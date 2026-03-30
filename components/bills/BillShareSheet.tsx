import React from 'react';
import { Modal, View, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
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
import type { Id } from '@/convex/_generated/dataModel';
import type { ResolvedBill, ResolvedContact } from '@/lib/filters';

interface BillShareSheetProps {
  visible: boolean;
  bill: ResolvedBill;
  billCountry: 'CO' | 'US';
  taxConfig: TaxConfig;
  tipPercent: number;
  translatedTaxLabel: string;
  bottomInset: number;
  infographicRefs: React.MutableRefObject<Record<number, ViewShot | null>>;
  onTogglePaid: (contactId: Id<'contacts'>) => void;
  onSendWhatsApp: (contact: ResolvedContact) => void;
  onShareInfographic: (contact: ResolvedContact, contactIndex: number) => void;
  onClose: () => void;
}

function BillShareSheet({
  visible,
  bill,
  billCountry,
  taxConfig,
  tipPercent,
  translatedTaxLabel,
  bottomInset,
  infographicRefs,
  onTogglePaid,
  onSendWhatsApp,
  onShareInfographic,
  onClose,
}: BillShareSheetProps) {
  const t = useT();
  const { colorScheme } = useColorScheme();
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background pt-3" style={{ paddingBottom: bottomInset }}>
        {/* Modal header */}
        <View className="items-center pb-2">
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
            // Compute per-contact amounts
            const contactItemAmounts = contact.items.map((itemId) => {
              const item = bill.items.find((i) => i.id === itemId);
              if (!item) return 0;
              const numContacts = bill.contacts.filter((c) => c.items.includes(itemId)).length;
              return Math.round(item.subtotal / numContacts);
            });
            const contactItemsTotal = contactItemAmounts.reduce((s, a) => s + a, 0);
            const contactBase = computeBase(contactItemsTotal, taxConfig);
            const contactTax = computeTax(contactItemsTotal, taxConfig);
            const contactTip = Math.round(contactBase * (tipPercent / 100));
            const contactTotal = contactBase + contactTax + contactTip;

            return (
            <View key={ci} className="mb-4">
              {/* Contact header */}
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  {contact.imageUri ? (
                    <Image source={{ uri: contact.imageUri }} className="w-10 h-10 rounded-full" />
                  ) : (
                    <View
                      className="w-10 h-10 rounded-full items-center justify-center bg-primary/10"
                    >
                      <Text className="text-base font-bold" style={{ color: iconColors.primary }}>
                        {contact.name[0]?.toUpperCase() ?? '?'}
                      </Text>
                    </View>
                  )}
                  <View>
                    <Text className="text-base font-semibold text-foreground">{contact.name}</Text>
                    <Text className="text-xs text-muted-foreground">
                      {t.share_itemCount(contact.items.length)}
                    </Text>
                  </View>
                </View>
                <Text className="text-lg font-bold tabular-nums text-foreground">
                  {formatCurrency(contactTotal, billCountry)}
                </Text>
              </View>

              {/* Contact items — two column */}
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

              {/* Tax & Tip breakdown */}
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

              {/* Actions */}
              <View className="ml-[52px] mt-3 flex-row gap-2">
                {/* Paid toggle */}
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

                {/* WhatsApp text */}
                {contact.phone && (
                  <Pressable
                    onPress={() => onSendWhatsApp(contact)}
                    className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl border bg-green-500/15 border-green-500/30"
                  >
                    <WhatsAppIcon size={16} color="#25d366" />
                    <Text className="text-[13px] font-semibold text-green-500">{t.share_whatsapp}</Text>
                  </Pressable>
                )}

                {/* Share infographic */}
                <Pressable
                  onPress={() => onShareInfographic(contact, ci)}
                  className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl border bg-primary/10 border-primary/20"
                >
                  <Share2 size={14} color={iconColors.primary} />
                  <Text className="text-[13px] font-semibold text-primary">{t.share_share}</Text>
                </Pressable>
              </View>

              {/* Hidden infographic for capture */}
              <View className="absolute -left-[9999px]">
                <ViewShot
                  ref={(ref) => { infographicRefs.current[ci] = ref; }}
                  options={{ format: 'png', quality: 1 }}
                >
                  <BillInfographic
                    billName={bill.name}
                    contactName={contact.name}
                    contactImageUri={contact.imageUri}
                    items={contact.items
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

              {/* Divider */}
              {ci < bill.contacts.length - 1 && (
                <View className="ml-[52px] mt-4 h-px bg-border/40" />
              )}
            </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

export default React.memo(BillShareSheet);
