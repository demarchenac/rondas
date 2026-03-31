import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, View } from 'react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import * as Contacts from 'expo-contacts';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useQuery, useMutation } from 'convex/react';
import type { Id } from '@/convex/_generated/dataModel';

import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ICON_COLORS } from '@/constants/colors';
import { api } from '@/convex/_generated/api';
import { useAuth } from '@/lib/AuthContext';
import { parseCurrency } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { toE164 } from '@/lib/phone';
import { computeBase, computeTax, getTaxConfig } from '@/constants/taxes';
import { STATE_STYLES, STATE_LABEL_KEYS, getTaxLabel } from '@/lib/billHelpers';
import { buildWhatsAppMessage } from '@/lib/whatsapp';

import BillHeader from '@/components/bills/detail/BillHeader';
import BillMetadata from '@/components/bills/detail/BillMetadata';
import SortBar from '@/components/bills/detail/SortBar';
import BillItemCard from '@/components/bills/detail/BillItemCard';
import BillSummaryCard from '@/components/bills/detail/BillSummaryCard';
import PeopleSummary from '@/components/bills/detail/PeopleSummary';
import TipDialog from '@/components/bills/TipDialog';
import CountryDialog from '@/components/bills/CountryDialog';
import BulkToolbar from '@/components/bills/BulkToolbar';
import ContactPickerSheet, { SUGGESTED_PREFIX } from '@/components/bills/ContactPickerSheet';
import UnassignPickerSheet from '@/components/bills/UnassignPickerSheet';
import BillShareSheet from '@/components/bills/BillShareSheet';

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
  const userId = user?.id;

  const bill = useQuery(api.bills.get, userId ? { id: id as Id<'bills'>, userId } : 'skip');
  const suggestedContacts = useQuery(api.contacts.suggested, userId ? { userId } : 'skip');
  const updateBill = useMutation(api.bills.update);
  const removeContact = useMutation(api.bills.removeContactFromItem);
  const togglePaid = useMutation(api.bills.togglePaymentStatus);
  const removeBill = useMutation(api.bills.remove);
  const removeContactsBatch = useMutation(api.bills.removeContactsFromItems);
  const assignContactToItems = useMutation(api.bills.assignContactToItems);

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [activeDialog, setActiveDialog] = useState<DialogType>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [sortStrategy, setSortStrategy] = useState<SortStrategy>('original');
  const [phoneContacts, setPhoneContacts] = useState<(Contacts.Contact & { id: string })[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [singleAssignItemId, setSingleAssignItemId] = useState<string | null>(null);
  const swipeOpenRef = useRef(false);
  const billRef = useRef(bill);
  billRef.current = bill;
  const infographicRefs = useRef<Record<number, ViewShot | null>>({});
  const shouldAnimate = useRef(true);
  const contactsCacheRef = useRef<{ data: (Contacts.Contact & { id: string })[]; fetchedAt: number } | null>(null);
  const contactsPermissionRef = useRef(false);

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

  const handleUpdateTax = useCallback((value: string) => {
    if (!userId) return;
    updateBill({ id: id as Id<'bills'>, userId, tax: parseCurrency(value) });
  }, [id, updateBill, userId]);

  const toggleItemSelection = useCallback((itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  const loadContacts = useCallback(async (): Promise<boolean> => {
    // Check permission (cached after first grant)
    if (!contactsPermissionRef.current) {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t.bill_permissionNeeded, t.bill_permissionContacts);
        return false;
      }
      contactsPermissionRef.current = true;
    }

    // Use cache if fresh
    const cache = contactsCacheRef.current;
    if (cache && Date.now() - cache.fetchedAt < CONTACTS_CACHE_TTL) {
      setPhoneContacts(cache.data);
      return true;
    }

    // Phase 1: fast fetch without images
    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      sort: Contacts.SortTypes.FirstName,
    });
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

    return true;
  }, [t]);

  const handleMultiAssign = useCallback(async () => {
    if (selectedItemIds.size === 0) return;
    setContactSearch('');
    setSelectedContactIds(new Set());
    setActiveDialog('contactPicker');
    const granted = await loadContacts();
    if (!granted) setActiveDialog(null);
  }, [selectedItemIds, loadContacts]);

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

    for (const selectedId of selectedContactIds) {
      let name: string;
      let phone: string;
      let imageUri: string | undefined;

      if (selectedId.startsWith(SUGGESTED_PREFIX)) {
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
        contact: { name, phone, imageUri },
      });
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setActiveDialog(null);
    setSingleAssignItemId(null);
    setSelectedItemIds(new Set());
    setMultiSelectMode(false);
  }, [selectedContactIds, selectedItemIds, singleAssignItemId, phoneContacts, suggestedContacts, bill, id, assignContactToItems, userId]);

  const handleBulkDelete = useCallback(() => {
    if (selectedItemIds.size === 0 || !bill || !userId) return;
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
  }, [selectedItemIds, bill, id, updateBill, t, userId]);

  const handleBulkRemoveContact = useCallback(() => {
    if (selectedItemIds.size === 0 || !bill || !userId) return;
    const selectedIds = Array.from(selectedItemIds);
    const contactsOnSelected = bill.contacts.filter((c) => c.items.some((itemId) => selectedIds.includes(itemId)));
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
              id: id as Id<'bills'>, userId,
              itemIds: selectedIds.filter((itemId): itemId is string => !!itemId),
              contactIds: [c.contactId],
            });
            setSelectedItemIds(new Set());
            setMultiSelectMode(false);
          },
        },
      ]);
    } else {
      setSelectedContactIds(new Set());
      setActiveDialog('unassignPicker');
    }
  }, [selectedItemIds, bill, id, removeContactsBatch, t, userId]);

  const handleConfirmUnassign = useCallback(async () => {
    if (selectedContactIds.size === 0 || !bill || !userId) return;
    await removeContactsBatch({
      id: id as Id<'bills'>, userId,
      itemIds: Array.from(selectedItemIds),
      contactIds: Array.from(selectedContactIds) as Id<'contacts'>[],
    });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setActiveDialog(null);
    setSelectedItemIds(new Set());
    setMultiSelectMode(false);
  }, [selectedContactIds, selectedItemIds, bill, id, removeContactsBatch, userId]);

  const handleAssignContact = useCallback(async (itemId: string) => {
    setContactSearch('');
    setSelectedContactIds(new Set());
    setSingleAssignItemId(itemId);
    setActiveDialog('contactPicker');
    const granted = await loadContacts();
    if (!granted) setActiveDialog(null);
  }, [loadContacts]);

  const handleRemoveContact = useCallback((itemId: string, contactId: Id<'contacts'>) => {
    if (!userId) return;
    Alert.alert(t.bill_removeContact, t.bill_removeContactConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.remove,
        style: 'destructive',
        onPress: () => removeContact({ id: id as Id<'bills'>, userId: userId!, itemId, contactId }),
      },
    ]);
  }, [id, removeContact, t, userId]);

  const handleTogglePaid = useCallback(async (contactId: Id<'contacts'>) => {
    if (!userId) return;
    await togglePaid({ id: id as Id<'bills'>, userId: userId!, contactId });
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [id, togglePaid, userId]);

  const handleSendWhatsApp = useCallback((contact: { name: string; phone?: string; items: string[]; amount: number }) => {
    if (!bill || !contact.phone) {
      Alert.alert(t.bill_noPhone, t.bill_noPhoneMessage);
      return;
    }
    const message = buildWhatsAppMessage({ bill, contact, t });
    const url = `https://wa.me/${toE164(contact.phone)}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url);
  }, [bill, t]);

  const handleShareInfographic = useCallback(async (contact: { name: string; imageUri?: string; items: string[]; amount: number }, contactIndex: number) => {
    if (!bill) return;
    const ref = infographicRefs.current[contactIndex];
    if (!ref?.capture) return;
    try {
      const uri = await ref.capture();
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: `Bill summary for ${contact.name}` });
    } catch (err) {
      console.error('[Share] Error:', err);
    }
  }, [bill]);

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
    const billCategory = bill.category || 'dining';
    const taxConfig = getTaxConfig(billCountry, billCategory);
    const translatedTaxLabel = getTaxLabel(taxConfig, t);
    const base = computeBase(itemsTotal, taxConfig);
    const computedTax = taxConfig.taxIncluded ? computeTax(itemsTotal, taxConfig) : (bill.tax ?? 0);
    const tipPercent = bill.tipPercent ?? 0;
    const computedTip = Math.round(base * (tipPercent / 100));
    const beforeTip = base + computedTax;
    const total = base + computedTax + computedTip;
    const stateStyle = STATE_STYLES[bill.state];
    const stateLabel = t[STATE_LABEL_KEYS[bill.state]] as string;
    return { base, billCountry, taxConfig, translatedTaxLabel, computedTax, tipPercent, computedTip, beforeTip, total, stateStyle, stateLabel };
  }, [bill, t]);

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
      <View className="flex-1 items-center justify-center bg-background" style={{ paddingTop: insets.top }}>
        <Text className="text-lg font-semibold text-foreground">{t.error}</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-sm font-medium text-primary">{t.back}</Text>
        </Pressable>
      </View>
    );
  }

  const { base, billCountry, taxConfig, translatedTaxLabel, computedTax, tipPercent, computedTip, beforeTip, total, stateStyle, stateLabel } = billDerived;

  // Progress bar computation
  const totalItems = bill.items.length;
  const assignedItemIds = new Set(bill.contacts.flatMap((c) => c.items));
  const assignedPercent = totalItems > 0 ? (assignedItemIds.size / totalItems) * 100 : 0;
  const paidContacts = bill.contacts.filter((c) => c.paid).length;
  const totalContacts = bill.contacts.length;
  const paidOfAssigned = totalContacts > 0 ? (paidContacts / totalContacts) * assignedPercent : 0;
  const unpaidOfAssigned = assignedPercent - paidOfAssigned;

  const animate = shouldAnimate.current;
  if (shouldAnimate.current) shouldAnimate.current = false;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <Animated.View entering={animate ? FadeInDown.duration(300) : undefined}>
        <BillHeader
          billName={bill.name}
          state={bill.state}
          stateLabel={stateLabel}
          completionPercent={assignedPercent}
          paidPercent={paidOfAssigned}
          unpaidPercent={unpaidOfAssigned}
          stateTextClass={stateStyle.textClass}
          hasContacts={totalContacts > 0}
          iconColors={iconColors}
          t={t}
          onBack={() => router.back()}
          onUpdateName={(name) => updateBill({ id: id as Id<'bills'>, userId, name })}
          onDelete={async () => {
            await removeBill({ id: id as Id<'bills'>, userId: userId! });
            router.back();
          }}
        />
      </Animated.View>

      <ScrollView className="flex-1" contentContainerClassName="pb-8" showsVerticalScrollIndicator={false}>
        {/* Metadata */}
        <Animated.View entering={animate ? FadeInDown.delay(60).duration(300) : undefined}>
          <BillMetadata
            category={bill.category}
            location={bill.location}
            photoTakenAt={bill.photoTakenAt}
            creationTime={bill._creationTime}
            billCountry={billCountry}
            iconColors={iconColors}
            t={t}
            onCountryPress={() => setActiveDialog('country')}
          />
        </Animated.View>

        {/* Sort bar + bulk edit */}
        <Animated.View entering={animate ? FadeInDown.delay(120).duration(300) : undefined}>
          <SortBar
            sortStrategy={sortStrategy}
            onSortChange={setSortStrategy}
            multiSelectMode={multiSelectMode}
            selectedCount={selectedItemIds.size}
            onToggleMultiSelect={() => {
              setMultiSelectMode(!multiSelectMode);
              setSelectedItemIds(new Set());
              setEditingItemId(null);
            }}
            t={t}
          />
        </Animated.View>

        {/* Items */}
        {sortedItems.map((item, index) => {
          const itemId = item.id!;
          const assignedContacts = bill.contacts.filter((c) => c.items.includes(itemId));
          return (
            <Animated.View
              key={item.id ?? `legacy-${index}`}
              entering={animate ? FadeInDown.delay(Math.min(index, 8) * 60 + 180).duration(350) : undefined}
            >
              <BillItemCard
                item={item}
                index={index}
                billCountry={billCountry}
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
                onToggleSelection={toggleItemSelection}
              />
            </Animated.View>
          );
        })}

        {/* People summary */}
        {bill.contacts.length > 0 && (
          <Animated.View entering={animate ? FadeInDown.delay(Math.min(sortedItems.length, 8) * 60 + 240).duration(350) : undefined}>
            <PeopleSummary
              contacts={bill.contacts}
              billItems={bill.items}
              billCountry={billCountry}
              taxConfig={taxConfig}
              tipPercent={tipPercent}
              iconColors={iconColors}
              t={t}
              onTogglePaid={handleTogglePaid}
            />
          </Animated.View>
        )}

        {/* Summary */}
        <Animated.View entering={animate ? FadeInDown.delay(Math.min(sortedItems.length, 8) * 60 + 300).duration(350) : undefined}>
          <BillSummaryCard
            base={base}
            computedTax={computedTax}
            beforeTip={beforeTip}
            tipPercent={tipPercent}
            computedTip={computedTip}
            total={total}
            billCountry={billCountry}
            translatedTaxLabel={translatedTaxLabel}
            taxConfig={taxConfig}
            iconColors={iconColors}
            t={t}
            onTipPress={() => setActiveDialog('tip')}
            onUpdateTax={handleUpdateTax}
          />
        </Animated.View>
      </ScrollView>

      {/* Share button — filled primary when contacts exist */}
      {!multiSelectMode && bill.contacts.length > 0 && bill.state !== 'draft' && (
        <View className="border-t border-border/30 px-7 pb-2 pt-3">
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
              <IconSymbol name="checkmark" size={18} color={iconColors.primaryForeground} />
              <Text className="text-base font-semibold text-primary-foreground">{t.bill_confirmItems}</Text>
            </View>
          </Pressable>
        </View>
      )}

      {/* Bulk toolbar */}
      {multiSelectMode && selectedItemIds.size > 0 && (
        <BulkToolbar
          selectedItemIds={selectedItemIds}
          hasContactsOnSelection={bill.contacts.some((c) => c.items.some((itemId) => selectedItemIds.has(itemId)))}
          onAssign={handleMultiAssign}
          onUnassign={handleBulkRemoveContact}
          onDelete={handleBulkDelete}
        />
      )}

      {/* Dialogs & Sheets */}
      <BillShareSheet
        visible={activeDialog === 'share'}
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
        onClose={() => setActiveDialog(null)}
      />

      <ContactPickerSheet
        visible={activeDialog === 'contactPicker'}
        phoneContacts={phoneContacts}
        suggestedContacts={suggestedContacts ?? undefined}
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
        onClose={() => { setActiveDialog(null); setSingleAssignItemId(null); }}
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

      <TipDialog
        visible={activeDialog === 'tip'}
        tipPercent={tipPercent}
        subtotal={base}
        billCountry={billCountry}
        onSelectTip={async (pct, newTip) => {
          await updateBill({ id: id as Id<'bills'>, userId, tipPercent: pct, tip: newTip });
          setActiveDialog(null);
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
