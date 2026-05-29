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
import { WhatsAppIcon } from '@/components/icons/whatsapp';
import { Share2 } from 'lucide-react-native';
import { Image } from '@/lib/expo-image';
import { ICON_COLORS } from '@/constants/colors';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useAuth } from '@/lib/AuthContext';
import { useT } from '@/lib/i18n';
import { useCustomAlert } from '@/components/ui/custom-alert';
import { formatCurrency } from '@/lib/format';
import { computeBase, computeTax, getTaxConfig, withTaxIncludedOverride, type ReceiptCategory } from '@/constants/taxes';
import { buildWhatsAppMessage } from '@/lib/whatsapp';
import { toE164 } from '@/lib/phone';
import { getTaxLabel } from '@/lib/billHelpers';
import { cn } from '@/lib/cn';
import BillInfographic from '@/components/bills/BillInfographic';
import InfographicPreview from '@/components/bills/InfographicPreview';

const GROUP_TINTS_BG = [
  'bg-blue-500/10',
  'bg-purple-500/10',
  'bg-teal-500/10',
  'bg-rose-500/10',
];

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

  if (!bill || !userId) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={iconColors.primary} />
      </View>
    );
  }

  const isEqualSplit = splitStrategy === 'equal';

  const renderContactRow = (contact: typeof bill.contacts[0], ci: number) => {
    const { total: contactTotal, tax: contactTax, tip: contactTip } = computeContactTotal(contact);
    const isInGroup = groupedContactIds.has(String(contact.contactId));
    const isInEditingGroup = editingGroupMemberIds.has(String(contact.contactId));
    const isLocked = isInGroup && !isInEditingGroup;
    const isSelectable = groupSelectMode && !isLocked;
    const isSelected = selectedForGroup.has(String(contact.contactId));

    return (
      <Pressable
        key={ci}
        className="mb-4"
        onPress={isSelectable ? () => toggleGroupSelection(String(contact.contactId)) : undefined}
        disabled={!isSelectable}
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-row items-center gap-3">
            {groupSelectMode && !isLocked && (
              <IconSymbol
                name={isSelected ? 'checkmark.circle.fill' : 'circle'}
                size={22}
                color={isSelected ? iconColors.primary : iconColors.mutedLight}
              />
            )}
            {contact.imageUri ? (
              <Image source={{ uri: contact.imageUri }} className="w-10 h-10 rounded-full" style={isLocked ? { opacity: 0.4 } : undefined} />
            ) : (
              <View className="w-10 h-10 rounded-full items-center justify-center bg-primary/10" style={isLocked ? { opacity: 0.4 } : undefined}>
                <Text className="text-lg font-bold" style={{ color: iconColors.primary }}>
                  {contact.name[0]?.toUpperCase() ?? '?'}
                </Text>
              </View>
            )}
            <View>
              <Text className="text-lg font-semibold text-foreground">{contact.isSelf ? t.self_label(contact.name) : contact.name}</Text>
              <Text className="text-sm text-muted-foreground">
                {isEqualSplit
                  ? t.share_equalPerPerson(formatCurrency(contactTotal, billCountry), bill.contacts.length)
                  : t.share_itemCount(contact.items.length)}
              </Text>
            </View>
          </View>
          <Text className="text-xl font-bold tabular-nums text-foreground">
            {formatCurrency(contactTotal, billCountry)}
          </Text>
        </View>

        {!isEqualSplit && (
          <View className="ml-[52px] mt-0 flex-row flex-wrap">
            {contact.items.map((ref) => {
              const item = bill.items.find((i) => i.id === ref.itemId);
              if (!item) return null;
              const totalUnits = bill.contacts.reduce((u, c) => {
                const cRef = c.items.find((ci) => ci.itemId === ref.itemId);
                return u + (cRef ? cRef.units : 0);
              }, 0);
              const share = totalUnits > 0
                ? Math.round((ref.units / totalUnits) * item.subtotal)
                : Math.round(item.subtotal);
              return (
                <View key={ref.itemId} className="w-1/2 pr-2 mb-1">
                  <Text className="text-sm text-foreground" numberOfLines={1}>
                    {item.name} ({ref.units}/{totalUnits})
                  </Text>
                  <Text className="text-sm text-muted-foreground">{formatCurrency(share, billCountry)}</Text>
                </View>
              );
            })}
          </View>
        )}

        {isEqualSplit && (
          <View className="ml-[52px] mt-2">
            <Text className="text-sm text-muted-foreground">{t.share_equalSplit}</Text>
          </View>
        )}

        {!isEqualSplit && (
          <View className="ml-[52px] mt-2 flex-row items-center gap-3">
            {contactTax > 0 && (
              <Text className="text-sm text-muted-foreground">
                {translatedTaxLabel}: {formatCurrency(contactTax, billCountry)}
              </Text>
            )}
            {contactTip > 0 && (
              <Text className="text-sm text-muted-foreground">
                {t.scan_tipPropina}: {formatCurrency(contactTip, billCountry)}
              </Text>
            )}
          </View>
        )}

        {!groupSelectMode && (
          <View className="ml-[52px] mt-3 flex-row items-center gap-2">
            <Pressable
              onPress={() => handleTogglePaid(contact.contactId)}
              className={cn(
                'flex-row items-center gap-1.5 rounded-full px-3 py-1.5',
                contact.paid ? 'bg-emerald-500/15' : 'bg-muted-foreground/10',
              )}
            >
              <IconSymbol
                name={contact.paid ? 'checkmark.circle.fill' : 'circle'}
                size={14}
                color={contact.paid ? '#10b981' : iconColors.muted}
              />
              <Text className={cn('text-sm font-medium', contact.paid ? 'text-emerald-500' : 'text-muted-foreground')}>
                {contact.paid ? t.share_paid : t.share_unpaid}
              </Text>
            </Pressable>

            {contact.phone && (
              <Pressable
                onPress={() => handleSendWhatsApp(contact)}
                className="flex-row items-center gap-1.5 rounded-full bg-[#25D366]/15 px-3 py-1.5"
              >
                <WhatsAppIcon size={14} />
                <Text className="text-sm font-medium text-[#25D366]">{t.share_whatsapp}</Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => handleShareInfographic(ci, contact.name)}
              className="flex-row items-center gap-1.5 rounded-full bg-muted-foreground/10 px-3 py-1.5"
            >
              {capturingIndex === ci ? (
                <ActivityIndicator size="small" color={iconColors.muted} />
              ) : (
                <Share2 size={13} color={iconColors.muted} />
              )}
              <Text className="text-sm font-medium text-muted-foreground">{t.share_share}</Text>
            </Pressable>
          </View>
        )}

        {/* Offscreen infographic */}
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
      </Pressable>
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

          const memberTotals = members.map((m) => computeContactTotal(m));
          const groupTotal = memberTotals.reduce((sum, mt) => sum + mt.total, 0);
          const groupTax = memberTotals.reduce((sum, mt) => sum + mt.tax, 0);
          const groupTip = memberTotals.reduce((sum, mt) => sum + mt.tip, 0);
          const tintBg = GROUP_TINTS_BG[gi % GROUP_TINTS_BG.length];

          return (
            <View key={group.id} className={cn('-mx-7 mb-4 px-7 py-4', tintBg)}>
              {/* Group label + edit button */}
              <View className="mb-3 flex-row items-center gap-2">
                <Pressable
                  onPress={() => {
                    setGroupSelectMode(true);
                    setEditingGroupId(group.id);
                    const memberIds = new Set(members.map((m) => String(m.contactId)));
                    setSelectedForGroup(memberIds);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={{ backgroundColor: 'transparent' }}
                >
                  {useGlass ? (
                    <GlassView isInteractive tintColor={iconColors.primary + '1A'} style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }}>
                      <IconSymbol name="pencil" size={12} color={iconColors.primary} />
                    </GlassView>
                  ) : (
                    <View className="h-[26px] w-[26px] items-center justify-center rounded-full bg-primary/10">
                      <IconSymbol name="pencil" size={12} color={iconColors.primary} />
                    </View>
                  )}
                </Pressable>
                <Text className="flex-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.name}</Text>
              </View>

              {/* Individual member rows — same layout as ungrouped */}
              {members.map((member, mi) => {
                const { total: mTotal, tax: mTax, tip: mTip } = computeContactTotal(member);
                return (
                  <View key={String(member.contactId)} className={cn(mi < members.length - 1 && 'mb-4')}>
                    <View className="flex-row items-start justify-between">
                      <View className="flex-row items-center gap-3">
                        {member.imageUri ? (
                          <Image source={{ uri: member.imageUri }} className="w-10 h-10 rounded-full" />
                        ) : (
                          <View className="w-10 h-10 rounded-full items-center justify-center bg-primary/10">
                            <Text className="text-lg font-bold" style={{ color: iconColors.primary }}>
                              {member.name[0]?.toUpperCase() ?? '?'}
                            </Text>
                          </View>
                        )}
                        <View>
                          <Text className="text-lg font-semibold text-foreground">
                            {member.isSelf ? t.self_label(member.name) : member.name}
                          </Text>
                          <Text className="text-sm text-muted-foreground">
                            {isEqualSplit ? t.share_equalSplit : t.share_itemCount(member.items.length)}
                          </Text>
                        </View>
                      </View>
                      <Text className="text-xl font-bold tabular-nums text-foreground">
                        {formatCurrency(mTotal, billCountry)}
                      </Text>
                    </View>

                    {!isEqualSplit && (
                      <View className="ml-[52px] mt-0 flex-row flex-wrap">
                        {member.items.map((ref) => {
                          const item = bill.items.find((i) => i.id === ref.itemId);
                          if (!item) return null;
                          const totalUnits = bill.contacts.reduce((u, c) => {
                            const cRef = c.items.find((ci) => ci.itemId === ref.itemId);
                            return u + (cRef ? cRef.units : 0);
                          }, 0);
                          const share = totalUnits > 0
                            ? Math.round((ref.units / totalUnits) * item.subtotal)
                            : Math.round(item.subtotal);
                          return (
                            <View key={ref.itemId} className="w-1/2 pr-2 mb-1">
                              <Text className="text-sm text-foreground" numberOfLines={1}>
                                {item.name} ({ref.units}/{totalUnits})
                              </Text>
                              <Text className="text-sm text-muted-foreground">{formatCurrency(share, billCountry)}</Text>
                            </View>
                          );
                        })}
                      </View>
                    )}

                    {!isEqualSplit && (
                      <View className="ml-[52px] mt-2 flex-row items-center gap-3">
                        {mTax > 0 && (
                          <Text className="text-sm text-muted-foreground">
                            {translatedTaxLabel}: {formatCurrency(mTax, billCountry)}
                          </Text>
                        )}
                        {mTip > 0 && (
                          <Text className="text-sm text-muted-foreground">
                            {t.scan_tipPropina}: {formatCurrency(mTip, billCountry)}
                          </Text>
                        )}
                      </View>
                    )}

                    <View className="ml-[52px] mt-3 flex-row items-center gap-2">
                      <Pressable
                        onPress={() => handleTogglePaid(member.contactId)}
                        className={cn(
                          'flex-row items-center gap-1.5 rounded-full px-3 py-1.5',
                          member.paid ? 'bg-emerald-500/15' : 'bg-muted-foreground/10',
                        )}
                      >
                        <IconSymbol
                          name={member.paid ? 'checkmark.circle.fill' : 'circle'}
                          size={14}
                          color={member.paid ? '#10b981' : iconColors.muted}
                        />
                        <Text className={cn('text-sm font-medium', member.paid ? 'text-emerald-500' : 'text-muted-foreground')}>
                          {member.paid ? t.share_paid : t.share_unpaid}
                        </Text>
                      </Pressable>

                      {member.phone && (
                        <Pressable
                          onPress={() => handleSendWhatsApp(member)}
                          className="flex-row items-center gap-1.5 rounded-full bg-[#25D366]/15 px-3 py-1.5"
                        >
                          <WhatsAppIcon size={14} />
                          <Text className="text-sm font-medium text-[#25D366]">{t.share_whatsapp}</Text>
                        </Pressable>
                      )}

                      <Pressable
                        onPress={() => handleShareInfographic(bill.contacts.indexOf(member), member.name)}
                        className="flex-row items-center gap-1.5 rounded-full bg-muted-foreground/10 px-3 py-1.5"
                      >
                        <Share2 size={13} color={iconColors.muted} />
                        <Text className="text-sm font-medium text-muted-foreground">{t.share_share}</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}

              {/* Group total row */}
              <View className="mt-4 border-t border-foreground/10 pt-3">
                {(groupTax > 0 || groupTip > 0) && (
                  <View className="mb-1 flex-row items-center justify-end gap-3">
                    {groupTax > 0 && (
                      <Text className="text-sm text-muted-foreground">
                        {translatedTaxLabel}: {formatCurrency(groupTax, billCountry)}
                      </Text>
                    )}
                    {groupTip > 0 && (
                      <Text className="text-sm text-muted-foreground">
                        {t.scan_tipPropina}: {formatCurrency(groupTip, billCountry)}
                      </Text>
                    )}
                  </View>
                )}
                <View className="flex-row items-center justify-end gap-2">
                  <Text className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t.bill_total}</Text>
                  <Text className="text-xl font-bold tabular-nums text-foreground">
                    {formatCurrency(groupTotal, billCountry)}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Group confirm toolbar */}
      {groupSelectMode && (() => {
        const canGroup = selectedForGroup.size >= 2;
        const showUngroup = editingGroupId && !canGroup;
        return (
          <View className="px-7 pb-4">
            <Pressable
              onPress={confirmGroupFromShare}
              disabled={!canGroup && !showUngroup}
              style={{ backgroundColor: 'transparent' }}
            >
              {showUngroup ? (
                useGlass ? (
                  <GlassView isInteractive tintColor={'#ef4444' + '1A'} style={{ borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' }}>
                    <Text className="text-sm font-semibold text-destructive">{t.people_ungroup}</Text>
                  </GlassView>
                ) : (
                  <View className="items-center rounded-xl bg-destructive/10 py-3.5">
                    <Text className="text-sm font-semibold text-destructive">{t.people_ungroup}</Text>
                  </View>
                )
              ) : useGlass && canGroup ? (
                <GlassView isInteractive tintColor={iconColors.primary + '1A'} style={{ borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' }}>
                  <Text className="text-sm font-semibold text-primary">{t.people_groupCount(selectedForGroup.size)}</Text>
                </GlassView>
              ) : (
                <View className={cn('items-center rounded-xl py-3.5', canGroup ? 'bg-primary' : 'bg-muted')}>
                  <Text className={cn('text-sm font-semibold', canGroup ? 'text-primary-foreground' : 'text-muted-foreground')}>
                    {t.people_groupCount(selectedForGroup.size)}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        );
      })()}

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
