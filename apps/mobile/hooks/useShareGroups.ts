import { useCallback, useMemo, useState } from 'react';
import * as Sentry from '@sentry/react-native';
import * as Haptics from 'expo-haptics';
import { randomUUID } from 'expo-crypto';
import { useMutation } from 'convex/react';
import type { Id } from '@convex/_generated/dataModel';
import { api } from '@convex/_generated/api';
import { buildGroupName, contactKey } from '@/lib/billSplit';
import { useCustomAlert } from '@/components/ui/custom-alert';
import { useT } from '@/lib/i18n';
import type { ResolvedContact, ContactGroup } from '@/lib/types';

export function useShareGroups(
  billId: string,
  userId: string | undefined,
  contacts: ResolvedContact[],
  contactGroups: ContactGroup[],
) {
  const t = useT();
  const { alert } = useCustomAlert();
  const updateContactGroupsMut = useMutation(api.bills.updateContactGroups);

  const [isGroupSelectMode, setIsGroupSelectMode] = useState(false);
  const [selectedForGroup, setSelectedForGroup] = useState<Set<string>>(new Set());
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  const groupedContactIds = useMemo(() => {
    const ids = new Set<string>();
    for (const group of contactGroups) {
      for (const cId of group.contactIds) ids.add(String(cId));
    }
    return ids;
  }, [contactGroups]);

  const editingGroup = editingGroupId ? contactGroups.find((g) => g.id === editingGroupId) : null;
  const editingGroupMemberIds = useMemo(() => {
    if (!editingGroup) return new Set<string>();
    return new Set(editingGroup.contactIds.map(String));
  }, [editingGroup]);

  const resolvedGroupMembers = useMemo(() => {
    const result = new Map<string, ResolvedContact[]>();
    for (const group of contactGroups) {
      const members = group.contactIds
        .map((cId) => contacts.find((c) => contactKey(c) === String(cId)))
        .filter((c): c is NonNullable<typeof c> => c != null);
      result.set(group.id, members);
    }
    return result;
  }, [contacts, contactGroups]);

  const handleResetGroupMode = useCallback(() => {
    setIsGroupSelectMode(false);
    setSelectedForGroup(new Set());
    setEditingGroupId(null);
  }, []);

  const handleEnterGroupMode = useCallback(() => {
    setIsGroupSelectMode(true);
    setSelectedForGroup(new Set());
    setEditingGroupId(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const toggleGroupSelection = useCallback((contactId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedForGroup((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) next.delete(contactId); else next.add(contactId);
      return next;
    });
  }, []);

  const handleEditGroup = useCallback((groupId: string, memberIds: Set<string>) => {
    setIsGroupSelectMode(true);
    setEditingGroupId(groupId);
    setSelectedForGroup(memberIds);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const confirmGroup = useCallback(async () => {
    if (!userId) return;
    const selectedIds = Array.from(selectedForGroup) as Id<'contacts'>[];
    if (!editingGroupId && selectedIds.length < 2) return;

    const members = selectedIds
      .map((cId) => contacts.find((c) => contactKey(c) === String(cId)))
      .filter((c): c is NonNullable<typeof c> => c != null);

    let updated: typeof contactGroups;
    if (editingGroupId && selectedIds.length < 2) {
      updated = contactGroups.filter((g) => g.id !== editingGroupId);
    } else if (editingGroupId) {
      const groupName = buildGroupName(members, t.self_label);
      updated = contactGroups.map((g) => g.id === editingGroupId ? { ...g, contactIds: selectedIds, name: groupName } : g);
    } else {
      const groupName = buildGroupName(members, t.self_label);
      updated = [...contactGroups, { id: randomUUID(), contactIds: selectedIds, name: groupName }];
    }

    try {
      await updateContactGroupsMut({ id: billId as Id<'bills'>, groups: updated });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Sentry.captureException(err, { tags: { feature: 'share' } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, err instanceof Error ? err.message : t.error_mutationFailed);
    }
    handleResetGroupMode();
  }, [userId, selectedForGroup, editingGroupId, contacts, contactGroups, updateContactGroupsMut, billId, t, alert, handleResetGroupMode]);

  return {
    isGroupSelectMode,
    selectedForGroup,
    editingGroupId,
    groupedContactIds,
    editingGroupMemberIds,
    resolvedGroupMembers,
    handleResetGroupMode,
    handleEnterGroupMode,
    toggleGroupSelection,
    handleEditGroup,
    confirmGroup,
  };
}
