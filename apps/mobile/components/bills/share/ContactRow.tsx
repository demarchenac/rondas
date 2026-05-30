import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Share2 } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { WhatsAppIcon } from '@/components/icons/whatsapp';
import { Image } from '@/lib/expo-image';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import type { Id } from '@convex/_generated/dataModel';
import type { Translations } from '@/lib/i18n';
import type { ResolvedContact } from './types';

export interface ContactRowProps {
  contact: ResolvedContact;
  contactIndex: number;
  total: number;
  tax: number;
  tip: number;
  isEqualSplit: boolean;
  billItems: { id?: string; name: string; subtotal: number }[];
  allContacts: { items: { itemId: string; units: number }[] }[];
  billCountry: string;
  contactCount: number;
  translatedTaxLabel: string;
  iconColors: Record<string, string>;
  t: Translations;
  groupSelectMode?: boolean;
  isLocked?: boolean;
  isSelected?: boolean;
  capturingIndex: number | null;
  onToggleSelection?: () => void;
  onTogglePaid: (id: Id<'contacts'>) => void;
  onSendWhatsApp: (contact: ResolvedContact) => void;
  onShareInfographic: (index: number, name: string) => void;
}

function ContactRow({
  contact, contactIndex, total, tax, tip, isEqualSplit, billItems, allContacts,
  billCountry, contactCount, translatedTaxLabel, iconColors, t,
  groupSelectMode, isLocked, isSelected, capturingIndex,
  onToggleSelection, onTogglePaid, onSendWhatsApp, onShareInfographic,
}: ContactRowProps) {
  return (
    <Pressable
      className="mb-4"
      onPress={groupSelectMode && !isLocked ? onToggleSelection : undefined}
      disabled={!groupSelectMode || !!isLocked}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 flex-row items-start gap-3">
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
          <View className="flex-1">
            <Text className="text-lg font-semibold text-foreground">{contact.isSelf ? t.self_label(contact.name) : contact.name}</Text>
            <Text className="text-sm text-muted-foreground">
              {isEqualSplit
                ? t.share_equalPerPerson(formatCurrency(total, billCountry), contactCount)
                : t.share_itemCount(contact.items.length)}
            </Text>

            {!isEqualSplit && (
              <View className="flex-row flex-wrap">
                {contact.items.map((ref) => {
                  const item = billItems.find((i) => i.id === ref.itemId);
                  if (!item) return null;
                  const totalUnits = allContacts.reduce((u, c) => {
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
              <Text className="mt-1 text-sm text-muted-foreground">{t.share_equalSplit}</Text>
            )}

            {!isEqualSplit && (
              <View className="mt-1 flex-row items-center gap-3">
                {tax > 0 && (
                  <Text className="text-sm text-muted-foreground">
                    {translatedTaxLabel}: {formatCurrency(tax, billCountry)}
                  </Text>
                )}
                {tip > 0 && (
                  <Text className="text-sm text-muted-foreground">
                    {t.scan_tipPropina}: {formatCurrency(tip, billCountry)}
                  </Text>
                )}
              </View>
            )}

            {!groupSelectMode && (
              <View className="mt-2 flex-row items-center gap-2">
                <Pressable
                  onPress={() => onTogglePaid(contact.contactId)}
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
                    onPress={() => onSendWhatsApp(contact)}
                    className="flex-row items-center gap-1.5 rounded-full bg-[#25D366]/15 px-3 py-1.5"
                  >
                    <WhatsAppIcon size={14} />
                    <Text className="text-sm font-medium text-[#25D366]">{t.share_whatsapp}</Text>
                  </Pressable>
                )}

                <Pressable
                  onPress={() => onShareInfographic(contactIndex, contact.name)}
                  className="flex-row items-center gap-1.5 rounded-full bg-muted-foreground/10 px-3 py-1.5"
                >
                  {capturingIndex === contactIndex ? (
                    <ActivityIndicator size="small" color={iconColors.muted} />
                  ) : (
                    <Share2 size={13} color={iconColors.muted} />
                  )}
                  <Text className="text-sm font-medium text-muted-foreground">{t.share_share}</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
        <Text className="text-xl font-bold tabular-nums text-foreground">
          {formatCurrency(total, billCountry)}
        </Text>
      </View>
    </Pressable>
  );
}

export default React.memo(ContactRow);
