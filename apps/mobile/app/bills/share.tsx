import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Image as RNImage, Linking, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { useQuery, useMutation } from 'convex/react';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
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

  const infographicRefs = useRef<Record<number, ViewShotRef | null>>({});
  const [capturingIndex, setCapturingIndex] = useState<number | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewAspect, setPreviewAspect] = useState(1);
  const [previewContactName, setPreviewContactName] = useState('');

  const billCountry = (bill?.country as 'CO' | 'US') || 'CO';
  const billCategory = (bill?.tags?.find((t) => t.isPlatform)?.slug || 'dining') as ReceiptCategory;
  const rawTaxConfig = getTaxConfig(billCountry, billCategory);
  const taxConfig = withTaxIncludedOverride(rawTaxConfig, bill?.taxIncludedOverride ?? undefined);
  const tipPercent = bill?.tipPercent ?? 0;
  const splitStrategy = bill?.splitStrategy;
  const translatedTaxLabel = getTaxLabel(taxConfig, t);

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

  if (!bill || !userId) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={iconColors.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">

      <View className="flex-row items-center gap-3 px-5 pb-4" style={{ paddingTop: insets.top + 12 }}>
        <Pressable onPress={() => router.back()} className="active:opacity-80">
          <IconSymbol name="chevron.left" size={22} color={iconColors.primary} />
        </Pressable>
        <Text className="text-2xl font-bold text-foreground">{t.share_title}</Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-7 pb-8">
        {bill.contacts.map((contact, ci) => {
          const isEqualSplit = splitStrategy === 'equal';

          let contactTotal: number;
          let contactTax: number;
          let contactTip: number;
          if (isEqualSplit) {
            contactTotal = contact.amount;
            contactTax = 0;
            contactTip = 0;
          } else {
            const contactItemAmounts = contact.items.map((ref) => {
              const item = bill.items.find((i) => i.id === ref.itemId);
              if (!item) return 0;
              const totalUnits = bill.contacts.reduce((u, c) => {
                const cRef = c.items.find((ci) => ci.itemId === ref.itemId);
                return u + (cRef ? cRef.units : 0);
              }, 0);
              return totalUnits > 0
                ? Math.round((ref.units / totalUnits) * item.subtotal)
                : Math.round(item.subtotal);
            });
            const contactItemsTotal = contactItemAmounts.reduce((s, a) => s + a, 0);
            const contactBase = computeBase(contactItemsTotal, taxConfig);
            contactTax = computeTax(contactItemsTotal, taxConfig);
            contactTip = Math.round(contactBase * (tipPercent / 100));
            contactTotal = contactBase + contactTax + contactTip;
          }

          return (
            <View key={ci} className="mb-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  {contact.imageUri ? (
                    <Image source={{ uri: contact.imageUri }} className="w-10 h-10 rounded-full" />
                  ) : (
                    <View className="w-10 h-10 rounded-full items-center justify-center bg-primary/10">
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
                <View className="ml-[52px] mt-2 flex-row flex-wrap">
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
            </View>
          );
        })}
      </ScrollView>

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
