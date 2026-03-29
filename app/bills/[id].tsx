import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, Pressable, ScrollView, TextInput, TouchableWithoutFeedback, View } from 'react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import * as Contacts from 'expo-contacts';
import * as Haptics from 'expo-haptics';
import { Swipeable } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, runOnJS } from 'react-native-reanimated';
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
import { WhatsAppIcon } from '@/components/icons/whatsapp';
import { Share2 } from 'lucide-react-native';

type BillState = 'draft' | 'unsplit' | 'split' | 'unresolved';

function parseExifDate(value: string): Date {
  // EXIF format: "2026:03:11 19:30:00" → "2026-03-11T19:30:00"
  const fixed = value.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3').replace(' ', 'T');
  return new Date(fixed);
}

function relativeTime(timestamp: string | number, t: Translations): string | null {
  const time = typeof timestamp === 'string' ? parseExifDate(timestamp).getTime() : timestamp;
  if (isNaN(time)) return null;
  const now = Date.now();
  const diff = now - time;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t.time_justNow;
  if (minutes < 60) return t.time_minutesAgo(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t.time_hoursAgo(hours);
  const days = Math.floor(hours / 24);
  if (days === 1) return t.time_yesterday;
  if (days < 7) return t.time_daysAgo(days);
  return new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const STATE_STYLES: Record<BillState, { dot: string; bg: string; text: string }> = {
  draft: { dot: '#6366f1', bg: 'rgba(99,102,241,0.15)', text: '#6366f1' },
  unsplit: { dot: '#94a3b8', bg: 'rgba(148,163,184,0.15)', text: '#94a3b8' },
  split: { dot: '#10b981', bg: 'rgba(16,185,129,0.15)', text: '#10b981' },
  unresolved: { dot: '#f59e0b', bg: 'rgba(245,158,11,0.15)', text: '#f59e0b' },
};

const STATE_LABEL_KEYS: Record<BillState, keyof Translations> = {
  draft: 'state_draft',
  unsplit: 'state_unsplit',
  split: 'state_split',
  unresolved: 'state_unresolved',
};

const TAX_LABEL_MAP: Record<string, keyof Translations> = {
  'Impoconsumo (included)': 'tax_impoconsumo',
  'IVA (included)': 'tax_iva',
  'Sales Tax': 'tax_salesTax',
};

const CATEGORY_KEY_MAP: Record<string, keyof Translations> = {
  dining: 'category_dining',
  retail: 'category_retail',
  service: 'category_service',
};

function getTaxLabel(taxConfig: TaxConfig, t: Translations): string {
  const key = TAX_LABEL_MAP[taxConfig.taxLabel];
  return key ? (t[key] as string) : taxConfig.taxLabel;
}

function getCategoryLabel(category: string, t: Translations): string {
  const key = CATEGORY_KEY_MAP[category];
  return key ? (t[key] as string) : category;
}

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
    const remaining = currentBill.items.filter((i) => i.id !== itemId);
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
            const remaining = bill.items.filter((i) => !selectedItemIds.has(i.id!));
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
      .map((c, ci) => ({ ...c, contactIndex: ci }))
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
              itemIds: selectedIds.filter((i): i is string => !!i),
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
      const ci = parseInt(ciStr, 10);
      return bill.contacts[ci]?.name;
    }).filter((n): n is string => !!n);

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
        const item = bill.items.find((i) => i.id === itemId);
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
  const subtotal = bill.items.reduce((sum, i) => sum + i.subtotal, 0);
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
            .map((c, ci) => ({ ...c, contactIndex: ci }))
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

      {/* Share sheet modal */}
      <Modal
        visible={showShareSheet}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowShareSheet(false)}
      >
        <View className="flex-1 bg-background" style={{ paddingTop: 12, paddingBottom: insets.bottom }}>
          {/* Modal header */}
          <View className="items-center pb-2">
            <View className="h-1 w-10 rounded-full bg-muted-foreground/30" />
          </View>
          <View className="flex-row items-center justify-between px-7 pb-4 pt-2">
            <Text className="text-xl font-bold text-foreground">{t.share_title}</Text>
            <Pressable onPress={() => setShowShareSheet(false)} className="rounded-full bg-muted p-2">
              <IconSymbol name="xmark" size={14} color={iconColors.muted} />
            </Pressable>
          </View>

          <ScrollView className="flex-1" contentContainerClassName="px-7 pb-8">
            {bill.contacts.map((contact, ci) => {
              // Compute per-contact amounts
              const contactItemAmounts = contact.items.map((itemId) => {
                const item = bill.items.find((i) => i.id === itemId);
                if (!item) return 0;
                const numContacts = bill.contacts.filter((c) => c.items.includes(itemId)).length;
                return Math.round(item.subtotal / numContacts);
              });
              const contactSubtotal = contactItemAmounts.reduce((s, a) => s + a, 0);
              const contactTax = computeTax(contactSubtotal, taxConfig);
              const contactTip = Math.round(contactSubtotal * (tipPercent / 100));
              const contactTotal = taxConfig.taxIncluded
                ? contactSubtotal + contactTip
                : contactSubtotal + contactTax + contactTip;

              return (
              <View key={ci} className="mb-4">
                {/* Contact header */}
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    {contact.imageUri ? (
                      <Image source={{ uri: contact.imageUri }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                    ) : (
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: 'rgba(56, 189, 248, 0.1)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 16, fontWeight: '700', color: iconColors.primary }}>
                          {contact.name[0]?.toUpperCase() ?? '?'}
                        </Text>
                      </View>
                    )}
                    <View>
                      <Text className="text-base font-semibold text-foreground">{contact.name}</Text>
                      <Text className="text-xs text-muted-foreground">
                        {contact.items.length} {contact.items.length === 1 ? 'item' : 'items'}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-lg font-bold tabular-nums text-foreground">
                    {formatCurrency(contactTotal, billCountry)}
                  </Text>
                </View>

                {/* Contact items — two column */}
                <View className="ml-[52px] mt-2 flex-row flex-wrap">
                  {contact.items.map((itemId) => {
                    const item = bill.items.find((i) => i.id === itemId);
                    if (!item) return null;
                    const numContacts = bill.contacts.filter((c) => c.items.includes(itemId)).length;
                    const share = Math.round(item.subtotal / numContacts);
                    return (
                      <View key={itemId} style={{ width: '50%', paddingRight: 8, marginBottom: 4 }}>
                        <Text className="text-xs text-foreground" numberOfLines={1}>{item.name}</Text>
                        <Text className="text-[11px] text-muted-foreground">{formatCurrency(share, billCountry)}</Text>
                      </View>
                    );
                  })}
                </View>

                {/* Tax & Tip breakdown */}
                <View className="ml-[52px] mt-2 gap-1">
                  <View className="flex-row justify-between">
                    <Text className="text-[11px] text-muted-foreground">{translatedTaxLabel}</Text>
                    <Text className="text-[11px] text-muted-foreground">{formatCurrency(contactTax, billCountry)}</Text>
                  </View>
                  {tipPercent > 0 && (
                    <View className="flex-row justify-between">
                      <Text className="text-[11px] text-muted-foreground">{t.bill_tip(tipPercent)}</Text>
                      <Text className="text-[11px] text-muted-foreground">{formatCurrency(contactTip, billCountry)}</Text>
                    </View>
                  )}
                </View>

                {/* Actions */}
                <View className="ml-[52px] mt-3 flex-row gap-2">
                  {/* Paid toggle */}
                  <Pressable
                    onPress={() => handleTogglePaid(ci)}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      paddingVertical: 10,
                      borderRadius: 12,
                      backgroundColor: contact.paid ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.1)',
                      borderWidth: 1,
                      borderColor: contact.paid ? 'rgba(16,185,129,0.3)' : 'rgba(148,163,184,0.2)',
                    }}
                  >
                    <IconSymbol
                      name={contact.paid ? 'checkmark.circle.fill' : 'circle'}
                      size={16}
                      color={contact.paid ? '#10b981' : '#94a3b8'}
                    />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: contact.paid ? '#10b981' : '#94a3b8' }}>
                      {contact.paid ? t.share_paid : t.share_unpaid}
                    </Text>
                  </Pressable>

                  {/* WhatsApp text */}
                  {contact.phone && (
                    <Pressable
                      onPress={() => handleSendWhatsApp(contact)}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        paddingVertical: 10,
                        borderRadius: 12,
                        backgroundColor: 'rgba(37,211,102,0.15)',
                        borderWidth: 1,
                        borderColor: 'rgba(37,211,102,0.3)',
                      }}
                    >
                      <WhatsAppIcon size={16} color="#25d366" />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#25d366' }}>{t.share_whatsapp}</Text>
                    </Pressable>
                  )}

                  {/* Share infographic */}
                  <Pressable
                    onPress={() => handleShareInfographic(contact, ci)}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      paddingVertical: 10,
                      borderRadius: 12,
                      backgroundColor: 'rgba(56, 189, 248, 0.1)',
                      borderWidth: 1,
                      borderColor: 'rgba(56, 189, 248, 0.2)',
                    }}
                  >
                    <Share2 size={14} color="#38bdf8" />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#38bdf8' }}>{t.share_share}</Text>
                  </Pressable>
                </View>

                {/* Hidden infographic for capture */}
                <View style={{ position: 'absolute', left: -9999 }}>
                  <ViewShot
                    ref={(ref) => { infographicRefs.current[ci] = ref; }}
                    options={{ format: 'png', quality: 1 }}
                  >
                    <BillInfographic
                      billName={bill.name}
                      contactName={contact.name}
                      contactImageUri={contact.imageUri}
                      items={contact.items
                        .map((itemId) => {
                          const item = bill.items.find((i) => i.id === itemId);
                          if (!item) return null;
                          const numContacts = bill.contacts.filter((c) => c.items.includes(itemId)).length;
                          const amount = Math.round(item.subtotal / numContacts);
                          if (amount === 0) return null;
                          return { name: item.name, amount };
                        })
                        .filter((i): i is { name: string; amount: number } => i !== null)}
                      taxConfig={taxConfig}
                      tipPercent={tipPercent}
                      location={bill.location?.address}
                      date={bill.photoTakenAt ?? new Date(bill._creationTime).toISOString()}
                      country={billCountry}
                      t={t}
                    />
                  </ViewShot>
                </View>

                {/* Divider */}
                {ci < bill.contacts.length - 1 && (
                  <View className="ml-[52px] mt-4 h-px bg-border/40" />
                )}
              </View>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      {/* Contact picker modal (multi-select) */}
      <Modal
        visible={showContactPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setShowContactPicker(false); setSingleAssignItemId(null); }}
      >
        <View className="flex-1 bg-background" style={{ paddingTop: 12, paddingBottom: insets.bottom }}>
          <View className="items-center pb-2">
            <View className="h-1 w-10 rounded-full bg-muted-foreground/30" />
          </View>
          <View className="flex-row items-center justify-between px-7 pb-3 pt-2">
            <Text className="text-xl font-bold text-foreground">{t.contactPicker_title}</Text>
            <Pressable onPress={() => { setShowContactPicker(false); setSingleAssignItemId(null); }} className="rounded-full bg-muted p-2">
              <IconSymbol name="xmark" size={14} color={iconColors.muted} />
            </Pressable>
          </View>

          {/* Search */}
          <View className="px-7 pb-3">
            <TextInput
              value={contactSearch}
              onChangeText={setContactSearch}
              placeholder={t.contactPicker_search}
              placeholderTextColor="#64748b"
              style={{
                backgroundColor: 'rgba(148,163,184,0.08)',
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 10,
                fontSize: 15,
                color: '#e8ecf4',
              }}
            />
          </View>

          <ScrollView className="flex-1" contentContainerClassName="px-7 pb-8">
            {phoneContacts
              .filter((c) => {
                if (!contactSearch) return true;
                const name = `${c.firstName ?? ''} ${c.lastName ?? ''}`.toLowerCase();
                return name.includes(contactSearch.toLowerCase());
              })
              .map((c) => {
                const isSelected = selectedContactIds.has(c.id!);
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => {
                      setSelectedContactIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(c.id!)) next.delete(c.id!);
                        else next.add(c.id!);
                        return next;
                      });
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 10,
                      gap: 12,
                    }}
                  >
                    <IconSymbol
                      name={isSelected ? 'checkmark.circle.fill' : 'circle'}
                      size={22}
                      color={isSelected ? '#38bdf8' : '#64748b'}
                    />
                    {c.image?.uri ? (
                      <Image source={{ uri: c.image.uri }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                    ) : (
                      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(56,189,248,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#38bdf8' }}>
                          {(c.firstName?.[0] ?? '?').toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View className="flex-1">
                      <Text className="text-sm font-medium text-foreground">
                        {`${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || 'Unknown'}
                      </Text>
                      {c.phoneNumbers?.[0]?.number && (
                        <Text className="text-xs text-muted-foreground">{c.phoneNumbers[0].number}</Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
          </ScrollView>

          {selectedContactIds.size > 0 && (
            <View className="border-t border-border/30 px-7 pb-2 pt-3">
              <Pressable
                onPress={handleConfirmContactPicker}
                className="items-center rounded-xl bg-primary py-4 active:opacity-80"
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: colorScheme === 'dark' ? '#0c1a2a' : '#ffffff' }}>
                  {t.contactPicker_assign(selectedContactIds.size)}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>

      {/* Unassign picker modal (multi-select from bill contacts) */}
      {bill && (
        <Modal
          visible={showUnassignPicker}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowUnassignPicker(false)}
        >
          <View className="flex-1 bg-background" style={{ paddingTop: 12, paddingBottom: insets.bottom }}>
            <View className="items-center pb-2">
              <View className="h-1 w-10 rounded-full bg-muted-foreground/30" />
            </View>
            <View className="flex-row items-center justify-between px-7 pb-3 pt-2">
              <Text className="text-xl font-bold text-foreground">{t.unassignPicker_title}</Text>
              <Pressable onPress={() => setShowUnassignPicker(false)} className="rounded-full bg-muted p-2">
                <IconSymbol name="xmark" size={14} color={iconColors.muted} />
              </Pressable>
            </View>

            <ScrollView className="flex-1" contentContainerClassName="px-7 pb-8">
              {(() => {
                const contactsOnSelected = bill.contacts
                  .map((c, ci) => ({ ...c, contactIndex: ci }))
                  .filter((c) => c.items.some((itemId) => selectedItemIds.has(itemId)));

                return contactsOnSelected.map((c) => {
                  const isSelected = selectedContactIds.has(String(c.contactIndex));
                  const itemCount = c.items.filter((itemId) => selectedItemIds.has(itemId)).length;
                  return (
                    <Pressable
                      key={c.contactIndex}
                      onPress={() => {
                        setSelectedContactIds((prev) => {
                          const next = new Set(prev);
                          const key = String(c.contactIndex);
                          if (next.has(key)) next.delete(key);
                          else next.add(key);
                          return next;
                        });
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 12,
                        gap: 12,
                      }}
                    >
                      <IconSymbol
                        name={isSelected ? 'checkmark.circle.fill' : 'circle'}
                        size={22}
                        color={isSelected ? '#ef4444' : '#64748b'}
                      />
                      {c.imageUri ? (
                        <Image source={{ uri: c.imageUri }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                      ) : (
                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(56,189,248,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: '#38bdf8' }}>
                            {(c.name[0] ?? '?').toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View className="flex-1">
                        <Text className="text-sm font-medium text-foreground">{c.name}</Text>
                        <Text className="text-xs text-muted-foreground">
                          {t.unassignPicker_itemsOnSelection(itemCount)}
                        </Text>
                      </View>
                    </Pressable>
                  );
                });
              })()}
            </ScrollView>

            {selectedContactIds.size > 0 && (
              <View className="border-t border-border/30 px-7 pb-2 pt-3">
                <Pressable
                  onPress={() => {
                    Alert.alert(
                      t.bill_confirmRemoval,
                      t.bill_removeMultipleConfirm(selectedContactIds.size),
                      [
                        { text: t.cancel, style: 'cancel' },
                        { text: t.remove, style: 'destructive', onPress: handleConfirmUnassign },
                      ]
                    );
                  }}
                  style={{
                    alignItems: 'center',
                    paddingVertical: 16,
                    borderRadius: 14,
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    borderWidth: 1,
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#ef4444' }}>
                    {t.unassignPicker_remove(selectedContactIds.size)}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </Modal>
      )}

      {/* Tip dialog */}
      <Modal
        visible={showTipDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTipDialog(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowTipDialog(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
            <TouchableWithoutFeedback>
              <View className="mx-8 w-80 rounded-2xl border border-border bg-card p-6">
                <Text className="mb-4 text-center text-lg font-bold text-foreground">{t.tipDialog_title}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {[0, 5, 10, 15, 18, 20].map((pct) => (
                    <Pressable
                      key={pct}
                      onPress={async () => {
                        const newTip = Math.round(subtotal * (pct / 100));
                        await updateBill({ id: id as Id<'bills'>, userId, tipPercent: pct, tip: newTip });
                        setShowTipDialog(false);
                      }}
                      style={{
                        flex: 1,
                        minWidth: 70,
                        alignItems: 'center',
                        paddingVertical: 12,
                        borderRadius: 12,
                        backgroundColor: tipPercent === pct ? 'rgba(56, 189, 248, 0.15)' : 'rgba(148,163,184,0.06)',
                        borderWidth: 1.5,
                        borderColor: tipPercent === pct ? 'rgba(56, 189, 248, 0.35)' : 'rgba(148,163,184,0.12)',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: '700',
                          color: tipPercent === pct ? '#38bdf8' : '#64748b',
                        }}
                      >
                        {pct}%
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable
                  onPress={() => setShowTipDialog(false)}
                  className="mt-4 items-center rounded-xl bg-muted py-3"
                >
                  <Text className="text-sm font-semibold text-muted-foreground">{t.cancel}</Text>
                </Pressable>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Country dialog */}
      <Modal
        visible={showCountryDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCountryDialog(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowCountryDialog(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
            <TouchableWithoutFeedback>
              <View className="mx-8 w-80 rounded-2xl border border-border bg-card p-6">
                <Text className="mb-4 text-center text-lg font-bold text-foreground">{t.countryDialog_title}</Text>
                <View style={{ gap: 8 }}>
                  {([
                    { code: 'CO' as const, flag: '🇨🇴', label: t.settings_countryColombia },
                    { code: 'US' as const, flag: '🇺🇸', label: t.settings_countryUSA },
                  ]).map((option) => (
                    <Pressable
                      key={option.code}
                      onPress={async () => {
                        await updateBill({ id: id as Id<'bills'>, userId, country: option.code });
                        setShowCountryDialog(false);
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        paddingVertical: 14,
                        paddingHorizontal: 16,
                        borderRadius: 12,
                        backgroundColor: billCountry === option.code ? 'rgba(56, 189, 248, 0.15)' : 'rgba(148,163,184,0.06)',
                        borderWidth: 1.5,
                        borderColor: billCountry === option.code ? 'rgba(56, 189, 248, 0.35)' : 'rgba(148,163,184,0.12)',
                      }}
                    >
                      <Text style={{ fontSize: 20 }}>{option.flag}</Text>
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: '600',
                          color: billCountry === option.code ? '#38bdf8' : '#64748b',
                        }}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable
                  onPress={() => setShowCountryDialog(false)}
                  className="mt-4 items-center rounded-xl bg-muted py-3"
                >
                  <Text className="text-sm font-semibold text-muted-foreground">{t.cancel}</Text>
                </Pressable>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Bulk edit toolbar */}
      {multiSelectMode && selectedItemIds.size > 0 && (() => {
        const hasContacts = bill.contacts.some((c) =>
          c.items.some((itemId) => selectedItemIds.has(itemId))
        );

        return (
          <View className="border-t border-border/30 px-7 pb-2 pt-3">
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {/* Assign contact */}
              <Pressable
                onPress={handleMultiAssign}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: 'rgba(56, 189, 248, 0.1)',
                  borderWidth: 1,
                  borderColor: 'rgba(56, 189, 248, 0.2)',
                }}
              >
                <IconSymbol name="person.crop.circle" size={16} color="#38bdf8" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#38bdf8' }}>{t.bulk_assign}</Text>
              </Pressable>

              {/* Remove contact — only if any selected item has contacts */}
              {hasContacts && (
                <Pressable
                  onPress={handleBulkRemoveContact}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: 12,
                    borderRadius: 12,
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    borderWidth: 1,
                    borderColor: 'rgba(245, 158, 11, 0.2)',
                  }}
                >
                  <IconSymbol name="person.crop.circle" size={16} color="#f59e0b" />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#f59e0b' }}>{t.bulk_unassign}</Text>
                </Pressable>
              )}

              {/* Delete items */}
              <Pressable
                onPress={handleBulkDelete}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  borderWidth: 1,
                  borderColor: 'rgba(239, 68, 68, 0.2)',
                }}
              >
                <IconSymbol name="xmark" size={14} color="#ef4444" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#ef4444' }}>{t.bulk_delete}</Text>
              </Pressable>
            </View>
          </View>
        );
      })()}

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

const RECEIPT_WIDTH = 460;
const RECEIPT_PADDING = 20;
const PAPER_WIDTH = RECEIPT_WIDTH - RECEIPT_PADDING * 2;
const BG_COLOR = '#e8e4df';

const PERF_SIZE = 11;
const PERF_HEIGHT = PERF_SIZE / 2;

function ReceiptPerforations({ position }: { position: 'top' | 'bottom' }) {
  const gap = 3;
  const count = Math.floor(PAPER_WIDTH / (PERF_SIZE + gap));
  const totalWidth = count * (PERF_SIZE + gap) - gap;
  const offset = (PAPER_WIDTH - totalWidth) / 2;
  return (
    <View style={{
      width: PAPER_WIDTH,
      height: PERF_HEIGHT,
      backgroundColor: '#fafaf8',
      overflow: 'hidden',
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            width: PERF_SIZE,
            height: PERF_SIZE,
            borderRadius: PERF_SIZE / 2,
            backgroundColor: BG_COLOR,
            position: 'absolute',
            left: offset + i * (PERF_SIZE + gap),
            top: position === 'top' ? -(PERF_SIZE / 2) : 0,
          }}
        />
      ))}
    </View>
  );
}

function ReceiptDotLine() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 14 }}>
      {Array.from({ length: 40 }).map((_, i) => (
        <View key={i} style={{ height: 1, borderRadius: 0.5, flex: 1, marginHorizontal: 1.5, backgroundColor: '#e2e8f0' }} />
      ))}
    </View>
  );
}

function BillInfographic({
  billName,
  contactName,
  contactImageUri,
  items,
  taxConfig: infTaxConfig,
  tipPercent,
  location,
  date,
  country,
  t,
}: {
  billName: string;
  contactName: string;
  contactImageUri?: string;
  items: { name: string; amount: number }[];
  taxConfig: TaxConfig;
  tipPercent: number;
  location?: string;
  date: string;
  country: 'CO' | 'US';
  t: Translations;
}) {
  const d = new Date(date);
  const isValidDate = !isNaN(d.getTime());
  const locale = country === 'US' ? 'en-US' : 'es-CO';
  const dateStr = isValidDate
    ? d.toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' })
    : '';

  const contactSubtotal = items.reduce((sum, i) => sum + i.amount, 0);
  const contactTax = computeTax(contactSubtotal, infTaxConfig);
  const contactTip = Math.round(contactSubtotal * (tipPercent / 100));
  const contactTotal = infTaxConfig.taxIncluded
    ? contactSubtotal + contactTip
    : contactSubtotal + contactTax + contactTip;

  const translatedTaxLabel = getTaxLabel(infTaxConfig, t);
  const flag = country === 'CO' ? '🇨🇴' : '🇺🇸';

  return (
    <View style={{ width: RECEIPT_WIDTH, backgroundColor: BG_COLOR, paddingVertical: RECEIPT_PADDING }}>
      <View style={{ position: 'relative', alignSelf: 'center', width: PAPER_WIDTH }}>
        {/* Perforated top edge — absolute, behind paper */}
        <View style={{ position: 'absolute', top: 0, left: 0, zIndex: 0 }}>
          <ReceiptPerforations position="top" />
        </View>

        {/* Perforated bottom edge — absolute, behind paper */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, zIndex: 0 }}>
          <ReceiptPerforations position="bottom" />
        </View>

        {/* Receipt paper — on top, overlapping perforations by 1px */}
        <View style={{ backgroundColor: '#fafaf8', zIndex: 1, marginVertical: PERF_HEIGHT - 1 }}>
          <View style={{ paddingHorizontal: 28, paddingTop: 22, paddingBottom: 20 }}>

          {/* Header: Brand + Country badge */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#0a7ea4', letterSpacing: 4, textTransform: 'uppercase' }}>
              Rondas
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
              <Text style={{ fontSize: 12 }}>{flag}</Text>
              <Text style={{ fontSize: 9, fontWeight: '700', color: '#64748b', letterSpacing: 0.5 }}>
                {country === 'CO' ? 'COP' : 'USD'}
              </Text>
            </View>
          </View>

          {/* Venue */}
          <View style={{ marginBottom: 4 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#0f172a' }}>
              {billName}
            </Text>
            {location && !location.startsWith(billName) && (
              <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }} numberOfLines={2}>
                {location}
              </Text>
            )}
            {dateStr && (
              <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                {dateStr}
              </Text>
            )}
          </View>

          <ReceiptDotLine />

          {/* Bill for contact */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            {contactImageUri ? (
              <Image source={{ uri: contactImageUri }} style={{ width: 32, height: 32, borderRadius: 16 }} />
            ) : (
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#e0f2fe', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#0a7ea4' }}>
                  {contactName[0]?.toUpperCase() ?? '?'}
                </Text>
              </View>
            )}
            <View>
              <Text style={{ fontSize: 8, color: '#94a3b8', fontWeight: '600', letterSpacing: 1.5, textTransform: 'uppercase' }}>{t.infographic_billFor}</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#0f172a' }}>{contactName}</Text>
            </View>
          </View>

          {/* Column headers */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 6, borderBottomWidth: 1.5, borderBottomColor: '#e2e8f0' }}>
            <Text style={{ fontSize: 8, fontWeight: '700', color: '#94a3b8', letterSpacing: 1.5, textTransform: 'uppercase' }}>{t.infographic_item}</Text>
            <Text style={{ fontSize: 8, fontWeight: '700', color: '#94a3b8', letterSpacing: 1.5, textTransform: 'uppercase' }}>{t.infographic_amount}</Text>
          </View>

          {/* Items */}
          {items.map((item, i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 9,
                borderBottomWidth: 1,
                borderBottomColor: '#f1f5f9',
              }}
            >
              <Text style={{ fontSize: 13, color: '#334155', flex: 1, marginRight: 12 }} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a', fontVariant: ['tabular-nums'] }}>
                {formatCurrency(item.amount, country)}
              </Text>
            </View>
          ))}

          {/* Breakdown */}
          <View style={{ marginTop: 8, gap: 2 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
              <Text style={{ fontSize: 11, color: '#94a3b8' }}>{t.bill_subtotal}</Text>
              <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600', fontVariant: ['tabular-nums'] }}>{formatCurrency(contactSubtotal, country)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
              <Text style={{ fontSize: 11, color: '#94a3b8' }}>{translatedTaxLabel}</Text>
              <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600', fontVariant: ['tabular-nums'] }}>{formatCurrency(contactTax, country)}</Text>
            </View>
            {tipPercent > 0 && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                <Text style={{ fontSize: 11, color: '#94a3b8' }}>{t.bill_tip(tipPercent)}</Text>
                <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600', fontVariant: ['tabular-nums'] }}>{formatCurrency(contactTip, country)}</Text>
              </View>
            )}
          </View>

          <ReceiptDotLine />

          {/* Total */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#0f172a', letterSpacing: 1, textTransform: 'uppercase' }}>{t.infographic_total}</Text>
            <Text
              style={{ fontSize: 22, fontWeight: '800', color: '#0a7ea4', fontVariant: ['tabular-nums'], flexShrink: 1, textAlign: 'right' }}
              adjustsFontSizeToFit
              numberOfLines={1}
              minimumFontScale={0.7}
            >
              {formatCurrency(contactTotal, country)}
            </Text>
          </View>

          <ReceiptDotLine />

          {/* Footer */}
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 9, color: '#94a3b8', fontStyle: 'italic' }}>{t.infographic_tagline}</Text>
            <Text style={{ fontSize: 8, color: '#cbd5e1' }}>rondas.app</Text>
          </View>
        </View>
      </View>
      </View>
    </View>
  );
}

function SwipeableItem({ children, isDeleting }: { children: React.ReactNode; isDeleting: boolean }) {
  const height = useSharedValue<number | null>(null);
  const animatedStyle = useAnimatedStyle(() => {
    if (!isDeleting || height.value === null) return {};
    return {
      height: withTiming(0, { duration: 300 }),
      opacity: withTiming(0, { duration: 200 }),
      overflow: 'hidden' as const,
    };
  }, [isDeleting]);

  return (
    <Animated.View
      style={animatedStyle}
      onLayout={(e) => {
        if (height.value === null) {
          height.value = e.nativeEvent.layout.height;
        }
      }}
    >
      {children}
    </Animated.View>
  );
}
