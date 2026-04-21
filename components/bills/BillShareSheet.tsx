import React, { useCallback } from 'react';
import { ActivityIndicator, Modal, View, Pressable, ScrollView } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn, FadeOut, SlideInDown, SlideOutDown,
  useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS,
} from 'react-native-reanimated';
import { Image } from '@/lib/expo-image';
import ViewShot from 'react-native-view-shot';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { WhatsAppIcon } from '@/components/icons/whatsapp';
import { Share2 } from 'lucide-react-native';
import { useT } from '@/lib/i18n';
import { formatCurrency } from '@/lib/format';
import { computeBase, computeTax, type TaxConfig } from '@/constants/taxes';
import { ICON_COLORS } from '@/constants/colors';
import { useColorScheme } from 'nativewind';
import { cn } from '@/lib/cn';
import BillInfographic from './BillInfographic';
import InfographicPreview from './InfographicPreview';
import type { Id } from '@/convex/_generated/dataModel';
import type { ResolvedBill, ResolvedContact } from '@/lib/filters';

const DISMISS_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 500;

interface BillShareSheetProps {
  visible: boolean;
  bill: ResolvedBill;
  billCountry: 'CO' | 'US';
  splitStrategy?: string;
  taxConfig: TaxConfig;
  tipPercent: number;
  translatedTaxLabel: string;
  bottomInset: number;
  infographicRefs: React.MutableRefObject<Record<number, ViewShot | null>>;
  onTogglePaid: (contactId: Id<'contacts'>) => void;
  onSendWhatsApp: (contact: ResolvedContact) => void;
  onShareInfographic: (contact: ResolvedContact, contactIndex: number) => void;
  capturingIndex: number | null;
  previewUri: string | null;
  previewAspect: number;
  onConfirmShare: () => void;
  onClosePreview: () => void;
  onClose: () => void;
}

function BillShareSheet({
  visible,
  bill,
  billCountry,
  splitStrategy,
  taxConfig,
  tipPercent,
  translatedTaxLabel,
  bottomInset,
  infographicRefs,
  onTogglePaid,
  onSendWhatsApp,
  onShareInfographic,
  capturingIndex,
  previewUri,
  previewAspect,
  onConfirmShare,
  onClosePreview,
  onClose,
}: BillShareSheetProps) {
  const t = useT();
  const { colorScheme } = useColorScheme();
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];
  const translateY = useSharedValue(0);

  const dismiss = useCallback(() => { onClose(); }, [onClose]);

  const panGesture = Gesture.Pan()
    .enabled(previewUri === null)
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_THRESHOLD || e.velocityY > VELOCITY_THRESHOLD) {
        const remaining = 1000 - e.translationY;
        const speed = Math.max(e.velocityY, 800);
        const duration = Math.min(Math.max((remaining / speed) * 1000, 150), 400);
        translateY.value = withTiming(1000, { duration }, () => {
          runOnJS(dismiss)();
        });
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal
      visible={visible}
      animationType="none"
      presentationStyle="overFullScreen"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1">
        {/* Backdrop */}
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          className="absolute inset-0"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <Pressable className="flex-1" onPress={onClose} />
        </Animated.View>

        {/* Sheet */}
        <GestureDetector gesture={panGesture}>
          <Animated.View
            entering={SlideInDown.duration(300)}
            exiting={SlideOutDown.duration(200)}
            className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-background"
            style={[{ top: 48, paddingBottom: bottomInset }, sheetStyle]}
          >
            {/* Header */}
            <View className="items-center pb-2 pt-3">
              <View className="h-1 w-10 rounded-full bg-muted-foreground/30" />
            </View>
            <View className="flex-row items-center justify-between px-7 pb-4 pt-2">
              <Text className="text-xl font-bold text-foreground">{t.share_title}</Text>
              <Pressable onPress={onClose} className="rounded-full bg-muted p-2">
                <IconSymbol name="xmark" size={14} color={iconColors.muted} />
              </Pressable>
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
                  const contactItemAmounts = contact.items.map((itemId) => {
                    const item = bill.items.find((i) => i.id === itemId);
                    if (!item) return 0;
                    const numContacts = bill.contacts.filter((c) => c.items.includes(itemId)).length;
                    return Math.round(item.subtotal / numContacts);
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
                          <Text className="text-base font-bold" style={{ color: iconColors.primary }}>
                            {contact.name[0]?.toUpperCase() ?? '?'}
                          </Text>
                        </View>
                      )}
                      <View>
                        <Text className="text-base font-semibold text-foreground">{contact.name}</Text>
                        <Text className="text-xs text-muted-foreground">
                          {isEqualSplit
                            ? t.share_equalPerPerson(formatCurrency(contactTotal, billCountry), bill.contacts.length)
                            : t.share_itemCount(contact.items.length)}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-lg font-bold tabular-nums text-foreground">
                      {formatCurrency(contactTotal, billCountry)}
                    </Text>
                  </View>

                  {!isEqualSplit && (
                    <View className="ml-[52px] mt-2 flex-row flex-wrap">
                      {contact.items.map((itemId) => {
                        const item = bill.items.find((i) => i.id === itemId);
                        if (!item) return null;
                        const numContacts = bill.contacts.filter((c) => c.items.includes(itemId)).length;
                        const share = Math.round(item.subtotal / numContacts);
                        return (
                          <View key={itemId} className="w-1/2 pr-2 mb-1">
                            <Text className="text-xs text-foreground" numberOfLines={1}>{item.name}</Text>
                            <Text className="text-[11px] text-muted-foreground">{formatCurrency(share, billCountry)}</Text>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {isEqualSplit && (
                    <View className="ml-[52px] mt-2">
                      <Text className="text-xs text-muted-foreground">{t.share_equalSplit}</Text>
                    </View>
                  )}

                  {!isEqualSplit && (
                    <View className="ml-[52px] mt-2 gap-1">
                      <View className="flex-row justify-between">
                        <Text className="text-[11px] text-muted-foreground">{translatedTaxLabel}</Text>
                        <Text className="text-[11px] text-muted-foreground">{formatCurrency(contactTax, billCountry)}</Text>
                      </View>
                      {tipPercent > 0 && (
                        <View className="flex-row justify-between">
                          <Text className="text-[11px] text-muted-foreground">{t.bill_tip(tipPercent)}</Text>
                          <Text className="text-[11px] text-muted-foreground">{formatCurrency(contactTip, billCountry)}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  <View className="ml-[52px] mt-3 flex-row gap-2">
                    <Pressable
                      onPress={() => onTogglePaid(contact.contactId)}
                      className={cn(
                        'flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl border',
                        contact.paid
                          ? 'bg-emerald-500/15 border-emerald-500/30'
                          : 'bg-muted-foreground/10 border-muted-foreground/20',
                      )}
                    >
                      <IconSymbol
                        name={contact.paid ? 'checkmark.circle.fill' : 'circle'}
                        size={16}
                        color={contact.paid ? iconColors.success : iconColors.mutedLight}
                      />
                      <Text className={cn('text-[13px] font-semibold', contact.paid ? 'text-emerald-500' : 'text-muted-foreground')}>
                        {contact.paid ? t.share_paid : t.share_unpaid}
                      </Text>
                    </Pressable>

                    {contact.phone && (
                      <Pressable
                        onPress={() => onSendWhatsApp(contact)}
                        className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl border bg-green-500/15 border-green-500/30"
                      >
                        <WhatsAppIcon size={16} color="#25d366" />
                        <Text className="text-[13px] font-semibold text-green-500">{t.share_whatsapp}</Text>
                      </Pressable>
                    )}

                    <Pressable
                      onPress={() => onShareInfographic(contact, ci)}
                      disabled={capturingIndex !== null}
                      className={cn(
                        'flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl border bg-primary/10 border-primary/20',
                        capturingIndex !== null && 'opacity-50',
                      )}
                    >
                      {capturingIndex === ci ? (
                        <ActivityIndicator size="small" color={iconColors.primary} />
                      ) : (
                        <>
                          <Share2 size={14} color={iconColors.primary} />
                          <Text className="text-[13px] font-semibold text-primary">{t.share_share}</Text>
                        </>
                      )}
                    </Pressable>
                  </View>

                  <View className="absolute -left-[9999px]">
                    <ViewShot
                      ref={(ref) => { infographicRefs.current[ci] = ref; }}
                      options={{ format: 'png', quality: 1 }}
                    >
                      <BillInfographic
                        billName={bill.name}
                        contactName={contact.name}
                        contactImageUri={contact.imageUri}
                        items={isEqualSplit
                          ? [{ name: t.share_equalSplit, amount: contactTotal }]
                          : contact.items
                            .map((itemId) => {
                              const item = bill.items.find((i) => i.id === itemId);
                              if (!item) return null;
                              const numContacts = bill.contacts.filter((c) => c.items.includes(itemId)).length;
                              const amount = Math.round(item.subtotal / numContacts);
                              if (amount === 0) return null;
                              return { name: item.name, amount };
                            })
                            .filter((i): i is { name: string; amount: number } => i !== null)}
                        taxConfig={taxConfig}
                        tipPercent={tipPercent}
                        location={bill.location?.address}
                        date={bill.photoTakenAt ?? new Date(bill._creationTime).toISOString()}
                        country={billCountry}
                        t={t}
                      />
                    </ViewShot>
                  </View>

                  {ci < bill.contacts.length - 1 && (
                    <View className="ml-[52px] mt-4 h-px bg-border/40" />
                  )}
                </View>
                );
              })}
            </ScrollView>

            {/* Infographic preview overlay */}
            <InfographicPreview
              uri={previewUri}
              imageAspect={previewAspect}
              visible={previewUri !== null}
              onShare={onConfirmShare}
              onClose={onClosePreview}
            />
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

export default React.memo(BillShareSheet);
