import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
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
import { formatCOP, parseCOP } from '@/lib/format';
import { toE164 } from '@/lib/phone';
import { CATEGORY_LABELS, getTaxConfig, type TaxConfig } from '@/constants/taxes';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { WhatsAppIcon } from '@/components/icons/whatsapp';
import { Share2 } from 'lucide-react-native';

type BillState = 'draft' | 'unsplit' | 'split' | 'unresolved';

function relativeTime(timestamp: string | number): string {
  const time = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
  const now = Date.now();
  const diff = now - time;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const STATE_STYLES: Record<BillState, { label: string; dot: string; bg: string; text: string }> = {
  draft: { label: 'Draft', dot: '#6366f1', bg: 'rgba(99,102,241,0.15)', text: '#6366f1' },
  unsplit: { label: 'Unsplit', dot: '#94a3b8', bg: 'rgba(148,163,184,0.15)', text: '#94a3b8' },
  split: { label: 'Split', dot: '#10b981', bg: 'rgba(16,185,129,0.15)', text: '#10b981' },
  unresolved: { label: 'Unresolved', dot: '#f59e0b', bg: 'rgba(245,158,11,0.15)', text: '#f59e0b' },
};

export default function BillDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];

  const bill = useQuery(api.bills.get, { id: id as Id<'bills'> });
  const updateBill = useMutation(api.bills.update);
  const assignContact = useMutation(api.bills.assignContactToItem);
  const removeContact = useMutation(api.bills.removeContactFromItem);
  const togglePaid = useMutation(api.bills.togglePaymentStatus);
  const removeBill = useMutation(api.bills.remove);
  const removeContactsBatch = useMutation(api.bills.removeContactsFromItems);
  const { defaultTipPercent } = useSettingsStore();

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [showUnassignPicker, setShowUnassignPicker] = useState(false);
  const [phoneContacts, setPhoneContacts] = useState<(Contacts.Contact & { id: string })[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [singleAssignItemIndex, setSingleAssignItemIndex] = useState<number | null>(null);
  const swipeOpenRef = useRef(false);
  const assignContactToItems = useMutation(api.bills.assignContactToItems);
  const billRef = useRef(bill);
  billRef.current = bill;

  const handleRemoveItem = useCallback((itemIndex: number) => {
    const currentBill = billRef.current;
    if (!currentBill) return;
    const item = currentBill.items[itemIndex];
    if (!item) return;
    const itemId = item.id;
    const remaining = itemId
      ? currentBill.items.filter((i) => i.id !== itemId)
      : currentBill.items.filter((_, i) => i !== itemIndex);
    setDeletingId(itemId ?? `idx-${itemIndex}`);
    setTimeout(() => {
      updateBill({ id: id as Id<'bills'>, items: remaining });
      setDeletingId(null);
    }, 300);
  }, [id, updateBill]);

  const handleItemPress = useCallback((index: number) => {
    if (swipeOpenRef.current) {
      swipeOpenRef.current = false;
      return;
    }
    setEditingIndex(index);
  }, []);

  const handleUpdateItem = useCallback((itemIndex: number, field: 'name' | 'quantity' | 'unitPrice', value: string) => {
    if (!bill) return;
    const items = [...bill.items];
    if (field === 'name') {
      items[itemIndex] = { ...items[itemIndex], name: value };
    } else {
      const num = parseCOP(value);
      items[itemIndex] = { ...items[itemIndex], [field]: num };
      if (field === 'quantity' || field === 'unitPrice') {
        items[itemIndex].subtotal = items[itemIndex].quantity * items[itemIndex].unitPrice;
      }
    }
    updateBill({ id: id as Id<'bills'>, items });
  }, [bill, id, updateBill]);

  const handleUpdateTax = useCallback((value: string) => {
    updateBill({ id: id as Id<'bills'>, tax: parseCOP(value) });
  }, [id, updateBill]);

  const handleUpdateTip = useCallback((value: string) => {
    updateBill({ id: id as Id<'bills'>, tip: parseCOP(value) });
  }, [id, updateBill]);

  const toggleItemSelection = useCallback((index: number) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const handleMultiAssign = useCallback(async () => {
    if (selectedItems.size === 0) return;
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Contact access is required to assign people to items.');
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
  }, [selectedItems]);

  const handleConfirmContactPicker = useCallback(async () => {
    if (selectedContactIds.size === 0 || !bill) return;

    // Determine which items to assign to
    let itemIds: string[];
    if (singleAssignItemIndex !== null) {
      // Single item assignment via + button
      const itemId = bill.items[singleAssignItemIndex]?.id;
      if (!itemId) return;
      itemIds = [itemId];
    } else {
      // Bulk assignment via multi-select
      itemIds = Array.from(selectedItems)
        .map((idx) => bill.items[idx]?.id)
        .filter((itemId): itemId is string => !!itemId);
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
        itemIds,
        contact: { name, phone: phone ?? undefined, imageUri: imageUri ?? undefined },
      });
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowContactPicker(false);
    setSingleAssignItemIndex(null);
    setSelectedItems(new Set());
    setMultiSelectMode(false);
  }, [selectedContactIds, selectedItems, singleAssignItemIndex, phoneContacts, bill, id, assignContactToItems]);

  const handleBulkDelete = useCallback(() => {
    if (selectedItems.size === 0 || !bill) return;
    Alert.alert(
      'Delete items',
      `Delete ${selectedItems.size} selected ${selectedItems.size === 1 ? 'item' : 'items'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const selectedIds = new Set(
              Array.from(selectedItems).map((idx) => bill.items[idx]?.id).filter(Boolean)
            );
            const remaining = bill.items.filter((i) => !selectedIds.has(i.id));
            updateBill({ id: id as Id<'bills'>, items: remaining });
            setSelectedItems(new Set());
            setMultiSelectMode(false);
          },
        },
      ]
    );
  }, [selectedItems, bill, id, updateBill]);

  const handleBulkRemoveContact = useCallback(() => {
    if (selectedItems.size === 0 || !bill) return;

    const selectedIds = Array.from(selectedItems).map((idx) => bill.items[idx]?.id).filter(Boolean);
    const contactsOnSelected = bill.contacts
      .map((c, ci) => ({ ...c, contactIndex: ci }))
      .filter((c) => c.items.some((itemId) => selectedIds.includes(itemId)));

    if (contactsOnSelected.length === 0) {
      Alert.alert('No contacts', 'Selected items have no contacts assigned.');
      return;
    }

    if (contactsOnSelected.length === 1) {
      const c = contactsOnSelected[0];
      Alert.alert('Remove contact', `Remove ${c.name} from selected items?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeContactsBatch({
              id: id as Id<'bills'>,
              itemIds: selectedIds.filter((i): i is string => !!i),
              contactNames: [c.name],
            });
            setSelectedItems(new Set());
            setMultiSelectMode(false);
          },
        },
      ]);
    } else {
      // Multiple contacts — open picker modal
      setSelectedContactIds(new Set());
      setShowUnassignPicker(true);
    }
  }, [selectedItems, bill, id, removeContact]);

  const handleConfirmUnassign = useCallback(async () => {
    if (selectedContactIds.size === 0 || !bill) return;

    const itemIds = Array.from(selectedItems)
      .map((idx) => bill.items[idx]?.id)
      .filter((itemId): itemId is string => !!itemId);

    const contactNames = Array.from(selectedContactIds).map((ciStr) => {
      const ci = parseInt(ciStr, 10);
      return bill.contacts[ci]?.name;
    }).filter((n): n is string => !!n);

    await removeContactsBatch({
      id: id as Id<'bills'>,
      itemIds,
      contactNames,
    });

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowUnassignPicker(false);
    setSelectedItems(new Set());
    setMultiSelectMode(false);
  }, [selectedContactIds, selectedItems, bill, id, removeContactsBatch]);

  const handleAssignContact = useCallback(async (itemIndex: number) => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Contact access is required to assign people to items.');
      return;
    }

    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Image, Contacts.Fields.Name],
      sort: Contacts.SortTypes.FirstName,
    });
    setPhoneContacts(data.filter((c): c is typeof c & { id: string } => !!c.id));
    setContactSearch('');
    setSelectedContactIds(new Set());
    setSingleAssignItemIndex(itemIndex);
    setShowContactPicker(true);
  }, []);

  const handleRemoveContact = useCallback((itemId: string, contactIndex: number) => {
    Alert.alert('Remove contact', 'Remove this person from the item?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => removeContact({ id: id as Id<'bills'>, itemId, contactIndex }),
      },
    ]);
  }, [id, removeContact]);

  const handleTogglePaid = useCallback(async (contactIndex: number) => {
    await togglePaid({ id: id as Id<'bills'>, contactIndex });
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [id, togglePaid]);

  const handleSendWhatsApp = useCallback((contact: { name: string; phone?: string; items: string[]; amount: number }) => {
    if (!bill || !contact.phone) {
      Alert.alert('No phone number', 'This contact has no phone number to send a message to.');
      return;
    }

    const itemLines = contact.items
      .map((itemId) => {
        const item = bill.items.find((i) => i.id === itemId);
        if (!item) return null;
        const numContacts = bill.contacts.filter((c) => c.items.includes(itemId)).length;
        const share = Math.round(item.subtotal / numContacts);
        return `- ${item.name}: ${formatCOP(share)}`;
      })
      .filter(Boolean)
      .join('\n');

    const message = `🧾 *${bill.name}*\n\nYour items:\n${itemLines}\n\n*Your total: ${formatCOP(contact.amount)}*\n\nResumen generado con la app Rondas`;
    const url = `https://wa.me/${toE164(contact.phone)}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url);
  }, [bill]);

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
        <Text className="text-lg font-semibold text-foreground">Bill not found</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-sm font-medium text-primary">Go back</Text>
        </Pressable>
      </View>
    );
  }

  const stateStyle = STATE_STYLES[bill.state];
  const subtotal = bill.items.reduce((sum, i) => sum + i.subtotal, 0);
  const billCountry = (bill.country as 'CO' | 'US') || 'CO';
  const billCategory = bill.category || 'dining';
  const taxConfig = getTaxConfig(billCountry, billCategory);

  // Tax: always computed from subtotal for tax-included countries (CO)
  // For US, use what's stored (from Gemini or user edit)
  const computedTax = taxConfig.taxIncluded
    ? Math.round(subtotal * taxConfig.taxRate)
    : (bill.tax ?? 0);

  // Tip: always computed from subtotal × user's default tip percent
  const computedTip = Math.round(subtotal * (defaultTipPercent / 100));

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
            onChangeText={(text) => updateBill({ id: id as Id<'bills'>, name: text })}
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
            <Text style={{ fontSize: 11, fontWeight: '600', color: stateStyle.text }}>{stateStyle.label}</Text>
          </View>
          <Pressable
            onPress={() => {
              Alert.alert(
                'Delete bill',
                'Are you sure? This cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      await removeBill({ id: id as Id<'bills'> });
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
                {CATEGORY_LABELS[bill.category]?.label ?? bill.category}
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
                  const photoTime = bill.photoTakenAt ? relativeTime(bill.photoTakenAt) : null;
                  const billTime = relativeTime(bill._creationTime);
                  if (photoTime && photoTime === billTime) {
                    return `Photo and bill from ${billTime}`;
                  }
                  if (photoTime) {
                    return `Photo ${photoTime} · Bill created ${billTime}`;
                  }
                  return `Created ${billTime}`;
                })()}
              </Text>
            </View>
          </View>
        )}

        {/* Hint + multi-select toggle */}
        <View className="mb-2 flex-row items-center justify-between px-7">
          <Text className="text-xs text-muted-foreground">
            {multiSelectMode
              ? `${selectedItems.size} selected`
              : 'Tap item to edit · Tap + to assign contact'}
          </Text>
          <Pressable
            onPress={() => {
              setMultiSelectMode(!multiSelectMode);
              setSelectedItems(new Set());
              setEditingIndex(null);
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
              {multiSelectMode ? 'Cancel' : 'Bulk edit'}
            </Text>
          </Pressable>
        </View>

        {/* Items */}
        {bill.items.map((item, index) => {
          const assignedContacts = bill.contacts
            .map((c, ci) => ({ ...c, contactIndex: ci }))
            .filter((c) => item.id ? c.items.includes(item.id) : false);
          const isEditing = editingIndex === index;

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
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '500', marginTop: 2 }}>Delete</Text>
                </Animated.View>
              )}
              rightThreshold={80}
              overshootRight
              onSwipeableOpen={() => handleRemoveItem(index)}
              onSwipeableOpenStartDrag={() => { swipeOpenRef.current = true; }}
            >
              {isEditing ? (
                /* Edit mode */
                <View className="border-l-2 border-l-primary bg-primary/5 px-7 py-3.5">
                  <View className="mb-3 flex-row items-center justify-between">
                    <Input
                      value={item.name}
                      onChangeText={(v) => handleUpdateItem(index, 'name', v)}
                      className="h-auto flex-1 border-0 bg-transparent px-0 py-0 text-[15px] font-semibold shadow-none"
                      placeholder="Item name"
                      autoFocus
                    />
                    <Pressable
                      onPress={() => setEditingIndex(null)}
                      className="ml-3 rounded-full bg-destructive/15 px-3 py-1"
                    >
                      <Text className="text-xs font-semibold text-destructive">Cancel</Text>
                    </Pressable>
                  </View>
                  <View className="flex-row gap-2.5">
                    <View className="flex-1">
                      <Text className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Qty</Text>
                      <Input
                        value={String(item.quantity)}
                        onChangeText={(v) => handleUpdateItem(index, 'quantity', v)}
                        className="h-9 rounded-lg border-0 bg-muted px-3 py-1 text-sm font-medium shadow-none"
                        keyboardType="number-pad"
                      />
                    </View>
                    <View className="flex-[2]">
                      <Text className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Unit Price</Text>
                      <Input
                        value={formatCOP(item.unitPrice)}
                        onChangeText={(v) => handleUpdateItem(index, 'unitPrice', v)}
                        className="h-9 rounded-lg border-0 bg-muted px-3 py-1 text-sm font-medium shadow-none"
                        keyboardType="number-pad"
                      />
                    </View>
                    <View className="flex-[2]">
                      <Text className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Subtotal</Text>
                      <View className="h-9 items-end justify-center rounded-lg px-3 py-1">
                        <Text className="text-sm font-bold text-primary">
                          {formatCOP(item.subtotal)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => setEditingIndex(null)}
                    className="mt-3 items-center rounded-lg bg-primary/10 py-2"
                  >
                    <Text className="text-sm font-semibold text-primary">Done</Text>
                  </Pressable>
                </View>
              ) : (
                /* Display mode */
                <Pressable
                  onPress={() => multiSelectMode ? toggleItemSelection(index) : handleItemPress(index)}
                  className="flex-row items-start bg-background px-7 py-3 active:opacity-80"
                >
                  {/* Checkbox in multi-select mode */}
                  {multiSelectMode && (
                    <View className="mr-3 justify-center pt-1">
                      <IconSymbol
                        name={selectedItems.has(index) ? 'checkmark.circle.fill' : 'circle'}
                        size={22}
                        color={selectedItems.has(index) ? '#38bdf8' : '#64748b'}
                      />
                    </View>
                  )}
                  <View className="mr-3 flex-1">
                    <Text className="text-[15px] font-semibold leading-5 text-foreground" numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text className="mt-0.5 text-xs text-muted-foreground">
                      {item.quantity} × {formatCOP(item.unitPrice)}
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
                      {formatCOP(item.subtotal)}
                    </Text>
                    {!multiSelectMode && (
                      <Pressable
                        onPress={() => handleAssignContact(index)}
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
              {index < bill.items.length - 1 && (
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
          <Text className="text-sm text-muted-foreground">Subtotal</Text>
          <Text className="text-sm font-semibold tabular-nums text-foreground">{formatCOP(subtotal)}</Text>
        </View>
        <View className="flex-row items-center justify-between px-7 py-3">
          <Text className="text-sm text-foreground">{taxConfig.taxLabel}</Text>
          {taxConfig.taxIncluded ? (
            <Text className="text-sm font-semibold tabular-nums text-muted-foreground">
              {formatCOP(computedTax)}
            </Text>
          ) : (
            <Input
              value={formatCOP(computedTax)}
              onChangeText={handleUpdateTax}
              className="h-auto w-32 border-0 bg-transparent px-0 py-0 text-right text-sm font-semibold tabular-nums shadow-none"
              keyboardType="number-pad"
            />
          )}
        </View>
        <View className="flex-row items-center justify-between px-7 py-3">
          <Text className="text-sm text-foreground">Tip ({defaultTipPercent}%)</Text>
          <Text className="text-sm font-semibold tabular-nums text-foreground">
            {formatCOP(computedTip)}
          </Text>
        </View>
        <View className="mx-7 h-px bg-border/40" />
        <View className="flex-row items-center justify-between px-7 py-4">
          <Text className="text-sm font-bold text-foreground">Total</Text>
          <Text className="text-2xl font-extrabold tracking-tight text-primary">{formatCOP(total)}</Text>
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
              {bill.contacts.length} {bill.contacts.length === 1 ? 'person' : 'people'} · Share & Pay
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
            <Text className="text-xl font-bold text-foreground">Share & Pay</Text>
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
              const contactTax = Math.round(contactSubtotal * taxConfig.taxRate);
              const contactTip = Math.round(contactSubtotal * (defaultTipPercent / 100));
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
                    {formatCOP(contactTotal)}
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
                        <Text className="text-[11px] text-muted-foreground">{formatCOP(share)}</Text>
                      </View>
                    );
                  })}
                </View>

                {/* Tax & Tip breakdown */}
                <View className="ml-[52px] mt-2 gap-1">
                  <View className="flex-row justify-between">
                    <Text className="text-[11px] text-muted-foreground">{taxConfig.taxLabel}</Text>
                    <Text className="text-[11px] text-muted-foreground">{formatCOP(contactTax)}</Text>
                  </View>
                  {defaultTipPercent > 0 && (
                    <View className="flex-row justify-between">
                      <Text className="text-[11px] text-muted-foreground">Tip ({defaultTipPercent}%)</Text>
                      <Text className="text-[11px] text-muted-foreground">{formatCOP(contactTip)}</Text>
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
                      {contact.paid ? 'Paid' : 'Unpaid'}
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
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#25d366' }}>WhatsApp</Text>
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
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#38bdf8' }}>Share</Text>
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
                      tipPercent={defaultTipPercent}
                      location={bill.location?.address}
                      date={bill.photoTakenAt ?? new Date(bill._creationTime).toISOString()}
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
        onRequestClose={() => { setShowContactPicker(false); setSingleAssignItemIndex(null); }}
      >
        <View className="flex-1 bg-background" style={{ paddingTop: 12, paddingBottom: insets.bottom }}>
          <View className="items-center pb-2">
            <View className="h-1 w-10 rounded-full bg-muted-foreground/30" />
          </View>
          <View className="flex-row items-center justify-between px-7 pb-3 pt-2">
            <Text className="text-xl font-bold text-foreground">Select Contacts</Text>
            <Pressable onPress={() => { setShowContactPicker(false); setSingleAssignItemIndex(null); }} className="rounded-full bg-muted p-2">
              <IconSymbol name="xmark" size={14} color={iconColors.muted} />
            </Pressable>
          </View>

          {/* Search */}
          <View className="px-7 pb-3">
            <TextInput
              value={contactSearch}
              onChangeText={setContactSearch}
              placeholder="Search contacts..."
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
                  Assign {selectedContactIds.size} {selectedContactIds.size === 1 ? 'contact' : 'contacts'}
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
              <Text className="text-xl font-bold text-foreground">Remove Contacts</Text>
              <Pressable onPress={() => setShowUnassignPicker(false)} className="rounded-full bg-muted p-2">
                <IconSymbol name="xmark" size={14} color={iconColors.muted} />
              </Pressable>
            </View>

            <ScrollView className="flex-1" contentContainerClassName="px-7 pb-8">
              {(() => {
                const selectedIds = Array.from(selectedItems).map((idx) => bill.items[idx]?.id).filter(Boolean);
                const contactsOnSelected = bill.contacts
                  .map((c, ci) => ({ ...c, contactIndex: ci }))
                  .filter((c) => c.items.some((itemId) => selectedIds.includes(itemId)));

                return contactsOnSelected.map((c) => {
                  const isSelected = selectedContactIds.has(String(c.contactIndex));
                  const itemCount = c.items.filter((itemId) => selectedIds.includes(itemId)).length;
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
                          {itemCount} {itemCount === 1 ? 'item' : 'items'} on selection
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
                      'Confirm removal',
                      `Remove ${selectedContactIds.size} ${selectedContactIds.size === 1 ? 'contact' : 'contacts'} from selected items?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Remove', style: 'destructive', onPress: handleConfirmUnassign },
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
                    Remove {selectedContactIds.size} {selectedContactIds.size === 1 ? 'contact' : 'contacts'}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </Modal>
      )}

      {/* Bulk edit toolbar */}
      {multiSelectMode && selectedItems.size > 0 && (() => {
        const selectedIds = Array.from(selectedItems).map((idx) => bill.items[idx]?.id).filter(Boolean);
        const hasContacts = bill.contacts.some((c) =>
          c.items.some((itemId) => selectedIds.includes(itemId))
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
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#38bdf8' }}>Assign</Text>
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
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#f59e0b' }}>Unassign</Text>
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
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#ef4444' }}>Delete</Text>
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
              await updateBill({ id: id as Id<'bills'>, state: 'unsplit' });
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            }}
            className="items-center rounded-xl bg-primary py-4 active:opacity-80"
          >
            <View className="flex-row items-center gap-2">
              <IconSymbol name="checkmark" size={18} color={colorScheme === 'dark' ? '#0c1a2a' : '#ffffff'} />
              <Text style={{ fontSize: 16, fontWeight: '600', color: colorScheme === 'dark' ? '#0c1a2a' : '#ffffff' }}>
                Confirm Items
              </Text>
            </View>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function ReceiptDashedLine() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 14 }}>
      {Array.from({ length: 40 }).map((_, i) => (
        <View key={i} style={{ flex: 1, height: 2, backgroundColor: i % 2 === 0 ? '#cbd5e1' : 'transparent', marginHorizontal: 1 }} />
      ))}
    </View>
  );
}

const PERF_SIZE = 10;
const PERF_GAP = 6;
const PERF_COLOR = '#dfe4ea';
const PERF_STEP = PERF_SIZE + PERF_GAP; // 16px center to center

function BillInfographic({
  billName,
  contactName,
  contactImageUri,
  items,
  taxConfig: infTaxConfig,
  tipPercent,
  location,
  date,
}: {
  billName: string;
  contactName: string;
  contactImageUri?: string;
  items: { name: string; amount: number }[];
  taxConfig: TaxConfig;
  tipPercent: number;
  location?: string;
  date: string;
}) {
  const d = new Date(date);
  const isValidDate = !isNaN(d.getTime());
  const dateStr = isValidDate
    ? d.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
    : '';

  const contactSubtotal = items.reduce((sum, i) => sum + i.amount, 0);
  const contactTax = Math.round(contactSubtotal * infTaxConfig.taxRate);
  const contactTip = Math.round(contactSubtotal * (tipPercent / 100));
  const contactTotal = infTaxConfig.taxIncluded
    ? contactSubtotal + contactTip
    : contactSubtotal + contactTax + contactTip;

  const hCount = Math.floor(408 / PERF_STEP); // horizontal circles count (width - padding)
  const vCount = 40; // vertical circles — generous, will be clipped by overflow

  return (
    <View style={{ width: 420, backgroundColor: PERF_COLOR, padding: PERF_SIZE / 2 + 2 }}>
      {/* Receipt paper */}
      <View style={{ backgroundColor: '#ffffff', overflow: 'hidden' }}>
        {/* Top perforations */}
        <View style={{ position: 'absolute', top: -(PERF_SIZE / 2), left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-evenly', zIndex: 2 }}>
          {Array.from({ length: hCount }).map((_, i) => (
            <View key={`t${i}`} style={{ width: PERF_SIZE, height: PERF_SIZE, borderRadius: PERF_SIZE / 2, backgroundColor: PERF_COLOR }} />
          ))}
        </View>
        {/* Bottom perforations */}
        <View style={{ position: 'absolute', bottom: -(PERF_SIZE / 2), left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-evenly', zIndex: 2 }}>
          {Array.from({ length: hCount }).map((_, i) => (
            <View key={`b${i}`} style={{ width: PERF_SIZE, height: PERF_SIZE, borderRadius: PERF_SIZE / 2, backgroundColor: PERF_COLOR }} />
          ))}
        </View>
        {/* Left perforations */}
        <View style={{ position: 'absolute', left: -(PERF_SIZE / 2), top: 0, bottom: 0, justifyContent: 'space-evenly', zIndex: 2 }}>
          {Array.from({ length: vCount }).map((_, i) => (
            <View key={`l${i}`} style={{ width: PERF_SIZE, height: PERF_SIZE, borderRadius: PERF_SIZE / 2, backgroundColor: PERF_COLOR }} />
          ))}
        </View>
        {/* Right perforations */}
        <View style={{ position: 'absolute', right: -(PERF_SIZE / 2), top: 0, bottom: 0, justifyContent: 'space-evenly', zIndex: 2 }}>
          {Array.from({ length: vCount }).map((_, i) => (
            <View key={`r${i}`} style={{ width: PERF_SIZE, height: PERF_SIZE, borderRadius: PERF_SIZE / 2, backgroundColor: PERF_COLOR }} />
          ))}
        </View>

        {/* Content */}
        <View style={{ paddingHorizontal: 32, paddingTop: 32, paddingBottom: 24 }}>
          {/* App brand */}
          <View style={{ alignItems: 'center', marginBottom: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#0a7ea4', letterSpacing: 3, textTransform: 'uppercase' }}>
              Rondas
            </Text>
          </View>

          <ReceiptDashedLine />

          {/* Restaurant name */}
          <View style={{ alignItems: 'center', marginBottom: 4 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#0f172a', textAlign: 'center' }}>
              {billName}
            </Text>
            {location && !location.startsWith(billName) && (
              <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, textAlign: 'center' }} numberOfLines={2}>
                {location}
              </Text>
            )}
            {dateStr && (
              <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                {dateStr}
              </Text>
            )}
          </View>

          <ReceiptDashedLine />

          {/* Bill for contact */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            {contactImageUri ? (
              <Image source={{ uri: contactImageUri }} style={{ width: 28, height: 28, borderRadius: 14 }} />
            ) : (
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748b' }}>
                  {contactName[0]?.toUpperCase() ?? '?'}
                </Text>
              </View>
            )}
            <View>
              <Text style={{ fontSize: 8, color: '#94a3b8', fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' }}>Bill for</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#0f172a' }}>{contactName}</Text>
            </View>
          </View>

          {/* Column headers */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
            <Text style={{ fontSize: 8, fontWeight: '600', color: '#94a3b8', letterSpacing: 1, textTransform: 'uppercase' }}>Item</Text>
            <Text style={{ fontSize: 8, fontWeight: '600', color: '#94a3b8', letterSpacing: 1, textTransform: 'uppercase' }}>Amount</Text>
          </View>

          {/* Items */}
          {items.map((item, i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 8,
                borderBottomWidth: i < items.length - 1 ? 1 : 0,
                borderBottomColor: '#f1f5f9',
              }}
            >
              <Text style={{ fontSize: 13, color: '#334155', flex: 1, marginRight: 12 }} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a' }}>
                {formatCOP(item.amount)}
              </Text>
            </View>
          ))}

          {/* Subtotal */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
            <Text style={{ fontSize: 11, color: '#94a3b8' }}>Subtotal</Text>
            <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600' }}>{formatCOP(contactSubtotal)}</Text>
          </View>

          {/* Tax */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
            <Text style={{ fontSize: 11, color: '#94a3b8' }}>{infTaxConfig.taxLabel}</Text>
            <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600' }}>{formatCOP(contactTax)}</Text>
          </View>

          {/* Tip */}
          {tipPercent > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
              <Text style={{ fontSize: 11, color: '#94a3b8' }}>Tip ({tipPercent}%)</Text>
              <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600' }}>{formatCOP(contactTip)}</Text>
            </View>
          )}

          <ReceiptDashedLine />

          {/* Total */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a' }}>TOTAL</Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#0f172a' }}>
              {formatCOP(contactTotal)}
            </Text>
          </View>

          <ReceiptDashedLine />

          {/* Footer */}
          <View style={{ alignItems: 'center', paddingTop: 4 }}>
            <Text style={{ fontSize: 9, color: '#94a3b8' }}>Split bills, not friendships</Text>
            <Text style={{ fontSize: 8, color: '#cbd5e1', marginTop: 4 }}>rondas.app</Text>
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
