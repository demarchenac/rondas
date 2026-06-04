import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Share2 } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { WhatsAppIcon } from '@/components/icons/whatsapp';
import Avatar from '@/components/ui/avatar';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import type { Translations } from '@/lib/i18n';
import type { IconPalette } from '@/constants/colors';
import type { ResolvedContact, ContactShareData } from './types';

export interface ContactRowProps {
  contact: ResolvedContact;
  contactIndex: number;
  shareData: ContactShareData;
  isEqualSplit: boolean;
  billCountry: string;
  decimalPlaces?: number;
  contactCount: number;
  translatedTaxLabel: string;
  iconColors: IconPalette;
  t: Translations;
  isGroupSelectMode?: boolean;
  isLocked?: boolean;
  isSelected?: boolean;
  capturingIndex: number | null;
  onToggleSelection?: () => void;
  onTogglePaid: (contactId: string) => void;
  onSendWhatsApp: (contact: ResolvedContact) => void;
  onShareInfographic: (index: number, name: string) => void;
}

function ContactRow({
  contact, contactIndex, shareData, isEqualSplit,
  billCountry, decimalPlaces, contactCount, translatedTaxLabel, iconColors, t,
  isGroupSelectMode, isLocked, isSelected, capturingIndex,
  onToggleSelection, onTogglePaid, onSendWhatsApp, onShareInfographic,
}: ContactRowProps) {
  const { total, tax, tip, items: itemShares } = shareData;

  const displayName = contact.isSelf ? t.self_label(contact.name) : contact.name;

  const content = (
      <View className="flex-row items-start gap-3">
        {isGroupSelectMode && !isLocked && (
          <IconSymbol
            name={isSelected ? 'checkmark.circle.fill' : 'circle'}
            size={22}
            color={isSelected ? iconColors.primary : iconColors.mutedLight}
          />
        )}
        <View style={isLocked ? { opacity: 0.4 } : undefined} accessibilityLabel={`${displayName} avatar`}>
          <Avatar name={contact.name} imageUri={contact.imageUri} size="lg" />
        </View>
        <View className="flex-1">
          <View className="flex-row items-start justify-between">
            <Text className="flex-1 text-lg font-semibold text-foreground" numberOfLines={1}>{displayName}</Text>
            <Text className="text-xl font-bold tabular-nums text-foreground">
              {formatCurrency(total, billCountry, decimalPlaces)}
            </Text>
          </View>
            <Text className="text-sm text-muted-foreground">
              {isEqualSplit
                ? t.share_equalPerPerson(formatCurrency(total, billCountry, decimalPlaces), contactCount)
                : t.share_itemCount(contact.items.length)}
            </Text>

            {!isEqualSplit && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 8 }}>
                {contact.items.map((itemRef) => {
                  const itemShareInfo = itemShares.get(itemRef.itemId);
                  if (!itemShareInfo) return null;
                  return (
                    <View key={itemRef.itemId} style={{ flexBasis: '48%', flexGrow: 1 }} className="mb-1">
                      <Text className="text-sm text-foreground" numberOfLines={1}>
                        {itemShareInfo.name} ({itemRef.units}/{itemShareInfo.totalUnits})
                      </Text>
                      <Text className="text-sm text-muted-foreground">{formatCurrency(itemShareInfo.share, billCountry, decimalPlaces)}</Text>
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
                    {translatedTaxLabel}: {formatCurrency(tax, billCountry, decimalPlaces)}
                  </Text>
                )}
                {tip > 0 && (
                  <Text className="text-sm text-muted-foreground">
                    {t.scan_tipPropina}: {formatCurrency(tip, billCountry, decimalPlaces)}
                  </Text>
                )}
              </View>
            )}

            {!isGroupSelectMode && (
              <View className="mt-2 flex-row items-center gap-2">
                <Pressable
                  onPress={() => onTogglePaid(contact.contactId)}
                  role="button"
                  accessibilityLabel={`${contact.paid ? t.share_paid : t.share_unpaid} ${displayName}`}
                  className={cn(
                    'flex-row items-center gap-1.5 rounded-full px-3 py-1.5',
                    contact.paid ? 'bg-emerald-500/15' : 'bg-muted-foreground/10',
                  )}
                >
                  <IconSymbol
                    name={contact.paid ? 'checkmark.circle.fill' : 'circle'}
                    size={14}
                    color={contact.paid ? iconColors.success : iconColors.muted}
                  />
                  <Text className={cn('text-sm font-medium', contact.paid ? 'text-emerald-500' : 'text-muted-foreground')}>
                    {contact.paid ? t.share_paid : t.share_unpaid}
                  </Text>
                </Pressable>

                {contact.phone && (
                  <Pressable
                    onPress={() => onSendWhatsApp(contact)}
                    role="button"
                    accessibilityLabel={`${t.share_whatsapp} ${displayName}`}
                    className="flex-row items-center gap-1.5 rounded-full bg-[#25D366]/15 px-3 py-1.5"
                  >
                    <WhatsAppIcon size={14} />
                    <Text className="text-sm font-medium text-[#25D366]">{t.share_whatsapp}</Text>
                  </Pressable>
                )}

                <Pressable
                  onPress={() => onShareInfographic(contactIndex, contact.name)}
                  role="button"
                  accessibilityLabel={`${t.share_share} ${displayName}`}
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
  );

  if (isGroupSelectMode && !isLocked) {
    return (
      <Pressable
        className="mb-4"
        onPress={onToggleSelection}
        role="button"
        accessibilityLabel={isSelected ? t.a11y_deselect(displayName) : t.a11y_select(displayName)}
      >
        {content}
      </Pressable>
    );
  }

  return <View className="mb-4">{content}</View>;
}

export default React.memo(ContactRow);
