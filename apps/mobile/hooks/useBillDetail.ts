import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Sentry from '@sentry/react-native';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation } from 'convex/react';
import type { Id } from '@convex/_generated/dataModel';

import { api } from '@convex/_generated/api';
import { computeUnassignedUnits } from '@/lib/billSplit';
import { resolveContactInfo, buildContactArgs } from '@/lib/contactResolver';
import { useT } from '@/lib/i18n';
import { computeBase, computeTax, getTaxConfig, withTaxIncludedOverride, type ReceiptCategory } from '@/constants/taxes';
import { STATE_STYLES, STATE_LABEL_KEYS, getTaxLabel } from '@/lib/billHelpers';
import { useCustomAlert } from '@/components/ui/custom-alert';
import { usePhoneContacts } from '@/hooks/usePhoneContacts';
import type { SortStrategy } from '@/lib/types';

export function useBillDetail(id: string, userId: string | undefined) {
  const t = useT();
  const { alert } = useCustomAlert();

  // ── Queries ──
  const bill = useQuery(api.bills.get, userId ? { id: id as Id<'bills'> } : 'skip');
  const suggestedContacts = useQuery(api.contacts.suggested, userId ? {} : 'skip');
  const selfContact = useQuery(api.contacts.getSelf, userId ? {} : 'skip');

  // ── Mutations ──
  const updateBill = useMutation(api.bills.update);
  const removeContactMut = useMutation(api.bills.removeContactFromItem);
  const togglePaid = useMutation(api.bills.togglePaymentStatus);
  const removeBillMut = useMutation(api.bills.remove);
  const removeContactsBatch = useMutation(api.bills.removeContactsFromItems);
  const assignContactToItems = useMutation(api.bills.assignContactToItems);
  const updateContactUnitsMut = useMutation(api.bills.updateContactUnits);
  const assignEqualSplit = useMutation(api.bills.assignEqualSplit);
  const clearSplit = useMutation(api.bills.clearSplitAssignments);
  const updateContactGroupsMut = useMutation(api.bills.updateContactGroups);
  const toggleGroupPaidMut = useMutation(api.bills.toggleGroupPaymentStatus);

  // ── Phone contacts ──
  const { phoneContacts, ensurePermission, loadContacts } = usePhoneContacts();

  // ── Data-driven state ──
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [singleAssignItemId, setSingleAssignItemId] = useState<string | null>(null);
  const [numPeople, setNumPeople] = useState(() => bill?.numPeople ?? 2);
  const [equalSplitMode, setEqualSplitMode] = useState(() => bill?.splitStrategy === 'equal');

  const billRef = useRef(bill);
  useEffect(() => { billRef.current = bill; }, [bill]);
  const numPeopleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Derived ──
  const computeExcludePhones = useCallback((selectedItemIds: Set<string>) => {
    if (!bill) return undefined;
    const phones = new Set<string>();
    if (equalSplitMode) {
      for (const c of bill.contacts) { if (c.phone) phones.add(c.phone); }
    } else {
      const targetItemId = singleAssignItemId ?? (selectedItemIds.size === 1 ? Array.from(selectedItemIds)[0] : null);
      if (!targetItemId) return undefined;
      for (const c of bill.contacts) { if (c.items.some((ref) => ref.itemId === targetItemId) && c.phone) phones.add(c.phone); }
    }
    return phones.size > 0 ? phones : undefined;
  }, [singleAssignItemId, bill, equalSplitMode]);

  const computeExcludeSelf = useCallback((selectedItemIds: Set<string>) => {
    if (!bill) return false;
    if (equalSplitMode) return bill.contacts.some((c) => c.isSelf);
    const targetItemId = singleAssignItemId ?? (selectedItemIds.size === 1 ? Array.from(selectedItemIds)[0] : null);
    if (!targetItemId) return false;
    return bill.contacts.some((c) => c.isSelf && c.items.some((ref) => ref.itemId === targetItemId));
  }, [bill, equalSplitMode, singleAssignItemId]);

  const billDerived = useMemo(() => {
    if (!bill) return null;
    const itemsTotal = bill.items.reduce((runningTotal, billItem) => runningTotal + billItem.subtotal, 0);
    const billCountry = (bill.country as 'CO' | 'US') || 'CO';
    const billCategory = (bill.tags?.find((tag) => tag.isPlatform)?.slug || 'dining') as ReceiptCategory;
    const rawTaxConfig = getTaxConfig(billCountry, billCategory);
    const taxConfig = withTaxIncludedOverride(rawTaxConfig, bill.taxIncludedOverride ?? undefined);
    const translatedTaxLabel = getTaxLabel(taxConfig, t);
    const base = computeBase(itemsTotal, taxConfig);
    const computedTax = computeTax(itemsTotal, taxConfig);
    const tipPercent = bill.tipPercent ?? 0;
    const shouldUseCustomTip = bill.useCustomTip ?? false;
    const computedTip = shouldUseCustomTip ? (bill.tip ?? 0) : base * (tipPercent / 100);
    const beforeTip = base + computedTax;
    const total = base + computedTax + computedTip;
    const stateStyle = STATE_STYLES[bill.state];
    const stateLabel = t[STATE_LABEL_KEYS[bill.state]] as string;
    const decimalPlaces = bill.decimalPlaces;
    return { base, billCountry, taxConfig, translatedTaxLabel, computedTax, tipPercent, shouldUseCustomTip, computedTip, beforeTip, total, stateStyle, stateLabel, decimalPlaces };
  }, [bill, t]);

  const computeSortedItems = useCallback((sortStrategy: SortStrategy) => {
    if (!bill) return [];
    const items = [...bill.items];
    switch (sortStrategy) {
      case 'price-asc': return items.sort((a, b) => a.subtotal - b.subtotal);
      case 'price-desc': return items.sort((a, b) => b.subtotal - a.subtotal);
      case 'alpha-asc': return items.sort((a, b) => a.name.localeCompare(b.name));
      case 'alpha-desc': return items.sort((a, b) => b.name.localeCompare(a.name));
      default: return items;
    }
  }, [bill]);

  // ── Helpers ──
  const allSuggested = useMemo(() => [
    ...(suggestedContacts?.frequent ?? []),
    ...(suggestedContacts?.recent ?? []),
  ], [suggestedContacts]);

  // ── Item handlers ──
  const handleRemoveItem = useCallback((itemId: string) => {
    const currentBill = billRef.current;
    if (!currentBill || !userId) return;
    const remaining = currentBill.items.filter((billItem) => billItem.id !== itemId);
    return { remaining, update: () => updateBill({ id: id as Id<'bills'>, items: remaining }) };
  }, [id, updateBill, userId]);

  const handleSubmitEdit = useCallback((itemId: string, values: { name: string; quantity: number; unitPrice: number }) => {
    if (!bill || !userId) return;
    const items = bill.items.map((item) => {
      if (item.id !== itemId) return item;
      return { ...item, name: values.name, quantity: values.quantity, unitPrice: values.unitPrice, subtotal: values.quantity * values.unitPrice };
    });
    updateBill({ id: id as Id<'bills'>, items });
  }, [bill, id, updateBill, userId]);

  const handleUpdateName = useCallback((name: string) => {
    if (!userId) return;
    updateBill({ id: id as Id<'bills'>, name });
  }, [id, updateBill, userId]);

  const handleRemoveBill = useCallback(async () => {
    if (!userId) return;
    await removeBillMut({ id: id as Id<'bills'> });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [id, removeBillMut, userId]);

  const handleBulkDelete = useCallback((selectedItemIds: Set<string>) => {
    if (selectedItemIds.size === 0 || !bill || !userId) return;
    alert(t.bill_deleteItems, t.bill_deleteItemsConfirm(selectedItemIds.size), [
      { text: t.cancel, style: 'cancel' },
      { text: t.delete, style: 'destructive', onPress: () => {
        const remaining = bill.items.filter((billItem) => !selectedItemIds.has(billItem.id!));
        updateBill({ id: id as Id<'bills'>, items: remaining });
      }},
    ]);
  }, [bill, id, updateBill, t, userId, alert]);

  const handleAddItem = useCallback(async () => {
    if (!bill || !userId) return null;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { randomUUID } = await import('expo-crypto');
    const newItem = { id: randomUUID(), name: '', quantity: 1, unitPrice: 0, subtotal: 0 };
    try {
      await updateBill({ id: id as Id<'bills'>, items: [...bill.items, newItem] });
      return newItem.id;
    } catch {
      alert(t.error, t.error_mutationFailed);
      return null;
    }
  }, [bill, userId, id, updateBill, t, alert]);

  // ── Contact assignment handlers ──
  const handleMultiAssign = useCallback(async (selectedItemIds: Set<string>) => {
    if (selectedItemIds.size === 0) return false;
    const granted = await ensurePermission();
    if (!granted) return false;
    setSelectedContactIds(new Set());
    loadContacts();
    return true;
  }, [ensurePermission, loadContacts]);

  const handleConfirmContactPicker = useCallback(async (selectedItemIds: Set<string>) => {
    if (selectedContactIds.size === 0 || !bill || !userId) return false;
    const itemIds = singleAssignItemId !== null ? [singleAssignItemId] : Array.from(selectedItemIds);
    if (itemIds.length === 0) return false;

    try {
      for (const selectedId of selectedContactIds) {
        const contactInfo = resolveContactInfo(selectedId, bill.contacts, phoneContacts, allSuggested, selfContact, t.bill_persona);
        if (!contactInfo) continue;
        await assignContactToItems({ id: id as Id<'bills'>, itemIds, contact: contactInfo });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSingleAssignItemId(null);
      return true;
    } catch (err) {
      console.error('[Bill] assignContactToItems failed:', err);
      Sentry.captureException(err, { tags: { feature: 'bill_detail' } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, t.error_mutationFailed);
      return false;
    }
  }, [selectedContactIds, singleAssignItemId, allSuggested, bill, id, assignContactToItems, t, userId, alert, phoneContacts, selfContact]);

  const handleAssignContact = useCallback(async (itemId: string) => {
    const granted = await ensurePermission();
    if (!granted) return false;
    setSelectedContactIds(new Set());
    setSingleAssignItemId(itemId);
    loadContacts();
    return true;
  }, [ensurePermission, loadContacts]);

  const handleToggleContactSelection = useCallback((contactId: string) => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) next.delete(contactId); else next.add(contactId);
      return next;
    });
  }, []);

  const handleCloseContactPicker = useCallback(() => { setSingleAssignItemId(null); }, []);

  const handleRemoveContact = useCallback((itemId: string, contactId: Id<'contacts'>, onConfirm?: () => void) => {
    if (!userId) return;
    alert(t.bill_removeContact, t.bill_removeContactConfirm, [
      { text: t.cancel, style: 'cancel' },
      { text: t.remove, style: 'destructive', onPress: async () => {
        onConfirm?.();
        try {
          await removeContactMut({ id: id as Id<'bills'>, itemId, contactId });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err) {
          Sentry.captureException(err, { tags: { feature: 'bill_detail' } });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          alert(t.error, t.error_mutationFailed);
        }
      }},
    ]);
  }, [id, removeContactMut, t, userId, alert]);

  const handleBulkRemoveContact = useCallback((selectedItemIds: Set<string>) => {
    if (selectedItemIds.size === 0 || !bill || !userId) return;
    const selectedIds = Array.from(selectedItemIds);
    const contactsOnSelected = bill.contacts.filter((c) => c.items.some((ref) => selectedIds.includes(ref.itemId)));
    if (contactsOnSelected.length === 0) { alert(t.bill_noContacts, t.bill_noContactsOnItems); return; }
    if (contactsOnSelected.length === 1) {
      const contactToRemove = contactsOnSelected[0];
      alert(t.bill_removeContact, t.bill_removeFromSelected(contactToRemove.name), [
        { text: t.cancel, style: 'cancel' },
        { text: t.remove, style: 'destructive', onPress: async () => {
          try {
            await removeContactsBatch({ id: id as Id<'bills'>, itemIds: selectedIds, contactIds: [contactToRemove.contactId] });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (err) {
            Sentry.captureException(err, { tags: { feature: 'bill_detail' } });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            alert(t.error, t.error_mutationFailed);
          }
        }},
      ]);
      return 'single' as const;
    }
    setSelectedContactIds(new Set());
    return 'multiple' as const;
  }, [bill, id, removeContactsBatch, t, userId, alert]);

  const handleConfirmUnassign = useCallback(async (selectedItemIds: Set<string>) => {
    if (selectedContactIds.size === 0 || !bill || !userId) return false;
    try {
      await removeContactsBatch({ id: id as Id<'bills'>, itemIds: Array.from(selectedItemIds), contactIds: Array.from(selectedContactIds) as Id<'contacts'>[] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (err) {
      Sentry.captureException(err, { tags: { feature: 'bill_detail' } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, t.error_mutationFailed);
      return false;
    }
  }, [selectedContactIds, bill, id, removeContactsBatch, t, userId, alert]);

  const handleUpdateUnits = useCallback(async (units: number, target: { itemId: string; contactId: Id<'contacts'> }) => {
    if (!userId) return;
    try {
      await updateContactUnitsMut({ id: id as Id<'bills'>, itemId: target.itemId, contactId: target.contactId, units });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      Sentry.captureException(err, { tags: { feature: 'bill_detail' } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, t.error_mutationFailed);
    }
  }, [userId, id, updateContactUnitsMut, t, alert]);

  const handleTogglePaid = useCallback(async (contactId: Id<'contacts'>) => {
    if (!userId) return;
    try {
      await togglePaid({ id: id as Id<'bills'>, contactId });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      Sentry.captureException(err, { tags: { feature: 'bill_detail' } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, t.error_mutationFailed);
    }
  }, [id, togglePaid, t, userId, alert]);

  const handleUpdateGroups = useCallback(async (groups: { id: string; contactIds: Id<'contacts'>[]; name: string }[]) => {
    if (!userId) return;
    try {
      await updateContactGroupsMut({ id: id as Id<'bills'>, groups });
    } catch (err) {
      Sentry.captureException(err, { tags: { feature: 'bill_detail' } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, err instanceof Error ? err.message : t.error_mutationFailed);
    }
  }, [id, updateContactGroupsMut, userId, t, alert]);

  const handleToggleGroupPaid = useCallback(async (groupId: string) => {
    if (!userId) return;
    try {
      await toggleGroupPaidMut({ id: id as Id<'bills'>, groupId });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      Sentry.captureException(err, { tags: { feature: 'bill_detail' } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, t.error_mutationFailed);
    }
  }, [id, toggleGroupPaidMut, userId, t, alert]);

  // ── Equal split handlers ──
  const handleSplitEqually = useCallback(() => {
    if (!bill || !userId) return;
    if (bill.contacts.length === 0) { setEqualSplitMode(true); setNumPeople(bill.numPeople ?? 2); return; }
    alert(t.bill_equalSwitchTitle, t.bill_equalSwitchWarning, [
      { text: t.cancel, style: 'cancel' },
      { text: t.confirm, onPress: async () => {
        try { await clearSplit({ id: id as Id<'bills'> }); setEqualSplitMode(true); setNumPeople(2); }
        catch { alert(t.error, t.error_mutationFailed); }
      }},
    ]);
  }, [bill, id, userId, clearSplit, t, alert]);

  const handleSplitByItem = useCallback(() => {
    if (!bill || !userId) return;
    if (bill.contacts.length === 0) { setEqualSplitMode(false); return; }
    alert(t.bill_equalSwitchTitle, t.bill_equalSwitchWarning, [
      { text: t.cancel, style: 'cancel' },
      { text: t.confirm, onPress: async () => {
        try { await clearSplit({ id: id as Id<'bills'> }); setEqualSplitMode(false); }
        catch { alert(t.error, t.error_mutationFailed); }
      }},
    ]);
  }, [bill, id, userId, clearSplit, t, alert]);

  const handleEqualAssignContacts = useCallback(async () => {
    const granted = await ensurePermission();
    if (!granted) return false;
    setSelectedContactIds(new Set());
    setSingleAssignItemId(null);
    loadContacts();
    return true;
  }, [ensurePermission, loadContacts]);

  const handleRemoveEqualContact = useCallback(async (contactId: Id<'contacts'>, overrideNumPeople?: number) => {
    if (!bill || !userId) return;
    try {
      const remaining = bill.contacts.filter((c) => c.contactId !== contactId);
      await assignEqualSplit({ id: id as Id<'bills'>, numPeople: Math.max(2, overrideNumPeople ?? numPeople), contacts: buildContactArgs(remaining) });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch { alert(t.error, t.error_mutationFailed); }
  }, [bill, userId, id, numPeople, assignEqualSplit, t, alert]);

  const handleNumPeopleChange = useCallback((newCount: number) => {
    if (!bill || !userId) return;
    if (newCount < numPeople && bill.contacts.length > newCount) {
      const contactToRemove = bill.contacts[bill.contacts.length - 1];
      alert(t.bill_equalSwitchTitle, t.bill_removePersonConfirm(contactToRemove.name), [
        { text: t.cancel, style: 'cancel' },
        { text: t.remove, style: 'destructive', onPress: () => { setNumPeople(newCount); handleRemoveEqualContact(contactToRemove.contactId, newCount); }},
      ]);
      return;
    }
    setNumPeople(newCount);
    if (numPeopleDebounceRef.current) clearTimeout(numPeopleDebounceRef.current);
    numPeopleDebounceRef.current = setTimeout(() => {
      if (bill.contacts.length > 0) {
        assignEqualSplit({ id: id as Id<'bills'>, numPeople: newCount, contacts: buildContactArgs(bill.contacts) });
      } else {
        updateBill({ id: id as Id<'bills'>, numPeople: newCount });
      }
    }, 500);
  }, [bill, numPeople, t, alert, handleRemoveEqualContact, id, userId, updateBill, assignEqualSplit]);

  const handleConfirmEqualSplit = useCallback(async () => {
    if (!bill || !userId) return;
    try {
      await assignEqualSplit({ id: id as Id<'bills'>, numPeople, contacts: buildContactArgs(bill.contacts) });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Sentry.captureException(err, { tags: { feature: 'bill_detail' } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, t.error_mutationFailed);
    }
  }, [bill, id, userId, numPeople, assignEqualSplit, t, alert]);

  const handleConfirmEqualContactPicker = useCallback(async () => {
    if (selectedContactIds.size === 0 || !bill || !userId) return false;
    const contactArgs = buildContactArgs(bill.contacts);

    for (const selectedId of selectedContactIds) {
      const info = resolveContactInfo(selectedId, bill.contacts, phoneContacts, allSuggested, selfContact, t.bill_persona);
      if (!info) continue;
      if (info.isSelf && contactArgs.some((ca) => ca.isSelf)) continue;
      if (info.phone && contactArgs.some((ca) => ca.phone === info.phone)) continue;
      contactArgs.push(info);
    }

    try {
      await assignEqualSplit({ id: id as Id<'bills'>, numPeople, contacts: contactArgs });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (err) {
      Sentry.captureException(err, { tags: { feature: 'bill_detail' } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, t.error_mutationFailed);
      return false;
    }
  }, [selectedContactIds, bill, userId, allSuggested, selfContact, phoneContacts, id, numPeople, assignEqualSplit, t, alert]);

  // ── Bill settings handlers ──
  const handleToggleTaxIncluded = useCallback(() => {
    if (!bill || !userId || !billDerived) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateBill({ id: id as Id<'bills'>, taxIncludedOverride: !(bill.taxIncludedOverride ?? billDerived.taxConfig.taxIncluded) });
  }, [bill, userId, billDerived, id, updateBill]);

  const handleSelectTip = useCallback(async (pct: number, newTip: number) => {
    if (!userId) return;
    await updateBill({ id: id as Id<'bills'>, tipPercent: pct, tip: newTip, useCustomTip: false });
  }, [id, updateBill, userId]);

  const handleSelectCustomTip = useCallback((tip: number) => {
    if (!userId) return;
    updateBill({ id: id as Id<'bills'>, tip, useCustomTip: true });
  }, [id, updateBill, userId]);

  const handleToggleCustomTip = useCallback((enabled: boolean) => {
    if (!userId || !billDerived) return;
    if (enabled) { updateBill({ id: id as Id<'bills'>, useCustomTip: true }); return; }
    updateBill({ id: id as Id<'bills'>, tip: billDerived.base * (billDerived.tipPercent / 100), useCustomTip: false });
  }, [id, updateBill, userId, billDerived]);

  const handleSelectCountry = useCallback(async (code: string) => {
    if (!userId) return;
    await updateBill({ id: id as Id<'bills'>, country: code });
  }, [id, updateBill, userId]);

  // ── Progress ──
  const totalContacts = bill?.contacts.length ?? 0;
  const paidContactCount = bill?.contacts.filter((c) => c.paid).length ?? 0;
  const paidPercent = totalContacts > 0 ? (paidContactCount / totalContacts) * 100 : 0;
  const unpaidPercent = totalContacts > 0 ? ((totalContacts - paidContactCount) / totalContacts) * 100 : 0;

  const unassignedUnits = useMemo(() => {
    if (!bill || equalSplitMode) return 0;
    return computeUnassignedUnits(bill.items, bill.contacts);
  }, [bill, equalSplitMode]);

  return {
    bill, billDerived, suggestedContacts, selfContact, phoneContacts, selectedContactIds,
    singleAssignItemId, numPeople, equalSplitMode, totalContacts, paidContactCount,
    paidPercent, unpaidPercent, unassignedUnits,
    computeExcludePhones, computeExcludeSelf, computeSortedItems,
    handleRemoveItem, handleSubmitEdit, handleUpdateName, handleRemoveBill,
    handleMultiAssign, handleConfirmContactPicker, handleBulkDelete, handleAddItem,
    handleBulkRemoveContact, handleConfirmUnassign, handleAssignContact,
    handleToggleContactSelection, handleCloseContactPicker, handleRemoveContact,
    handleUpdateUnits, handleTogglePaid, handleUpdateGroups, handleToggleGroupPaid,
    handleSplitEqually, handleSplitByItem, handleEqualAssignContacts,
    handleRemoveEqualContact, handleNumPeopleChange, handleConfirmEqualSplit,
    handleConfirmEqualContactPicker, handleToggleTaxIncluded, handleSelectTip,
    handleSelectCustomTip, handleToggleCustomTip, handleSelectCountry,
  };
}
