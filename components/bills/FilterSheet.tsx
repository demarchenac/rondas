import React, { useState, useMemo } from 'react';
import { Modal, View, Pressable, ScrollView, TextInput } from 'react-native';
import { Image } from '@/lib/expo-image';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useT } from '@/lib/i18n';
import { useColorScheme } from 'nativewind';
import { ICON_COLORS } from '@/constants/colors';
import { cn } from '@/lib/cn';
import FilterChip from '@/components/bills/FilterChip';
import type { Id, Doc } from '@/convex/_generated/dataModel';
import type { BillState } from '@/lib/billHelpers';
import type { FilterState, DatePreset } from '@/lib/filters';

interface FilterSheetProps {
  visible: boolean;
  filters: FilterState;
  billsByState?: { draft: number; unsplit: number; split: number; unresolved: number };
  activeBillCount: number;
  availableContacts: Doc<'contacts'>[];
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
  onApply,
  onClear,
  onClose,
}: FilterSheetProps) {
  const t = useT();
  const { colorScheme } = useColorScheme();
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];

  const [draft, setDraft] = useState<FilterState>(filters);
  const [contactSearch, setContactSearch] = useState('');

  React.useEffect(() => {
    if (visible) {
      setDraft(filters);
      setContactSearch('');
    }
  }, [visible, filters]);

  const filteredContacts = useMemo(() => {
    if (!contactSearch) return availableContacts;
    const q = contactSearch.toLowerCase();
    return availableContacts.filter((c) => c.name.toLowerCase().includes(q));
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

  // Count active non-default filters for Apply button
  const activeCount = [
    draft.contactIds.length > 0,
    draft.minAmount != null || draft.maxAmount != null,
    draft.state !== 'all',
    draft.datePreset !== '7d',
  ].filter(Boolean).length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background pt-3">
        {/* Handle */}
        <View className="items-center pb-2">
          <View className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </View>

        {/* Header */}
        <View className="flex-row items-center justify-between px-7 pb-4 pt-2">
          <Text className="text-xl font-bold text-foreground">{t.filterSheet_title}</Text>
          <Pressable onPress={onClose} className="rounded-full bg-muted p-2">
            <IconSymbol name="xmark" size={14} color={iconColors.muted} />
          </Pressable>
        </View>

        <ScrollView className="flex-1" contentContainerClassName="px-7 pb-8">
          {/* Country */}
          <View className="mb-2 rounded-xl bg-muted/10 p-4">
            <View className="mb-2.5 flex-row items-center gap-2">
              <IconSymbol name="globe" size={14} color={iconColors.muted} />
              <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t.filterSheet_country}
              </Text>
            </View>
            <View className="flex-row gap-2">
              <FilterChip
                label="🇨🇴 Colombia"
                isActive={draft.country === 'CO'}
                onPress={() => setDraft((f) => ({ ...f, country: 'CO' }))}
              />
              <FilterChip
                label="🇺🇸 USA"
                isActive={draft.country === 'US'}
                onPress={() => setDraft((f) => ({ ...f, country: 'US' }))}
              />
            </View>
          </View>

          {/* Status */}
          <View className="mb-2 rounded-xl bg-muted/10 p-4">
            <View className="mb-2.5 flex-row items-center gap-2">
              <IconSymbol name="circle.grid.2x2" size={14} color={iconColors.muted} />
              <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
              <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t.filterSheet_contacts}
              </Text>
              {draft.contactIds.length > 0 && (
                <View className="rounded-full bg-primary/20 px-1.5 py-0.5">
                  <Text className="text-[10px] font-bold text-primary">{draft.contactIds.length}</Text>
                </View>
              )}
            </View>
            <TextInput
              value={contactSearch}
              onChangeText={setContactSearch}
              placeholder={t.filterSheet_contactSearch}
              placeholderTextColor={iconColors.muted}
              className="mb-2 rounded-lg bg-muted-foreground/[0.08] px-3.5 py-2 text-[14px] text-foreground"
            />
            <View className="max-h-[280px]">
              <ScrollView nestedScrollEnabled>
                {filteredContacts.map((c) => {
                  const isSelected = selectedContactSet.has(String(c._id));
                  return (
                    <Pressable
                      key={String(c._id)}
                      onPress={() => toggleContact(c._id)}
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
                      {c.imageUri ? (
                        <Image source={{ uri: c.imageUri }} className="h-8 w-8 rounded-full" />
                      ) : (
                        <View className="h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                          <Text className="text-sm font-bold text-primary">
                            {(c.name[0] ?? '?').toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View className="flex-1">
                        <Text className="text-sm font-medium text-foreground">{c.name}</Text>
                        {c.phone && (
                          <Text className="text-xs text-muted-foreground">{c.phone}</Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
                {filteredContacts.length === 0 && (
                  <Text className="py-4 text-center text-sm text-muted-foreground">
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
              <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t.filterSheet_amount}
              </Text>
            </View>
            <View className="flex-row items-center gap-3">
              <View className="flex-1 flex-row items-center rounded-lg bg-muted-foreground/[0.08] px-3.5">
                <Text className="text-sm text-muted-foreground">$</Text>
                <TextInput
                  value={draft.minAmount != null ? String(draft.minAmount) : ''}
                  onChangeText={(text) => {
                    const num = text ? parseFloat(text) : null;
                    setDraft((f) => ({ ...f, minAmount: num }));
                  }}
                  placeholder={t.filterSheet_amountMin}
                  placeholderTextColor={iconColors.muted}
                  keyboardType="numeric"
                  className="flex-1 py-2 pl-1 text-[14px] text-foreground"
                />
              </View>
              <Text className="text-sm text-muted-foreground">—</Text>
              <View className="flex-1 flex-row items-center rounded-lg bg-muted-foreground/[0.08] px-3.5">
                <Text className="text-sm text-muted-foreground">$</Text>
                <TextInput
                  value={draft.maxAmount != null ? String(draft.maxAmount) : ''}
                  onChangeText={(text) => {
                    const num = text ? parseFloat(text) : null;
                    setDraft((f) => ({ ...f, maxAmount: num }));
                  }}
                  placeholder={t.filterSheet_amountMax}
                  placeholderTextColor={iconColors.muted}
                  keyboardType="numeric"
                  className="flex-1 py-2 pl-1 text-[14px] text-foreground"
                />
              </View>
            </View>
          </View>

          {/* Date Range */}
          <View className="rounded-xl bg-muted/10 p-4">
            <View className="mb-2.5 flex-row items-center gap-2">
              <IconSymbol name="calendar" size={14} color={iconColors.muted} />
              <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
                  value={draft.fromDate ? new Date(draft.fromDate).toISOString().split('T')[0] : ''}
                  onChangeText={(text) => {
                    const ts = Date.parse(text);
                    setDraft((f) => ({ ...f, fromDate: isNaN(ts) ? null : ts }));
                  }}
                  placeholder={`${t.filterSheet_dateFrom} (YYYY-MM-DD)`}
                  placeholderTextColor={iconColors.muted}
                  className="flex-1 rounded-lg bg-muted-foreground/[0.08] px-3.5 py-2 text-[14px] text-foreground"
                />
                <Text className="text-sm text-muted-foreground">—</Text>
                <TextInput
                  value={draft.toDate ? new Date(draft.toDate).toISOString().split('T')[0] : ''}
                  onChangeText={(text) => {
                    const ts = Date.parse(text);
                    setDraft((f) => ({ ...f, toDate: isNaN(ts) ? null : ts }));
                  }}
                  placeholder={`${t.filterSheet_dateTo} (YYYY-MM-DD)`}
                  placeholderTextColor={iconColors.muted}
                  className="flex-1 rounded-lg bg-muted-foreground/[0.08] px-3.5 py-2 text-[14px] text-foreground"
                />
              </View>
            )}
          </View>
        </ScrollView>

        {/* Footer */}
        <View className="flex-row gap-3 border-t border-border/20 px-7 pb-8 pt-3">
          <Pressable
            onPress={() => {
              onClear();
              onClose();
            }}
            className="flex-1 items-center rounded-xl border border-border py-3.5"
          >
            <Text className="text-sm font-semibold text-muted-foreground">
              {t.filterSheet_resetDefaults}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onApply(draft)}
            className="flex-[2] items-center rounded-xl bg-primary py-3.5"
          >
            <Text className="text-sm font-bold text-primary-foreground">
              {t.filterSheet_apply}{activeCount > 0 ? ` (${activeCount})` : ''}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default React.memo(FilterSheet);
