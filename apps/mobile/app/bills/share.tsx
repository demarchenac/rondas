import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image as RNImage, Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { useQuery, useMutation } from 'convex/react';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { randomUUID } from 'expo-crypto';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Image } from '@/lib/expo-image';
import { ICON_COLORS } from '@/constants/colors';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useAuth } from '@/lib/AuthContext';
import { useT, type Translations } from '@/lib/i18n';
import { useCustomAlert } from '@/components/ui/custom-alert';
import { computeBase, computeTax, getTaxConfig, withTaxIncludedOverride, type ReceiptCategory } from '@/constants/taxes';
import { buildWhatsAppMessage } from '@/lib/whatsapp';
import { toE164 } from '@/lib/phone';
import { getTaxLabel } from '@/lib/billHelpers';
import BillInfographic from '@/components/bills/BillInfographic';
import InfographicPreview from '@/components/bills/InfographicPreview';
import ContactRow from '@/components/bills/share/ContactRow';
import ContactGroupSection from '@/components/bills/share/ContactGroupSection';
import GroupConfirmToolbar from '@/components/bills/share/GroupConfirmToolbar';
import type { ResolvedContact } from '@/components/bills/share/types';

export default function ShareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
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

  const useGlass = Platform.OS === 'ios' && isGlassEffectAPIAvailable();

  const billCountry = (bill?.country as 'CO' | 'US') || 'CO';
  const billCategory = (bill?.tags?.find((t) => t.isPlatform)?.slug || 'dining') as ReceiptCategory;
  const rawTaxConfig = getTaxConfig(billCountry, billCategory);
  const taxConfig = withTaxIncludedOverride(rawTaxConfig, bill?.taxIncludedOverride ?? undefined);
  const tipPercent = bill?.tipPercent ?? 0;
  const splitStrategy = bill?.splitStrategy;
  const translatedTaxLabel = getTaxLabel(taxConfig, t);

  const contactGroups = useMemo(() => bill?.contactGroups ?? [], [bill?.contactGroups]);
  const groupedContactIds = useMemo(() => {
    const ids = new Set<string>();
    for (const g of contactGroups) {
      for (const cid of g.contactIds) ids.add(String(cid));
    }
    return ids;
  }, [contactGroups]);

  const ungroupedContacts = useMemo(() => {
    if (!bill) return [];
    return bill.contacts.filter((c) => !groupedContactIds.has(String(c.contactId)));
  }, [bill, groupedContactIds]);

  const computeContactTotal = useCallback((contact: { items: { itemId: string; units: number }[]; amount: number }) => {
    if (!bill) return { total: 0, tax: 0, tip: 0 };
    const isEqualSplit = splitStrategy === 'equal';
    if (isEqualSplit) return { total: contact.amount, tax: 0, tip: 0 };

    const contactItemAmounts = contact.items.map((ref) => {
      const item = bill.items.find((i) => i.id === ref.itemId);
      if (!item) return 0;
      const totalUnits = bill.contacts.reduce((u, c) => {
        const cRef = c.items.find((ci) => ci.itemId === ref.itemId);
        return u + (cRef ? cRef.units : 0);
      }, 0);
      return totalUnits > 0 ? Math.round((ref.units / totalUnits) * item.subtotal) : Math.round(item.subtotal);
    });
    const contactItemsTotal = contactItemAmounts.reduce((s, a) => s + a, 0);
    const contactBase = computeBase(contactItemsTotal, taxConfig);
    const cTax = computeTax(contactItemsTotal, taxConfig);
    const cTip = Math.round(contactBase * (tipPercent / 100));
    return { total: contactBase + cTax + cTip, tax: cTax, tip: cTip };
  }, [bill, splitStrategy, taxConfig, tipPercent]);

  const handleTogglePaid = useCallback(async (contactId: Id<'contacts'>) => {
    if (!userId) return;
    try {
      await togglePaid({ id: id as Id<'bills'>, userId, contactId });
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
    const message = buildWhatsAppMessage({ bill, contact, taxConfig, t });
    const url = `https://wa.me/${toE164(contact.phone)}?text=${encodeURIComponent(message)}`;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      alert(t.error, t.error_whatsappNotAvailable);
      return;
    }
    Linking.openURL(url);
  }, [bill, taxConfig, t, alert]);

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
      .map((cid) => bill.contacts.find((c) => String(c.contactId) === String(cid)))
      .filter((c): c is NonNullable<typeof c> => c != null);

    let updated: typeof contactGroups;

    if (editingGroupId) {
      if (selectedIds.length < 2) {
        updated = contactGroups.filter((g) => g.id !== editingGroupId);
      } else {
        const names = members.map((m) => m.isSelf ? t.self_label(m.name) : m.name);
        const groupName = names.length <= 2 ? names.join(', ') : `${names[0]}, ${names[1]} +${names.length - 2}`;
        updated = contactGroups.map((g) => g.id === editingGroupId ? { ...g, contactIds: selectedIds, name: groupName } : g);
      }
    } else {
      if (selectedIds.length < 2) return;
      const names = members.map((m) => m.isSelf ? t.self_label(m.name) : m.name);
      const groupName = names.length <= 2 ? names.join(', ') : `${names[0]}, ${names[1]} +${names.length - 2}`;
      updated = [...contactGroups, { id: randomUUID(), contactIds: selectedIds, name: groupName }];
    }

    try {
      await updateContactGroupsMut({ id: id as Id<'bills'>, userId, groups: updated as any });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('[Share] confirmGroup failed:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, err instanceof Error ? err.message : t.error_mutationFailed);
    }
    setGroupSelectMode(false);
    setSelectedForGroup(new Set());
    setEditingGroupId(null);
  }, [bill, userId, selectedForGroup, editingGroupId, contactGroups, updateContactGroupsMut, id, t, alert]);

  const handleShareInfographic = useCallback(async (contactIndex: number, contactName: string) => {
    const ref = infographicRefs.current[contactIndex];
    if (!ref?.capture) return;
    setCapturingIndex(contactIndex);
    try {
      const uri = await ref.capture();
      const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        RNImage.getSize(uri, (w, h) => resolve({ width: w, height: h }), reject);
      });
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

  const editingGroup = editingGroupId ? contactGroups.find((g) => g.id === editingGroupId) : null;
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

  const getContactIndex = useCallback((contact: ResolvedContact) => {
    if (!bill) return 0;
    return bill.contacts.findIndex((c) => String(c.contactId) === String(contact.contactId));
  }, [bill]);

  if (!bill || !userId) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={iconColors.primary} />
      </View>
    );
  }

  const isEqualSplit = splitStrategy === 'equal';

  const sharedRowProps = {
    isEqualSplit,
    billItems: bill.items,
    allContacts: bill.contacts,
    billCountry,
    contactCount: bill.contacts.length,
    translatedTaxLabel,
    iconColors,
    t,
    capturingIndex,
    onTogglePaid: handleTogglePaid,
    onSendWhatsApp: handleSendWhatsApp,
    onShareInfographic: handleShareInfographic,
  };

  const renderContactRow = (contact: typeof bill.contacts[0], ci: number) => {
    const { total, tax, tip } = computeContactTotal(contact);
    const isInGroup = groupedContactIds.has(String(contact.contactId));
    const isInEditingGroup = editingGroupMemberIds.has(String(contact.contactId));
    const isLocked = isInGroup && !isInEditingGroup;

    return (
      <View key={ci}>
        <ContactRow
          contact={contact}
          contactIndex={ci}
          total={total}
          tax={tax}
          tip={tip}
          {...sharedRowProps}
          groupSelectMode={groupSelectMode}
          isLocked={isLocked}
          isSelected={selectedForGroup.has(String(contact.contactId))}
          onToggleSelection={() => toggleGroupSelection(String(contact.contactId))}
        />
        <View style={{ position: 'absolute', left: -9999 }}>
          <ViewShot ref={(r) => { infographicRefs.current[ci] = r; }} options={{ format: 'png', quality: 1 }}>
            <BillInfographic
              billName={bill.name}
              contactName={contact.isSelf ? t.self_label(contact.name) : contact.name}
              contactImageUri={contact.imageUri}
              items={contact.items.map((ref) => {
                const item = bill.items.find((i) => i.id === ref.itemId);
                const totalUnits = bill.contacts.reduce((u, c) => {
                  const cRef = c.items.find((ci) => ci.itemId === ref.itemId);
                  return u + (cRef ? cRef.units : 0);
                }, 0);
                const share = item && totalUnits > 0
                  ? Math.round((ref.units / totalUnits) * item.subtotal)
                  : item?.subtotal ?? 0;
                return { name: item?.name ?? '', amount: share, units: ref.units, totalUnits };
              })}
              taxConfig={taxConfig}
              tipPercent={tipPercent}
              location={bill.location?.address}
              date={new Date(bill._creationTime).toISOString()}
              country={billCountry}
              t={t}
            />
          </ViewShot>
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-background">

      <View className="flex-row items-center gap-3 px-5 pb-4" style={{ paddingTop: insets.top + 12 }}>
        <Pressable onPress={() => router.back()} className="active:opacity-80">
          <IconSymbol name="chevron.left" size={22} color={iconColors.primary} />
        </Pressable>
        <Text className="flex-1 text-2xl font-bold text-foreground">{t.share_title}</Text>
        {bill.contacts.length >= 2 && !groupSelectMode && (
          <Pressable
            onPress={() => { setGroupSelectMode(true); setSelectedForGroup(new Set()); setEditingGroupId(null); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            style={{ backgroundColor: 'transparent' }}
          >
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
        )}
        {groupSelectMode && (
          <Pressable
            onPress={() => { setGroupSelectMode(false); setSelectedForGroup(new Set()); setEditingGroupId(null); }}
            className="rounded-full bg-muted px-2.5 py-1 active:opacity-70"
          >
            <Text className="text-xs font-semibold text-muted-foreground">{t.cancel}</Text>
          </Pressable>
        )}
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-7 pb-8">
        {/* In select mode: show all contacts as flat list */}
        {groupSelectMode && bill.contacts.map((contact, ci) => renderContactRow(contact, ci))}

        {/* Normal mode: ungrouped contacts */}
        {!groupSelectMode && ungroupedContacts.map((contact, ci) => renderContactRow(contact, ci))}

        {/* Normal mode: grouped contacts as tinted sections */}
        {!groupSelectMode && contactGroups.map((group, gi) => {
          const members = group.contactIds
            .map((cid) => bill.contacts.find((c) => String(c.contactId) === String(cid)))
            .filter((c): c is NonNullable<typeof c> => c != null);
          if (members.length < 2) return null;

          return (
            <ContactGroupSection
              key={group.id}
              group={group}
              members={members}
              groupIndex={gi}
              computeTotal={computeContactTotal}
              {...sharedRowProps}
              useGlass={useGlass}
              onEditGroup={handleEditGroup}
              getContactIndex={getContactIndex}
            />
          );
        })}
      </ScrollView>

      {/* Group confirm toolbar */}
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
        onClose={() => { setPreviewUri(null); setPreviewContactName(''); }}
      />
    </View>
  );
}
