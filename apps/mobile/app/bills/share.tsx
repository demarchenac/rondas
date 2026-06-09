import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, useColorScheme, View } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { GlassView } from 'expo-glass-effect';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'convex/react';
import * as Haptics from 'expo-haptics';
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
import { computeContactItemShare, contactKey, computeUnassignedUnits } from '@/lib/billSplit';
import { useGlassEffect } from '@/hooks/useGlassEffect';
import { useInfographicCapture } from '@/hooks/useInfographicCapture';
import { useShareGroups } from '@/hooks/useShareGroups';
import { posthog } from '@/lib/posthog';
import ViewShot from 'react-native-view-shot';
import { Share2 } from 'lucide-react-native';
import { WhatsAppIcon } from '@/components/icons/whatsapp';
import InfographicPreview from '@/components/bills/InfographicPreview';
import BillSummaryInfographic from '@/components/bills/BillSummaryInfographic';
import ContactRow from '@/components/bills/share/ContactRow';
import ContactGroupSection from '@/components/bills/share/ContactGroupSection';
import ContactInfographic from '@/components/bills/share/ContactInfographic';
import GroupConfirmToolbar from '@/components/bills/share/GroupConfirmToolbar';
import type { ContactShareData, ItemShareInfo } from '@/components/bills/share/types';

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

  const bill = useQuery(api.bills.get, userId ? { id: id as Id<'bills'> } : 'skip');
  const togglePaid = useMutation(api.bills.togglePaymentStatus);

  const { shouldUseGlass } = useGlassEffect();
  const {
    infographicRefs, billInfographicRef, capturingIndex, isCapturingBill,
    preview: infographicPreview, captureInfographic, captureBillInfographic,
    confirmShare: confirmInfographicShare, closePreview: closeInfographicPreview,
  } = useInfographicCapture();

  const billCountry = (bill?.country as 'CO' | 'US') || 'CO';
  const billCategory = (bill?.tags?.find((tag) => tag.isPlatform)?.slug || 'dining') as ReceiptCategory;
  const rawTaxConfig = getTaxConfig(billCountry, billCategory);
  const taxConfig = withTaxIncludedOverride(rawTaxConfig, bill?.taxIncludedOverride ?? undefined);
  const tipPercent = bill?.tipPercent ?? 0;
  const splitStrategy = bill?.splitStrategy;
  const decimalPlaces = bill?.decimalPlaces;
  const translatedTaxLabel = getTaxLabel(taxConfig, t);

  const contactGroups = useMemo(() => bill?.contactGroups ?? [], [bill?.contactGroups]);
  const groups = useShareGroups(id, userId, bill?.contacts ?? [], contactGroups);

  const ungroupedContacts = useMemo(() => {
    if (!bill) return [];
    return bill.contacts.filter((contact) => !groups.groupedContactIds.has(contactKey(contact)));
  }, [bill, groups.groupedContactIds]);

  const [optimisticPaid, setOptimisticPaid] = useState<Map<string, boolean>>(new Map());
  const prevBillRef = useRef(bill);
  useEffect(() => {
    if (bill && prevBillRef.current !== bill) setOptimisticPaid(new Map());
    prevBillRef.current = bill;
  }, [bill]);

  const shareDataMap = useMemo(() => {
    if (!bill) return new Map<string, ContactShareData>();
    const isEqualStrategy = splitStrategy === 'equal';
    const result = new Map<string, ContactShareData>();
    for (const contact of bill.contacts) {
      if (isEqualStrategy) { result.set(contactKey(contact), { items: new Map(), total: contact.amount, tax: 0, tip: 0 }); continue; }
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
    const contact = bill.contacts.find((entry) => contactKey(entry) === contactId);
    const currentPaid = optimisticPaid.has(contactId) ? optimisticPaid.get(contactId)! : (contact?.paid ?? false);
    setOptimisticPaid((prev) => new Map(prev).set(contactId, !currentPaid));
    if (!currentPaid) posthog.capture('payment_marked_paid');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await togglePaid({ id: id as Id<'bills'>, contactId: contactId as Id<'contacts'> });
    } catch (err) {
      setOptimisticPaid((prev) => { const next = new Map(prev); next.delete(contactId); return next; });
      Sentry.captureException(err, { tags: { feature: 'share' } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, t.error_mutationFailed);
    }
  }, [id, togglePaid, t, userId, alert, bill, optimisticPaid]);

  const handleSendWhatsApp = useCallback(async (contact: { name: string; phone?: string; items: { itemId: string; units: number }[]; amount: number }) => {
    if (!bill || !contact.phone) { alert(t.bill_noPhone, t.bill_noPhoneMessage); return; }
    const message = buildWhatsAppMessage({ bill, contact, taxConfig, decimalPlaces, t });
    const url = `https://wa.me/${toE164(contact.phone)}?text=${encodeURIComponent(message)}`;
    if (!(await Linking.canOpenURL(url))) { alert(t.error, t.error_whatsappNotAvailable); return; }
    posthog.capture('bill_shared', { share_type: 'whatsapp_individual' });
    Linking.openURL(url);
  }, [bill, taxConfig, decimalPlaces, t, alert]);

  const handleSendGroupWhatsApp = useCallback(async (group: { name: string }, members: { name: string; amount: number }[], groupTotal: number) => {
    if (!bill) return;
    const message = buildGroupWhatsAppMessage({ bill, groupName: group.name, members, groupTotal, decimalPlaces, t });
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    if (!(await Linking.canOpenURL(url))) { alert(t.error, t.error_whatsappNotAvailable); return; }
    posthog.capture('bill_shared', { share_type: 'whatsapp_group', member_count: members.length });
    Linking.openURL(url);
  }, [bill, decimalPlaces, t, alert]);

  const handleSendBillWhatsApp = useCallback(async () => {
    if (!bill) return;
    const contacts = bill.contacts.map((c) => ({ name: c.isSelf ? t.self_label(c.name) : c.name, amount: shareDataMap.get(contactKey(c))?.total ?? c.amount, paid: c.paid }));
    const billTotal = contacts.reduce((sum, c) => sum + c.amount, 0);
    const message = buildBillWhatsAppMessage({ bill, contacts, billTotal, decimalPlaces, t });
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    if (!(await Linking.canOpenURL(url))) { alert(t.error, t.error_whatsappNotAvailable); return; }
    posthog.capture('bill_shared', { share_type: 'whatsapp_bill_summary', contact_count: contacts.length });
    Linking.openURL(url);
  }, [bill, shareDataMap, decimalPlaces, t, alert]);

  const getContactIndex = useCallback((contact: { contactId: Id<'contacts'> }) => {
    if (!bill) return 0;
    return bill.contacts.findIndex((bc) => contactKey(bc) === contactKey(contact));
  }, [bill]);

  const unassignedUnits = useMemo(() => {
    if (!bill || splitStrategy === 'equal') return 0;
    return computeUnassignedUnits(bill.items, bill.contacts);
  }, [bill, splitStrategy]);

  if (!bill || !userId) {
    return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator size="large" color={iconColors.primary} /></View>;
  }

  const isEqualSplit = splitStrategy === 'equal';

  const renderContactRow = (contact: typeof bill.contacts[0]) => {
    const shareData = shareDataMap.get(contactKey(contact));
    if (!shareData) return null;
    const billIndex = getContactIndex(contact);
    const isInGroup = groups.groupedContactIds.has(contactKey(contact));
    const isInEditingGroup = groups.editingGroupMemberIds.has(contactKey(contact));
    const cKey = contactKey(contact);
    const displayContact = optimisticPaid.has(cKey) ? { ...contact, paid: optimisticPaid.get(cKey)! } : contact;

    return (
      <View key={cKey}>
        <ContactRow
          contact={displayContact} contactIndex={billIndex} shareData={shareData}
          isEqualSplit={isEqualSplit} billCountry={billCountry} decimalPlaces={decimalPlaces}
          contactCount={bill.contacts.length} translatedTaxLabel={translatedTaxLabel}
          iconColors={iconColors} t={t} capturingIndex={capturingIndex}
          onTogglePaid={handleTogglePaid} onSendWhatsApp={handleSendWhatsApp}
          onShareInfographic={captureInfographic}
          isGroupSelectMode={groups.isGroupSelectMode}
          isLocked={isInGroup && !isInEditingGroup}
          isSelected={groups.selectedForGroup.has(cKey)}
          onToggleSelection={() => groups.toggleGroupSelection(cKey)}
        />
        <ContactInfographic
          viewShotRef={(ref) => { infographicRefs.current[billIndex] = ref; }}
          contact={contact} shareData={shareData} billName={bill.name}
          taxConfig={taxConfig} tipPercent={tipPercent} decimalPlaces={decimalPlaces}
          location={bill.location?.address} date={new Date(bill._creationTime).toISOString()}
          country={billCountry} t={t}
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

  const trailingButton = groups.isGroupSelectMode ? (
    <Pressable onPress={groups.handleResetGroupMode} role="button" accessibilityLabel={t.cancel} className="active:opacity-80">
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
    <Pressable onPress={groups.handleEnterGroupMode} role="button" accessibilityLabel={t.people_group} className="active:opacity-80">
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
      <View style={{ position: 'absolute', left: 0, right: 0, top: insets.top, zIndex: 10 }}>
        <View className="flex-row items-center gap-3 px-7 pb-3 pt-3">
          {backButton}
          <Text className="flex-1 text-2xl font-bold text-foreground">{t.share_title}</Text>
          {trailingButton}
        </View>
      </View>

      <MaskedView
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: insets.top + 80, zIndex: 5 }}
        pointerEvents="none"
        maskElement={<LinearGradient colors={['rgba(0,0,0,1)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0)']} locations={[0, 0.65, 1]} style={{ flex: 1 }} />}
      >
        <View className="flex-1 bg-background" />
      </MaskedView>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingTop: insets.top + 80, paddingBottom: insets.bottom + 16, paddingHorizontal: 28 }}>
        {!groups.isGroupSelectMode && unassignedUnits > 0 && (
          shouldUseGlass ? (
            <GlassView tintColor="#f59e0b1A" style={{ marginBottom: 16, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <IconSymbol name="exclamationmark.triangle.fill" size={16} color="#f59e0b" />
              <Text className="flex-1 text-sm text-amber-600 dark:text-amber-400">{t.share_unassignedWarning(unassignedUnits)}</Text>
            </GlassView>
          ) : (
            <View className="mb-4 flex-row items-center gap-2 rounded-xl bg-amber-500/10 px-4 py-3">
              <IconSymbol name="exclamationmark.triangle.fill" size={16} color={iconColors.pro} />
              <Text className="flex-1 text-sm text-amber-600 dark:text-amber-400">{t.share_unassignedWarning(unassignedUnits)}</Text>
            </View>
          )
        )}
        {groups.isGroupSelectMode && bill.contacts.map(renderContactRow)}
        {!groups.isGroupSelectMode && ungroupedContacts.map(renderContactRow)}
        {!groups.isGroupSelectMode && contactGroups.map((group, groupIndex) => {
          const members = groups.resolvedGroupMembers.get(group.id) ?? [];
          if (members.length < 2) return null;
          return (
            <ContactGroupSection
              key={group.id} group={group} members={members} groupIndex={groupIndex}
              shareDataMap={shareDataMap} isEqualSplit={isEqualSplit} billCountry={billCountry}
              decimalPlaces={decimalPlaces} contactCount={bill.contacts.length}
              translatedTaxLabel={translatedTaxLabel} iconColors={iconColors} t={t}
              capturingIndex={capturingIndex} onTogglePaid={handleTogglePaid}
              onSendWhatsApp={handleSendWhatsApp} onShareInfographic={captureInfographic}
              onSendGroupWhatsApp={handleSendGroupWhatsApp} shouldUseGlass={shouldUseGlass}
              onEditGroup={groups.handleEditGroup} getContactIndex={getContactIndex}
            />
          );
        })}

        {!groups.isGroupSelectMode && bill.contacts.length > 0 && (
          <View className="mt-6 border-t border-foreground/10 pt-4">
            <Text className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.share_shareBill}</Text>
            <View className="flex-row items-center gap-2">
              <Pressable onPress={handleSendBillWhatsApp} role="button" accessibilityLabel={t.share_whatsappBill} className="flex-row items-center gap-1.5 rounded-full bg-[#25D366]/15 px-3 py-1.5">
                <WhatsAppIcon size={14} />
                <Text className="text-sm font-medium text-[#25D366]">{t.share_whatsapp}</Text>
              </Pressable>
              <Pressable onPress={() => captureBillInfographic(bill.name)} role="button" accessibilityLabel={t.share_shareBill} className="flex-row items-center gap-1.5 rounded-full bg-muted-foreground/10 px-3 py-1.5">
                {isCapturingBill ? <ActivityIndicator size="small" color={iconColors.muted} /> : <Share2 size={13} color={iconColors.muted} />}
                <Text className="text-sm font-medium text-muted-foreground">{t.share_share}</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      {groups.isGroupSelectMode && (
        <GroupConfirmToolbar selectedCount={groups.selectedForGroup.size} isEditing={!!groups.editingGroupId} shouldUseGlass={shouldUseGlass} iconColors={iconColors} t={t} onConfirm={groups.confirmGroup} />
      )}

      <View style={{ position: 'absolute', left: -9999 }}>
        <ViewShot ref={billInfographicRef} options={{ format: 'png', quality: 1 }}>
          <BillSummaryInfographic
            billName={bill.name}
            contacts={bill.contacts.map((c) => {
              const key = contactKey(c);
              return { name: c.isSelf ? t.self_label(c.name) : c.name, imageUri: c.imageUri, amount: shareDataMap.get(key)?.total ?? c.amount, paid: optimisticPaid.has(key) ? optimisticPaid.get(key)! : c.paid };
            })}
            billTotal={bill.contacts.reduce((sum, c) => sum + (shareDataMap.get(contactKey(c))?.total ?? c.amount), 0)}
            location={bill.location?.address} date={new Date(bill._creationTime).toISOString()}
            country={billCountry} decimalPlaces={decimalPlaces} t={t}
          />
        </ViewShot>
      </View>

      <InfographicPreview uri={infographicPreview?.uri ?? null} imageAspect={infographicPreview?.aspect ?? 1} visible={infographicPreview !== null} onShare={confirmInfographicShare} onClose={closeInfographicPreview} />
    </View>
  );
}
