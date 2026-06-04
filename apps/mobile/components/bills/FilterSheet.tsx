import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View, Pressable, ScrollView, TextInput } from 'react-native';
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from '@/lib/expo-image';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useT } from '@/lib/i18n';
import { useColorScheme } from 'nativewind';
import { ICON_COLORS } from '@/constants/colors';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import { formatPhone } from '@/lib/phone';
import CurrencyInput from '@/components/form/CurrencyInput';
import FilterChip from '@/components/bills/FilterChip';
import type { Id, Doc } from '@convex/_generated/dataModel';
import type { BillState } from '@/lib/billHelpers';
import type { FilterState, DatePreset, SortOption } from '@/lib/filters';

interface FilterSheetProps {
  visible: boolean;
  filters: FilterState;
  billsByState?: { draft: number; unsplit: number; split: number; unresolved: number };
  activeBillCount: number;
  availableContacts: Doc<'contacts'>[];
  country: string;
  minTotal?: number;
  maxTotal?: number;
  onApply: (filters: FilterState) => void;
  onClear: () => void;
  onClose: () => void;
}

const STATE_OPTIONS: (BillState | 'all')[] = ['all', 'draft', 'unsplit', 'unresolved', 'split'];

function FilterSheet({
  visible,
  filters,
  billsByState,
  activeBillCount,
  availableContacts,
  country,
  minTotal,
  maxTotal,
  onApply,
  onClear,
  onClose,
}: FilterSheetProps) {
  const t = useT();
  const { colorScheme } = useColorScheme();
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<TrueSheet>(null);

  useEffect(() => {
    if (visible) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [visible]);

  const handleDismiss = useCallback(() => { onClose(); }, [onClose]);

  const [draft, setDraft] = useState<FilterState>(filters);
  const [contactSearch, setContactSearch] = useState('');
  const [wasPrevVisible, setPrevVisible] = useState(false);
  if (visible !== wasPrevVisible) {
    setPrevVisible(visible);
    if (visible) {
      setDraft(filters);
      setContactSearch('');
    }
  }

  const filteredContacts = useMemo(() => {
    if (!contactSearch) return availableContacts;
    const query = contactSearch.toLowerCase();
    return availableContacts.filter((c) => c.name.toLowerCase().includes(query));
  }, [availableContacts, contactSearch]);

  const selectedContactSet = useMemo(
    () => new Set(draft.contactIds.map(String)),
    [draft.contactIds],
  );

  const toggleContact = (contactId: Id<'contacts'>) => {
    setDraft((prev) => {
      const ids = new Set(prev.contactIds.map(String));
      if (ids.has(String(contactId))) {
        return { ...prev, contactIds: prev.contactIds.filter((id) => id !== contactId) };
      }
      return { ...prev, contactIds: [...prev.contactIds, contactId] };
    });
  };

  const stateCount = (state: BillState | 'all') => {
    if (state === 'all') return activeBillCount;
    return billsByState?.[state] ?? 0;
  };

  const stateLabels: Record<string, string> = {
    all: t.filter_all,
    draft: t.filter_draft,
    unsplit: t.filter_unsplit,
    unresolved: t.filter_unresolved,
    split: t.filter_split,
  };

  const presetLabels: Record<DatePreset, string> = {
    '1h': t.filterSheet_preset1h,
    '1d': t.filterSheet_preset1d,
    '7d': t.filterSheet_preset7d,
    '30d': t.filterSheet_preset30d,
    custom: t.filterSheet_presetCustom,
  };

  const SORT_OPTIONS: SortOption[] = ['newest', 'oldest', 'highest', 'lowest', 'updated', 'name_asc'];
  const sortLabels: Record<SortOption, string> = {
    newest: t.filter_sort_newest,
    oldest: t.filter_sort_oldest,
    highest: t.filter_sort_highest,
    lowest: t.filter_sort_lowest,
    updated: t.filter_sort_updated,
    name_asc: t.filter_sort_name_asc,
  };

  // Count active non-default filters for Apply button
  const activeCount = [
    draft.sort !== 'newest',
    draft.contactIds.length > 0,
    draft.minAmount != null || draft.maxAmount != null,
    draft.state !== 'all',
    draft.datePreset !== '7d',
  ].filter(Boolean).length;

  return (
    <TrueSheet
      ref={sheetRef}
      name="filter-sheet"
      detents={[1]}
      grabber
      grabberOptions={{ topMargin: 12 }}
      cornerRadius={20}
      scrollable
      backgroundColor={colorScheme === 'dark' ? '#0f172a' : '#fafbfc'}
      onDidDismiss={handleDismiss}
    >
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-7 pb-4 pt-4">
          <Text className="text-2xl font-bold text-foreground">{t.filterSheet_title}</Text>
        </View>

        <ScrollView className="flex-1" contentContainerClassName="px-7" contentContainerStyle={{ paddingBottom: insets.bottom + 100 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          {/* Sort */}
          <View className="mb-2 rounded-xl bg-muted/10 p-4">
            <View className="mb-2.5 flex-row items-center gap-2">
              <IconSymbol name="arrow.up.arrow.down" size={14} color={iconColors.muted} />
              <Text className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {t.filter_sort}
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {SORT_OPTIONS.map((opt) => (
                  <FilterChip
                    key={opt}
                    label={sortLabels[opt]}
                    isActive={draft.sort === opt}
                    onPress={() => setDraft((f) => ({ ...f, sort: opt }))}
                  />
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Country */}
          <View className="mb-2 rounded-xl bg-muted/10 p-4">
            <View className="mb-2.5 flex-row items-center gap-2">
              <IconSymbol name="globe" size={14} color={iconColors.muted} />
              <Text className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {t.filterSheet_country}
              </Text>
            </View>
            <View className="flex-row gap-2">
              <FilterChip
                label="Colombia"
                icon={<Text className="text-base">🇨🇴</Text>}
                isActive={draft.country === 'CO'}
                onPress={() => setDraft((f) => ({ ...f, country: 'CO' }))}
              />
              <FilterChip
                label="USA"
                icon={<Text className="text-base">🇺🇸</Text>}
                isActive={draft.country === 'US'}
                onPress={() => setDraft((f) => ({ ...f, country: 'US' }))}
              />
              <FilterChip
                label={t.filter_international}
                icon={<Text className="text-base">🌐</Text>}
                isActive={draft.country === 'all'}
                onPress={() => setDraft((f) => ({ ...f, country: 'all' }))}
              />
            </View>
          </View>

          {/* Status */}
          <View className="mb-2 rounded-xl bg-muted/10 p-4">
            <View className="mb-2.5 flex-row items-center gap-2">
              <IconSymbol name="circle.grid.2x2" size={14} color={iconColors.muted} />
              <Text className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {t.filterSheet_status}
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {STATE_OPTIONS.map((state) => (
                  <FilterChip
                    key={state}
                    label={stateLabels[state] ?? state}
                    isActive={draft.state === state}
                    count={stateCount(state)}
                    onPress={() => setDraft((f) => ({ ...f, state }))}
                  />
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Contacts */}
          <View className="mb-2 rounded-xl bg-muted/10 p-4">
            <View className="mb-2.5 flex-row items-center gap-2">
              <IconSymbol name="person.2" size={14} color={iconColors.muted} />
              <Text className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {t.filterSheet_contacts}
              </Text>
              {draft.contactIds.length > 0 && (
                <View className="rounded-full bg-primary/20 px-1.5 py-0.5">
                  <Text className="text-sm font-bold text-primary">{draft.contactIds.length}</Text>
                </View>
              )}
            </View>
            <TextInput
              value={contactSearch}
              onChangeText={setContactSearch}
              placeholder={t.filterSheet_contactSearch}
              placeholderTextColor={iconColors.muted}
              className="mb-2 rounded-lg bg-muted-foreground/[0.08] px-3.5 py-2 text-base text-foreground"
            />
            <View className="max-h-[280px]">
              <ScrollView nestedScrollEnabled>
                {filteredContacts.map((contact) => {
                  const isSelected = selectedContactSet.has(String(contact._id));
                  return (
                    <Pressable
                      key={String(contact._id)}
                      onPress={() => toggleContact(contact._id)}
                      className={cn(
                        'flex-row items-center gap-3 rounded-lg px-1 py-2.5',
                        isSelected && 'bg-primary/[0.06]',
                      )}
                    >
                      <IconSymbol
                        name={isSelected ? 'checkmark.circle.fill' : 'circle'}
                        size={20}
                        color={isSelected ? iconColors.primary : iconColors.mutedLight}
                      />
                      {contact.imageUri ? (
                        <Image source={{ uri: contact.imageUri }} className="h-8 w-8 rounded-full" />
                      ) : (
                        <View className="h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                          <Text className="text-base font-bold text-primary">
                            {(contact.name[0] ?? '?').toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View className="flex-1">
                        <Text className="text-base font-medium text-foreground">{contact.name}</Text>
                        {contact.phone && (
                          <Text className="text-sm text-muted-foreground">{formatPhone(contact.phone)}</Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
                {filteredContacts.length === 0 && (
                  <Text className="py-4 text-center text-base text-muted-foreground">
                    {contactSearch ? 'No contacts found' : 'No contacts yet'}
                  </Text>
                )}
              </ScrollView>
            </View>
          </View>

          {/* Amount Range */}
          <View className="mb-2 rounded-xl bg-muted/10 p-4">
            <View className="mb-2.5 flex-row items-center gap-2">
              <IconSymbol name="dollarsign.circle" size={14} color={iconColors.muted} />
              <Text className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {t.filterSheet_amount}
              </Text>
            </View>
            <View className="flex-row items-center gap-3">
              <View className="flex-1 rounded-lg bg-muted-foreground/[0.08] px-3.5">
                <CurrencyInput
                  value={draft.minAmount ?? 0}
                  onChangeValue={(v) => setDraft((f) => ({ ...f, minAmount: v || null }))}
                  country={country}
                  placeholder={t.filterSheet_amountMin}
                  placeholderTextColor={iconColors.muted}
                  className="py-2 text-base"
                />
              </View>
              <Text className="text-base text-muted-foreground">—</Text>
              <View className="flex-1 rounded-lg bg-muted-foreground/[0.08] px-3.5">
                <CurrencyInput
                  value={draft.maxAmount ?? 0}
                  onChangeValue={(v) => setDraft((f) => ({ ...f, maxAmount: v || null }))}
                  country={country}
                  placeholder={t.filterSheet_amountMax}
                  placeholderTextColor={iconColors.muted}
                  className="py-2 text-base"
                />
              </View>
            </View>
            {minTotal != null && maxTotal != null && maxTotal > 0 && (
              <Text className="mt-2 text-sm text-muted-foreground">
                {t.filterSheet_amountHint(formatCurrency(minTotal, country), formatCurrency(maxTotal, country))}
              </Text>
            )}
          </View>

          {/* Date Range */}
          <View className="rounded-xl bg-muted/10 p-4">
            <View className="mb-2.5 flex-row items-center gap-2">
              <IconSymbol name="calendar" size={14} color={iconColors.muted} />
              <Text className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {t.filterSheet_dateRange}
              </Text>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {(['1h', '1d', '7d', '30d', 'custom'] as DatePreset[]).map((key) => (
                <FilterChip
                  key={key}
                  label={presetLabels[key]}
                  isActive={draft.datePreset === key}
                  onPress={() =>
                    setDraft((f) => ({
                      ...f,
                      datePreset: key,
                      ...(key !== 'custom' ? { fromDate: null, toDate: null } : {}),
                    }))
                  }
                />
              ))}
            </View>
            {draft.datePreset === 'custom' && (
              <View className="mt-3 flex-row items-center gap-3">
                <TextInput
                  defaultValue={draft.fromDate ? new Date(draft.fromDate).toISOString().split('T')[0] : ''}
                  onEndEditing={(e) => {
                    const ts = Date.parse(e.nativeEvent.text);
                    setDraft((f) => ({ ...f, fromDate: isNaN(ts) ? null : ts }));
                  }}
                  placeholder={`${t.filterSheet_dateFrom} (YYYY-MM-DD)`}
                  placeholderTextColor={iconColors.muted}
                  className="flex-1 rounded-lg bg-muted-foreground/[0.08] px-3.5 py-2 text-base text-foreground"
                />
                <Text className="text-base text-muted-foreground">—</Text>
                <TextInput
                  defaultValue={draft.toDate ? new Date(draft.toDate).toISOString().split('T')[0] : ''}
                  onEndEditing={(e) => {
                    const ts = Date.parse(e.nativeEvent.text);
                    setDraft((f) => ({ ...f, toDate: isNaN(ts) ? null : ts }));
                  }}
                  placeholder={`${t.filterSheet_dateTo} (YYYY-MM-DD)`}
                  placeholderTextColor={iconColors.muted}
                  className="flex-1 rounded-lg bg-muted-foreground/[0.08] px-3.5 py-2 text-base text-foreground"
                />
              </View>
            )}
          </View>
        </ScrollView>

        {/* Bottom fade */}
        <MaskedView
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: insets.bottom + 100, zIndex: 5 }}
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

        {/* Footer — floating glass buttons */}
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 10, backgroundColor: 'transparent', paddingHorizontal: 28, paddingBottom: insets.bottom > 0 ? insets.bottom : 16, paddingTop: 12 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable
              onPress={() => { onClear(); onClose(); }}
              style={{ flex: 1, backgroundColor: 'transparent' }}
              className="active:opacity-80"
            >
              {Platform.OS === 'ios' && isGlassEffectAPIAvailable() ? (
                <GlassView isInteractive style={{ borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' }}>
                  <Text className="text-base font-semibold text-muted-foreground">
                    {t.filterSheet_resetDefaults}
                  </Text>
                </GlassView>
              ) : (
                <View className="items-center rounded-xl border border-border py-3.5">
                  <Text className="text-base font-semibold text-muted-foreground">
                    {t.filterSheet_resetDefaults}
                  </Text>
                </View>
              )}
            </Pressable>
            <Pressable
              onPress={() => {
                const applied = { ...draft };
                if (applied.minAmount != null && applied.maxAmount != null && applied.minAmount > applied.maxAmount) {
                  const tmp = applied.minAmount;
                  applied.minAmount = applied.maxAmount;
                  applied.maxAmount = tmp;
                }
                onApply(applied);
              }}
              style={{ flex: 2, backgroundColor: 'transparent' }}
              className="active:opacity-80"
            >
              {Platform.OS === 'ios' && isGlassEffectAPIAvailable() ? (
                <GlassView isInteractive tintColor={iconColors.primary + '0D'} style={{ borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' }}>
                  <Text className="text-base font-bold text-primary">
                    {t.filterSheet_apply}{activeCount > 0 ? ` (${activeCount})` : ''}
                  </Text>
                </GlassView>
              ) : (
                <View className="items-center rounded-xl bg-primary py-3.5">
                  <Text className="text-base font-bold text-primary-foreground">
                    {t.filterSheet_apply}{activeCount > 0 ? ` (${activeCount})` : ''}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </TrueSheet>
  );
}

export default React.memo(FilterSheet);
