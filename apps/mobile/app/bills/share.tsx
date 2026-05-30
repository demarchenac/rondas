import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Platform, Pressable, ScrollView, useColorScheme, View } from 'react-native';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
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
import { buildWhatsAppMessage } from '@/lib/whatsapp';
import { toE164 } from '@/lib/phone';
import { getTaxLabel } from '@/lib/billHelpers';
import Skeleton from '@/components/ui/Skeleton';
import InfographicPreview from '@/components/bills/InfographicPreview';
import ContactRow from '@/components/bills/share/ContactRow';
import ContactGroupSection from '@/components/bills/share/ContactGroupSection';
import ContactInfographic from '@/components/bills/share/ContactInfographic';
import GroupConfirmToolbar from '@/components/bills/share/GroupConfirmToolbar';
import { buildGroupName, contactKey, computeContactItemShare } from '@/components/bills/share/utils';
import type { ResolvedContact, ContactShareData, ItemShareInfo } from '@/components/bills/share/types';

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
  const [capturingIndex, setCapturingIndex] = useState<number | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewAspect, setPreviewAspect] = useState(1);
  const [previewContactName, setPreviewContactName] = useState('');

  const [groupSelectMode, setGroupSelectMode] = useState(false);
  const [selectedForGroup, setSelectedForGroup] = useState<Set<string>>(new Set());
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  const glassAvailable = Platform.OS === 'ios' && isGlassEffectAPIAvailable();
  const [glassReady, setGlassReady] = useState(false);
  useEffect(() => {
    if (glassAvailable && !glassReady) {
      const id = setTimeout(() => setGlassReady(true), 500);
      return () => clearTimeout(id);
    }
  }, [glassAvailable, glassReady]);
  const useGlass = glassAvailable && glassReady;

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
      const itemsTotal = [...items.values()].reduce((sum, shareInfo) => sum + shareInfo.share, 0);
      const base = computeBase(itemsTotal, taxConfig);
      const contactTax = computeTax(itemsTotal, taxConfig);
      const contactTip = Math.round(base * (tipPercent / 100));
      result.set(contactKey(contact), { items, total: base + contactTax + contactTip, tax: contactTax, tip: contactTip });
    }
    return result;
  }, [bill, splitStrategy, taxConfig, tipPercent]);

  const handleTogglePaid = useCallback(async (contactId: string) => {
    if (!userId) return;
    try {
      await togglePaid({ id: id as Id<'bills'>, userId, contactId: contactId as Id<'contacts'> });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, t.error_mutationFailed);
    }
  }, [id, togglePaid, t, userId, alert]);

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

  const resetGroupMode = useCallback(() => {
    setGroupSelectMode(false);
    setSelectedForGroup(new Set());
    setEditingGroupId(null);
  }, []);

  const enterGroupMode = useCallback(() => {
    setGroupSelectMode(true);
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

    const members = selectedIds
      .map((cId) => bill.contacts.find((contact) => contactKey(contact) === String(cId)))
      .filter((contact): contact is NonNullable<typeof contact> => contact != null);

    let updated: typeof contactGroups;

    if (editingGroupId) {
      if (selectedIds.length < 2) {
        updated = contactGroups.filter((group) => group.id !== editingGroupId);
      } else {
        const groupName = buildGroupName(members, t.self_label);
        updated = contactGroups.map((group) => group.id === editingGroupId ? { ...group, contactIds: selectedIds, name: groupName } : group);
      }
    } else {
      if (selectedIds.length < 2) return;
      const groupName = buildGroupName(members, t.self_label);
      updated = [...contactGroups, { id: randomUUID(), contactIds: selectedIds, name: groupName }];
    }

    try {
      await updateContactGroupsMut({ id: id as Id<'bills'>, userId, groups: updated as { id: string; contactIds: Id<'contacts'>[]; name: string }[] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('[Share] confirmGroup failed:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, err instanceof Error ? err.message : t.error_mutationFailed);
    }
    resetGroupMode();
  }, [bill, userId, selectedForGroup, editingGroupId, contactGroups, updateContactGroupsMut, id, t, alert, resetGroupMode]);

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
    setGroupSelectMode(true);
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

    return (
      <View key={contactKey(contact)}>
        <ContactRow
          contact={contact}
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
          groupSelectMode={groupSelectMode}
          isLocked={isLocked}
          isSelected={selectedForGroup.has(contactKey(contact))}
          onToggleSelection={() => toggleGroupSelection(contactKey(contact))}
        />
        <ContactInfographic
          viewShotRef={(r) => { infographicRefs.current[billIndex] = r; }}
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

  const backButton = useGlass ? (
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

  const trailingButton = groupSelectMode ? (
    <Pressable onPress={resetGroupMode} role="button" accessibilityLabel={t.cancel} className="active:opacity-80">
      {useGlass ? (
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
    <Pressable onPress={enterGroupMode} role="button" accessibilityLabel={t.people_group} className="active:opacity-80">
      {useGlass ? (
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
        {glassAvailable && !glassReady ? (
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

      <ScrollView className="flex-1" contentContainerStyle={{ paddingTop: insets.top + 80, paddingBottom: insets.bottom + 16, paddingHorizontal: 28,  }}>
        {groupSelectMode && bill.contacts.map((contact) => renderContactRow(contact))}
        {!groupSelectMode && ungroupedContacts.map((contact) => renderContactRow(contact))}
        {!groupSelectMode && contactGroups.map((group, groupIndex) => {
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
              useGlass={useGlass}
              onEditGroup={handleEditGroup}
              getContactIndex={getContactIndex}
            />
          );
        })}
      </ScrollView>

      {groupSelectMode && (
        <GroupConfirmToolbar
          selectedCount={selectedForGroup.size}
          isEditing={!!editingGroupId}
          useGlass={useGlass}
          iconColors={iconColors}
          t={t}
          onConfirm={confirmGroupFromShare}
        />
      )}

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
