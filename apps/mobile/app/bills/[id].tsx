import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image as RNImage, Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { type ViewShotRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import * as Contacts from 'expo-contacts';
import * as Haptics from 'expo-haptics';
import { randomUUID } from 'expo-crypto';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useQuery, useMutation } from 'convex/react';
import type { Id } from '@convex/_generated/dataModel';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ICON_COLORS } from '@/constants/colors';
import { api } from '@convex/_generated/api';
import { useAuth } from '@/lib/AuthContext';

import { useT } from '@/lib/i18n';
import { toE164 } from '@/lib/phone';
import { computeBase, computeTax, getTaxConfig, withTaxIncludedOverride, type ReceiptCategory } from '@/constants/taxes';
import { STATE_STYLES, STATE_LABEL_KEYS, getTaxLabel } from '@/lib/billHelpers';
import { buildWhatsAppMessage } from '@/lib/whatsapp';

import { useCustomAlert } from '@/components/ui/custom-alert';
import BillHeader from '@/components/bills/detail/BillHeader';
import BillMetadata from '@/components/bills/detail/BillMetadata';
import SortBar from '@/components/bills/detail/SortBar';
import BillItemCard from '@/components/bills/detail/BillItemCard';
import BillSummaryCard from '@/components/bills/detail/BillSummaryCard';
import PeopleSummary from '@/components/bills/detail/PeopleSummary';
import EqualSplitView from '@/components/bills/detail/EqualSplitView';
import TipDialog from '@/components/bills/TipDialog';
import CountryDialog from '@/components/bills/CountryDialog';
import BulkToolbar from '@/components/bills/BulkToolbar';
import ContactPickerSheet, { SUGGESTED_PREFIX, SELF_PREFIX } from '@/components/bills/ContactPickerSheet';
import UnassignPickerSheet from '@/components/bills/UnassignPickerSheet';
import BillShareSheet from '@/components/bills/BillShareSheet';
import ContactUnitSheet from '@/components/bills/detail/ContactUnitSheet';

const CONTACTS_CACHE_TTL = 5 * 60_000; // 5 minutes

type SortStrategy = 'original' | 'price-asc' | 'price-desc' | 'alpha-asc' | 'alpha-desc';
type DialogType = 'tip' | 'country' | 'share' | 'contactPicker' | 'unassignPicker' | null;

export default function BillDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];
  const t = useT();
  const { user } = useAuth();
  const { alert } = useCustomAlert();
  const userId = user?.id;

  const bill = useQuery(api.bills.get, userId ? { id: id as Id<'bills'>, userId } : 'skip');
  const suggestedContacts = useQuery(api.contacts.suggested, userId ? { userId } : 'skip');
  const selfContact = useQuery(api.contacts.getSelf, userId ? { userId } : 'skip');
  const updateBill = useMutation(api.bills.update);
  const removeContact = useMutation(api.bills.removeContactFromItem);
  const togglePaid = useMutation(api.bills.togglePaymentStatus);
  const removeBill = useMutation(api.bills.remove);
  const removeContactsBatch = useMutation(api.bills.removeContactsFromItems);
  const assignContactToItems = useMutation(api.bills.assignContactToItems);
  const updateContactUnits = useMutation(api.bills.updateContactUnits);
  const assignEqualSplit = useMutation(api.bills.assignEqualSplit);
  const clearSplit = useMutation(api.bills.clearSplitAssignments);

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [activeDialog, setActiveDialog] = useState<DialogType>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [sortStrategy, setSortStrategy] = useState<SortStrategy>('original');
  const [phoneContacts, setPhoneContacts] = useState<(Contacts.Contact & { id: string })[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [singleAssignItemId, setSingleAssignItemId] = useState<string | null>(null);
  const [numPeople, setNumPeople] = useState(() => bill?.numPeople ?? 2);
  const [equalSplitMode, setEqualSplitMode] = useState(() => bill?.splitStrategy === 'equal');
  const [capturingIndex, setCapturingIndex] = useState<number | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewAspect, setPreviewAspect] = useState(1);
  const [previewContactName, setPreviewContactName] = useState('');
  const [unitSheetTarget, setUnitSheetTarget] = useState<{ itemId: string; contactId: Id<'contacts'> } | null>(null);

  const swipeOpenRef = useRef(false);
  const billRef = useRef(bill);
  useEffect(() => { billRef.current = bill; }, [bill]);
  const infographicRefs = useRef<Record<number, ViewShotRef | null>>({});
  const contactsCacheRef = useRef<{ data: (Contacts.Contact & { id: string })[]; fetchedAt: number } | null>(null);
  const contactsPermissionRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);

  const excludePhones = useMemo(() => {
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
  }, [singleAssignItemId, selectedItemIds, bill, equalSplitMode]);

  const excludeSelf = useMemo(() => {
    if (!bill) return false;
    if (equalSplitMode) {
      return bill.contacts.some((c) => c.isSelf);
    }
    const targetItemId = singleAssignItemId ?? (selectedItemIds.size === 1 ? Array.from(selectedItemIds)[0] : null);
    if (!targetItemId) return false;
    return bill.contacts.some((c) => c.isSelf && c.items.some((i) => i.itemId === targetItemId));
  }, [bill, equalSplitMode, singleAssignItemId, selectedItemIds]);

  // --- Callbacks ---

  const handleRemoveItem = useCallback((itemId: string) => {
    const currentBill = billRef.current;
    if (!currentBill || !userId) return;
    const remaining = currentBill.items.filter((billItem) => billItem.id !== itemId);
    setDeletingId(itemId);
    setTimeout(() => {
      updateBill({ id: id as Id<'bills'>, userId, items: remaining });
      setDeletingId(null);
    }, 300);
  }, [id, updateBill, userId]);

  const handleItemPress = useCallback((itemId: string) => {
    if (swipeOpenRef.current) {
      swipeOpenRef.current = false;
      return;
    }
    setEditingItemId(itemId);
  }, []);

  const handleSubmitEdit = useCallback((itemId: string, values: { name: string; quantity: number; unitPrice: number }) => {
    if (!bill || !userId) return;
    const items = bill.items.map((item) => {
      if (item.id !== itemId) return item;
      return { ...item, name: values.name, quantity: values.quantity, unitPrice: values.unitPrice, subtotal: values.quantity * values.unitPrice };
    });
    updateBill({ id: id as Id<'bills'>, userId, items });
    setEditingItemId(null);
  }, [bill, id, updateBill, userId]);

  const toggleItemSelection = useCallback((itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

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
    // Use cache if fresh
    const cache = contactsCacheRef.current;
    if (cache && Date.now() - cache.fetchedAt < CONTACTS_CACHE_TTL) {
      setPhoneContacts(cache.data);
      return;
    }

    // Phase 1: fast fetch without images
    Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      sort: Contacts.SortTypes.FirstName,
    }).then(({ data }) => {
      const filtered = data.filter((c): c is typeof c & { id: string } => !!c.id);
      setPhoneContacts(filtered);
      contactsCacheRef.current = { data: filtered, fetchedAt: Date.now() };

      // Phase 2: background re-fetch with images
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

  const handleMultiAssign = useCallback(async () => {
    if (selectedItemIds.size === 0) return;
    const granted = await ensureContactPermission();
    if (!granted) return;
    // search reset handled inside ContactPickerSheet
    setSelectedContactIds(new Set());
    setActiveDialog('contactPicker');
    loadContacts();
  }, [selectedItemIds, ensureContactPermission, loadContacts]);

  const handleConfirmContactPicker = useCallback(async () => {
    if (selectedContactIds.size === 0 || !bill || !userId) return;
    let itemIds: string[];
    if (singleAssignItemId !== null) {
      itemIds = [singleAssignItemId];
    } else {
      itemIds = Array.from(selectedItemIds);
    }
    if (itemIds.length === 0) return;

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

        if (selectedId.startsWith(SELF_PREFIX)) {
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
      setActiveDialog(null);
      setSingleAssignItemId(null);
      setSelectedItemIds(new Set());
      setMultiSelectMode(false);
    } catch (err) {
      console.error('[Bill] assignContactToItems failed:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, t.error_mutationFailed);
    }
  }, [selectedContactIds, selectedItemIds, singleAssignItemId, phoneContacts, suggestedContacts, selfContact, bill, id, assignContactToItems, t, userId, alert]);

  const handleBulkDelete = useCallback(() => {
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
            setSelectedItemIds(new Set());
            setMultiSelectMode(false);
          },
        },
      ]
    );
  }, [selectedItemIds, bill, id, updateBill, t, userId, alert]);

  const handleAddItem = useCallback(async () => {
    if (!bill || !userId) return;
    if (multiSelectMode) {
      setMultiSelectMode(false);
      setSelectedItemIds(new Set());
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newItem = { id: randomUUID(), name: '', quantity: 1, unitPrice: 0, subtotal: 0 };
    try {
      await updateBill({ id: id as Id<'bills'>, userId, items: [...bill.items, newItem] });
      setEditingItemId(newItem.id);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
    } catch {
      alert(t.error, t.error_mutationFailed);
    }
  }, [bill, userId, id, updateBill, multiSelectMode, t, alert]);

  const handleBulkRemoveContact = useCallback(() => {
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
              setSelectedItemIds(new Set());
              setMultiSelectMode(false);
            } catch (err) {
              console.error('[Bill] removeContactsBatch failed:', err);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              alert(t.error, t.error_mutationFailed);
            }
          },
        },
      ]);
    } else {
      setSelectedContactIds(new Set());
      setActiveDialog('unassignPicker');
    }
  }, [selectedItemIds, bill, id, removeContactsBatch, t, userId, alert]);

  const handleConfirmUnassign = useCallback(async () => {
    if (selectedContactIds.size === 0 || !bill || !userId) return;
    try {
      await removeContactsBatch({
        id: id as Id<'bills'>, userId,
        itemIds: Array.from(selectedItemIds),
        contactIds: Array.from(selectedContactIds) as Id<'contacts'>[],
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setActiveDialog(null);
      setSelectedItemIds(new Set());
      setMultiSelectMode(false);
    } catch (err) {
      console.error('[Bill] removeContactsBatch failed:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, t.error_mutationFailed);
    }
  }, [selectedContactIds, selectedItemIds, bill, id, removeContactsBatch, t, userId, alert]);

  const handleAssignContact = useCallback(async (itemId: string) => {
    const granted = await ensureContactPermission();
    if (!granted) return;
    // search reset handled inside ContactPickerSheet
    setSelectedContactIds(new Set());
    setSingleAssignItemId(itemId);
    setActiveDialog('contactPicker');
    loadContacts();
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
    setActiveDialog(null);
    setSingleAssignItemId(null);
  }, []);

  const handleRemoveContact = useCallback((itemId: string, contactId: Id<'contacts'>) => {
    if (!userId) return;
    alert(t.bill_removeContact, t.bill_removeContactConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.remove,
        style: 'destructive',
        onPress: async () => {
            try {
              await removeContact({ id: id as Id<'bills'>, userId: userId!, itemId, contactId });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (err) {
              console.error('[Bill] removeContact failed:', err);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              alert(t.error, t.error_mutationFailed);
            }
          },
      },
    ]);
  }, [id, removeContact, t, userId, alert]);

  const handleContactPress = useCallback((itemId: string, contactId: Id<'contacts'>) => {
    setUnitSheetTarget({ itemId, contactId });
  }, []);

  const handleUpdateUnits = useCallback(async (units: number) => {
    if (!unitSheetTarget || !userId) return;
    try {
      await updateContactUnits({
        id: id as Id<'bills'>,
        userId,
        itemId: unitSheetTarget.itemId,
        contactId: unitSheetTarget.contactId,
        units,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      console.error('[Bill] updateContactUnits failed:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, t.error_mutationFailed);
    }
  }, [unitSheetTarget, userId, id, updateContactUnits, t, alert]);

  const handleRemoveFromUnitSheet = useCallback(() => {
    if (!unitSheetTarget || !userId) return;
    setUnitSheetTarget(null);
    handleRemoveContact(unitSheetTarget.itemId, unitSheetTarget.contactId);
  }, [unitSheetTarget, userId, handleRemoveContact]);

  const handleTogglePaid = useCallback(async (contactId: Id<'contacts'>) => {
    if (!userId) return;
    try {
      await togglePaid({ id: id as Id<'bills'>, userId: userId!, contactId });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      console.error('[Bill] togglePaid failed:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, t.error_mutationFailed);
    }
  }, [id, togglePaid, t, userId, alert]);

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
    if (!granted) return;
    setSelectedContactIds(new Set());
    setSingleAssignItemId(null);
    setActiveDialog('contactPicker');
    loadContacts();
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

  const numPeopleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, t.error_mutationFailed);
    }
  }, [bill, id, userId, numPeople, assignEqualSplit, t, alert]);

  // Equal split: handle contact picker confirm (different from by-item flow)
  const handleConfirmEqualContactPicker = useCallback(async () => {
    if (selectedContactIds.size === 0 || !bill || !userId) return;
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
      setActiveDialog(null);
    } catch (err) {
      console.error('[Bill] assignEqualSplit failed:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, t.error_mutationFailed);
    }
  }, [selectedContactIds, bill, userId, suggestedContacts, selfContact, phoneContacts, id, numPeople, assignEqualSplit, t, alert]);

  const handleSendWhatsApp = useCallback(async (contact: { name: string; phone?: string; items: { itemId: string; units: number }[]; amount: number }) => {
    if (!bill || !contact.phone) {
      alert(t.bill_noPhone, t.bill_noPhoneMessage);
      return;
    }
    const billCountry = (bill.country as 'CO' | 'US') || 'CO';
    const billCategory = (bill.tags?.find((t) => t.isPlatform)?.slug || 'dining') as ReceiptCategory;
    const rawTaxConfig = getTaxConfig(billCountry, billCategory);
    const taxConfig = withTaxIncludedOverride(rawTaxConfig, bill.taxIncludedOverride ?? undefined);
    const message = buildWhatsAppMessage({ bill, contact, taxConfig, t });
    const url = `https://wa.me/${toE164(contact.phone)}?text=${encodeURIComponent(message)}`;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      alert(t.error, t.error_whatsappNotAvailable);
      return;
    }
    Linking.openURL(url);
  }, [bill, t, alert]);

  const handleShareInfographic = useCallback(async (contact: { name: string; imageUri?: string; items: { itemId: string; units: number }[]; amount: number }, contactIndex: number) => {
    if (!bill) return;
    const ref = infographicRefs.current[contactIndex];
    if (!ref?.capture) return;
    setCapturingIndex(contactIndex);
    try {
      const uri = await ref.capture();
      const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        RNImage.getSize(uri, (w, h) => resolve({ width: w, height: h }), reject);
      });
      setPreviewAspect(width > 0 && height > 0 ? width / height : 0.55);
      setPreviewUri(uri);
      setPreviewContactName(contact.name);
    } catch (err) {
      console.error('[Share] Error:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, t.error_shareFailed);
    } finally {
      setCapturingIndex(null);
    }
  }, [bill, t, alert]);

  const handleConfirmShare = useCallback(async () => {
    if (!previewUri) return;
    try {
      await Sharing.shareAsync(previewUri, { mimeType: 'image/png', dialogTitle: previewContactName });
    } catch (err) {
      console.error('[Share] Error:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, t.error_shareFailed);
    }
  }, [previewUri, previewContactName, t, alert]);

  const handleClosePreview = useCallback(() => {
    setPreviewUri(null);
    setPreviewContactName('');
  }, []);

  // --- Derived data ---

  const sortedItems = useMemo(() => {
    if (!bill) return [];
    const items = [...bill.items];
    switch (sortStrategy) {
      case 'price-asc': return items.sort((a, b) => a.subtotal - b.subtotal);
      case 'price-desc': return items.sort((a, b) => b.subtotal - a.subtotal);
      case 'alpha-asc': return items.sort((a, b) => a.name.localeCompare(b.name));
      case 'alpha-desc': return items.sort((a, b) => b.name.localeCompare(a.name));
      default: return items;
    }
  }, [bill, sortStrategy]);

  const billDerived = useMemo(() => {
    if (!bill) return null;
    const itemsTotal = bill.items.reduce((sum, billItem) => sum + billItem.subtotal, 0);
    const billCountry = (bill.country as 'CO' | 'US') || 'CO';
    const billCategory = (bill.tags?.find((t) => t.isPlatform)?.slug || 'dining') as ReceiptCategory;
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

  const handleToggleTaxIncluded = useCallback(() => {
    if (!bill || !userId || !billDerived) return;
    const current = bill.taxIncludedOverride ?? billDerived.taxConfig.taxIncluded;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateBill({ id: id as Id<'bills'>, userId, taxIncludedOverride: !current });
  }, [bill, userId, billDerived, id, updateBill]);

  // --- Loading / Error states ---

  if (bill === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-background" style={{ paddingTop: insets.top }}>
        <ActivityIndicator size="large" color={iconColors.primary} />
      </View>
    );
  }

  if (!bill || !billDerived || !userId) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6" style={{ paddingTop: insets.top }}>
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-muted/50">
          <IconSymbol name="exclamationmark.triangle" size={32} color={iconColors.destructive} />
        </View>
        <Text className="text-lg font-semibold text-foreground">{t.error_billNotFound}</Text>
        <Text className="mt-2 text-center text-sm text-muted-foreground">{t.error_billNotFoundHint}</Text>
        <Button
          variant="outline"
          className="mt-6"
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)' as Href)}
        >
          <Text>{t.error_goHome}</Text>
        </Button>
      </View>
    );
  }

  const { base, billCountry, taxConfig, translatedTaxLabel, computedTax, tipPercent, useCustomTip, computedTip, beforeTip, total, stateStyle, stateLabel, decimalPlaces } = billDerived;

  // Progress bar computation
  const totalItems = bill.items.length;
  const totalContacts = bill.contacts.length;
  const isEqualSplit = bill.splitStrategy === 'equal';
  const paidContactCount = bill.contacts.filter((c) => c.paid).length;

  let paidPercent: number;
  let unpaidPercent: number;

  if (isEqualSplit || equalSplitMode) {
    const target = equalSplitMode ? numPeople : (bill.numPeople ?? numPeople);
    paidPercent = target > 0 ? (paidContactCount / target) * 100 : 0;
    unpaidPercent = target > 0 ? ((totalContacts - paidContactCount) / target) * 100 : 0;
  } else {
    const assignedItemIds = new Set(bill.contacts.flatMap((c) => c.items.map((i) => i.itemId)));
    const assignedPercent = totalItems > 0 ? (assignedItemIds.size / totalItems) * 100 : 0;
    const paidProportion = totalContacts > 0 ? paidContactCount / totalContacts : 0;
    paidPercent = assignedPercent * paidProportion;
    unpaidPercent = assignedPercent - paidPercent;
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingBottom: insets.bottom }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header — floating above MaskedView */}
      <Animated.View entering={FadeInDown.duration(300)} style={{ position: 'absolute', left: 0, right: 0, top: insets.top, zIndex: 10 }}>
        <BillHeader
          billName={bill.name}
          state={bill.state}
          stateLabel={stateLabel}
          completionPercent={paidPercent}
          paidPercent={paidPercent}
          unpaidPercent={unpaidPercent}
          stateTextClass={stateStyle.textClass}
          hasContacts={totalContacts > 0}
          splitStrategy={equalSplitMode ? 'equal' : bill.splitStrategy}
          multiSelectMode={multiSelectMode}
          iconColors={iconColors}
          t={t}
          onBack={() => router.back()}
          onUpdateName={(name) => updateBill({ id: id as Id<'bills'>, userId, name })}
          onSplitEqually={handleSplitEqually}
          onSplitByItem={handleSplitByItem}
          onEdit={() => {
            setMultiSelectMode(true);
            setSelectedItemIds(new Set());
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          onDoneEdit={() => {
            setMultiSelectMode(false);
            setSelectedItemIds(new Set());
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          onDelete={async () => {
            try {
              await removeBill({ id: id as Id<'bills'>, userId: userId! });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            } catch (err) {
              console.error('[Bill] removeBill failed:', err);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              alert(t.error, t.error_mutationFailed);
            }
          }}
        />
      </Animated.View>

      {/* Top scroll edge — fade content under header */}
      <MaskedView
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: insets.top + 100, zIndex: 5 }}
        pointerEvents="none"
        maskElement={
          <LinearGradient
            colors={['rgba(0,0,0,1)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0)']}
            locations={[0, 0.65, 1]}
            style={{ flex: 1 }}
          />
        }
      >
        <View className="flex-1 bg-background" />
      </MaskedView>

      <ScrollView ref={scrollRef} className="flex-1" contentContainerStyle={{ paddingTop: insets.top + 80, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* Metadata */}
        <Animated.View entering={FadeInDown.delay(60).duration(300)}>
          <BillMetadata
            category={bill.tags?.find((t) => t.isPlatform)?.slug}
            location={bill.location}
            photoTakenAt={bill.photoTakenAt}
            creationTime={bill._creationTime}
            billCountry={billCountry}
            iconColors={iconColors}
            t={t}
            onCountryPress={() => setActiveDialog('country')}
          />
        </Animated.View>

        {/* Equal Split View OR Sort bar + Items */}
        {equalSplitMode ? (
          <Animated.View entering={FadeInDown.delay(120).duration(300)} className="px-5">
            <EqualSplitView
              items={bill.items}
              contacts={bill.contacts}
              total={total}
              numPeople={numPeople}
              billCountry={billCountry}
              decimalPlaces={decimalPlaces}
              iconColors={iconColors}
              t={t}
              editingItemId={editingItemId}
              onNumPeopleChange={handleNumPeopleChange}
              onAssignContacts={handleEqualAssignContacts}
              onConfirm={handleConfirmEqualSplit}
              onTogglePaid={handleTogglePaid}
              onRemoveContact={handleRemoveEqualContact}
              onItemPress={handleItemPress}
              onSubmitEdit={handleSubmitEdit}
              onDismissEdit={() => setEditingItemId(null)}
              onRemoveItem={handleRemoveItem}
            />
          </Animated.View>
        ) : (
          <>
            {/* Sort bar + bulk edit */}
            <Animated.View entering={FadeInDown.delay(120).duration(300)}>
              <SortBar
                sortStrategy={sortStrategy}
                onSortChange={setSortStrategy}
                t={t}
              />
            </Animated.View>

            {/* Items */}
            {sortedItems.map((item, index) => {
              const itemId = item.id!;
              const assignedContacts = bill.contacts.filter((c) => c.items.some((i) => i.itemId === itemId));
              return (
                <Animated.View
                  key={item.id ?? `legacy-${index}`}
                  entering={FadeInDown.delay(Math.min(index, 8) * 60 + 180).duration(350)}
                >
                  <BillItemCard
                    item={item}
                    index={index}
                    billCountry={billCountry}
                    decimalPlaces={decimalPlaces}
                    stateStyle={stateStyle}
                    assignedContacts={assignedContacts}
                    isEditing={editingItemId === itemId}
                    isDeleting={deletingId === item.id}
                    multiSelectMode={multiSelectMode}
                    isSelected={selectedItemIds.has(itemId)}
                    iconColors={iconColors}
                    t={t}
                    swipeOpenRef={swipeOpenRef}
                    onPress={handleItemPress}
                    onRemoveItem={handleRemoveItem}
                    onSubmitEdit={handleSubmitEdit}
                    onDismissEdit={() => setEditingItemId(null)}
                    onAssignContact={handleAssignContact}
                    onRemoveContact={handleRemoveContact}
                    onContactPress={handleContactPress}
                    onToggleSelection={toggleItemSelection}
                  />
                </Animated.View>
              );
            })}
          </>
        )}

        {/* People summary */}
        {bill.contacts.length > 0 && (
          <Animated.View entering={FadeInDown.delay(Math.min(sortedItems.length, 8) * 60 + 240).duration(350)}>
            <PeopleSummary
              contacts={bill.contacts}
              billItems={bill.items}
              billCountry={billCountry}
              decimalPlaces={decimalPlaces}
              splitStrategy={bill.splitStrategy}
              taxConfig={taxConfig}
              tipPercent={tipPercent}
              iconColors={iconColors}
              t={t}
              onTogglePaid={handleTogglePaid}
            />
          </Animated.View>
        )}

        {/* Summary */}
        <Animated.View entering={FadeInDown.delay(Math.min(sortedItems.length, 8) * 60 + 300).duration(350)}>
          <BillSummaryCard
            base={base}
            computedTax={computedTax}
            beforeTip={beforeTip}
            tipPercent={tipPercent}
            useCustomTip={useCustomTip}
            computedTip={computedTip}
            total={total}
            billCountry={billCountry}
            decimalPlaces={decimalPlaces}
            translatedTaxLabel={translatedTaxLabel}
            taxConfig={taxConfig}
            iconColors={iconColors}
            t={t}
            showTaxToggle={billCountry === 'CO'}
            taxIncluded={taxConfig.taxIncluded}
            onToggleTaxIncluded={handleToggleTaxIncluded}
            onTipPress={() => setActiveDialog('tip')}
          />
        </Animated.View>
      </ScrollView>

      {/* Bottom fixed area */}
      {Platform.OS === 'ios' ? (
        <BlurView intensity={80} tint={colorScheme === 'dark' ? 'dark' : 'light'} className="border-t border-border/30">
          {!multiSelectMode && bill.contacts.length > 0 && bill.state !== 'draft' && (
            <View className="px-7 pb-2 pt-3">
              <Pressable
                onPress={() => setActiveDialog('share')}
                className="flex-row items-center justify-center gap-2 rounded-xl bg-primary py-4 active:opacity-80"
              >
                <IconSymbol name="person.2.fill" size={18} color={iconColors.primaryForeground} />
                <Text className="text-[15px] font-semibold text-primary-foreground">
                  {t.share_button(bill.contacts.length)}
                </Text>
              </Pressable>
            </View>
          )}
          {multiSelectMode && selectedItemIds.size > 0 && (
            <BulkToolbar
              selectedItemIds={selectedItemIds}
              hasContactsOnSelection={bill.contacts.some((c) => c.items.some((ref) => selectedItemIds.has(ref.itemId)))}
              onAssign={handleMultiAssign}
              onUnassign={handleBulkRemoveContact}
              onDelete={handleBulkDelete}
            />
          )}
          <View className="px-7 py-2">
            <Pressable
              onPress={handleAddItem}
              className="flex-row items-center justify-center gap-2 rounded-xl bg-primary/10 py-3 active:opacity-80"
            >
              <IconSymbol name="plus" size={14} color={iconColors.primary} />
              <Text className="text-sm font-semibold text-primary">{t.scan_addItem}</Text>
            </Pressable>
          </View>
        </BlurView>
      ) : (
        <View className="border-t border-border/30">
          {!multiSelectMode && bill.contacts.length > 0 && bill.state !== 'draft' && (
            <View className="px-7 pb-2 pt-3">
              <Pressable
                onPress={() => setActiveDialog('share')}
                className="flex-row items-center justify-center gap-2 rounded-xl bg-primary py-4 active:opacity-80"
              >
                <IconSymbol name="person.2.fill" size={18} color={iconColors.primaryForeground} />
                <Text className="text-[15px] font-semibold text-primary-foreground">
                  {t.share_button(bill.contacts.length)}
                </Text>
              </Pressable>
            </View>
          )}
          {multiSelectMode && selectedItemIds.size > 0 && (
            <BulkToolbar
              selectedItemIds={selectedItemIds}
              hasContactsOnSelection={bill.contacts.some((c) => c.items.some((ref) => selectedItemIds.has(ref.itemId)))}
              onAssign={handleMultiAssign}
              onUnassign={handleBulkRemoveContact}
              onDelete={handleBulkDelete}
            />
          )}
          <View className="px-7 py-2">
            <Pressable
              onPress={handleAddItem}
              className="flex-row items-center justify-center gap-2 rounded-xl bg-primary/10 py-3 active:opacity-80"
            >
              <IconSymbol name="plus" size={14} color={iconColors.primary} />
              <Text className="text-sm font-semibold text-primary">{t.scan_addItem}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Dialogs & Sheets */}
      <BillShareSheet
        visible={activeDialog === 'share'}
        bill={bill}
        billCountry={billCountry}
        splitStrategy={bill.splitStrategy}
        taxConfig={taxConfig}
        tipPercent={tipPercent}
        translatedTaxLabel={translatedTaxLabel}
        bottomInset={insets.bottom}
        infographicRefs={infographicRefs}
        onTogglePaid={handleTogglePaid}
        onSendWhatsApp={handleSendWhatsApp}
        onShareInfographic={handleShareInfographic}
        capturingIndex={capturingIndex}
        previewUri={previewUri}
        previewAspect={previewAspect}
        onConfirmShare={handleConfirmShare}
        onClosePreview={handleClosePreview}
        onClose={() => setActiveDialog(null)}
      />

      <ContactPickerSheet
        visible={activeDialog === 'contactPicker'}
        phoneContacts={phoneContacts}
        suggestedContacts={suggestedContacts ?? undefined}
        selfContact={selfContact}
        selectedContactIds={selectedContactIds}
        excludePhones={excludePhones}
        excludeSelf={excludeSelf}
        maxSelectable={equalSplitMode ? numPeople - bill.contacts.length : undefined}
        bottomInset={insets.bottom}
        onToggleContact={handleToggleContactSelection}
        onConfirm={equalSplitMode ? handleConfirmEqualContactPicker : handleConfirmContactPicker}
        onClose={handleCloseContactPicker}
      />

      {bill && (
        <UnassignPickerSheet
          visible={activeDialog === 'unassignPicker'}
          contacts={bill.contacts}
          selectedItemIds={selectedItemIds}
          selectedContactIds={selectedContactIds}
          bottomInset={insets.bottom}
          onToggleContact={(key) => {
            setSelectedContactIds((prev) => {
              const next = new Set(prev);
              if (next.has(key)) next.delete(key);
              else next.add(key);
              return next;
            });
          }}
          onConfirm={handleConfirmUnassign}
          onClose={() => setActiveDialog(null)}
        />
      )}

      {unitSheetTarget && bill && (() => {
        const targetItem = bill.items.find((i) => i.id === unitSheetTarget.itemId);
        const targetContact = bill.contacts.find((c) => c.contactId === unitSheetTarget.contactId);
        if (!targetItem || !targetContact) return null;
        const ref = targetContact.items.find((i) => i.itemId === unitSheetTarget.itemId);
        if (!ref) return null;
        const othersUnits = bill.contacts.reduce((sum, c) => {
          if (c.contactId === unitSheetTarget.contactId) return sum;
          const cRef = c.items.find((i) => i.itemId === unitSheetTarget.itemId);
          return sum + (cRef ? cRef.units : 0);
        }, 0);
        return (
          <ContactUnitSheet
            visible
            contactName={targetContact.name}
            contactImageUri={targetContact.imageUri}
            contactId={targetContact.contactId}
            isSelf={targetContact.isSelf}
            itemName={targetItem.name}
            itemQuantity={targetItem.quantity}
            unitPrice={targetItem.unitPrice}
            currentUnits={ref.units}
            maxUnits={targetItem.quantity - othersUnits}
            billCountry={billCountry}
            bottomInset={insets.bottom}
            onUpdateUnits={handleUpdateUnits}
            onRemove={handleRemoveFromUnitSheet}
            onClose={() => setUnitSheetTarget(null)}
          />
        );
      })()}

      <TipDialog
        visible={activeDialog === 'tip'}
        tipPercent={tipPercent}
        useCustomTip={useCustomTip}
        customTip={bill.tip ?? 0}
        subtotal={base}
        billCountry={billCountry}
        decimalPlaces={decimalPlaces}
        iconColors={iconColors}
        onSelectTip={async (pct, newTip) => {
          await updateBill({ id: id as Id<'bills'>, userId, tipPercent: pct, tip: newTip, useCustomTip: false });
          setActiveDialog(null);
        }}
        onSelectCustomTip={(tip) => {
          updateBill({ id: id as Id<'bills'>, userId, tip, useCustomTip: true });
        }}
        onToggleCustomTip={(enabled) => {
          if (enabled) {
            updateBill({ id: id as Id<'bills'>, userId, useCustomTip: true });
          } else {
            const newTip = base * (tipPercent / 100);
            updateBill({ id: id as Id<'bills'>, userId, tip: newTip, useCustomTip: false });
          }
        }}
        onClose={() => setActiveDialog(null)}
      />

      <CountryDialog
        visible={activeDialog === 'country'}
        billCountry={billCountry}
        onSelectCountry={async (code) => {
          await updateBill({ id: id as Id<'bills'>, userId, country: code });
          setActiveDialog(null);
        }}
        onClose={() => setActiveDialog(null)}
      />
    </View>
  );
}
