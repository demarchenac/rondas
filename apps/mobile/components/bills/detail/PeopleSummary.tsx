import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { randomUUID } from 'expo-crypto';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import Avatar from '@/components/ui/avatar';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import { computeContactTotal } from '@/lib/billSplit';
import type { TaxConfig } from '@/constants/taxes';
import type { Id } from '@convex/_generated/dataModel';
import type { Translations } from '@/lib/i18n';
import { useProGate } from '@/hooks/useProGate';

interface ResolvedContact {
  contactId: Id<'contacts'>;
  isSelf?: boolean;
  name: string;
  phone?: string;
  imageUri?: string;
  items: { itemId: string; units: number }[];
  amount: number;
  paid: boolean;
}

interface BillItem {
  id?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface ContactGroup {
  id: string;
  contactIds: Id<'contacts'>[];
  name: string;
}

const GROUP_TINTS = [
  { bg: 'bg-blue-500/10', border: 'border-l-blue-500' },
  { bg: 'bg-purple-500/10', border: 'border-l-purple-500' },
  { bg: 'bg-teal-500/10', border: 'border-l-teal-500' },
  { bg: 'bg-rose-500/10', border: 'border-l-rose-500' },
];

interface PeopleSummaryProps {
  contacts: ResolvedContact[];
  billItems: BillItem[];
  billCountry: string;
  splitStrategy?: string;
  taxConfig: TaxConfig;
  tipPercent: number;
  decimalPlaces?: number;
  iconColors: Record<string, string>;
  t: Translations;
  onTogglePaid: (contactId: Id<'contacts'>) => void;
  contactGroups?: ContactGroup[];
  onUpdateGroups: (groups: ContactGroup[]) => void;
  onToggleGroupPaid: (groupId: string) => void;
}

function generateGroupName(members: ResolvedContact[], t: Translations): string {
  const names = members.map((m) => m.isSelf ? t.self_label(m.name) : m.name);
  if (names.length <= 2) return names.join(', ');
  return `${names[0]}, ${names[1]} +${names.length - 2}`;
}

function PeopleSummary({
  contacts,
  billItems,
  billCountry,
  splitStrategy,
  taxConfig,
  tipPercent,
  decimalPlaces,
  iconColors,
  t,
  onTogglePaid,
  contactGroups = [],
  onUpdateGroups,
  onToggleGroupPaid,
}: PeopleSummaryProps) {
  const { unlocked, showPaywall } = useProGate();
  const paidCount = contacts.filter((c) => c.paid).length;
  const allPaid = paidCount === contacts.length;

  const isEqualSplit = splitStrategy === 'equal';
  const useGlass = Platform.OS === 'ios' && isGlassEffectAPIAvailable();

  const [groupSelectMode, setGroupSelectMode] = useState(false);
  const [selectedForGroup, setSelectedForGroup] = useState<Set<string>>(new Set());
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());
  const [editingNameGroupId, setEditingNameGroupId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');

  const groupedContactIds = useMemo(() => {
    const ids = new Set<string>();
    for (const g of contactGroups) {
      for (const cid of g.contactIds) ids.add(String(cid));
    }
    return ids;
  }, [contactGroups]);

  const contactTotals = useMemo(() => {
    const positiveTotal = billItems.reduce((sum, i) => sum + Math.max(0, i.subtotal), 0);
    const discountTotal = billItems.reduce((sum, i) => sum + Math.min(0, i.subtotal), 0);
    return contacts.map((c) => ({
      ...c,
      total: isEqualSplit ? c.amount : computeContactTotal(c, billItems, contacts, taxConfig, tipPercent, positiveTotal, discountTotal),
    }));
  }, [contacts, billItems, taxConfig, tipPercent, isEqualSplit]);

  const contactTotalMap = useMemo(() => {
    const map = new Map<string, typeof contactTotals[0]>();
    for (const c of contactTotals) map.set(String(c.contactId), c);
    return map;
  }, [contactTotals]);

  const ungroupedContacts = useMemo(() => {
    return contactTotals
      .filter((c) => !groupedContactIds.has(String(c.contactId)))
      .sort((a, b) => {
        if (a.paid !== b.paid) return a.paid ? 1 : -1;
        if (a.isSelf) return -1;
        if (b.isSelf) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [contactTotals, groupedContactIds]);

  const groupData = useMemo(() => {
    return contactGroups.map((g, i) => {
      const members = g.contactIds
        .map((cid) => contactTotalMap.get(String(cid)))
        .filter((m): m is NonNullable<typeof m> => m != null);
      const total = members.reduce((sum, m) => sum + m.total, 0);
      const allMembersPaid = members.length > 0 && members.every((m) => m.paid);
      const tint = GROUP_TINTS[i % GROUP_TINTS.length];
      return { ...g, members, total, allMembersPaid, tint };
    }).filter((g) => g.members.length >= 2);
  }, [contactGroups, contactTotalMap]);

  const handleToggle = useCallback((contactId: Id<'contacts'>) => {
    if (!unlocked) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      showPaywall();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onTogglePaid(contactId);
  }, [unlocked, showPaywall, onTogglePaid]);

  const handleGroupToggle = useCallback((groupId: string) => {
    if (!unlocked) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      showPaywall();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggleGroupPaid(groupId);
  }, [unlocked, showPaywall, onToggleGroupPaid]);

  const toggleSelection = useCallback((contactId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedForGroup((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  }, []);

  const handleExpandGroup = useCallback((groupId: string) => {
    const group = contactGroups.find((g) => g.id === groupId);
    if (!group) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
        setSelectedForGroup((sel) => {
          const updated = new Set(sel);
          for (const cid of group.contactIds) updated.delete(String(cid));
          return updated;
        });
      } else {
        next.add(groupId);
        setSelectedForGroup((sel) => {
          const updated = new Set(sel);
          for (const cid of group.contactIds) updated.add(String(cid));
          return updated;
        });
      }
      return next;
    });
  }, [contactGroups]);

  const enterSelectMode = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setGroupSelectMode(true);
    setSelectedForGroup(new Set());
    setExpandedGroupIds(new Set());
  }, []);

  const cancelSelectMode = useCallback(() => {
    setGroupSelectMode(false);
    setSelectedForGroup(new Set());
    setExpandedGroupIds(new Set());
  }, []);

  const confirmGroup = useCallback(() => {
    const selectedIds = Array.from(selectedForGroup) as Id<'contacts'>[];
    if (selectedIds.length < 2) return;

    const members = selectedIds
      .map((id) => contactTotalMap.get(String(id)))
      .filter((m): m is NonNullable<typeof m> => m != null);

    const expandedGroupIdList = Array.from(expandedGroupIds);
    let updatedGroups = contactGroups.filter((g) => !expandedGroupIdList.includes(g.id));

    const newGroup: ContactGroup = {
      id: randomUUID(),
      contactIds: selectedIds,
      name: generateGroupName(members, t),
    };
    updatedGroups = [...updatedGroups, newGroup];

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onUpdateGroups(updatedGroups);
    cancelSelectMode();
  }, [selectedForGroup, expandedGroupIds, contactGroups, contactTotalMap, t, onUpdateGroups, cancelSelectMode]);

  const handleUngroup = useCallback((groupId: string) => {
    Alert.alert(t.people_ungroup, t.people_ungroupConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.people_ungroup,
        style: 'destructive',
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onUpdateGroups(contactGroups.filter((g) => g.id !== groupId));
        },
      },
    ]);
  }, [contactGroups, onUpdateGroups, t]);

  const handleNameEdit = useCallback((groupId: string, name: string) => {
    setEditingNameGroupId(groupId);
    setEditingNameValue(name);
  }, [setEditingNameValue]);

  const handleNameSave = useCallback(() => {
    if (!editingNameGroupId || !editingNameValue.trim()) {
      setEditingNameGroupId(null);
      return;
    }
    const updated = contactGroups.map((g) =>
      g.id === editingNameGroupId ? { ...g, name: editingNameValue.trim() } : g,
    );
    onUpdateGroups(updated);
    setEditingNameGroupId(null);
  }, [editingNameGroupId, editingNameValue, contactGroups, onUpdateGroups]);

  const pillsInSelectMode = useMemo(() => {
    if (!groupSelectMode) return [];
    const expandedIds = new Set<string>();
    for (const gid of expandedGroupIds) {
      const group = contactGroups.find((g) => g.id === gid);
      if (group) for (const cid of group.contactIds) expandedIds.add(String(cid));
    }
    const nonExpandedGroupIds = new Set(
      contactGroups.filter((g) => !expandedGroupIds.has(g.id)).flatMap((g) => g.contactIds.map(String)),
    );

    return contactTotals
      .filter((c) => !nonExpandedGroupIds.has(String(c.contactId)))
      .sort((a, b) => {
        if (a.isSelf) return -1;
        if (b.isSelf) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [groupSelectMode, contactTotals, contactGroups, expandedGroupIds]);

  const nonExpandedGroups = useMemo(() => {
    if (!groupSelectMode) return [];
    return groupData.filter((g) => !expandedGroupIds.has(g.id));
  }, [groupSelectMode, groupData, expandedGroupIds]);

  return (
    <View className="mt-3">
      {/* Section header */}
      <View className="mb-2 flex-row items-center justify-between px-7">
        <View className="flex-row items-center gap-2">
          <Text className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t.people_title}
          </Text>
          {contacts.length >= 2 && !groupSelectMode && (
            <Pressable onPress={enterSelectMode} style={{ backgroundColor: 'transparent' }}>
              {useGlass ? (
                <GlassView isInteractive tintColor={iconColors.primary + '1A'} style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <IconSymbol name="rectangle.stack.person.crop" size={12} color={iconColors.primary} />
                  <Text className="text-xs font-semibold text-primary">{t.people_group}</Text>
                </GlassView>
              ) : (
                <View className="flex-row items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5">
                  <IconSymbol name="rectangle.stack.person.crop" size={12} color={iconColors.primary} />
                  <Text className="text-xs font-semibold text-primary">{t.people_group}</Text>
                </View>
              )}
            </Pressable>
          )}
          {groupSelectMode && (
            <Pressable
              onPress={cancelSelectMode}
              className="rounded-full bg-muted px-2 py-0.5 active:opacity-70"
            >
              <Text className="text-xs font-semibold text-muted-foreground">{t.cancel}</Text>
            </Pressable>
          )}
        </View>
        <View
          className={cn(
            'rounded-full px-2 py-0.5',
            allPaid ? 'bg-emerald-500/15' : 'bg-amber-500/15',
          )}
        >
          <Text
            className={cn(
              'text-sm font-semibold',
              allPaid ? 'text-emerald-500' : 'text-amber-500',
            )}
          >
            {t.people_paidCount(paidCount, contacts.length)}
          </Text>
        </View>
      </View>

      {/* Normal mode: ungrouped pills + group pills */}
      {!groupSelectMode && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 px-7 pb-2"
        >
          {ungroupedContacts.map((c) => (
            <Animated.View key={String(c.contactId)} layout={LinearTransition}>
              <Pressable
                onPress={() => handleToggle(c.contactId)}
                className={cn(
                  'w-[140px] rounded-xl border-l-[3px] bg-card px-3.5 py-2 active:opacity-80',
                  c.paid ? 'border-l-emerald-500' : 'border-l-amber-500',
                )}
              >
                <View className="flex-row items-center gap-2">
                  <Avatar name={c.name} imageUri={c.imageUri} size="sm" />
                  <Text className="flex-1 text-sm font-semibold text-foreground" numberOfLines={1}>
                    {c.isSelf ? t.self_label(c.name) : c.name}
                  </Text>
                </View>
                <View className="mt-1 flex-row items-center justify-between">
                  <Text className="text-sm font-bold tabular-nums text-foreground">
                    {formatCurrency(c.total, billCountry, decimalPlaces)}
                  </Text>
                  <IconSymbol
                    name={c.paid ? 'checkmark.circle.fill' : 'circle'}
                    size={16}
                    color={c.paid ? '#10b981' : iconColors.mutedLight}
                  />
                </View>
              </Pressable>
            </Animated.View>
          ))}

          {groupData.map((g) => (
            <Animated.View key={g.id} layout={LinearTransition}>
              <Pressable
                onPress={() => handleGroupToggle(g.id)}
                onLongPress={() => handleUngroup(g.id)}
                className={cn(
                  'w-[160px] rounded-xl border-l-[3px] px-3.5 py-2 active:opacity-80',
                  g.tint.bg,
                  g.tint.border,
                )}
              >
                {/* Stacked avatars */}
                <View className="flex-row items-center gap-2">
                  <View className="flex-row">
                    {g.members.slice(0, 3).map((m, i) => (
                      <View
                        key={String(m.contactId)}
                        style={{ marginLeft: i > 0 ? -8 : 0, zIndex: 3 - i }}
                        className="rounded-full border-2 border-card"
                      >
                        <Avatar name={m.name} imageUri={m.imageUri} size="xs" />
                      </View>
                    ))}
                    {g.members.length > 3 && (
                      <View
                        style={{ marginLeft: -8, zIndex: 0 }}
                        className="h-[26px] w-[26px] items-center justify-center rounded-full border-2 border-card bg-muted"
                      >
                        <Text className="text-[10px] font-bold text-muted-foreground">
                          +{g.members.length - 3}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View className="flex-1">
                    {editingNameGroupId === g.id ? (
                      <TextInput
                        value={editingNameValue}
                        onChangeText={setEditingNameValue}
                        onBlur={handleNameSave}
                        onSubmitEditing={handleNameSave}
                        autoFocus
                        className="h-5 p-0 text-sm font-semibold text-foreground"
                        returnKeyType="done"
                      />
                    ) : (
                      <Pressable onPress={() => handleNameEdit(g.id, g.name)}>
                        <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                          {g.name}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
                <View className="mt-1 flex-row items-center justify-between">
                  <Text className="text-sm font-bold tabular-nums text-foreground">
                    {formatCurrency(g.total, billCountry, decimalPlaces)}
                  </Text>
                  <IconSymbol
                    name={g.allMembersPaid ? 'checkmark.circle.fill' : 'circle'}
                    size={16}
                    color={g.allMembersPaid ? '#10b981' : iconColors.mutedLight}
                  />
                </View>
              </Pressable>
            </Animated.View>
          ))}
        </ScrollView>
      )}

      {/* Select mode: selectable pills */}
      {groupSelectMode && (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2 px-7 pb-2"
          >
            {/* Non-expanded group pills (tappable to expand) */}
            {nonExpandedGroups.map((g) => (
              <Animated.View key={g.id} layout={LinearTransition}>
                <Pressable
                  onPress={() => handleExpandGroup(g.id)}
                  className={cn(
                    'w-[140px] rounded-xl border-l-[3px] px-3.5 py-2 active:opacity-80',
                    g.tint.bg,
                    g.tint.border,
                  )}
                >
                  <View className="flex-row items-center gap-2">
                    <View className="flex-row">
                      {g.members.slice(0, 2).map((m, i) => (
                        <View
                          key={String(m.contactId)}
                          style={{ marginLeft: i > 0 ? -8 : 0, zIndex: 2 - i }}
                          className="rounded-full border-2 border-card"
                        >
                          <Avatar name={m.name} imageUri={m.imageUri} size="xs" />
                        </View>
                      ))}
                    </View>
                    <Text className="flex-1 text-sm font-semibold text-foreground" numberOfLines={1}>
                      {g.name}
                    </Text>
                  </View>
                  <Text className="mt-1 text-xs text-muted-foreground">Tap to edit</Text>
                </Pressable>
              </Animated.View>
            ))}

            {/* Individual pills (ungrouped + expanded group members) */}
            {pillsInSelectMode.map((c) => {
              const isSelected = selectedForGroup.has(String(c.contactId));
              return (
                <Animated.View key={String(c.contactId)} layout={LinearTransition}>
                  <Pressable
                    onPress={() => toggleSelection(String(c.contactId))}
                    className={cn(
                      'w-[140px] rounded-xl border-l-[3px] bg-card px-3.5 py-2 active:opacity-80',
                      isSelected ? 'border-l-primary' : 'border-l-muted',
                    )}
                  >
                    <View className="flex-row items-center gap-2">
                      <Avatar name={c.name} imageUri={c.imageUri} size="sm" />
                      <Text className="flex-1 text-sm font-semibold text-foreground" numberOfLines={1}>
                        {c.isSelf ? t.self_label(c.name) : c.name}
                      </Text>
                      <Animated.View entering={FadeIn.duration(200)}>
                        <IconSymbol
                          name={isSelected ? 'checkmark.circle.fill' : 'circle'}
                          size={16}
                          color={isSelected ? iconColors.primary : iconColors.mutedLight}
                        />
                      </Animated.View>
                    </View>
                    <View className="mt-1">
                      <Text className="text-sm font-bold tabular-nums text-foreground">
                        {formatCurrency(c.total, billCountry, decimalPlaces)}
                      </Text>
                    </View>
                  </Pressable>
                </Animated.View>
              );
            })}
          </ScrollView>

          {/* Confirm toolbar */}
          <View className="mt-2 flex-row items-center gap-2 px-7">
            <Pressable
              onPress={confirmGroup}
              disabled={selectedForGroup.size < 2}
              style={{ flex: 1, backgroundColor: 'transparent' }}
            >
              {useGlass && selectedForGroup.size >= 2 ? (
                <GlassView isInteractive tintColor={iconColors.primary + '1A'} style={{ borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' }}>
                  <Text className="text-sm font-semibold text-primary">{t.people_groupCount(selectedForGroup.size)}</Text>
                </GlassView>
              ) : (
                <View className={cn('items-center rounded-xl py-2.5', selectedForGroup.size >= 2 ? 'bg-primary' : 'bg-muted')}>
                  <Text className={cn('text-sm font-semibold', selectedForGroup.size >= 2 ? 'text-primary-foreground' : 'text-muted-foreground')}>
                    {t.people_groupCount(selectedForGroup.size)}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

export default React.memo(PeopleSummary);
