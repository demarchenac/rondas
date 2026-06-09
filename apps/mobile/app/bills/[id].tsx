import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { useGlassEffect } from '@/hooks/useGlassEffect';
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import BillDetailActionBar from '@/components/bills/detail/BillDetailActionBar';
import BillDetailSheets from '@/components/bills/detail/BillDetailSheets';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { Id } from '@convex/_generated/dataModel';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ICON_COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/AuthContext';
import { useT } from '@/lib/i18n';
import { useCustomAlert } from '@/components/ui/custom-alert';

import BillHeader from '@/components/bills/detail/BillHeader';
import BillMetadata from '@/components/bills/detail/BillMetadata';
import SortBar from '@/components/bills/detail/SortBar';
import BillItemCard from '@/components/bills/detail/BillItemCard';
import BillSummaryCard from '@/components/bills/detail/BillSummaryCard';
import PeopleSummary from '@/components/bills/detail/PeopleSummary';
import EqualSplitView from '@/components/bills/detail/EqualSplitView';
import { useBillDetail } from '@/hooks/useBillDetail';

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

  // ── Data hook ──
  const {
    bill,
    billDerived,
    suggestedContacts,
    selfContact,
    phoneContacts,
    selectedContactIds,
    numPeople,
    equalSplitMode,
    totalContacts,
    paidPercent,
    unpaidPercent,
    unassignedUnits,
    computeExcludePhones,
    computeExcludeSelf,
    computeSortedItems,
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
  } = useBillDetail(id, userId);

  // ── UI-only state ──
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [activeDialog, setActiveDialog] = useState<DialogType>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [sortStrategy, setSortStrategy] = useState<SortStrategy>('original');
  const [unitSheetTarget, setUnitSheetTarget] = useState<{ itemId: string; contactId: Id<'contacts'> } | null>(null);

  const swipeOpenRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);

  // ── Glass effect ──
  const { shouldUseGlass } = useGlassEffect();

  // ── Derived (depends on UI state) ──
  const excludePhones = useMemo(() => computeExcludePhones(selectedItemIds), [computeExcludePhones, selectedItemIds]);
  const excludeSelf = useMemo(() => computeExcludeSelf(selectedItemIds), [computeExcludeSelf, selectedItemIds]);
  const sortedItems = useMemo(() => computeSortedItems(sortStrategy), [computeSortedItems, sortStrategy]);

  // ── UI callbacks that wrap hook callbacks ──

  const onRemoveItem = useCallback((itemId: string) => {
    const result = handleRemoveItem(itemId);
    if (!result) return;
    setDeletingId(itemId);
    setTimeout(() => {
      result.update();
      setDeletingId(null);
    }, 300);
  }, [handleRemoveItem]);

  const onItemPress = useCallback((itemId: string) => {
    if (swipeOpenRef.current) {
      swipeOpenRef.current = false;
      return;
    }
    setEditingItemId(itemId);
  }, []);

  const onSubmitEdit = useCallback((itemId: string, values: { name: string; quantity: number; unitPrice: number }) => {
    handleSubmitEdit(itemId, values);
    setEditingItemId(null);
  }, [handleSubmitEdit]);

  const toggleItemSelection = useCallback((itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  const onMultiAssign = useCallback(async () => {
    const ok = await handleMultiAssign(selectedItemIds);
    if (ok) setActiveDialog('contactPicker');
  }, [selectedItemIds, handleMultiAssign]);

  const onConfirmContactPicker = useCallback(async () => {
    const ok = await handleConfirmContactPicker(selectedItemIds);
    if (ok) {
      setActiveDialog(null);
      setSelectedItemIds(new Set());
    }
  }, [selectedItemIds, handleConfirmContactPicker]);

  const onBulkDelete = useCallback(() => {
    handleBulkDelete(selectedItemIds);
    setSelectedItemIds(new Set());
  }, [selectedItemIds, handleBulkDelete]);

  const onAddItem = useCallback(async () => {
    if (isMultiSelectMode) {
      setSelectedItemIds(new Set());
    }
    const newItemId = await handleAddItem();
    if (newItemId) {
      setEditingItemId(newItemId);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
    }
  }, [isMultiSelectMode, handleAddItem]);

  const onBulkRemoveContact = useCallback(() => {
    const result = handleBulkRemoveContact(selectedItemIds);
    if (result === 'single') {
      setSelectedItemIds(new Set());
    } else if (result === 'multiple') {
      setActiveDialog('unassignPicker');
    }
  }, [selectedItemIds, handleBulkRemoveContact]);

  const onConfirmUnassign = useCallback(async () => {
    const ok = await handleConfirmUnassign(selectedItemIds);
    if (ok) {
      setActiveDialog(null);
      setSelectedItemIds(new Set());
    }
  }, [selectedItemIds, handleConfirmUnassign]);

  const onAssignContact = useCallback(async (itemId: string) => {
    const ok = await handleAssignContact(itemId);
    if (ok) setActiveDialog('contactPicker');
  }, [handleAssignContact]);

  const onCloseContactPicker = useCallback(() => {
    setActiveDialog(null);
    handleCloseContactPicker();
  }, [handleCloseContactPicker]);

  const onContactPress = useCallback((itemId: string, contactId: Id<'contacts'>) => {
    setUnitSheetTarget({ itemId, contactId });
  }, []);

  const onUpdateUnits = useCallback(async (units: number) => {
    if (!unitSheetTarget) return;
    await handleUpdateUnits(units, unitSheetTarget);
  }, [unitSheetTarget, handleUpdateUnits]);

  const onRemoveFromUnitSheet = useCallback(() => {
    if (!unitSheetTarget || !userId) return;
    handleRemoveContact(unitSheetTarget.itemId, unitSheetTarget.contactId, () => {
      TrueSheet.dismiss('contact-unit').then(() => setUnitSheetTarget(null)).catch(() => setUnitSheetTarget(null));
    });
  }, [unitSheetTarget, userId, handleRemoveContact]);

  const onEqualAssignContacts = useCallback(async () => {
    const ok = await handleEqualAssignContacts();
    if (ok) setActiveDialog('contactPicker');
  }, [handleEqualAssignContacts]);

  const onConfirmEqualContactPicker = useCallback(async () => {
    const ok = await handleConfirmEqualContactPicker();
    if (ok) setActiveDialog(null);
  }, [handleConfirmEqualContactPicker]);

  const onSelectTip = useCallback(async (pct: number, newTip: number) => {
    await handleSelectTip(pct, newTip);
    setActiveDialog(null);
  }, [handleSelectTip]);

  const onSelectCountry = useCallback(async (code: string) => {
    await handleSelectCountry(code);
    setActiveDialog(null);
  }, [handleSelectCountry]);

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
        <Text className="text-xl font-semibold text-foreground">{t.error_billNotFound}</Text>
        <Text className="mt-2 text-center text-base text-muted-foreground">{t.error_billNotFoundHint}</Text>
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

  const { base, billCountry, taxConfig, translatedTaxLabel, computedTax, tipPercent, shouldUseCustomTip, computedTip, beforeTip, total, stateStyle, stateLabel, decimalPlaces } = billDerived;

  return (
    <View className="flex-1 bg-background">
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
          isMultiSelectMode={isMultiSelectMode}
          unassignedUnits={unassignedUnits}
          iconColors={iconColors}
          t={t}
          onBack={() => router.back()}
          onUpdateName={handleUpdateName}
          onSplitEqually={handleSplitEqually}
          onSplitByItem={handleSplitByItem}
          onEdit={() => {
            setIsMultiSelectMode(true);
            setSelectedItemIds(new Set());
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          onDoneEdit={() => {
            setIsMultiSelectMode(false);
            setSelectedItemIds(new Set());
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          onDelete={async () => {
            try {
              await handleRemoveBill();
              router.back();
            } catch (err) {
              console.error('[Bill] removeBill failed:', err);
              Sentry.captureException(err, { tags: { feature: 'bill_detail' } });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              alert(t.error, t.error_mutationFailed);
            }
          }}
        />
      </Animated.View>

      {/* Top scroll edge — fade content under header */}
      <MaskedView
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: insets.top + (unassignedUnits > 0 ? 140 : 100), zIndex: 5 }}
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

      <ScrollView ref={scrollRef} className="flex-1" contentContainerStyle={{ paddingTop: insets.top + (unassignedUnits > 0 ? 120 : 80), paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
        {/* Metadata */}
        <Animated.View entering={FadeInDown.delay(60).duration(300)}>
          <BillMetadata
            category={bill.tags?.find((tag) => tag.isPlatform)?.slug}
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
              onAssignContacts={onEqualAssignContacts}
              onConfirm={handleConfirmEqualSplit}
              onTogglePaid={handleTogglePaid}
              onRemoveContact={handleRemoveEqualContact}
              onItemPress={onItemPress}
              onSubmitEdit={onSubmitEdit}
              onDismissEdit={() => setEditingItemId(null)}
              onRemoveItem={onRemoveItem}
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
              const assignedContacts = bill.contacts.filter((contact) => contact.items.some((itemRef) => itemRef.itemId === itemId));
              const assignedUnits = bill.contacts.reduce((sum, contact) => {
                const ref = contact.items.find((itemRef) => itemRef.itemId === itemId);
                return sum + (ref ? ref.units : 0);
              }, 0);
              const itemUnassigned = Math.max(0, item.quantity - assignedUnits);
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
                    unassignedUnits={itemUnassigned}
                    isEditing={editingItemId === itemId}
                    isDeleting={deletingId === item.id}
                    isMultiSelectMode={isMultiSelectMode}
                    isSelected={selectedItemIds.has(itemId)}
                    iconColors={iconColors}
                    t={t}
                    swipeOpenRef={swipeOpenRef}
                    onPress={onItemPress}
                    onRemoveItem={onRemoveItem}
                    onSubmitEdit={onSubmitEdit}
                    onDismissEdit={() => setEditingItemId(null)}
                    onAssignContact={onAssignContact}
                    onRemoveContact={handleRemoveContact}
                    onContactPress={onContactPress}
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
              contactGroups={bill.contactGroups}
              onUpdateGroups={handleUpdateGroups}
              onToggleGroupPaid={handleToggleGroupPaid}
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
            shouldUseCustomTip={shouldUseCustomTip}
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

      {/* Bottom scroll edge — MaskedView fade above buttons */}
      <MaskedView
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: insets.bottom + 140, zIndex: 5 }}
        pointerEvents="none"
        maskElement={
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,1)']}
            locations={[0, 0.35, 1]}
            style={{ flex: 1 }}
          />
        }
      >
        <View className="flex-1 bg-background" />
      </MaskedView>

      <BillDetailActionBar
        shouldUseGlass={shouldUseGlass}
        isMultiSelectMode={isMultiSelectMode}
        selectedItemIds={selectedItemIds}
        hasContacts={bill.contacts.length > 0}
        hasContactsOnSelection={bill.contacts.some((contact) => contact.items.some((ref) => selectedItemIds.has(ref.itemId)))}
        billState={bill.state}
        contactCount={bill.contacts.length}
        bottomInset={insets.bottom}
        iconColors={iconColors}
        t={t}
        onSharePress={() => router.push(`/bills/share?id=${id}`)}
        onAddItem={onAddItem}
        onMultiAssign={onMultiAssign}
        onBulkRemoveContact={onBulkRemoveContact}
        onBulkDelete={onBulkDelete}
      />

      <BillDetailSheets
        activeDialog={activeDialog}
        bill={bill}
        userId={userId}
        phoneContacts={phoneContacts}
        suggestedContacts={suggestedContacts ?? undefined}
        selfContact={selfContact}
        selectedContactIds={selectedContactIds}
        selectedItemIds={selectedItemIds}
        excludePhones={excludePhones}
        excludeSelf={excludeSelf}
        equalSplitMode={equalSplitMode}
        numPeople={numPeople}
        unitSheetTarget={unitSheetTarget}
        billCountry={billCountry}
        decimalPlaces={decimalPlaces}
        tipPercent={tipPercent}
        shouldUseCustomTip={shouldUseCustomTip}
        base={base}
        taxConfig={taxConfig}
        bottomInset={insets.bottom}
        iconColors={iconColors}
        t={t}
        onToggleContact={handleToggleContactSelection}
        onConfirmContactPicker={onConfirmContactPicker}
        onConfirmEqualContactPicker={onConfirmEqualContactPicker}
        onCloseContactPicker={onCloseContactPicker}
        onConfirmUnassign={onConfirmUnassign}
        onCloseUnassign={() => setActiveDialog(null)}
        onUpdateUnits={onUpdateUnits}
        onRemoveFromUnitSheet={onRemoveFromUnitSheet}
        onCloseUnitSheet={() => setUnitSheetTarget(null)}
        onSelectTip={onSelectTip}
        onSelectCustomTip={handleSelectCustomTip}
        onToggleCustomTip={handleToggleCustomTip}
        onCloseDialog={() => setActiveDialog(null)}
        onSelectCountry={onSelectCountry}
      />
    </View>
  );
}
