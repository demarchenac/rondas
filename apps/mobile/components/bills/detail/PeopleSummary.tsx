import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
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
import type { BillItem, ResolvedContact } from '@/lib/types';
import type { IconPalette } from '@/constants/colors';

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
  iconColors: IconPalette;
  t: Translations;
  onTogglePaid: (contactId: Id<'contacts'>) => void;
  contactGroups?: ContactGroup[];
  onUpdateGroups: (groups: ContactGroup[]) => void;
  onToggleGroupPaid: (groupId: string) => void;
}

function generateGroupName(members: ResolvedContact[], t: Translations): string {
  const names = members.map((member) => member.isSelf ? t.self_label(member.name) : member.name);
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
  const paidCount = contacts.filter((contact) => contact.paid).length;
  const allPaid = paidCount === contacts.length;

  const isEqualSplit = splitStrategy === 'equal';

  const [isGroupSelectMode, setIsGroupSelectMode] = useState(false);
  const [selectedForGroup, setSelectedForGroup] = useState<Set<string>>(new Set());
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());
  const [editingNameGroupId, setEditingNameGroupId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');

  const groupedContactIds = useMemo(() => {
    const ids = new Set<string>();
    for (const group of contactGroups) {
      for (const cid of group.contactIds) ids.add(String(cid));
    }
    return ids;
  }, [contactGroups]);

  const contactTotals = useMemo(() => {
    const positiveTotal = billItems.reduce((positivesSum, item) => positivesSum + Math.max(0, item.subtotal), 0);
    const discountTotal = billItems.reduce((discountsSum, item) => discountsSum + Math.min(0, item.subtotal), 0);
    return contacts.map((contact) => ({
      ...contact,
      total: isEqualSplit ? contact.amount : computeContactTotal(contact, billItems, contacts, taxConfig, tipPercent, positiveTotal, discountTotal),
    }));
  }, [contacts, billItems, taxConfig, tipPercent, isEqualSplit]);

  const contactTotalMap = useMemo(() => {
    const map = new Map<string, typeof contactTotals[0]>();
    for (const contact of contactTotals) map.set(String(contact.contactId), contact);
    return map;
  }, [contactTotals]);

  const ungroupedContacts = useMemo(() => {
    return contactTotals
      .filter((contact) => !groupedContactIds.has(String(contact.contactId)))
      .sort((a, b) => {
        if (a.paid !== b.paid) return a.paid ? 1 : -1;
        if (a.isSelf) return -1;
        if (b.isSelf) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [contactTotals, groupedContactIds]);

  const groupData = useMemo(() => {
    return contactGroups.map((group, index) => {
      const members = group.contactIds
        .map((cid) => contactTotalMap.get(String(cid)))
        .filter((member): member is NonNullable<typeof member> => member != null);
      const total = members.reduce((membersTotal, member) => membersTotal + member.total, 0);
      const allMembersPaid = members.length > 0 && members.every((member) => member.paid);
      const tint = GROUP_TINTS[index % GROUP_TINTS.length];
      return { ...group, members, total, allMembersPaid, tint };
    }).filter((group) => group.members.length >= 2);
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
    const group = contactGroups.find((grp) => grp.id === groupId);
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

  const handleEnterSelectMode = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsGroupSelectMode(true);
    setSelectedForGroup(new Set());
    setExpandedGroupIds(new Set());
  }, []);

  const handleCancelSelectMode = useCallback(() => {
    setIsGroupSelectMode(false);
    setSelectedForGroup(new Set());
    setExpandedGroupIds(new Set());
  }, []);

  const handleConfirmGroup = useCallback(() => {
    const selectedIds = Array.from(selectedForGroup) as Id<'contacts'>[];
    const expandedGroups = Array.from(expandedGroupIds);
    const isEditing = expandedGroups.length > 0;

    if (selectedIds.length < 2 && !isEditing) return;

    if (selectedIds.length < 2) {
      const updatedGroups = contactGroups.filter((grp) => !expandedGroups.includes(grp.id));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onUpdateGroups(updatedGroups);
      handleCancelSelectMode();
      return;
    }

    const members = selectedIds
      .map((id) => contactTotalMap.get(String(id)))
      .filter((member): member is NonNullable<typeof member> => member != null);

    const remainingGroups = contactGroups.filter((grp) => !expandedGroups.includes(grp.id));

    const newGroup: ContactGroup = {
      id: randomUUID(),
      contactIds: selectedIds,
      name: generateGroupName(members, t),
    };

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onUpdateGroups([...remainingGroups, newGroup]);
    handleCancelSelectMode();
  }, [selectedForGroup, expandedGroupIds, contactGroups, contactTotalMap, t, onUpdateGroups, handleCancelSelectMode]);

  const handleNameEdit = useCallback((groupId: string, name: string) => {
    setEditingNameGroupId(groupId);
    setEditingNameValue(name);
  }, [setEditingNameValue]);

  const handleNameSave = useCallback(() => {
    if (!editingNameGroupId || !editingNameValue.trim()) {
      setEditingNameGroupId(null);
      return;
    }
    const updated = contactGroups.map((group) =>
      group.id === editingNameGroupId ? { ...group, name: editingNameValue.trim() } : group,
    );
    onUpdateGroups(updated);
    setEditingNameGroupId(null);
  }, [editingNameGroupId, editingNameValue, contactGroups, onUpdateGroups]);

  const pillsInSelectMode = useMemo(() => {
    if (!isGroupSelectMode) return [];
    const expandedIds = new Set<string>();
    for (const gid of expandedGroupIds) {
      const group = contactGroups.find((grp) => grp.id === gid);
      if (group) for (const cid of group.contactIds) expandedIds.add(String(cid));
    }
    const nonExpandedGroupIds = new Set(
      contactGroups.filter((grp) => !expandedGroupIds.has(grp.id)).flatMap((grp) => grp.contactIds.map(String)),
    );

    return contactTotals
      .filter((contact) => !nonExpandedGroupIds.has(String(contact.contactId)))
      .sort((a, b) => {
        if (a.isSelf) return -1;
        if (b.isSelf) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [isGroupSelectMode, contactTotals, contactGroups, expandedGroupIds]);

  const nonExpandedGroups = useMemo(() => {
    if (!isGroupSelectMode) return [];
    return groupData.filter((group) => !expandedGroupIds.has(group.id));
  }, [isGroupSelectMode, groupData, expandedGroupIds]);

  return (
    <View className="mt-3">
      {/* Section header */}
      <View className="mb-2 flex-row items-center justify-between px-7">
        <View className="flex-row items-center gap-2">
          <Text className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t.people_title}
          </Text>
          {contacts.length >= 2 && !isGroupSelectMode && (
            <Pressable onPress={handleEnterSelectMode} className="flex-row items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 active:opacity-70">
              <IconSymbol name="rectangle.stack.person.crop" size={12} color={iconColors.primary} />
              <Text className="text-xs font-semibold text-primary">{t.people_group}</Text>
            </Pressable>
          )}
          {isGroupSelectMode && (
            <Pressable
              onPress={handleCancelSelectMode}
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
      {!isGroupSelectMode && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 px-7 pb-2"
        >
          {ungroupedContacts.map((contact) => (
            <Animated.View key={String(contact.contactId)} layout={LinearTransition}>
              <Pressable
                onPress={() => handleToggle(contact.contactId)}
                className={cn(
                  'w-[160px] rounded-xl border-l-[3px] bg-card px-3.5 py-3 active:opacity-80',
                  contact.paid ? 'border-l-emerald-500' : 'border-l-amber-500',
                )}
              >
                <View className="flex-row items-center gap-2.5">
                  <View className="rounded-full border-2 border-card">
                    <Avatar name={contact.name} imageUri={contact.imageUri} size="sm" />
                  </View>
                  <Text className="flex-1 text-sm font-semibold text-foreground" numberOfLines={1}>
                    {contact.isSelf ? t.self_label(contact.name) : contact.name}
                  </Text>
                </View>
                <View className="mt-2 flex-row items-center justify-between">
                  <Text className="text-sm font-bold tabular-nums text-foreground">
                    {formatCurrency(contact.total, billCountry, decimalPlaces)}
                  </Text>
                  <IconSymbol
                    name={contact.paid ? 'checkmark.circle.fill' : 'circle'}
                    size={16}
                    color={contact.paid ? '#10b981' : iconColors.mutedLight}
                  />
                </View>
              </Pressable>
            </Animated.View>
          ))}

          {groupData.map((group) => (
            <Animated.View key={group.id} layout={LinearTransition}>
              <Pressable
                onPress={() => handleGroupToggle(group.id)}
                className={cn(
                  'w-[160px] rounded-xl border-l-[3px] px-3.5 py-3 active:opacity-80',
                  group.tint.bg,
                  group.allMembersPaid ? 'border-l-emerald-500' : 'border-l-amber-500',
                )}
              >
                <View className="flex-row items-center gap-2.5">
                  <View className="flex-row">
                    {group.members.slice(0, 3).map((member, idx) => (
                      <View
                        key={String(member.contactId)}
                        style={{ marginLeft: idx > 0 ? -8 : 0, zIndex: 3 - idx }}
                        className="rounded-full border-2 border-card"
                      >
                        <Avatar name={member.name} imageUri={member.imageUri} size="sm" />
                      </View>
                    ))}
                    {group.members.length > 3 && (
                      <View
                        style={{ marginLeft: -8, zIndex: 0 }}
                        className="h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-muted"
                      >
                        <Text className="text-[10px] font-bold text-muted-foreground">
                          +{group.members.length - 3}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View className="flex-1">
                    {editingNameGroupId === group.id ? (
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
                      <Pressable onPress={() => handleNameEdit(group.id, group.name)}>
                        <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                          {group.name}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
                <View className="mt-2 flex-row items-center justify-between">
                  <Text className="text-sm font-bold tabular-nums text-foreground">
                    {formatCurrency(group.total, billCountry, decimalPlaces)}
                  </Text>
                  <IconSymbol
                    name={group.allMembersPaid ? 'checkmark.circle.fill' : 'circle'}
                    size={16}
                    color={group.allMembersPaid ? '#10b981' : iconColors.mutedLight}
                  />
                </View>
              </Pressable>
            </Animated.View>
          ))}
        </ScrollView>
      )}

      {/* Select mode: selectable pills */}
      {isGroupSelectMode && (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2 px-7 pb-2"
          >
            {/* Non-expanded group pills (tappable to expand) */}
            {nonExpandedGroups.map((group) => (
              <Animated.View key={group.id} layout={LinearTransition}>
                <Pressable
                  onPress={() => handleExpandGroup(group.id)}
                  className={cn(
                    'w-[160px] rounded-xl border-l-[3px] px-3.5 py-3 active:opacity-80',
                    group.tint.bg,
                    group.tint.border,
                  )}
                >
                  <View className="flex-row items-center gap-2.5">
                    <View className="flex-row">
                      {group.members.slice(0, 2).map((member, idx) => (
                        <View
                          key={String(member.contactId)}
                          style={{ marginLeft: idx > 0 ? -8 : 0, zIndex: 2 - idx }}
                          className="rounded-full border-2 border-card"
                        >
                          <Avatar name={member.name} imageUri={member.imageUri} size="sm" />
                        </View>
                      ))}
                    </View>
                    <Text className="flex-1 text-sm font-semibold text-foreground" numberOfLines={1}>
                      {group.name}
                    </Text>
                  </View>
                  <Text className="mt-2 text-xs text-muted-foreground">{t.a11y_tapToEdit}</Text>
                </Pressable>
              </Animated.View>
            ))}

            {/* Individual pills (ungrouped + expanded group members) */}
            {pillsInSelectMode.map((contact) => {
              const isSelected = selectedForGroup.has(String(contact.contactId));
              return (
                <Animated.View key={String(contact.contactId)} layout={LinearTransition}>
                  <Pressable
                    onPress={() => toggleSelection(String(contact.contactId))}
                    className={cn(
                      'w-[160px] rounded-xl border-l-[3px] bg-card px-3.5 py-3 active:opacity-80',
                      isSelected ? 'border-l-primary' : 'border-l-muted',
                    )}
                  >
                    <View className="flex-row items-center gap-2.5">
                      <View className="rounded-full border-2 border-card">
                        <Avatar name={contact.name} imageUri={contact.imageUri} size="sm" />
                      </View>
                      <Text className="flex-1 text-sm font-semibold text-foreground" numberOfLines={1}>
                        {contact.isSelf ? t.self_label(contact.name) : contact.name}
                      </Text>
                      <Animated.View entering={FadeIn.duration(200)}>
                        <IconSymbol
                          name={isSelected ? 'checkmark.circle.fill' : 'circle'}
                          size={16}
                          color={isSelected ? iconColors.primary : iconColors.mutedLight}
                        />
                      </Animated.View>
                    </View>
                    <View className="mt-2">
                      <Text className="text-sm font-bold tabular-nums text-foreground">
                        {formatCurrency(contact.total, billCountry, decimalPlaces)}
                      </Text>
                    </View>
                  </Pressable>
                </Animated.View>
              );
            })}
          </ScrollView>

          {/* Confirm toolbar */}
          {(() => {
            const canGroup = selectedForGroup.size >= 2;
            const isEditing = expandedGroupIds.size > 0;
            const showUngroup = isEditing && !canGroup;
            return (
              <View className="mt-2 flex-row items-center gap-2 px-7">
                <Pressable
                  onPress={handleConfirmGroup}
                  disabled={!canGroup && !showUngroup}
                  style={{ flex: 1, backgroundColor: 'transparent' }}
                >
                  {showUngroup ? (
                    <View className="items-center rounded-xl bg-destructive/10 py-2.5">
                      <Text className="text-sm font-semibold text-destructive">{t.people_ungroup}</Text>
                    </View>
                  ) : (
                    <View className={cn('items-center rounded-xl py-2.5', canGroup ? 'bg-primary/10' : 'bg-muted')}>
                      <Text className={cn('text-sm font-semibold', canGroup ? 'text-primary' : 'text-muted-foreground')}>
                        {t.people_groupCount(selectedForGroup.size)}
                      </Text>
                    </View>
                  )}
                </Pressable>
              </View>
            );
          })()}
        </>
      )}
    </View>
  );
}

export default React.memo(PeopleSummary);
