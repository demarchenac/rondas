import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, Pressable, ScrollView, View } from 'react-native';
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

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [showShareSheet, setShowShareSheet] = useState(false);
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
    try {
      const contact = await Contacts.presentContactPickerAsync();
      if (!contact) return;

      const phone = contact.phoneNumbers?.[0]?.number;
      const name = `${contact.firstName ?? ''}${contact.lastName ? ` ${contact.lastName}` : ''}`.trim() || 'Unknown';
      const imageUri = contact.image?.uri;

      await assignContactToItems({
        id: id as Id<'bills'>,
        itemIndices: Array.from(selectedItems),
        contact: { name, phone: phone ?? undefined, imageUri: imageUri ?? undefined },
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSelectedItems(new Set());
      setMultiSelectMode(false);
    } catch (err) {
      console.error('[MultiAssign] Error:', err);
    }
  }, [selectedItems, id, assignContactToItems]);

  const handleAssignContact = useCallback(async (itemIndex: number) => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Contact access is required to assign people to items.');
      return;
    }

    try {
      const contact = await Contacts.presentContactPickerAsync();
      if (!contact) return;

      const phone = contact.phoneNumbers?.[0]?.number;
      const name = `${contact.firstName ?? ''}${contact.lastName ? ` ${contact.lastName}` : ''}`.trim() || 'Unknown';
      const imageUri = contact.image?.uri;

      await assignContact({
        id: id as Id<'bills'>,
        itemIndex,
        contact: { name, phone: phone ?? undefined, imageUri: imageUri ?? undefined },
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('[Contact] Error:', err);
    }
  }, [id, assignContact]);

  const handleRemoveContact = useCallback((itemIndex: number, contactIndex: number) => {
    Alert.alert('Remove contact', 'Remove this person from the item?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => removeContact({ id: id as Id<'bills'>, itemIndex, contactIndex }),
      },
    ]);
  }, [id, removeContact]);

  const handleTogglePaid = useCallback(async (contactIndex: number) => {
    await togglePaid({ id: id as Id<'bills'>, contactIndex });
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [id, togglePaid]);

  const handleSendWhatsApp = useCallback((contact: { name: string; phone?: string; items: number[]; amount: number }) => {
    if (!bill || !contact.phone) {
      Alert.alert('No phone number', 'This contact has no phone number to send a message to.');
      return;
    }

    const itemLines = contact.items
      .map((idx) => {
        const item = bill.items[idx];
        if (!item) return null;
        const numContacts = bill.contacts.filter((c) => c.items.includes(idx)).length;
        const share = Math.round(item.subtotal / numContacts);
        return `- ${item.name}: ${formatCOP(share)}`;
      })
      .filter(Boolean)
      .join('\n');

    const message = `🧾 *${bill.name}*\n\nYour items:\n${itemLines}\n\n*Your total: ${formatCOP(contact.amount)}*\n\nResumen generado con la app Rondas`;
    const url = `https://wa.me/${toE164(contact.phone)}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url);
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
  const total = subtotal + (bill.tax ?? 0) + (bill.tip ?? 0);

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
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-8"
        showsVerticalScrollIndicator={false}
      >
        {/* Location & time metadata */}
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
              ? `${selectedItems.size} selected · Pick a contact to assign`
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
              {multiSelectMode ? 'Cancel' : 'Multi-select'}
            </Text>
          </Pressable>
        </View>

        {/* Items */}
        {bill.items.map((item, index) => {
          const assignedContacts = bill.contacts
            .map((c, ci) => ({ ...c, contactIndex: ci }))
            .filter((c) => c.items.includes(index));
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
                            onPress={() => handleRemoveContact(index, c.contactIndex)}
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
          <Text className="text-sm text-foreground">Tax (IVA)</Text>
          <Input
            value={formatCOP(bill.tax ?? 0)}
            onChangeText={handleUpdateTax}
            className="h-auto w-32 border-0 bg-transparent px-0 py-0 text-right text-sm font-semibold tabular-nums shadow-none"
            keyboardType="number-pad"
          />
        </View>
        <View className="flex-row items-center justify-between px-7 py-3">
          <Text className="text-sm text-foreground">Tip (Propina)</Text>
          <Input
            value={(bill.tip ?? 0) === 0 ? '' : formatCOP(bill.tip ?? 0)}
            onChangeText={handleUpdateTip}
            className="h-auto w-32 border-0 bg-transparent px-0 py-0 text-right text-sm font-semibold tabular-nums shadow-none"
            placeholder="$0"
            keyboardType="number-pad"
          />
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
            {bill.contacts.map((contact, ci) => (
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
                    {formatCOP(contact.amount)}
                  </Text>
                </View>

                {/* Contact items — two column */}
                <View className="ml-[52px] mt-2 flex-row flex-wrap">
                  {contact.items.map((idx) => {
                    const item = bill.items[idx];
                    if (!item) return null;
                    const numContacts = bill.contacts.filter((c) => c.items.includes(idx)).length;
                    const share = Math.round(item.subtotal / numContacts);
                    return (
                      <View key={idx} style={{ width: '50%', paddingRight: 8, marginBottom: 4 }}>
                        <Text className="text-xs text-foreground" numberOfLines={1}>{item.name}</Text>
                        <Text className="text-[11px] text-muted-foreground">{formatCOP(share)}</Text>
                      </View>
                    );
                  })}
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

                  {/* WhatsApp */}
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
                      <Text style={{ fontSize: 15 }}>💬</Text>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#25d366' }}>WhatsApp</Text>
                    </Pressable>
                  )}
                </View>

                {/* Divider */}
                {ci < bill.contacts.length - 1 && (
                  <View className="ml-[52px] mt-4 h-px bg-border/40" />
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Multi-select assign button */}
      {multiSelectMode && selectedItems.size > 0 && (
        <View className="border-t border-border/30 px-7 pb-2 pt-3">
          <Pressable
            onPress={handleMultiAssign}
            className="items-center rounded-xl bg-primary py-4 active:opacity-80"
          >
            <View className="flex-row items-center gap-2">
              <IconSymbol name="person.crop.circle" size={18} color={colorScheme === 'dark' ? '#0c1a2a' : '#ffffff'} />
              <Text style={{ fontSize: 16, fontWeight: '600', color: colorScheme === 'dark' ? '#0c1a2a' : '#ffffff' }}>
                Assign {selectedItems.size} {selectedItems.size === 1 ? 'item' : 'items'} to contact
              </Text>
            </View>
          </Pressable>
        </View>
      )}

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
