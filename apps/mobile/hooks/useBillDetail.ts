import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Sentry from '@sentry/react-native';
import { Contact, ContactField, ContactsSortOrder, requestPermissionsAsync, type PartialContactDetails } from 'expo-contacts';
import * as Haptics from 'expo-haptics';
import { randomUUID } from 'expo-crypto';
import { useQuery, useMutation } from 'convex/react';
import type { Id } from '@convex/_generated/dataModel';

import { api } from '@convex/_generated/api';
import { computeUnassignedUnits } from '@/lib/billSplit';
import { useT } from '@/lib/i18n';
import { computeBase, computeTax, getTaxConfig, withTaxIncludedOverride, type ReceiptCategory } from '@/constants/taxes';
import { STATE_STYLES, STATE_LABEL_KEYS, getTaxLabel } from '@/lib/billHelpers';
import { useCustomAlert } from '@/components/ui/custom-alert';
import { SUGGESTED_PREFIX, SELF_PREFIX, ANON_PREFIX } from '@/components/bills/ContactPickerSheet';

const CONTACTS_CACHE_TTL = 5 * 60_000; // 5 minutes

type SortStrategy = 'original' | 'price-asc' | 'price-desc' | 'alpha-asc' | 'alpha-desc';

const CONTACT_FIELDS = [ContactField.PHONES, ContactField.GIVEN_NAME, ContactField.FAMILY_NAME, ContactField.IMAGE] as const;
type PhoneContactDetails = PartialContactDetails<typeof CONTACT_FIELDS> & { id: string };

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

  // ── Data-driven state ──
  const [phoneContacts, setPhoneContacts] = useState<PhoneContactDetails[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [singleAssignItemId, setSingleAssignItemId] = useState<string | null>(null);
  const [numPeople, setNumPeople] = useState(() => bill?.numPeople ?? 2);
  const [equalSplitMode, setEqualSplitMode] = useState(() => bill?.splitStrategy === 'equal');

  // ── Refs ──
  const billRef = useRef(bill);
  useEffect(() => { billRef.current = bill; }, [bill]);

  const contactsCacheRef = useRef<{ data: PhoneContactDetails[]; fetchedAt: number } | null>(null);
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
        if (c.items.some((ref) => ref.itemId === targetItemId) && c.phone) phones.add(c.phone);
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
    return bill.contacts.some((c) => c.isSelf && c.items.some((ref) => ref.itemId === targetItemId));
  }, [bill, equalSplitMode, singleAssignItemId]);

  // ── Derived: bill computations ──
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

  // ── Contact loading ──
  const ensureContactPermission = useCallback(async (): Promise<boolean> => {
    if (contactsPermissionRef.current) return true;
    const { status } = await requestPermissionsAsync();
    if (status !== 'granted') {
      alert(t.bill_permissionNeeded, t.bill_permissionContacts);
      return false;
    }
    contactsPermissionRef.current = true;
    return true;
  }, [t, alert]);

  const loadContacts = useCallback(async () => {
    const cache = contactsCacheRef.current;
    if (cache && Date.now() - cache.fetchedAt < CONTACTS_CACHE_TTL) {
      setPhoneContacts(cache.data);
      return;
    }

    const quickFields = [ContactField.PHONES, ContactField.GIVEN_NAME, ContactField.FAMILY_NAME] as const;
    const quickData = await Contact.getAllDetails(quickFields, { sortOrder: ContactsSortOrder.GivenName });
    const filtered = quickData.map((c) => ({ ...c, id: c.id! })).filter((c) => !!c.id) as PhoneContactDetails[];
    setPhoneContacts(filtered);
    contactsCacheRef.current = { data: filtered, fetchedAt: Date.now() };

    const fullData = await Contact.getAllDetails(CONTACT_FIELDS, { sortOrder: ContactsSortOrder.GivenName });
    const enriched = fullData.map((c) => ({ ...c, id: c.id! })).filter((c) => !!c.id) as PhoneContactDetails[];
    setPhoneContacts(enriched);
    contactsCacheRef.current = { data: enriched, fetchedAt: Date.now() };
  }, []);

  // ── Callbacks ──

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

  const handleMultiAssign = useCallback(async (selectedItemIds: Set<string>) => {
    if (selectedItemIds.size === 0) return false;
    const granted = await ensureContactPermission();
    if (!granted) return false;
    setSelectedContactIds(new Set());
    loadContacts();
    return true;
  }, [ensureContactPermission, loadContacts]);

  const resolveContactInfo = useCallback((
    selectedId: string,
    bill: NonNullable<typeof billRef.current>,
    allSuggested: { _id: string; name: string; phone?: string; imageUri?: string }[],
  ): { name: string; phone?: string; imageUri?: string; isSelf?: boolean } | null => {
    if (selectedId.startsWith(ANON_PREFIX)) {
      const anonNum = parseInt(selectedId.slice(ANON_PREFIX.length), 10);
      const existingAnonCount = bill.contacts.filter((c) => !c.phone && !c.isSelf).length;
      return { name: t.bill_persona(existingAnonCount + anonNum) };
    }

    if (selectedId.startsWith(SELF_PREFIX)) {
      if (!selfContact) return null;
      return { name: selfContact.name, imageUri: selfContact.imageUri, isSelf: true };
    }

    if (selectedId.startsWith(SUGGESTED_PREFIX)) {
      const convexId = selectedId.slice(SUGGESTED_PREFIX.length);
      const suggested = allSuggested.find((c) => c._id === convexId);
      if (!suggested) return null;
      return { name: suggested.name, phone: suggested.phone, imageUri: suggested.imageUri };
    }

    const contact = phoneContacts.find((c) => c.id === selectedId);
    if (!contact) return null;
    const phone = contact.phones?.[0]?.number ?? '';
    const name = `${contact.givenName ?? ''}${contact.familyName ? ` ${contact.familyName}` : ''}`.trim() || 'Unknown';
    return { name, phone, imageUri: contact.image ?? undefined };
  }, [phoneContacts, selfContact, t]);

  const handleConfirmContactPicker = useCallback(async (selectedItemIds: Set<string>) => {
    if (selectedContactIds.size === 0 || !bill || !userId) return false;
    const itemIds = singleAssignItemId !== null ? [singleAssignItemId] : Array.from(selectedItemIds);
    if (itemIds.length === 0) return false;

    const allSuggested = [
      ...(suggestedContacts?.frequent ?? []),
      ...(suggestedContacts?.recent ?? []),
    ];

    try {
      for (const selectedId of selectedContactIds) {
        const contactInfo = resolveContactInfo(selectedId, bill, allSuggested);
        if (!contactInfo) continue;

        await assignContactToItems({
          id: id as Id<'bills'>,
          itemIds,
          contact: contactInfo,
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
  }, [selectedContactIds, singleAssignItemId, suggestedContacts, bill, id, assignContactToItems, t, userId, alert, resolveContactInfo]);

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
            updateBill({ id: id as Id<'bills'>, items: remaining });
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
      await updateBill({ id: id as Id<'bills'>, items: [...bill.items, newItem] });
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
      const contactToRemove = contactsOnSelected[0];
      alert(t.bill_removeContact, t.bill_removeFromSelected(contactToRemove.name), [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.remove,
          style: 'destructive',
          onPress: async () => {
            try {
              await removeContactsBatch({
                id: id as Id<'bills'>,
                itemIds: selectedIds.filter((itemId): itemId is string => !!itemId),
                contactIds: [contactToRemove.contactId],
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
    }

    setSelectedContactIds(new Set());
    return 'multiple' as const;
  }, [bill, id, removeContactsBatch, t, userId, alert]);

  const handleConfirmUnassign = useCallback(async (selectedItemIds: Set<string>) => {
    if (selectedContactIds.size === 0 || !bill || !userId) return false;
    try {
      await removeContactsBatch({
        id: id as Id<'bills'>,
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
            await removeContactMut({ id: id as Id<'bills'>, itemId, contactId });
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
      await togglePaid({ id: id as Id<'bills'>, contactId });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      console.error('[Bill] togglePaid failed:', err);
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
      console.error('[Bill] updateContactGroups failed:', err);
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
      console.error('[Bill] toggleGroupPaid failed:', err);
      Sentry.captureException(err, { tags: { feature: 'bill_detail' } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, t.error_mutationFailed);
    }
  }, [id, toggleGroupPaidMut, userId, t, alert]);

  const handleSplitEqually = useCallback(() => {
    if (!bill || !userId) return;
    if (bill.contacts.length === 0) {
      setEqualSplitMode(true);
      setNumPeople(bill.numPeople ?? 2);
      return;
    }
    alert(t.bill_equalSwitchTitle, t.bill_equalSwitchWarning, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.confirm,
        onPress: async () => {
          try {
            await clearSplit({ id: id as Id<'bills'> });
            setEqualSplitMode(true);
            setNumPeople(2);
          } catch {
            alert(t.error, t.error_mutationFailed);
          }
        },
      },
    ]);
  }, [bill, id, userId, clearSplit, t, alert]);

  const handleSplitByItem = useCallback(() => {
    if (!bill || !userId) return;
    if (bill.contacts.length === 0) {
      setEqualSplitMode(false);
      return;
    }
    alert(t.bill_equalSwitchTitle, t.bill_equalSwitchWarning, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.confirm,
        onPress: async () => {
          try {
            await clearSplit({ id: id as Id<'bills'> });
            setEqualSplitMode(false);
          } catch {
            alert(t.error, t.error_mutationFailed);
          }
        },
      },
    ]);
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
        numPeople: Math.max(2, overrideNumPeople ?? numPeople),
        contacts: remaining.map((c) => ({ name: c.name, phone: c.phone, isSelf: c.isSelf || undefined, imageUri: c.imageUri })),
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      alert(t.error, t.error_mutationFailed);
    }
  }, [bill, userId, id, numPeople, assignEqualSplit, t, alert]);

  const handleNumPeopleChange = useCallback((newCount: number) => {
    if (!bill || !userId) return;
    if (newCount < numPeople && bill.contacts.length > newCount) {
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
              setNumPeople(newCount);
              handleRemoveEqualContact(contactToRemove.contactId, newCount);
            },
          },
        ],
      );
      return;
    }
    setNumPeople(newCount);
    if (numPeopleDebounceRef.current) clearTimeout(numPeopleDebounceRef.current);
    numPeopleDebounceRef.current = setTimeout(() => {
      if (bill.contacts.length > 0) {
        const contactArgs = bill.contacts.map((c) => ({
          name: c.name,
          phone: c.phone,
          isSelf: c.isSelf || undefined,
          imageUri: c.imageUri,
        }));
        assignEqualSplit({ id: id as Id<'bills'>, numPeople: newCount, contacts: contactArgs });
      } else {
        updateBill({ id: id as Id<'bills'>, numPeople: newCount });
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
        const phone = contact.phones?.[0]?.number ?? '';
        const name = `${contact.givenName ?? ''}${contact.familyName ? ` ${contact.familyName}` : ''}`.trim() || 'Unknown';
        if (contactArgs.some((ca) => ca.phone === phone)) continue;
        contactArgs.push({ name, phone, imageUri: contact.image ?? undefined });
      }
    }

    try {
      await assignEqualSplit({
        id: id as Id<'bills'>,
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
    updateBill({ id: id as Id<'bills'>, taxIncludedOverride: !current });
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
    if (enabled) {
      updateBill({ id: id as Id<'bills'>, useCustomTip: true });
    } else {
      const newTip = billDerived.base * (billDerived.tipPercent / 100);
      updateBill({ id: id as Id<'bills'>, tip: newTip, useCustomTip: false });
    }
  }, [id, updateBill, userId, billDerived]);

  const handleSelectCountry = useCallback(async (code: string) => {
    if (!userId) return;
    await updateBill({ id: id as Id<'bills'>, country: code });
  }, [id, updateBill, userId]);

  // ── Progress bar ──
  const totalContacts = bill?.contacts.length ?? 0;
  const paidContactCount = bill?.contacts.filter((c) => c.paid).length ?? 0;
  const paidPercent = totalContacts > 0 ? (paidContactCount / totalContacts) * 100 : 0;
  const unpaidPercent = totalContacts > 0 ? ((totalContacts - paidContactCount) / totalContacts) * 100 : 0;

  const unassignedUnits = useMemo(() => {
    if (!bill || equalSplitMode) return 0;
    return computeUnassignedUnits(bill.items, bill.contacts);
  }, [bill, equalSplitMode]);

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
    unassignedUnits,

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
