import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Sentry from '@sentry/react-native';
import * as Contacts from 'expo-contacts';
import * as Haptics from 'expo-haptics';
import { randomUUID } from 'expo-crypto';
import { useQuery, useMutation } from 'convex/react';
import type { Id } from '@convex/_generated/dataModel';

import { api } from '@convex/_generated/api';
import { useT } from '@/lib/i18n';
import { computeBase, computeTax, getTaxConfig, withTaxIncludedOverride, type ReceiptCategory } from '@/constants/taxes';
import { STATE_STYLES, STATE_LABEL_KEYS, getTaxLabel } from '@/lib/billHelpers';
import { useCustomAlert } from '@/components/ui/custom-alert';
import { SUGGESTED_PREFIX, SELF_PREFIX, ANON_PREFIX } from '@/components/bills/ContactPickerSheet';

const CONTACTS_CACHE_TTL = 5 * 60_000; // 5 minutes

type SortStrategy = 'original' | 'price-asc' | 'price-desc' | 'alpha-asc' | 'alpha-desc';

export function useBillDetail(id: string, userId: string | undefined) {
  const t = useT();
  const { alert } = useCustomAlert();

  // ── Queries ──
  const bill = useQuery(api.bills.get, userId ? { id: id as Id<'bills'>, userId } : 'skip');
  const suggestedContacts = useQuery(api.contacts.suggested, userId ? { userId } : 'skip');
  const selfContact = useQuery(api.contacts.getSelf, userId ? { userId } : 'skip');

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

  // ── Data-driven state ──
  const [phoneContacts, setPhoneContacts] = useState<(Contacts.Contact & { id: string })[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [singleAssignItemId, setSingleAssignItemId] = useState<string | null>(null);
  const [numPeople, setNumPeople] = useState(() => bill?.numPeople ?? 2);
  const [equalSplitMode, setEqualSplitMode] = useState(() => bill?.splitStrategy === 'equal');

  // ── Refs ──
  const billRef = useRef(bill);
  useEffect(() => { billRef.current = bill; }, [bill]);

  const contactsCacheRef = useRef<{ data: (Contacts.Contact & { id: string })[]; fetchedAt: number } | null>(null);
  const contactsPermissionRef = useRef(false);
  const numPeopleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Derived: exclude logic for contact picker ──
  const computeExcludePhones = useCallback((selectedItemIds: Set<string>) => {
    if (!bill) return undefined;
    const phones = new Set<string>();

    if (equalSplitMode) {
      for (const c of bill.contacts) {
        if (c.phone) phones.add(c.phone);
      }
    } else {
      const targetItemId = singleAssignItemId ?? (selectedItemIds.size === 1 ? Array.from(selectedItemIds)[0] : null);
      if (!targetItemId) return undefined;
      for (const c of bill.contacts) {
        if (c.items.some((i) => i.itemId === targetItemId) && c.phone) phones.add(c.phone);
      }
    }

    return phones.size > 0 ? phones : undefined;
  }, [singleAssignItemId, bill, equalSplitMode]);

  const computeExcludeSelf = useCallback((selectedItemIds: Set<string>) => {
    if (!bill) return false;
    if (equalSplitMode) {
      return bill.contacts.some((c) => c.isSelf);
    }
    const targetItemId = singleAssignItemId ?? (selectedItemIds.size === 1 ? Array.from(selectedItemIds)[0] : null);
    if (!targetItemId) return false;
    return bill.contacts.some((c) => c.isSelf && c.items.some((i) => i.itemId === targetItemId));
  }, [bill, equalSplitMode, singleAssignItemId]);

  // ── Derived: bill computations ──
  const billDerived = useMemo(() => {
    if (!bill) return null;
    const itemsTotal = bill.items.reduce((sum, billItem) => sum + billItem.subtotal, 0);
    const billCountry = (bill.country as 'CO' | 'US') || 'CO';
    const billCategory = (bill.tags?.find((tag) => tag.isPlatform)?.slug || 'dining') as ReceiptCategory;
    const rawTaxConfig = getTaxConfig(billCountry, billCategory);
    const taxConfig = withTaxIncludedOverride(rawTaxConfig, bill.taxIncludedOverride ?? undefined);
    const translatedTaxLabel = getTaxLabel(taxConfig, t);
    const base = computeBase(itemsTotal, taxConfig);
    const computedTax = computeTax(itemsTotal, taxConfig);
    const tipPercent = bill.tipPercent ?? 0;
    const useCustomTip = bill.useCustomTip ?? false;
    const computedTip = useCustomTip ? (bill.tip ?? 0) : base * (tipPercent / 100);
    const beforeTip = base + computedTax;
    const total = base + computedTax + computedTip;
    const stateStyle = STATE_STYLES[bill.state];
    const stateLabel = t[STATE_LABEL_KEYS[bill.state]] as string;
    const decimalPlaces = bill.decimalPlaces;
    return { base, billCountry, taxConfig, translatedTaxLabel, computedTax, tipPercent, useCustomTip, computedTip, beforeTip, total, stateStyle, stateLabel, decimalPlaces };
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

  // ── Contact loading ──
  const ensureContactPermission = useCallback(async (): Promise<boolean> => {
    if (contactsPermissionRef.current) return true;
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      alert(t.bill_permissionNeeded, t.bill_permissionContacts);
      return false;
    }
    contactsPermissionRef.current = true;
    return true;
  }, [t, alert]);

  const loadContacts = useCallback(() => {
    const cache = contactsCacheRef.current;
    if (cache && Date.now() - cache.fetchedAt < CONTACTS_CACHE_TTL) {
      setPhoneContacts(cache.data);
      return;
    }

    Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      sort: Contacts.SortTypes.FirstName,
    }).then(({ data }) => {
      const filtered = data.filter((c): c is typeof c & { id: string } => !!c.id);
      setPhoneContacts(filtered);
      contactsCacheRef.current = { data: filtered, fetchedAt: Date.now() };

      Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name, Contacts.Fields.Image],
        sort: Contacts.SortTypes.FirstName,
      }).then(({ data: withImages }) => {
        const enriched = withImages.filter((c): c is typeof c & { id: string } => !!c.id);
        setPhoneContacts(enriched);
        contactsCacheRef.current = { data: enriched, fetchedAt: Date.now() };
      });
    });
  }, []);

  // ── Callbacks ──

  const handleRemoveItem = useCallback((itemId: string) => {
    const currentBill = billRef.current;
    if (!currentBill || !userId) return;
    const remaining = currentBill.items.filter((billItem) => billItem.id !== itemId);
    return { remaining, update: () => updateBill({ id: id as Id<'bills'>, userId, items: remaining }) };
  }, [id, updateBill, userId]);

  const handleSubmitEdit = useCallback((itemId: string, values: { name: string; quantity: number; unitPrice: number }) => {
    if (!bill || !userId) return;
    const items = bill.items.map((item) => {
      if (item.id !== itemId) return item;
      return { ...item, name: values.name, quantity: values.quantity, unitPrice: values.unitPrice, subtotal: values.quantity * values.unitPrice };
    });
    updateBill({ id: id as Id<'bills'>, userId, items });
  }, [bill, id, updateBill, userId]);

  const handleUpdateName = useCallback((name: string) => {
    if (!userId) return;
    updateBill({ id: id as Id<'bills'>, userId, name });
  }, [id, updateBill, userId]);

  const handleRemoveBill = useCallback(async () => {
    if (!userId) return;
    await removeBillMut({ id: id as Id<'bills'>, userId });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [id, removeBillMut, userId]);

  const handleMultiAssign = useCallback(async (selectedItemIds: Set<string>) => {
    if (selectedItemIds.size === 0) return false;
    const granted = await ensureContactPermission();
    if (!granted) return false;
    setSelectedContactIds(new Set());
    loadContacts();
    return true;
  }, [ensureContactPermission, loadContacts]);

  const handleConfirmContactPicker = useCallback(async (selectedItemIds: Set<string>) => {
    if (selectedContactIds.size === 0 || !bill || !userId) return false;
    let itemIds: string[];
    if (singleAssignItemId !== null) {
      itemIds = [singleAssignItemId];
    } else {
      itemIds = Array.from(selectedItemIds);
    }
    if (itemIds.length === 0) return false;

    const allSuggested = [
      ...(suggestedContacts?.frequent ?? []),
      ...(suggestedContacts?.recent ?? []),
    ];

    try {
      for (const selectedId of selectedContactIds) {
        let name: string;
        let phone: string | undefined;
        let imageUri: string | undefined;
        let isSelf: boolean | undefined;

        if (selectedId.startsWith(ANON_PREFIX)) {
          const anonNum = parseInt(selectedId.slice(ANON_PREFIX.length), 10);
          const existingAnonCount = bill.contacts.filter((c) => !c.phone && !c.isSelf).length;
          name = t.bill_persona(existingAnonCount + anonNum);
        } else if (selectedId.startsWith(SELF_PREFIX)) {
          if (!selfContact) continue;
          name = selfContact.name;
          imageUri = selfContact.imageUri;
          isSelf = true;
        } else if (selectedId.startsWith(SUGGESTED_PREFIX)) {
          const convexId = selectedId.slice(SUGGESTED_PREFIX.length);
          const sc = allSuggested.find((c) => c._id === convexId);
          if (!sc) continue;
          name = sc.name;
          phone = sc.phone;
          imageUri = sc.imageUri;
        } else {
          const contact = phoneContacts.find((c) => c.id === selectedId);
          if (!contact) continue;
          phone = contact.phoneNumbers?.[0]?.number ?? '';
          name = `${contact.firstName ?? ''}${contact.lastName ? ` ${contact.lastName}` : ''}`.trim() || 'Unknown';
          imageUri = contact.image?.uri;
        }

        await assignContactToItems({
          id: id as Id<'bills'>,
          userId,
          itemIds,
          contact: { name, phone, isSelf, imageUri },
        });
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
  }, [selectedContactIds, singleAssignItemId, phoneContacts, suggestedContacts, selfContact, bill, id, assignContactToItems, t, userId, alert]);

  const handleBulkDelete = useCallback((selectedItemIds: Set<string>) => {
    if (selectedItemIds.size === 0 || !bill || !userId) return;
    alert(
      t.bill_deleteItems,
      t.bill_deleteItemsConfirm(selectedItemIds.size),
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.delete,
          style: 'destructive',
          onPress: () => {
            const remaining = bill.items.filter((billItem) => !selectedItemIds.has(billItem.id!));
            updateBill({ id: id as Id<'bills'>, userId, items: remaining });
          },
        },
      ]
    );
  }, [bill, id, updateBill, t, userId, alert]);

  const handleAddItem = useCallback(async () => {
    if (!bill || !userId) return null;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newItem = { id: randomUUID(), name: '', quantity: 1, unitPrice: 0, subtotal: 0 };
    try {
      await updateBill({ id: id as Id<'bills'>, userId, items: [...bill.items, newItem] });
      return newItem.id;
    } catch {
      alert(t.error, t.error_mutationFailed);
      return null;
    }
  }, [bill, userId, id, updateBill, t, alert]);

  const handleBulkRemoveContact = useCallback((selectedItemIds: Set<string>) => {
    if (selectedItemIds.size === 0 || !bill || !userId) return;
    const selectedIds = Array.from(selectedItemIds);
    const contactsOnSelected = bill.contacts.filter((c) => c.items.some((ref) => selectedIds.includes(ref.itemId)));
    if (contactsOnSelected.length === 0) {
      alert(t.bill_noContacts, t.bill_noContactsOnItems);
      return;
    }
    if (contactsOnSelected.length === 1) {
      const c = contactsOnSelected[0];
      alert(t.bill_removeContact, t.bill_removeFromSelected(c.name), [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.remove,
          style: 'destructive',
          onPress: async () => {
            try {
              await removeContactsBatch({
                id: id as Id<'bills'>, userId,
                itemIds: selectedIds.filter((itemId): itemId is string => !!itemId),
                contactIds: [c.contactId],
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (err) {
              console.error('[Bill] removeContactsBatch failed:', err);
              Sentry.captureException(err, { tags: { feature: 'bill_detail' } });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              alert(t.error, t.error_mutationFailed);
            }
          },
        },
      ]);
      return 'single' as const;
    } else {
      setSelectedContactIds(new Set());
      return 'multiple' as const;
    }
  }, [bill, id, removeContactsBatch, t, userId, alert]);

  const handleConfirmUnassign = useCallback(async (selectedItemIds: Set<string>) => {
    if (selectedContactIds.size === 0 || !bill || !userId) return false;
    try {
      await removeContactsBatch({
        id: id as Id<'bills'>, userId,
        itemIds: Array.from(selectedItemIds),
        contactIds: Array.from(selectedContactIds) as Id<'contacts'>[],
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (err) {
      console.error('[Bill] removeContactsBatch failed:', err);
      Sentry.captureException(err, { tags: { feature: 'bill_detail' } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, t.error_mutationFailed);
      return false;
    }
  }, [selectedContactIds, bill, id, removeContactsBatch, t, userId, alert]);

  const handleAssignContact = useCallback(async (itemId: string) => {
    const granted = await ensureContactPermission();
    if (!granted) return false;
    setSelectedContactIds(new Set());
    setSingleAssignItemId(itemId);
    loadContacts();
    return true;
  }, [ensureContactPermission, loadContacts]);

  const handleToggleContactSelection = useCallback((contactId: string) => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  }, []);

  const handleCloseContactPicker = useCallback(() => {
    setSingleAssignItemId(null);
  }, []);

  const handleRemoveContact = useCallback((itemId: string, contactId: Id<'contacts'>, onConfirm?: () => void) => {
    if (!userId) return;
    alert(t.bill_removeContact, t.bill_removeContactConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.remove,
        style: 'destructive',
        onPress: async () => {
          onConfirm?.();
          try {
            await removeContactMut({ id: id as Id<'bills'>, userId: userId!, itemId, contactId });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (err) {
            console.error('[Bill] removeContact failed:', err);
            Sentry.captureException(err, { tags: { feature: 'bill_detail' } });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            alert(t.error, t.error_mutationFailed);
          }
        },
      },
    ]);
  }, [id, removeContactMut, t, userId, alert]);

  const handleUpdateUnits = useCallback(async (units: number, target: { itemId: string; contactId: Id<'contacts'> }) => {
    if (!userId) return;
    try {
      await updateContactUnitsMut({
        id: id as Id<'bills'>,
        userId,
        itemId: target.itemId,
        contactId: target.contactId,
        units,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      console.error('[Bill] updateContactUnits failed:', err);
      Sentry.captureException(err, { tags: { feature: 'bill_detail' } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, t.error_mutationFailed);
    }
  }, [userId, id, updateContactUnitsMut, t, alert]);

  const handleTogglePaid = useCallback(async (contactId: Id<'contacts'>) => {
    if (!userId) return;
    try {
      await togglePaid({ id: id as Id<'bills'>, userId: userId!, contactId });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      console.error('[Bill] togglePaid failed:', err);
      Sentry.captureException(err, { tags: { feature: 'bill_detail' } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, t.error_mutationFailed);
    }
  }, [id, togglePaid, t, userId, alert]);

  const handleUpdateGroups = useCallback(async (groups: { id: string; contactIds: string[]; name: string }[]) => {
    if (!userId) return;
    try {
      await updateContactGroupsMut({ id: id as Id<'bills'>, userId, groups: groups as any });
    } catch (err) {
      console.error('[Bill] updateContactGroups failed:', err);
      Sentry.captureException(err, { tags: { feature: 'bill_detail' } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, err instanceof Error ? err.message : t.error_mutationFailed);
    }
  }, [id, updateContactGroupsMut, userId, t, alert]);

  const handleToggleGroupPaid = useCallback(async (groupId: string) => {
    if (!userId) return;
    try {
      await toggleGroupPaidMut({ id: id as Id<'bills'>, userId, groupId });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      console.error('[Bill] toggleGroupPaid failed:', err);
      Sentry.captureException(err, { tags: { feature: 'bill_detail' } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, t.error_mutationFailed);
    }
  }, [id, toggleGroupPaidMut, userId, t, alert]);

  const handleSplitEqually = useCallback(() => {
    if (!bill || !userId) return;
    if (bill.contacts.length > 0) {
      alert(t.bill_equalSwitchTitle, t.bill_equalSwitchWarning, [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.confirm,
          onPress: async () => {
            try {
              await clearSplit({ id: id as Id<'bills'>, userId });
              setEqualSplitMode(true);
              setNumPeople(2);
            } catch {
              alert(t.error, t.error_mutationFailed);
            }
          },
        },
      ]);
    } else {
      setEqualSplitMode(true);
      setNumPeople(bill.numPeople ?? 2);
    }
  }, [bill, id, userId, clearSplit, t, alert]);

  const handleSplitByItem = useCallback(() => {
    if (!bill || !userId) return;
    if (bill.contacts.length > 0) {
      alert(t.bill_equalSwitchTitle, t.bill_equalSwitchWarning, [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.confirm,
          onPress: async () => {
            try {
              await clearSplit({ id: id as Id<'bills'>, userId });
              setEqualSplitMode(false);
            } catch {
              alert(t.error, t.error_mutationFailed);
            }
          },
        },
      ]);
    } else {
      setEqualSplitMode(false);
    }
  }, [bill, id, userId, clearSplit, t, alert]);

  const handleEqualAssignContacts = useCallback(async () => {
    const granted = await ensureContactPermission();
    if (!granted) return false;
    setSelectedContactIds(new Set());
    setSingleAssignItemId(null);
    loadContacts();
    return true;
  }, [ensureContactPermission, loadContacts]);

  const handleRemoveEqualContact = useCallback(async (contactId: Id<'contacts'>, overrideNumPeople?: number) => {
    if (!bill || !userId) return;
    try {
      const remaining = bill.contacts.filter((c) => c.contactId !== contactId);
      await assignEqualSplit({
        id: id as Id<'bills'>,
        userId,
        numPeople: Math.max(2, overrideNumPeople ?? numPeople),
        contacts: remaining.map((c) => ({ name: c.name, phone: c.phone, isSelf: c.isSelf || undefined, imageUri: c.imageUri })),
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      alert(t.error, t.error_mutationFailed);
    }
  }, [bill, userId, id, numPeople, assignEqualSplit, t, alert]);

  const handleNumPeopleChange = useCallback((n: number) => {
    if (!bill || !userId) return;
    if (n < numPeople && bill.contacts.length > n) {
      const contactToRemove = bill.contacts[bill.contacts.length - 1];
      alert(
        t.bill_equalSwitchTitle,
        t.bill_removePersonConfirm(contactToRemove.name),
        [
          { text: t.cancel, style: 'cancel' },
          {
            text: t.remove,
            style: 'destructive',
            onPress: () => {
              setNumPeople(n);
              handleRemoveEqualContact(contactToRemove.contactId, n);
            },
          },
        ],
      );
      return;
    }
    setNumPeople(n);
    if (numPeopleDebounceRef.current) clearTimeout(numPeopleDebounceRef.current);
    numPeopleDebounceRef.current = setTimeout(() => {
      if (bill.contacts.length > 0) {
        const contactArgs = bill.contacts.map((c) => ({
          name: c.name,
          phone: c.phone,
          isSelf: c.isSelf || undefined,
          imageUri: c.imageUri,
        }));
        assignEqualSplit({ id: id as Id<'bills'>, userId, numPeople: n, contacts: contactArgs });
      } else {
        updateBill({ id: id as Id<'bills'>, userId, numPeople: n });
      }
    }, 500);
  }, [bill, numPeople, t, alert, handleRemoveEqualContact, id, userId, updateBill, assignEqualSplit]);

  const handleConfirmEqualSplit = useCallback(async () => {
    if (!bill || !userId) return;
    const contactArgs = bill.contacts.map((c) => ({
      name: c.name,
      phone: c.phone,
      isSelf: c.isSelf || undefined,
      imageUri: c.imageUri,
    }));
    try {
      await assignEqualSplit({
        id: id as Id<'bills'>,
        userId,
        numPeople,
        contacts: contactArgs,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('[Bill] assignEqualSplit failed:', err);
      Sentry.captureException(err, { tags: { feature: 'bill_detail' } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, t.error_mutationFailed);
    }
  }, [bill, id, userId, numPeople, assignEqualSplit, t, alert]);

  const handleConfirmEqualContactPicker = useCallback(async () => {
    if (selectedContactIds.size === 0 || !bill || !userId) return false;
    const allSuggested = [
      ...(suggestedContacts?.frequent ?? []),
      ...(suggestedContacts?.recent ?? []),
    ];

    const contactArgs: { name: string; phone?: string; isSelf?: boolean; imageUri?: string }[] = [];

    for (const c of bill.contacts) {
      contactArgs.push({ name: c.name, phone: c.phone, isSelf: c.isSelf || undefined, imageUri: c.imageUri });
    }

    for (const selectedId of selectedContactIds) {
      if (selectedId.startsWith(SELF_PREFIX)) {
        if (!selfContact || contactArgs.some((ca) => ca.isSelf)) continue;
        contactArgs.push({ name: selfContact.name, isSelf: true, imageUri: selfContact.imageUri });
      } else if (selectedId.startsWith(SUGGESTED_PREFIX)) {
        const convexId = selectedId.slice(SUGGESTED_PREFIX.length);
        const sc = allSuggested.find((c) => c._id === convexId);
        if (!sc) continue;
        if (contactArgs.some((ca) => ca.phone === sc.phone)) continue;
        contactArgs.push({ name: sc.name, phone: sc.phone, imageUri: sc.imageUri });
      } else {
        const contact = phoneContacts.find((c) => c.id === selectedId);
        if (!contact) continue;
        const phone = contact.phoneNumbers?.[0]?.number ?? '';
        const name = `${contact.firstName ?? ''}${contact.lastName ? ` ${contact.lastName}` : ''}`.trim() || 'Unknown';
        if (contactArgs.some((ca) => ca.phone === phone)) continue;
        contactArgs.push({ name, phone, imageUri: contact.image?.uri });
      }
    }

    try {
      await assignEqualSplit({
        id: id as Id<'bills'>,
        userId,
        numPeople,
        contacts: contactArgs,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (err) {
      console.error('[Bill] assignEqualSplit failed:', err);
      Sentry.captureException(err, { tags: { feature: 'bill_detail' } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, t.error_mutationFailed);
      return false;
    }
  }, [selectedContactIds, bill, userId, suggestedContacts, selfContact, phoneContacts, id, numPeople, assignEqualSplit, t, alert]);

  const handleToggleTaxIncluded = useCallback(() => {
    if (!bill || !userId || !billDerived) return;
    const current = bill.taxIncludedOverride ?? billDerived.taxConfig.taxIncluded;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateBill({ id: id as Id<'bills'>, userId, taxIncludedOverride: !current });
  }, [bill, userId, billDerived, id, updateBill]);

  const handleSelectTip = useCallback(async (pct: number, newTip: number) => {
    if (!userId) return;
    await updateBill({ id: id as Id<'bills'>, userId, tipPercent: pct, tip: newTip, useCustomTip: false });
  }, [id, updateBill, userId]);

  const handleSelectCustomTip = useCallback((tip: number) => {
    if (!userId) return;
    updateBill({ id: id as Id<'bills'>, userId, tip, useCustomTip: true });
  }, [id, updateBill, userId]);

  const handleToggleCustomTip = useCallback((enabled: boolean) => {
    if (!userId || !billDerived) return;
    if (enabled) {
      updateBill({ id: id as Id<'bills'>, userId, useCustomTip: true });
    } else {
      const newTip = billDerived.base * (billDerived.tipPercent / 100);
      updateBill({ id: id as Id<'bills'>, userId, tip: newTip, useCustomTip: false });
    }
  }, [id, updateBill, userId, billDerived]);

  const handleSelectCountry = useCallback(async (code: string) => {
    if (!userId) return;
    await updateBill({ id: id as Id<'bills'>, userId, country: code });
  }, [id, updateBill, userId]);

  // ── Progress bar ──
  const totalContacts = bill?.contacts.length ?? 0;
  const paidContactCount = bill?.contacts.filter((c) => c.paid).length ?? 0;
  const paidPercent = totalContacts > 0 ? (paidContactCount / totalContacts) * 100 : 0;
  const unpaidPercent = totalContacts > 0 ? ((totalContacts - paidContactCount) / totalContacts) * 100 : 0;

  return {
    // Data
    bill,
    billDerived,
    suggestedContacts,
    selfContact,
    phoneContacts,
    selectedContactIds,
    singleAssignItemId,
    numPeople,
    equalSplitMode,
    totalContacts,
    paidContactCount,
    paidPercent,
    unpaidPercent,

    // Derived computations
    computeExcludePhones,
    computeExcludeSelf,
    computeSortedItems,

    // Callbacks — mutations
    handleRemoveItem,
    handleSubmitEdit,
    handleUpdateName,
    handleRemoveBill,
    handleMultiAssign,
    handleConfirmContactPicker,
    handleBulkDelete,
    handleAddItem,
    handleBulkRemoveContact,
    handleConfirmUnassign,
    handleAssignContact,
    handleToggleContactSelection,
    handleCloseContactPicker,
    handleRemoveContact,
    handleUpdateUnits,
    handleTogglePaid,
    handleUpdateGroups,
    handleToggleGroupPaid,
    handleSplitEqually,
    handleSplitByItem,
    handleEqualAssignContacts,
    handleRemoveEqualContact,
    handleNumPeopleChange,
    handleConfirmEqualSplit,
    handleConfirmEqualContactPicker,
    handleToggleTaxIncluded,
    handleSelectTip,
    handleSelectCustomTip,
    handleToggleCustomTip,
    handleSelectCountry,
  };
}
