import React, { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, View, Pressable, ScrollView } from 'react-native';
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import { Image } from '@/lib/expo-image';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';
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
import type { Id } from '@convex/_generated/dataModel';
import type { ResolvedBill, ResolvedContact } from '@/lib/filters';

interface BillShareSheetProps {
  visible: boolean;
  bill: ResolvedBill;
  billCountry: 'CO' | 'US';
  splitStrategy?: string;
  taxConfig: TaxConfig;
  tipPercent: number;
  translatedTaxLabel: string;
  bottomInset: number;
  infographicRefs: React.MutableRefObject<Record<number, ViewShotRef | null>>;
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
  const sheetRef = useRef<TrueSheet>(null);

  useEffect(() => {
    if (visible) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [visible]);

  const handleDismiss = useCallback(() => { onClose(); }, [onClose]);

  return (
    <TrueSheet
      ref={sheetRef}
      name="bill-share"
      detents={[0.7, 1]}
      grabber
      grabberOptions={{ topMargin: 12 }}
      cornerRadius={20}
      backgroundColor={colorScheme === 'dark' ? '#0f172a' : '#fafbfc'}
      onDidDismiss={handleDismiss}
    >
      <View style={{ flex: 1, paddingBottom: bottomInset > 0 ? bottomInset : 16 }}>
        <Text className="px-7 pt-4 pb-4 text-2xl font-bold text-foreground">{t.share_title}</Text>

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
                              {ref.units > 1 ? `${item.name} ×${ref.units}` : item.name}
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
                    <View className="ml-[52px] mt-2 gap-1">
                      <View className="flex-row justify-between">
                        <Text className="text-sm text-muted-foreground">{translatedTaxLabel}</Text>
                        <Text className="text-sm text-muted-foreground">{formatCurrency(contactTax, billCountry)}</Text>
                      </View>
                      {tipPercent > 0 && (
                        <View className="flex-row justify-between">
                          <Text className="text-sm text-muted-foreground">{t.bill_tip(tipPercent)}</Text>
                          <Text className="text-sm text-muted-foreground">{formatCurrency(contactTip, billCountry)}</Text>
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
                      <Text className={cn('text-sm font-semibold', contact.paid ? 'text-emerald-500' : 'text-muted-foreground')}>
                        {contact.paid ? t.share_paid : t.share_unpaid}
                      </Text>
                    </Pressable>

                    {contact.phone && !contact.isSelf && (
                      <Pressable
                        onPress={() => onSendWhatsApp(contact)}
                        className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl border bg-green-500/15 border-green-500/30"
                      >
                        <WhatsAppIcon size={16} color="#25d366" />
                        <Text className="text-sm font-semibold text-green-500">{t.share_whatsapp}</Text>
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
                          <Text className="text-sm font-semibold text-primary">{t.share_share}</Text>
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
                            .map((ref) => {
                              const item = bill.items.find((i) => i.id === ref.itemId);
                              if (!item) return null;
                              const totalUnits = bill.contacts.reduce((u, c) => {
                                const cRef = c.items.find((ci) => ci.itemId === ref.itemId);
                                return u + (cRef ? cRef.units : 0);
                              }, 0);
                              const amount = totalUnits > 0
                                ? Math.round((ref.units / totalUnits) * item.subtotal)
                                : Math.round(item.subtotal);
                              if (amount === 0) return null;
                              return { name: ref.units > 1 ? `${item.name} ×${ref.units}` : item.name, amount };
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
      </View>
    </TrueSheet>
  );
}

export default React.memo(BillShareSheet);
