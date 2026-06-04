import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, useColorScheme, View } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { GlassView } from 'expo-glass-effect';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'convex/react';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { randomUUID } from 'expo-crypto';
import { type ViewShotRef } from 'react-native-view-shot';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ICON_COLORS } from '@/constants/colors';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useAuth } from '@/lib/AuthContext';
import { useT } from '@/lib/i18n';
import { useCustomAlert } from '@/components/ui/custom-alert';
import { computeBase, computeTax, getTaxConfig, withTaxIncludedOverride, type ReceiptCategory } from '@/constants/taxes';
import { buildWhatsAppMessage, buildGroupWhatsAppMessage, buildBillWhatsAppMessage } from '@/lib/whatsapp';
import { toE164 } from '@/lib/phone';
import { getTaxLabel } from '@/lib/billHelpers';
import Skeleton from '@/components/ui/Skeleton';
import ViewShot from 'react-native-view-shot';
import { Share2 } from 'lucide-react-native';
import { WhatsAppIcon } from '@/components/icons/whatsapp';
import InfographicPreview from '@/components/bills/InfographicPreview';
import BillSummaryInfographic from '@/components/bills/BillSummaryInfographic';
import ContactRow from '@/components/bills/share/ContactRow';
import ContactGroupSection from '@/components/bills/share/ContactGroupSection';
import ContactInfographic from '@/components/bills/share/ContactInfographic';
import GroupConfirmToolbar from '@/components/bills/share/GroupConfirmToolbar';
import { buildGroupName, contactKey, computeContactItemShare } from '@/components/bills/share/utils';
import type { ResolvedContact, ContactShareData, ItemShareInfo } from '@/components/bills/share/types';
import { useGlassEffect } from '@/hooks/useGlassEffect';

export default function ShareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];
  const t = useT();
  const { user } = useAuth();
  const { alert } = useCustomAlert();
  const userId = user?.id;

  const bill = useQuery(api.bills.get, userId ? { id: id as Id<'bills'>, userId } : 'skip');
  const togglePaid = useMutation(api.bills.togglePaymentStatus);
  const updateContactGroupsMut = useMutation(api.bills.updateContactGroups);

  const infographicRefs = useRef<Record<number, ViewShotRef | null>>({});
  const billInfographicRef = useRef<ViewShotRef | null>(null);
  const [capturingIndex, setCapturingIndex] = useState<number | null>(null);
  const [isCapturingBill, setCapturingBill] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewAspect, setPreviewAspect] = useState(1);
  const [previewContactName, setPreviewContactName] = useState('');

  const [isGroupSelectMode, setIsGroupSelectMode] = useState(false);
  const [selectedForGroup, setSelectedForGroup] = useState<Set<string>>(new Set());
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  const [optimisticPaid, setOptimisticPaid] = useState<Map<string, boolean>>(new Map());
  const prevBillRef = useRef(bill);

  // Clear optimistic state when Convex query re-syncs (real data arrives)
  useEffect(() => {
    if (bill && prevBillRef.current !== bill) {
      setOptimisticPaid(new Map());
    }
    prevBillRef.current = bill;
  }, [bill]);

  const { glassAvailable, isGlassReady, shouldUseGlass } = useGlassEffect();

  const billCountry = (bill?.country as 'CO' | 'US') || 'CO';
  const billCategory = (bill?.tags?.find((tag) => tag.isPlatform)?.slug || 'dining') as ReceiptCategory;
  const rawTaxConfig = getTaxConfig(billCountry, billCategory);
  const taxConfig = withTaxIncludedOverride(rawTaxConfig, bill?.taxIncludedOverride ?? undefined);
  const tipPercent = bill?.tipPercent ?? 0;
  const splitStrategy = bill?.splitStrategy;
  const decimalPlaces = bill?.decimalPlaces;
  const translatedTaxLabel = getTaxLabel(taxConfig, t);

  const contactGroups = useMemo(() => bill?.contactGroups ?? [], [bill?.contactGroups]);
  const groupedContactIds = useMemo(() => {
    const ids = new Set<string>();
    for (const group of contactGroups) {
      for (const cId of group.contactIds) ids.add(String(cId));
    }
    return ids;
  }, [contactGroups]);

  const ungroupedContacts = useMemo(() => {
    if (!bill) return [];
    return bill.contacts.filter((contact) => !groupedContactIds.has(contactKey(contact)));
  }, [bill, groupedContactIds]);

  const shareDataMap = useMemo(() => {
    if (!bill) return new Map<string, ContactShareData>();
    const isEqualStrategy = splitStrategy === 'equal';

    const result = new Map<string, ContactShareData>();
    for (const contact of bill.contacts) {
      if (isEqualStrategy) {
        result.set(contactKey(contact), { items: new Map(), total: contact.amount, tax: 0, tip: 0 });
        continue;
      }
      const items = new Map<string, ItemShareInfo>();
      for (const itemRef of contact.items) {
        const info = computeContactItemShare(itemRef, bill.items, bill.contacts);
        if (info) items.set(itemRef.itemId, info);
      }
      const itemsTotal = [...items.values()].reduce((totalShare, shareInfo) => totalShare + shareInfo.share, 0);
      const base = computeBase(itemsTotal, taxConfig);
      const contactTax = computeTax(itemsTotal, taxConfig);
      const contactTip = Math.round(base * (tipPercent / 100));
      result.set(contactKey(contact), { items, total: base + contactTax + contactTip, tax: contactTax, tip: contactTip });
    }
    return result;
  }, [bill, splitStrategy, taxConfig, tipPercent]);

  const handleTogglePaid = useCallback(async (contactId: string) => {
    if (!userId || !bill) return;
    // Optimistic update: toggle immediately
    const contact = bill.contacts.find((entry) => contactKey(entry) === contactId);
    const currentPaid = optimisticPaid.has(contactId) ? optimisticPaid.get(contactId)! : (contact?.paid ?? false);
    const newPaid = !currentPaid;
    setOptimisticPaid((prev) => new Map(prev).set(contactId, newPaid));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await togglePaid({ id: id as Id<'bills'>, userId, contactId: contactId as Id<'contacts'> });
    } catch (err) {
      // Revert optimistic state on failure
      setOptimisticPaid((prev) => { const next = new Map(prev); next.delete(contactId); return next; });
      Sentry.captureException(err, { tags: { feature: 'share' } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, t.error_mutationFailed);
    }
  }, [id, togglePaid, t, userId, alert, bill, optimisticPaid]);

  const handleSendWhatsApp = useCallback(async (contact: { name: string; phone?: string; items: { itemId: string; units: number }[]; amount: number }) => {
    if (!bill || !contact.phone) {
      alert(t.bill_noPhone, t.bill_noPhoneMessage);
      return;
    }
    const message = buildWhatsAppMessage({ bill, contact, taxConfig, decimalPlaces, t });
    const url = `https://wa.me/${toE164(contact.phone)}?text=${encodeURIComponent(message)}`;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      alert(t.error, t.error_whatsappNotAvailable);
      return;
    }
    Linking.openURL(url);
  }, [bill, taxConfig, decimalPlaces, t, alert]);

  const handleSendGroupWhatsApp = useCallback(async (group: { name: string }, members: { name: string; amount: number }[], groupTotal: number) => {
    if (!bill) return;
    const message = buildGroupWhatsAppMessage({ bill, groupName: group.name, members, groupTotal, decimalPlaces, t });
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      alert(t.error, t.error_whatsappNotAvailable);
      return;
    }
    Linking.openURL(url);
  }, [bill, decimalPlaces, t, alert]);

  const handleSendBillWhatsApp = useCallback(async () => {
    if (!bill) return;
    const contacts = bill.contacts.map((contact) => ({
      name: contact.isSelf ? t.self_label(contact.name) : contact.name,
      amount: shareDataMap.get(contactKey(contact))?.total ?? contact.amount,
      paid: contact.paid,
    }));
    const billTotal = contacts.reduce((runningTotal, contact) => runningTotal + contact.amount, 0);
    const message = buildBillWhatsAppMessage({ bill, contacts, billTotal, decimalPlaces, t });
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      alert(t.error, t.error_whatsappNotAvailable);
      return;
    }
    Linking.openURL(url);
  }, [bill, shareDataMap, decimalPlaces, t, alert]);

  const handleShareBillInfographic = useCallback(async () => {
    if (!billInfographicRef.current?.capture) return;
    setCapturingBill(true);
    try {
      const uri = await billInfographicRef.current.capture();
      const { width, height } = await Image.getSize(uri);
      setPreviewAspect(width > 0 && height > 0 ? width / height : 0.55);
      setPreviewUri(uri);
      setPreviewContactName(bill?.name ?? '');
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, t.error_shareFailed);
    } finally {
      setCapturingBill(false);
    }
  }, [bill, t, alert]);

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
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  }, []);

  const confirmGroupFromShare = useCallback(async () => {
    if (!bill || !userId) return;
    const selectedIds = Array.from(selectedForGroup) as Id<'contacts'>[];

    // Not editing and too few selected — nothing to do
    if (!editingGroupId && selectedIds.length < 2) return;

    const members = selectedIds
      .map((cId) => bill.contacts.find((contact) => contactKey(contact) === String(cId)))
      .filter((contact): contact is NonNullable<typeof contact> => contact != null);

    let updated: typeof contactGroups;

    if (editingGroupId && selectedIds.length < 2) {
      // Editing but fewer than 2 — remove the group
      updated = contactGroups.filter((group) => group.id !== editingGroupId);
    } else if (editingGroupId) {
      // Editing with enough members — update the group
      const groupName = buildGroupName(members, t.self_label);
      updated = contactGroups.map((group) => group.id === editingGroupId ? { ...group, contactIds: selectedIds, name: groupName } : group);
    } else {
      // Creating a new group
      const groupName = buildGroupName(members, t.self_label);
      updated = [...contactGroups, { id: randomUUID(), contactIds: selectedIds, name: groupName }];
    }

    try {
      await updateContactGroupsMut({ id: id as Id<'bills'>, userId, groups: updated as { id: string; contactIds: Id<'contacts'>[]; name: string }[] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('[Share] confirmGroup failed:', err);
      Sentry.captureException(err, { tags: { feature: 'share' } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, err instanceof Error ? err.message : t.error_mutationFailed);
    }
    handleResetGroupMode();
  }, [bill, userId, selectedForGroup, editingGroupId, contactGroups, updateContactGroupsMut, id, t, alert, handleResetGroupMode]);

  const handleShareInfographic = useCallback(async (contactIndex: number, contactName: string) => {
    const viewShotRef = infographicRefs.current[contactIndex];
    if (!viewShotRef?.capture) return;
    setCapturingIndex(contactIndex);
    try {
      const uri = await viewShotRef.capture();
      const { width, height } = await Image.getSize(uri);
      setPreviewAspect(width > 0 && height > 0 ? width / height : 0.55);
      setPreviewUri(uri);
      setPreviewContactName(contactName);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, t.error_shareFailed);
    } finally {
      setCapturingIndex(null);
    }
  }, [t, alert]);

  const handleConfirmShare = useCallback(async () => {
    if (!previewUri) return;
    try {
      await Sharing.shareAsync(previewUri, { mimeType: 'image/png', dialogTitle: previewContactName });
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, t.error_shareFailed);
    }
  }, [previewUri, previewContactName, t, alert]);

  const handleClosePreview = useCallback(() => {
    setPreviewUri(null);
    setPreviewContactName('');
  }, []);

  const editingGroup = editingGroupId ? contactGroups.find((group) => group.id === editingGroupId) : null;
  const editingGroupMemberIds = useMemo(() => {
    if (!editingGroup) return new Set<string>();
    return new Set(editingGroup.contactIds.map(String));
  }, [editingGroup]);

  const handleEditGroup = useCallback((groupId: string, memberIds: Set<string>) => {
    setIsGroupSelectMode(true);
    setEditingGroupId(groupId);
    setSelectedForGroup(memberIds);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const resolvedGroupMembers = useMemo(() => {
    if (!bill) return new Map<string, ResolvedContact[]>();
    const result = new Map<string, ResolvedContact[]>();
    for (const group of contactGroups) {
      const members = group.contactIds
        .map((cId) => bill.contacts.find((contact) => contactKey(contact) === String(cId)))
        .filter((contact): contact is NonNullable<typeof contact> => contact != null);
      result.set(group.id, members);
    }
    return result;
  }, [bill, contactGroups]);

  const getContactIndex = useCallback((contact: ResolvedContact) => {
    if (!bill) return 0;
    return bill.contacts.findIndex((billContact) => contactKey(billContact) === contactKey(contact));
  }, [bill]);

  const unassignedUnits = useMemo(() => {
    if (!bill || splitStrategy === 'equal') return 0;
    return bill.items.reduce((total, item) => {
      if (!item.id) return total;
      const assignedUnits = bill.contacts.reduce((assigned, contact) => {
        const ref = contact.items.find((itemRef) => itemRef.itemId === item.id);
        return assigned + (ref ? ref.units : 0);
      }, 0);
      return total + Math.max(0, item.quantity - assignedUnits);
    }, 0);
  }, [bill, splitStrategy]);

  if (!bill || !userId) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={iconColors.primary} />
      </View>
    );
  }

  const isEqualSplit = splitStrategy === 'equal';

  const renderContactRow = (contact: typeof bill.contacts[0]) => {
    const shareData = shareDataMap.get(contactKey(contact));
    if (!shareData) return null;
    const billIndex = getContactIndex(contact);
    const isInGroup = groupedContactIds.has(contactKey(contact));
    const isInEditingGroup = editingGroupMemberIds.has(contactKey(contact));
    const isLocked = isInGroup && !isInEditingGroup;

    // Merge optimistic paid state — optimistic takes precedence
    const cKey = contactKey(contact);
    const displayContact = optimisticPaid.has(cKey)
      ? { ...contact, paid: optimisticPaid.get(cKey)! }
      : contact;

    return (
      <View key={contactKey(contact)}>
        <ContactRow
          contact={displayContact}
          contactIndex={billIndex}
          shareData={shareData}
          isEqualSplit={isEqualSplit}
          billCountry={billCountry}
          decimalPlaces={decimalPlaces}
          contactCount={bill.contacts.length}
          translatedTaxLabel={translatedTaxLabel}
          iconColors={iconColors}
          t={t}
          capturingIndex={capturingIndex}
          onTogglePaid={handleTogglePaid}
          onSendWhatsApp={handleSendWhatsApp}
          onShareInfographic={handleShareInfographic}
          isGroupSelectMode={isGroupSelectMode}
          isLocked={isLocked}
          isSelected={selectedForGroup.has(contactKey(contact))}
          onToggleSelection={() => toggleGroupSelection(contactKey(contact))}
        />
        <ContactInfographic
          viewShotRef={(ref) => { infographicRefs.current[billIndex] = ref; }}
          contact={contact}
          shareData={shareData}
          billName={bill.name}
          taxConfig={taxConfig}
          tipPercent={tipPercent}
          decimalPlaces={decimalPlaces}
          location={bill.location?.address}
          date={new Date(bill._creationTime).toISOString()}
          country={billCountry}
          t={t}
        />
      </View>
    );
  };

  const backButton = shouldUseGlass ? (
    <Pressable onPress={() => router.back()} role="button" accessibilityLabel={t.a11y_goBack} className="active:opacity-80">
      <GlassView isInteractive style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
        <IconSymbol name="chevron.left" size={18} color={iconColors.primary} />
      </GlassView>
    </Pressable>
  ) : (
    <Pressable onPress={() => router.back()} role="button" accessibilityLabel={t.a11y_goBack} className="active:opacity-80">
      <IconSymbol name="chevron.left" size={22} color={iconColors.primary} />
    </Pressable>
  );

  const trailingButton = isGroupSelectMode ? (
    <Pressable onPress={handleResetGroupMode} role="button" accessibilityLabel={t.cancel} className="active:opacity-80">
      {shouldUseGlass ? (
        <GlassView isInteractive style={{ borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5 }}>
          <Text className="text-xs font-semibold text-muted-foreground">{t.cancel}</Text>
        </GlassView>
      ) : (
        <View className="rounded-full bg-muted px-2.5 py-1">
          <Text className="text-xs font-semibold text-muted-foreground">{t.cancel}</Text>
        </View>
      )}
    </Pressable>
  ) : bill.contacts.length >= 2 ? (
    <Pressable onPress={handleEnterGroupMode} role="button" accessibilityLabel={t.people_group} className="active:opacity-80">
      {shouldUseGlass ? (
        <GlassView isInteractive tintColor={iconColors.primary + '1A'} style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <IconSymbol name="rectangle.stack.person.crop" size={14} color={iconColors.primary} />
          <Text className="text-xs font-semibold text-primary">{t.people_group}</Text>
        </GlassView>
      ) : (
        <View className="flex-row items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1">
          <IconSymbol name="rectangle.stack.person.crop" size={14} color={iconColors.primary} />
          <Text className="text-xs font-semibold text-primary">{t.people_group}</Text>
        </View>
      )}
    </Pressable>
  ) : null;

  return (
    <View className="flex-1 bg-background">

      {/* Header — floating above MaskedView */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: insets.top, zIndex: 10 }}>
        {glassAvailable && !isGlassReady ? (
          <View className="flex-row items-center gap-3 px-7 pb-3 pt-3">
            <Skeleton width={36} height={36} borderRadius={18} />
            <Skeleton width="50%" height={24} borderRadius={6} />
            <View className="flex-1" />
            <Skeleton width={72} height={28} borderRadius={14} />
          </View>
        ) : (
          <View className="flex-row items-center gap-3 px-7 pb-3 pt-3">
            {backButton}
            <Text className="flex-1 text-2xl font-bold text-foreground">{t.share_title}</Text>
            {trailingButton}
          </View>
        )}
      </View>

      {/* Top scroll edge — fade content under header */}
      <MaskedView
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: insets.top + 80, zIndex: 5 }}
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

      <ScrollView className="flex-1" contentContainerStyle={{ paddingTop: insets.top + 80, paddingBottom: insets.bottom + 16, paddingHorizontal: 28 }}>
        {!isGroupSelectMode && unassignedUnits > 0 && (
          <View className="mb-4 flex-row items-center gap-2 rounded-xl bg-amber-500/10 px-4 py-3">
            <IconSymbol name="exclamationmark.triangle.fill" size={16} color={iconColors.pro} />
            <Text className="flex-1 text-sm text-amber-600 dark:text-amber-400">{t.share_unassignedWarning(unassignedUnits)}</Text>
          </View>
        )}
        {isGroupSelectMode && bill.contacts.map((contact) => renderContactRow(contact))}
        {!isGroupSelectMode && ungroupedContacts.map((contact) => renderContactRow(contact))}
        {!isGroupSelectMode && contactGroups.map((group, groupIndex) => {
          const members = resolvedGroupMembers.get(group.id) ?? [];
          if (members.length < 2) return null;

          return (
            <ContactGroupSection
              key={group.id}
              group={group}
              members={members}
              groupIndex={groupIndex}
              shareDataMap={shareDataMap}
              isEqualSplit={isEqualSplit}
              billCountry={billCountry}
              decimalPlaces={decimalPlaces}
              contactCount={bill.contacts.length}
              translatedTaxLabel={translatedTaxLabel}
              iconColors={iconColors}
              t={t}
              capturingIndex={capturingIndex}
              onTogglePaid={handleTogglePaid}
              onSendWhatsApp={handleSendWhatsApp}
              onShareInfographic={handleShareInfographic}
              onSendGroupWhatsApp={handleSendGroupWhatsApp}
              shouldUseGlass={shouldUseGlass}
              onEditGroup={handleEditGroup}
              getContactIndex={getContactIndex}
            />
          );
        })}

        {/* Bill-level share actions */}
        {!isGroupSelectMode && bill.contacts.length > 0 && (
          <View className="mt-6 border-t border-foreground/10 pt-4">
            <Text className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.share_shareBill}</Text>
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={handleSendBillWhatsApp}
                role="button"
                accessibilityLabel={t.share_whatsappBill}
                className="flex-row items-center gap-1.5 rounded-full bg-[#25D366]/15 px-3 py-1.5"
              >
                <WhatsAppIcon size={14} />
                <Text className="text-sm font-medium text-[#25D366]">{t.share_whatsapp}</Text>
              </Pressable>
              <Pressable
                onPress={handleShareBillInfographic}
                role="button"
                accessibilityLabel={t.share_shareBill}
                className="flex-row items-center gap-1.5 rounded-full bg-muted-foreground/10 px-3 py-1.5"
              >
                {isCapturingBill ? (
                  <ActivityIndicator size="small" color={iconColors.muted} />
                ) : (
                  <Share2 size={13} color={iconColors.muted} />
                )}
                <Text className="text-sm font-medium text-muted-foreground">{t.share_share}</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      {isGroupSelectMode && (
        <GroupConfirmToolbar
          selectedCount={selectedForGroup.size}
          isEditing={!!editingGroupId}
          shouldUseGlass={shouldUseGlass}
          iconColors={iconColors}
          t={t}
          onConfirm={confirmGroupFromShare}
        />
      )}

      {/* Offscreen bill summary infographic for capture */}
      <View style={{ position: 'absolute', left: -9999 }}>
        <ViewShot ref={billInfographicRef} options={{ format: 'png', quality: 1 }}>
          <BillSummaryInfographic
            billName={bill.name}
            contacts={bill.contacts.map((contact) => {
              const key = contactKey(contact);
              return {
                name: contact.isSelf ? t.self_label(contact.name) : contact.name,
                imageUri: contact.imageUri,
                amount: shareDataMap.get(key)?.total ?? contact.amount,
                paid: optimisticPaid.has(key) ? optimisticPaid.get(key)! : contact.paid,
              };
            })}
            billTotal={bill.contacts.reduce((runningTotal, contact) => runningTotal + (shareDataMap.get(contactKey(contact))?.total ?? contact.amount), 0)}
            location={bill.location?.address}
            date={new Date(bill._creationTime).toISOString()}
            country={billCountry}
            decimalPlaces={decimalPlaces}
            t={t}
          />
        </ViewShot>
      </View>

      <InfographicPreview
        uri={previewUri}
        imageAspect={previewAspect}
        visible={previewUri !== null}
        onShare={handleConfirmShare}
        onClose={handleClosePreview}
      />
    </View>
  );
}
