import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, ScrollView, View } from 'react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import * as Contacts from 'expo-contacts';
import * as Haptics from 'expo-haptics';
import { Swipeable } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useQuery, useMutation } from 'convex/react';
import type { Id } from '@/convex/_generated/dataModel';

import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ICON_COLORS } from '@/constants/colors';
import { api } from '@/convex/_generated/api';
import { useAuth } from '@/lib/AuthContext';
import { formatCurrency, parseCurrency } from '@/lib/format';
import { useT } from '@/lib/i18n';
import type { Translations } from '@/lib/i18n';
import { toE164 } from '@/lib/phone';
import { CATEGORY_LABELS, computeTax, getTaxConfig, type TaxConfig } from '@/constants/taxes';
import { relativeTime, parseExifDate } from '@/lib/date';
import { STATE_STYLES, STATE_LABEL_KEYS, getTaxLabel, getCategoryLabel, type BillState } from '@/lib/billHelpers';

import SwipeableItem from '@/components/bills/SwipeableItem';
import TipDialog from '@/components/bills/TipDialog';
import CountryDialog from '@/components/bills/CountryDialog';
import BulkToolbar from '@/components/bills/BulkToolbar';
import ContactPickerSheet from '@/components/bills/ContactPickerSheet';
import UnassignPickerSheet from '@/components/bills/UnassignPickerSheet';
import BillShareSheet from '@/components/bills/BillShareSheet';

export default function BillDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];
  const t = useT();
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const bill = useQuery(api.bills.get, userId ? { id: id as Id<'bills'>, userId } : 'skip');
  const updateBill = useMutation(api.bills.update);
  const assignContact = useMutation(api.bills.assignContactToItem);
  const removeContact = useMutation(api.bills.removeContactFromItem);
  const togglePaid = useMutation(api.bills.togglePaymentStatus);
  const removeBill = useMutation(api.bills.remove);
  const removeContactsBatch = useMutation(api.bills.removeContactsFromItems);
  type SortStrategy = 'original' | 'price-asc' | 'price-desc' | 'alpha-asc' | 'alpha-desc';
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [showTipDialog, setShowTipDialog] = useState(false);
  const [showCountryDialog, setShowCountryDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [sortStrategy, setSortStrategy] = useState<SortStrategy>('original');
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [showUnassignPicker, setShowUnassignPicker] = useState(false);
  const [phoneContacts, setPhoneContacts] = useState<(Contacts.Contact & { id: string })[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [singleAssignItemId, setSingleAssignItemId] = useState<string | null>(null);
  const swipeOpenRef = useRef(false);
  const assignContactToItems = useMutation(api.bills.assignContactToItems);
  const billRef = useRef(bill);
  billRef.current = bill;

  const handleRemoveItem = useCallback((itemId: string) => {
    const currentBill = billRef.current;
    if (!currentBill) return;
    const remaining = currentBill.items.filter((billItem) => billItem.id !== itemId);
    setDeletingId(itemId);
    setTimeout(() => {
      updateBill({ id: id as Id<'bills'>, userId, items: remaining });
      setDeletingId(null);
    }, 300);
  }, [id, updateBill]);

  const handleItemPress = useCallback((itemId: string) => {
    if (swipeOpenRef.current) {
      swipeOpenRef.current = false;
      return;
    }
    setEditingItemId(itemId);
  }, []);

  const handleUpdateItem = useCallback((itemId: string, field: 'name' | 'quantity' | 'unitPrice', value: string) => {
    if (!bill) return;
    const items = bill.items.map((item) => {
      if (item.id !== itemId) return item;
      if (field === 'name') return { ...item, name: value };
      const num = parseCurrency(value);
      const updated = { ...item, [field]: num };
      if (field === 'quantity' || field === 'unitPrice') {
        updated.subtotal = updated.quantity * updated.unitPrice;
      }
      return updated;
    });
    updateBill({ id: id as Id<'bills'>, userId, items });
  }, [bill, id, updateBill]);

  const handleUpdateTax = useCallback((value: string) => {
    updateBill({ id: id as Id<'bills'>, userId, tax: parseCurrency(value) });
  }, [id, updateBill]);

  const handleUpdateTip = useCallback((value: string) => {
    updateBill({ id: id as Id<'bills'>, userId, tip: parseCurrency(value) });
  }, [id, updateBill]);

  const toggleItemSelection = useCallback((itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  const handleMultiAssign = useCallback(async () => {
    if (selectedItemIds.size === 0) return;
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t.bill_permissionNeeded, t.bill_permissionContacts);
      return;
    }

    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Image, Contacts.Fields.Name],
      sort: Contacts.SortTypes.FirstName,
    });
    setPhoneContacts(data.filter((c): c is typeof c & { id: string } => !!c.id));
    setContactSearch('');
    setSelectedContactIds(new Set());
    setShowContactPicker(true);
  }, [selectedItemIds, t]);

  const handleConfirmContactPicker = useCallback(async () => {
    if (selectedContactIds.size === 0 || !bill) return;

    // Determine which items to assign to
    let itemIds: string[];
    if (singleAssignItemId !== null) {
      itemIds = [singleAssignItemId];
    } else {
      itemIds = Array.from(selectedItemIds);
    }
    if (itemIds.length === 0) return;

    for (const contactId of selectedContactIds) {
      const contact = phoneContacts.find((c) => c.id === contactId);
      if (!contact) continue;

      const phone = contact.phoneNumbers?.[0]?.number;
      const name = `${contact.firstName ?? ''}${contact.lastName ? ` ${contact.lastName}` : ''}`.trim() || 'Unknown';
      const imageUri = contact.image?.uri;

      await assignContactToItems({
        id: id as Id<'bills'>,
        userId,
        itemIds,
        contact: { name, phone: phone ?? undefined, imageUri: imageUri ?? undefined },
      });
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowContactPicker(false);
    setSingleAssignItemId(null);
    setSelectedItemIds(new Set());
    setMultiSelectMode(false);
  }, [selectedContactIds, selectedItemIds, singleAssignItemId, phoneContacts, bill, id, assignContactToItems]);

  const handleBulkDelete = useCallback(() => {
    if (selectedItemIds.size === 0 || !bill) return;
    Alert.alert(
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
  }, [selectedItemIds, bill, id, updateBill, t]);

  const handleBulkRemoveContact = useCallback(() => {
    if (selectedItemIds.size === 0 || !bill) return;

    const selectedIds = Array.from(selectedItemIds);
    const contactsOnSelected = bill.contacts
      .map((c, contactIdx) => ({ ...c, contactIndex: contactIdx }))
      .filter((c) => c.items.some((itemId) => selectedIds.includes(itemId)));

    if (contactsOnSelected.length === 0) {
      Alert.alert(t.bill_noContacts, t.bill_noContactsOnItems);
      return;
    }

    if (contactsOnSelected.length === 1) {
      const c = contactsOnSelected[0];
      Alert.alert(t.bill_removeContact, t.bill_removeFromSelected(c.name), [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.remove,
          style: 'destructive',
          onPress: async () => {
            await removeContactsBatch({
              id: id as Id<'bills'>,
              userId,
              itemIds: selectedIds.filter((itemId): itemId is string => !!itemId),
              contactNames: [c.name],
            });
            setSelectedItemIds(new Set());
            setMultiSelectMode(false);
          },
        },
      ]);
    } else {
      // Multiple contacts — open picker modal
      setSelectedContactIds(new Set());
      setShowUnassignPicker(true);
    }
  }, [selectedItemIds, bill, id, removeContact, t]);

  const handleConfirmUnassign = useCallback(async () => {
    if (selectedContactIds.size === 0 || !bill) return;

    const itemIds = Array.from(selectedItemIds);

    const contactNames = Array.from(selectedContactIds).map((ciStr) => {
      const contactIdx = parseInt(ciStr, 10);
      return bill.contacts[contactIdx]?.name;
    }).filter((contactName): contactName is string => !!contactName);

    await removeContactsBatch({
      id: id as Id<'bills'>,
      userId,
      itemIds,
      contactNames,
    });

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowUnassignPicker(false);
    setSelectedItemIds(new Set());
    setMultiSelectMode(false);
  }, [selectedContactIds, selectedItemIds, bill, id, removeContactsBatch]);

  const handleAssignContact = useCallback(async (itemId: string) => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t.bill_permissionNeeded, t.bill_permissionContacts);
      return;
    }

    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Image, Contacts.Fields.Name],
      sort: Contacts.SortTypes.FirstName,
    });
    setPhoneContacts(data.filter((c): c is typeof c & { id: string } => !!c.id));
    setContactSearch('');
    setSelectedContactIds(new Set());
    setSingleAssignItemId(itemId);
    setShowContactPicker(true);
  }, [t]);

  const handleRemoveContact = useCallback((itemId: string, contactIndex: number) => {
    Alert.alert(t.bill_removeContact, t.bill_removeContactConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.remove,
        style: 'destructive',
        onPress: () => removeContact({ id: id as Id<'bills'>, userId, itemId, contactIndex }),
      },
    ]);
  }, [id, removeContact, t]);

  const handleTogglePaid = useCallback(async (contactIndex: number) => {
    await togglePaid({ id: id as Id<'bills'>, userId, contactIndex });
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [id, togglePaid]);

  const handleSendWhatsApp = useCallback((contact: { name: string; phone?: string; items: string[]; amount: number }) => {
    if (!bill || !contact.phone) {
      Alert.alert(t.bill_noPhone, t.bill_noPhoneMessage);
      return;
    }

    const billCountry = (bill.country as 'CO' | 'US') || 'CO';

    const itemLines = contact.items
      .map((itemId) => {
        const item = bill.items.find((billItem) => billItem.id === itemId);
        if (!item) return null;
        const numContacts = bill.contacts.filter((c) => c.items.includes(itemId)).length;
        const share = Math.round(item.subtotal / numContacts);
        return `- ${item.name}: ${formatCurrency(share, billCountry)}`;
      })
      .filter(Boolean)
      .join('\n');

    const message = `🧾 *${bill.name}*\n\n${t.wa_items}\n${itemLines}\n\n${t.wa_total(formatCurrency(contact.amount, billCountry))}\n\n${t.wa_footer}`;
    const url = `https://wa.me/${toE164(contact.phone)}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url);
  }, [bill, t]);

  const infographicRefs = useRef<Record<number, ViewShot | null>>({});

  const handleShareInfographic = useCallback(async (contact: { name: string; items: string[]; amount: number }, contactIndex: number) => {
    if (!bill) return;
    const ref = infographicRefs.current[contactIndex];
    if (!ref?.capture) return;

    try {
      const uri = await ref.capture();
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: `Bill summary for ${contact.name}`,
      });
    } catch (err) {
      console.error('[Share] Error:', err);
    }
  }, [bill]);

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

  // Loading state
  if (bill === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-background" style={{ paddingTop: insets.top }}>
        <ActivityIndicator size="large" color={iconColors.primary} />
      </View>
    );
  }

  if (!bill) {
    return (
      <View className="flex-1 items-center justify-center bg-background" style={{ paddingTop: insets.top }}>
        <Text className="text-lg font-semibold text-foreground">{t.error}</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-sm font-medium text-primary">{t.back}</Text>
        </Pressable>
      </View>
    );
  }

  const stateStyle = STATE_STYLES[bill.state];
  const stateLabel = t[STATE_LABEL_KEYS[bill.state]] as string;
  const subtotal = bill.items.reduce((sum, billItem) => sum + billItem.subtotal, 0);
  const billCountry = (bill.country as 'CO' | 'US') || 'CO';
  const billCategory = bill.category || 'dining';
  const taxConfig = getTaxConfig(billCountry, billCategory);
  const translatedTaxLabel = getTaxLabel(taxConfig, t);

  // Tax: extracted from tax-inclusive subtotal for CO, stored value for US
  const computedTax = taxConfig.taxIncluded
    ? computeTax(subtotal, taxConfig)
    : (bill.tax ?? 0);

  // Tip: computed from the bill's own tip percent
  const tipPercent = bill.tipPercent ?? 0;
  const computedTip = Math.round(subtotal * (tipPercent / 100));

  // Total: CO = subtotal + tip (tax already in prices), US = subtotal + tax + tip
  const total = taxConfig.taxIncluded
    ? subtotal + computedTip
    : subtotal + computedTax + computedTip;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header */}
      <View className="flex-row items-center gap-3 px-7 pb-2 pt-3">
        <Pressable onPress={() => router.back()} className="py-1 pr-1">
          <IconSymbol name="chevron.left" size={22} color={iconColors.primary} />
        </Pressable>
        <View className="flex-1">
          <Input
            value={bill.name}
            onChangeText={(text) => updateBill({ id: id as Id<'bills'>, userId, name: text })}
            className="h-auto border-0 bg-transparent px-0 py-0 text-xl font-bold shadow-none"
          />
        </View>
        <View className="flex-row items-center gap-2">
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: stateStyle.bg,
            }}
          >
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: stateStyle.dot }} />
            <Text style={{ fontSize: 11, fontWeight: '600', color: stateStyle.text }}>{stateLabel}</Text>
          </View>
          <Pressable
            onPress={() => {
              Alert.alert(
                t.bill_deleteBill,
                t.bill_deleteConfirm,
                [
                  { text: t.cancel, style: 'cancel' },
                  {
                    text: t.delete,
                    style: 'destructive',
                    onPress: async () => {
                      await removeBill({ id: id as Id<'bills'>, userId });
                      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      router.back();
                    },
                  },
                ]
              );
            }}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: 'rgba(239,68,68,0.1)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconSymbol name="xmark" size={14} color="#ef4444" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-8"
        showsVerticalScrollIndicator={false}
      >
        {/* Category + Location + time metadata */}
        <View className="mb-1 gap-1 px-7">
          {bill.category && (
            <View className="flex-row items-center gap-1.5">
              <Text style={{ fontSize: 12 }}>{CATEGORY_LABELS[bill.category]?.emoji ?? '📋'}</Text>
              <Text className="text-xs text-muted-foreground">
                {getCategoryLabel(bill.category, t)}
              </Text>
            </View>
          )}
        </View>
        {(bill.location?.address || bill.photoTakenAt) && (
          <View className="mb-1 gap-1 px-7">
            {bill.location?.address && (
              <View className="flex-row items-center gap-1.5">
                <Text style={{ fontSize: 12 }}>📍</Text>
                <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>
                  {bill.location.address}
                </Text>
              </View>
            )}
            <View className="flex-row items-center gap-1.5">
              <Text style={{ fontSize: 12 }}>🕐</Text>
              <Text className="text-xs text-muted-foreground">
                {(() => {
                  const photoTime = bill.photoTakenAt ? relativeTime(bill.photoTakenAt, t) : null;
                  const billTime = relativeTime(bill._creationTime, t) ?? 'unknown';
                  if (photoTime && photoTime === billTime) {
                    return t.time_photoAndBill(billTime);
                  }
                  if (photoTime) {
                    return t.time_photoBill(photoTime, billTime);
                  }
                  return t.time_created(billTime);
                })()}
              </Text>
            </View>
          </View>
        )}

        {/* Country row */}
        <Pressable
          onPress={() => setShowCountryDialog(true)}
          className="mb-1 px-7"
        >
          <View className="flex-row items-center gap-1.5">
            <Text style={{ fontSize: 12 }}>{billCountry === 'CO' ? '🇨🇴' : '🇺🇸'}</Text>
            <Text className="text-xs text-muted-foreground">
              {billCountry === 'CO' ? t.settings_countryColombia : t.settings_countryUSA}
            </Text>
            <IconSymbol name="chevron.right" size={10} color={iconColors.mutedLight} />
          </View>
        </Pressable>

        {/* Sort pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 28, gap: 6, paddingBottom: 8 }}
        >
          {([
            { key: 'original', label: t.sort_receipt },
            { key: 'price-desc', label: t.sort_priceDesc },
            { key: 'price-asc', label: t.sort_priceAsc },
            { key: 'alpha-asc', label: t.sort_alphaAsc },
            { key: 'alpha-desc', label: t.sort_alphaDesc },
          ] as const).map((opt) => (
            <Pressable
              key={opt.key}
              onPress={() => setSortStrategy(opt.key)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 999,
                backgroundColor: sortStrategy === opt.key ? 'rgba(56, 189, 248, 0.15)' : 'rgba(148,163,184,0.06)',
                borderWidth: 1,
                borderColor: sortStrategy === opt.key ? 'rgba(56, 189, 248, 0.3)' : 'rgba(148,163,184,0.12)',
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '600', color: sortStrategy === opt.key ? '#38bdf8' : '#8b9cc0' }}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Hint + multi-select toggle */}
        <View className="mb-2 flex-row items-center justify-between px-7">
          <Text className="text-xs text-muted-foreground">
            {multiSelectMode
              ? t.bill_selected(selectedItemIds.size)
              : t.bill_tapToEdit}
          </Text>
          <Pressable
            onPress={() => {
              setMultiSelectMode(!multiSelectMode);
              setSelectedItemIds(new Set());
              setEditingItemId(null);
            }}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: multiSelectMode ? 'rgba(56, 189, 248, 0.15)' : 'rgba(148,163,184,0.1)',
              borderWidth: 1,
              borderColor: multiSelectMode ? 'rgba(56, 189, 248, 0.3)' : 'rgba(148,163,184,0.2)',
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '600', color: multiSelectMode ? '#38bdf8' : '#8b9cc0' }}>
              {multiSelectMode ? t.cancel : t.bill_bulkEdit}
            </Text>
          </Pressable>
        </View>

        {/* Items */}
        {sortedItems.map((item, index) => {
          const itemId = item.id!;
          const assignedContacts = bill.contacts
            .map((c, contactIdx) => ({ ...c, contactIndex: contactIdx }))
            .filter((c) => c.items.includes(itemId));
          const isEditing = editingItemId === itemId;

          return (
            <SwipeableItem key={item.id ?? `legacy-${index}`} isDeleting={deletingId === item.id}>
            <Swipeable
              renderRightActions={(_progress, dragX) => (
                <Animated.View
                  style={{
                    flex: 1,
                    backgroundColor: '#ef4444',
                    justifyContent: 'center',
                    alignItems: 'flex-end',
                    paddingRight: 24,
                  }}
                >
                  <IconSymbol name="xmark" size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '500', marginTop: 2 }}>{t.delete}</Text>
                </Animated.View>
              )}
              rightThreshold={80}
              overshootRight
              onSwipeableOpen={() => handleRemoveItem(itemId)}
              onSwipeableOpenStartDrag={() => { swipeOpenRef.current = true; }}
            >
              {isEditing ? (
                /* Edit mode */
                <View className="border-l-2 border-l-primary bg-primary/5 px-7 py-3.5">
                  <View className="mb-3 flex-row items-center justify-between">
                    <Input
                      value={item.name}
                      onChangeText={(v) => handleUpdateItem(itemId, 'name', v)}
                      className="h-auto flex-1 border-0 bg-transparent px-0 py-0 text-[15px] font-semibold shadow-none"
                      placeholder={t.scan_itemName}
                      autoFocus
                    />
                    <Pressable
                      onPress={() => setEditingItemId(null)}
                      className="ml-3 rounded-full bg-destructive/15 px-3 py-1"
                    >
                      <Text className="text-xs font-semibold text-destructive">{t.cancel}</Text>
                    </Pressable>
                  </View>
                  <View className="flex-row gap-2.5">
                    <View className="flex-1">
                      <Text className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t.scan_qty}</Text>
                      <Input
                        value={String(item.quantity)}
                        onChangeText={(v) => handleUpdateItem(itemId, 'quantity', v)}
                        className="h-9 rounded-lg border-0 bg-muted px-3 py-1 text-sm font-medium shadow-none"
                        keyboardType="number-pad"
                      />
                    </View>
                    <View className="flex-[2]">
                      <Text className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t.scan_unitPrice}</Text>
                      <Input
                        value={formatCurrency(item.unitPrice, billCountry)}
                        onChangeText={(v) => handleUpdateItem(itemId, 'unitPrice', v)}
                        className="h-9 rounded-lg border-0 bg-muted px-3 py-1 text-sm font-medium shadow-none"
                        keyboardType="number-pad"
                      />
                    </View>
                    <View className="flex-[2]">
                      <Text className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t.scan_subtotalLabel}</Text>
                      <View className="h-9 items-end justify-center rounded-lg px-3 py-1">
                        <Text className="text-sm font-bold text-primary">
                          {formatCurrency(item.subtotal, billCountry)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => setEditingItemId(null)}
                    className="mt-3 items-center rounded-lg bg-primary/10 py-2"
                  >
                    <Text className="text-sm font-semibold text-primary">{t.done}</Text>
                  </Pressable>
                </View>
              ) : (
                /* Display mode */
                <Pressable
                  onPress={() => multiSelectMode ? toggleItemSelection(itemId) : handleItemPress(itemId)}
                  className="flex-row items-start bg-background px-7 py-3 active:opacity-80"
                >
                  {/* Checkbox in multi-select mode */}
                  {multiSelectMode && (
                    <View className="mr-3 justify-center pt-1">
                      <IconSymbol
                        name={selectedItemIds.has(itemId) ? 'checkmark.circle.fill' : 'circle'}
                        size={22}
                        color={selectedItemIds.has(itemId) ? '#38bdf8' : '#64748b'}
                      />
                    </View>
                  )}
                  <View className="mr-3 flex-1">
                    <Text className="text-[15px] font-semibold leading-5 text-foreground" numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text className="mt-0.5 text-xs text-muted-foreground">
                      {item.quantity} × {formatCurrency(item.unitPrice, billCountry)}
                    </Text>

                    {/* Contact chips */}
                    {assignedContacts.length > 0 && (
                      <View className="mt-2 flex-row flex-wrap gap-1.5">
                        {assignedContacts.map((c) => (
                          <Pressable
                            key={c.contactIndex}
                            onPress={() => item.id && handleRemoveContact(item.id, c.contactIndex)}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 4,
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 999,
                              backgroundColor: 'rgba(56, 189, 248, 0.1)',
                              borderWidth: 1,
                              borderColor: 'rgba(56, 189, 248, 0.2)',
                            }}
                          >
                            {c.imageUri ? (
                              <Image source={{ uri: c.imageUri }} style={{ width: 14, height: 14, borderRadius: 7 }} />
                            ) : (
                              <IconSymbol name="person.crop.circle" size={12} color={iconColors.primary} />
                            )}
                            <Text style={{ fontSize: 11, fontWeight: '500', color: iconColors.primary }}>
                              {c.name}
                            </Text>
                            <IconSymbol name="xmark" size={8} color={iconColors.primary} />
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>

                  <View className="items-end gap-1">
                    <Text className="text-[15px] font-bold tabular-nums text-foreground">
                      {formatCurrency(item.subtotal, billCountry)}
                    </Text>
                    {!multiSelectMode && (
                      <Pressable
                        onPress={() => handleAssignContact(itemId)}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: 'rgba(56, 189, 248, 0.1)',
                          borderWidth: 1,
                          borderColor: 'rgba(56, 189, 248, 0.2)',
                        }}
                      >
                        <IconSymbol name="plus" size={14} color={iconColors.primary} />
                      </Pressable>
                    )}
                  </View>
                </Pressable>
              )}
              {/* Divider */}
              {index < sortedItems.length - 1 && (
                <View className="ml-7 h-px bg-border/40" />
              )}
            </Swipeable>
            </SwipeableItem>
          );
        })}

        {/* Summary divider */}
        <View className="mx-7 mt-3 h-px bg-border/40" />

        {/* Summary */}
        <View className="flex-row items-center justify-between px-7 py-3">
          <Text className="text-sm text-muted-foreground">{t.bill_subtotal}</Text>
          <Text className="text-sm font-semibold tabular-nums text-foreground">{formatCurrency(subtotal, billCountry)}</Text>
        </View>
        <View className="flex-row items-center justify-between px-7 py-3">
          <Text className="text-sm text-foreground">{translatedTaxLabel}</Text>
          {taxConfig.taxIncluded ? (
            <Text className="text-sm font-semibold tabular-nums text-muted-foreground">
              {formatCurrency(computedTax, billCountry)}
            </Text>
          ) : (
            <Input
              value={formatCurrency(computedTax, billCountry)}
              onChangeText={handleUpdateTax}
              className="h-auto w-32 border-0 bg-transparent px-0 py-0 text-right text-sm font-semibold tabular-nums shadow-none"
              keyboardType="number-pad"
            />
          )}
        </View>
        <Pressable
          className="flex-row items-center justify-between px-7 py-3 active:bg-muted/30"
          onPress={() => setShowTipDialog(true)}
        >
          <View className="flex-row items-center gap-1">
            <Text className="text-sm text-foreground">{t.bill_tip(tipPercent)}</Text>
            <IconSymbol name="chevron.right" size={12} color={iconColors.mutedLight} />
          </View>
          <Text className="text-sm font-semibold tabular-nums text-foreground">
            {formatCurrency(computedTip, billCountry)}
          </Text>
        </Pressable>
        <View className="mx-7 h-px bg-border/40" />
        <View className="flex-row items-center justify-between px-7 py-4">
          <Text className="text-sm font-bold text-foreground">{t.bill_total}</Text>
          <Text className="text-2xl font-extrabold tracking-tight text-primary">{formatCurrency(total, billCountry)}</Text>
        </View>

      </ScrollView>

      {/* Share button — only when contacts exist */}
      {!multiSelectMode && bill.contacts.length > 0 && bill.state !== 'draft' && (
        <View className="border-t border-border/30 px-7 pb-2 pt-3">
          <Pressable
            onPress={() => setShowShareSheet(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 14,
              borderRadius: 14,
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              borderWidth: 1,
              borderColor: 'rgba(56, 189, 248, 0.2)',
            }}
          >
            <IconSymbol name="person.crop.circle" size={18} color={iconColors.primary} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: iconColors.primary }}>
              {t.share_button(bill.contacts.length)}
            </Text>
          </Pressable>
        </View>
      )}

      <BillShareSheet
        visible={showShareSheet}
        bill={bill}
        billCountry={billCountry}
        taxConfig={taxConfig}
        tipPercent={tipPercent}
        translatedTaxLabel={translatedTaxLabel}
        bottomInset={insets.bottom}
        infographicRefs={infographicRefs}
        onTogglePaid={handleTogglePaid}
        onSendWhatsApp={handleSendWhatsApp}
        onShareInfographic={handleShareInfographic}
        onClose={() => setShowShareSheet(false)}
      />

      <ContactPickerSheet
        visible={showContactPicker}
        phoneContacts={phoneContacts}
        contactSearch={contactSearch}
        selectedContactIds={selectedContactIds}
        bottomInset={insets.bottom}
        onSearchChange={setContactSearch}
        onToggleContact={(contactId) => {
          setSelectedContactIds((prev) => {
            const next = new Set(prev);
            if (next.has(contactId)) next.delete(contactId);
            else next.add(contactId);
            return next;
          });
        }}
        onConfirm={handleConfirmContactPicker}
        onClose={() => { setShowContactPicker(false); setSingleAssignItemId(null); }}
      />

      {bill && (
        <UnassignPickerSheet
          visible={showUnassignPicker}
          contacts={bill.contacts.map((c, contactIdx) => ({ ...c, contactIndex: contactIdx }))}
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
          onClose={() => setShowUnassignPicker(false)}
        />
      )}

      <TipDialog
        visible={showTipDialog}
        tipPercent={tipPercent}
        subtotal={subtotal}
        billCountry={billCountry}
        onSelectTip={async (pct, newTip) => {
          await updateBill({ id: id as Id<'bills'>, userId, tipPercent: pct, tip: newTip });
          setShowTipDialog(false);
        }}
        onClose={() => setShowTipDialog(false)}
      />

      <CountryDialog
        visible={showCountryDialog}
        billCountry={billCountry}
        onSelectCountry={async (code) => {
          await updateBill({ id: id as Id<'bills'>, userId, country: code });
          setShowCountryDialog(false);
        }}
        onClose={() => setShowCountryDialog(false)}
      />

      {multiSelectMode && selectedItemIds.size > 0 && (
        <BulkToolbar
          selectedItemIds={selectedItemIds}
          hasContactsOnSelection={bill.contacts.some((c) =>
            c.items.some((itemId) => selectedItemIds.has(itemId))
          )}
          onAssign={handleMultiAssign}
          onUnassign={handleBulkRemoveContact}
          onDelete={handleBulkDelete}
        />
      )}

      {/* Confirm button for draft bills */}
      {!multiSelectMode && bill.state === 'draft' && (
        <View className="border-t border-border/30 px-7 pb-2 pt-3">
          <Pressable
            onPress={async () => {
              await updateBill({ id: id as Id<'bills'>, userId, state: 'unsplit' });
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            }}
            className="items-center rounded-xl bg-primary py-4 active:opacity-80"
          >
            <View className="flex-row items-center gap-2">
              <IconSymbol name="checkmark" size={18} color={colorScheme === 'dark' ? '#0c1a2a' : '#ffffff'} />
              <Text style={{ fontSize: 16, fontWeight: '600', color: colorScheme === 'dark' ? '#0c1a2a' : '#ffffff' }}>
                {t.bill_confirmItems}
              </Text>
            </View>
          </Pressable>
        </View>
      )}
    </View>
  );
}


