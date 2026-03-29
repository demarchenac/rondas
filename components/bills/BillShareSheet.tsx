import React from 'react';
import { Modal, View, Pressable, ScrollView, Image } from 'react-native';
import ViewShot from 'react-native-view-shot';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { WhatsAppIcon } from '@/components/icons/whatsapp';
import { Share2 } from 'lucide-react-native';
import { useT } from '@/lib/i18n';
import { formatCurrency } from '@/lib/format';
import { computeTax, type TaxConfig } from '@/constants/taxes';
import { ICON_COLORS } from '@/constants/colors';
import { useColorScheme } from 'nativewind';
import BillInfographic from './BillInfographic';
import type { Doc } from '@/convex/_generated/dataModel';

interface BillShareSheetProps {
  visible: boolean;
  bill: Doc<'bills'>;
  billCountry: 'CO' | 'US';
  taxConfig: TaxConfig;
  tipPercent: number;
  translatedTaxLabel: string;
  bottomInset: number;
  infographicRefs: React.MutableRefObject<Record<number, ViewShot | null>>;
  onTogglePaid: (contactIndex: number) => void;
  onSendWhatsApp: (contact: { name: string; phone?: string; items: string[]; amount: number }) => void;
  onShareInfographic: (contact: any, contactIndex: number) => void;
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
      <View className="flex-1 bg-background" style={{ paddingTop: 12, paddingBottom: bottomInset }}>
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
            const contactSubtotal = contactItemAmounts.reduce((s, a) => s + a, 0);
            const contactTax = computeTax(contactSubtotal, taxConfig);
            const contactTip = Math.round(contactSubtotal * (tipPercent / 100));
            const contactTotal = taxConfig.taxIncluded
              ? contactSubtotal + contactTip
              : contactSubtotal + contactTax + contactTip;

            return (
            <View key={ci} className="mb-4">
              {/* Contact header */}
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  {contact.imageUri ? (
                    <Image source={{ uri: contact.imageUri }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                  ) : (
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: 'rgba(56, 189, 248, 0.1)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 16, fontWeight: '700', color: iconColors.primary }}>
                        {contact.name[0]?.toUpperCase() ?? '?'}
                      </Text>
                    </View>
                  )}
                  <View>
                    <Text className="text-base font-semibold text-foreground">{contact.name}</Text>
                    <Text className="text-xs text-muted-foreground">
                      {contact.items.length} {contact.items.length === 1 ? 'item' : 'items'}
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
                    <View key={itemId} style={{ width: '50%', paddingRight: 8, marginBottom: 4 }}>
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
                  onPress={() => onTogglePaid(ci)}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: contact.paid ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.1)',
                    borderWidth: 1,
                    borderColor: contact.paid ? 'rgba(16,185,129,0.3)' : 'rgba(148,163,184,0.2)',
                  }}
                >
                  <IconSymbol
                    name={contact.paid ? 'checkmark.circle.fill' : 'circle'}
                    size={16}
                    color={contact.paid ? '#10b981' : '#94a3b8'}
                  />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: contact.paid ? '#10b981' : '#94a3b8' }}>
                    {contact.paid ? t.share_paid : t.share_unpaid}
                  </Text>
                </Pressable>

                {/* WhatsApp text */}
                {contact.phone && (
                  <Pressable
                    onPress={() => onSendWhatsApp(contact)}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      paddingVertical: 10,
                      borderRadius: 12,
                      backgroundColor: 'rgba(37,211,102,0.15)',
                      borderWidth: 1,
                      borderColor: 'rgba(37,211,102,0.3)',
                    }}
                  >
                    <WhatsAppIcon size={16} color="#25d366" />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#25d366' }}>{t.share_whatsapp}</Text>
                  </Pressable>
                )}

                {/* Share infographic */}
                <Pressable
                  onPress={() => onShareInfographic(contact, ci)}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: 'rgba(56, 189, 248, 0.1)',
                    borderWidth: 1,
                    borderColor: 'rgba(56, 189, 248, 0.2)',
                  }}
                >
                  <Share2 size={14} color="#38bdf8" />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#38bdf8' }}>{t.share_share}</Text>
                </Pressable>
              </View>

              {/* Hidden infographic for capture */}
              <View style={{ position: 'absolute', left: -9999 }}>
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

export default BillShareSheet;
