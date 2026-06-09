import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { randomUUID } from 'expo-crypto';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { cn } from '@/lib/cn';
import { computeContactTotal, buildGroupName } from '@/lib/billSplit';
import type { TaxConfig } from '@/constants/taxes';
import type { Id } from '@convex/_generated/dataModel';
import type { Translations } from '@/lib/i18n';
import { useProGate } from '@/hooks/useProGate';
import type { BillItem, ResolvedContact, ContactGroup } from '@/lib/types';
import type { IconPalette } from '@/constants/colors';
import { ContactPill, GroupPill, SelectablePill, CollapsedGroupPill } from './PeoplePills';

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

function PeopleSummary({
  contacts, billItems, billCountry, splitStrategy, taxConfig, tipPercent,
  decimalPlaces, iconColors, t, onTogglePaid, contactGroups = [], onUpdateGroups, onToggleGroupPaid,
}: PeopleSummaryProps) {
  const { unlocked, showPaywall } = useProGate();
  const paidCount = contacts.filter((c) => c.paid).length;
  const allPaid = paidCount === contacts.length;
  const isEqualSplit = splitStrategy === 'equal';

  const [isGroupSelectMode, setIsGroupSelectMode] = useState(false);
  const [selectedForGroup, setSelectedForGroup] = useState<Set<string>>(new Set());
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());
  const [editingNameGroupId, setEditingNameGroupId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');

  const groupedContactIds = useMemo(() => {
    const ids = new Set<string>();
    for (const group of contactGroups) for (const cid of group.contactIds) ids.add(String(cid));
    return ids;
  }, [contactGroups]);

  const contactTotals = useMemo(() => {
    const positiveTotal = billItems.reduce((s, i) => s + Math.max(0, i.subtotal), 0);
    const discountTotal = billItems.reduce((s, i) => s + Math.min(0, i.subtotal), 0);
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

  const ungroupedContacts = useMemo(() =>
    contactTotals
      .filter((c) => !groupedContactIds.has(String(c.contactId)))
      .sort((a, b) => { if (a.paid !== b.paid) return a.paid ? 1 : -1; if (a.isSelf) return -1; if (b.isSelf) return 1; return a.name.localeCompare(b.name); }),
  [contactTotals, groupedContactIds]);

  const groupData = useMemo(() =>
    contactGroups.map((group, index) => {
      const members = group.contactIds.map((cid) => contactTotalMap.get(String(cid))).filter((m): m is NonNullable<typeof m> => m != null);
      return { ...group, members, total: members.reduce((s, m) => s + m.total, 0), allMembersPaid: members.length > 0 && members.every((m) => m.paid), tint: GROUP_TINTS[index % GROUP_TINTS.length] };
    }).filter((g) => g.members.length >= 2),
  [contactGroups, contactTotalMap]);

  const handleToggle = useCallback((contactId: Id<'contacts'>) => {
    if (!unlocked) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); showPaywall(); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onTogglePaid(contactId);
  }, [unlocked, showPaywall, onTogglePaid]);

  const handleGroupToggle = useCallback((groupId: string) => {
    if (!unlocked) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); showPaywall(); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggleGroupPaid(groupId);
  }, [unlocked, showPaywall, onToggleGroupPaid]);

  const toggleSelection = useCallback((contactId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedForGroup((prev) => { const next = new Set(prev); if (next.has(contactId)) next.delete(contactId); else next.add(contactId); return next; });
  }, []);

  const handleExpandGroup = useCallback((groupId: string) => {
    const group = contactGroups.find((g) => g.id === groupId);
    if (!group) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) { next.delete(groupId); setSelectedForGroup((sel) => { const u = new Set(sel); for (const cid of group.contactIds) u.delete(String(cid)); return u; }); }
      else { next.add(groupId); setSelectedForGroup((sel) => { const u = new Set(sel); for (const cid of group.contactIds) u.add(String(cid)); return u; }); }
      return next;
    });
  }, [contactGroups]);

  const handleCancelSelectMode = useCallback(() => { setIsGroupSelectMode(false); setSelectedForGroup(new Set()); setExpandedGroupIds(new Set()); }, []);

  const handleConfirmGroup = useCallback(() => {
    const selectedIds = Array.from(selectedForGroup) as Id<'contacts'>[];
    const expanded = Array.from(expandedGroupIds);
    const isEditing = expanded.length > 0;
    if (selectedIds.length < 2 && !isEditing) return;
    if (selectedIds.length < 2) { onUpdateGroups(contactGroups.filter((g) => !expanded.includes(g.id))); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleCancelSelectMode(); return; }
    const members = selectedIds.map((id) => contactTotalMap.get(String(id))).filter((m): m is NonNullable<typeof m> => m != null);
    const remaining = contactGroups.filter((g) => !expanded.includes(g.id));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onUpdateGroups([...remaining, { id: randomUUID(), contactIds: selectedIds, name: buildGroupName(members, t.self_label) }]);
    handleCancelSelectMode();
  }, [selectedForGroup, expandedGroupIds, contactGroups, contactTotalMap, t, onUpdateGroups, handleCancelSelectMode]);

  const handleNameSave = () => {
    if (!editingNameGroupId || !editingNameValue.trim()) { setEditingNameGroupId(null); return; }
    onUpdateGroups(contactGroups.map((g) => g.id === editingNameGroupId ? { ...g, name: editingNameValue.trim() } : g));
    setEditingNameGroupId(null);
  };

  const pillsInSelectMode = useMemo(() => {
    if (!isGroupSelectMode) return [];
    const nonExpandedIds = new Set(contactGroups.filter((g) => !expandedGroupIds.has(g.id)).flatMap((g) => g.contactIds.map(String)));
    return contactTotals.filter((c) => !nonExpandedIds.has(String(c.contactId))).sort((a, b) => { if (a.isSelf) return -1; if (b.isSelf) return 1; return a.name.localeCompare(b.name); });
  }, [isGroupSelectMode, contactTotals, contactGroups, expandedGroupIds]);

  const nonExpandedGroups = useMemo(() => isGroupSelectMode ? groupData.filter((g) => !expandedGroupIds.has(g.id)) : [], [isGroupSelectMode, groupData, expandedGroupIds]);

  const canGroup = selectedForGroup.size >= 2;
  const isEditing = expandedGroupIds.size > 0;
  const showUngroup = isEditing && !canGroup;

  return (
    <View className="mt-3">
      <View className="mb-2 flex-row items-center justify-between px-7">
        <View className="flex-row items-center gap-2">
          <Text className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t.people_title}</Text>
          {contacts.length >= 2 && !isGroupSelectMode && (
            <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setIsGroupSelectMode(true); setSelectedForGroup(new Set()); setExpandedGroupIds(new Set()); }} className="flex-row items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 active:opacity-70">
              <IconSymbol name="rectangle.stack.person.crop" size={12} color={iconColors.primary} />
              <Text className="text-xs font-semibold text-primary">{t.people_group}</Text>
            </Pressable>
          )}
          {isGroupSelectMode && (
            <Pressable onPress={handleCancelSelectMode} className="rounded-full bg-muted px-2 py-0.5 active:opacity-70">
              <Text className="text-xs font-semibold text-muted-foreground">{t.cancel}</Text>
            </Pressable>
          )}
        </View>
        <View className={cn('rounded-full px-2 py-0.5', allPaid ? 'bg-emerald-500/15' : 'bg-amber-500/15')}>
          <Text className={cn('text-sm font-semibold', allPaid ? 'text-emerald-500' : 'text-amber-500')}>{t.people_paidCount(paidCount, contacts.length)}</Text>
        </View>
      </View>

      {!isGroupSelectMode && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-7 pb-2">
          {ungroupedContacts.map((c) => (
            <ContactPill key={String(c.contactId)} contact={c} billCountry={billCountry} decimalPlaces={decimalPlaces} iconColors={iconColors} t={t} onPress={handleToggle} />
          ))}
          {groupData.map((g) => (
            <GroupPill key={g.id} group={g} billCountry={billCountry} decimalPlaces={decimalPlaces} iconColors={iconColors} onPress={handleGroupToggle}
              editingNameGroupId={editingNameGroupId} editingNameValue={editingNameValue} onEditingNameChange={setEditingNameValue} onNameSave={handleNameSave} onNameEdit={(gid, name) => { setEditingNameGroupId(gid); setEditingNameValue(name); }} />
          ))}
        </ScrollView>
      )}

      {isGroupSelectMode && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-7 pb-2">
            {nonExpandedGroups.map((g) => <CollapsedGroupPill key={g.id} group={g} t={t} onExpand={handleExpandGroup} />)}
            {pillsInSelectMode.map((c) => (
              <SelectablePill key={String(c.contactId)} contact={c} isSelected={selectedForGroup.has(String(c.contactId))} billCountry={billCountry} decimalPlaces={decimalPlaces} iconColors={iconColors} t={t} onToggle={toggleSelection} />
            ))}
          </ScrollView>
          <View className="mt-2 flex-row items-center gap-2 px-7">
            <Pressable onPress={handleConfirmGroup} disabled={!canGroup && !showUngroup} style={{ flex: 1, backgroundColor: 'transparent' }}>
              {showUngroup ? (
                <View className="items-center rounded-xl bg-destructive/10 py-2.5"><Text className="text-sm font-semibold text-destructive">{t.people_ungroup}</Text></View>
              ) : (
                <View className={cn('items-center rounded-xl py-2.5', canGroup ? 'bg-primary/10' : 'bg-muted')}>
                  <Text className={cn('text-sm font-semibold', canGroup ? 'text-primary' : 'text-muted-foreground')}>{t.people_groupCount(selectedForGroup.size)}</Text>
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
