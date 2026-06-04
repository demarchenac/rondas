import React from 'react';
import { Pressable, View } from 'react-native';
import { GlassView } from 'expo-glass-effect';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { WhatsAppIcon } from '@/components/icons/whatsapp';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import type { Id } from '@convex/_generated/dataModel';
import type { Translations } from '@/lib/i18n';
import type { IconPalette } from '@/constants/colors';
import ContactRow from './ContactRow';
import type { ResolvedContact, ContactShareData } from './types';
import { contactKey, GROUP_TINTS_BG } from './utils';

export interface ContactGroupSectionProps {
  group: { id: string; contactIds: Id<'contacts'>[]; name: string };
  members: ResolvedContact[];
  groupIndex: number;
  shareDataMap: Map<string, ContactShareData>;
  isEqualSplit: boolean;
  billCountry: string;
  decimalPlaces?: number;
  contactCount: number;
  translatedTaxLabel: string;
  shouldUseGlass: boolean;
  iconColors: IconPalette;
  t: Translations;
  capturingIndex: number | null;
  onEditGroup: (groupId: string, memberIds: Set<string>) => void;
  onTogglePaid: (contactId: string) => void;
  onSendWhatsApp: (contact: ResolvedContact) => void;
  onShareInfographic: (index: number, name: string) => void;
  onSendGroupWhatsApp: (group: { name: string }, members: { name: string; amount: number }[], groupTotal: number) => void;
  getContactIndex: (contact: ResolvedContact) => number;
}

function ContactGroupSection({
  group, members, groupIndex, shareDataMap, isEqualSplit,
  billCountry, decimalPlaces, contactCount, translatedTaxLabel, shouldUseGlass, iconColors, t, capturingIndex,
  onEditGroup, onTogglePaid, onSendWhatsApp, onShareInfographic, onSendGroupWhatsApp, getContactIndex,
}: ContactGroupSectionProps) {
  const tintBg = GROUP_TINTS_BG[groupIndex % GROUP_TINTS_BG.length];

  let groupTotal = 0;
  let groupTax = 0;
  let groupTip = 0;
  for (const member of members) {
    const memberShare = shareDataMap.get(contactKey(member));
    if (memberShare) { groupTotal += memberShare.total; groupTax += memberShare.tax; groupTip += memberShare.tip; }
  }

  return (
    <View className={cn('-mx-7 mb-4 px-7 py-4', tintBg)}>
      <View className="mb-3 flex-row items-center gap-2">
        <Pressable
          onPress={() => onEditGroup(group.id, new Set(members.map((member) => contactKey(member))))}
          role="button"
          accessibilityLabel={t.a11y_editGroup(group.name)}
          style={{ backgroundColor: 'transparent' }}
        >
          {shouldUseGlass ? (
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

      {members.map((member, memberIndex) => {
        const memberShareData = shareDataMap.get(contactKey(member));
        if (!memberShareData) return null;
        return (
          <View key={contactKey(member)} className={cn(memberIndex < members.length - 1 && 'mb-4')}>
            <ContactRow
              contact={member}
              contactIndex={getContactIndex(member)}
              shareData={memberShareData}
              isEqualSplit={isEqualSplit}
              billCountry={billCountry}
              decimalPlaces={decimalPlaces}
              contactCount={contactCount}
              translatedTaxLabel={translatedTaxLabel}
              iconColors={iconColors}
              t={t}
              capturingIndex={capturingIndex}
              onTogglePaid={onTogglePaid}
              onSendWhatsApp={onSendWhatsApp}
              onShareInfographic={onShareInfographic}
            />
          </View>
        );
      })}

      <View className="mt-4 border-t border-foreground/10" />
      <View className="ml-[45px] pt-3">
        {(groupTax > 0 || groupTip > 0) && (
          <View className="mb-1 flex-row items-center gap-3">
            {groupTax > 0 && (
              <Text className="text-sm text-muted-foreground">
                {translatedTaxLabel}: {formatCurrency(groupTax, billCountry, decimalPlaces)}
              </Text>
            )}
            {groupTip > 0 && (
              <Text className="text-sm text-muted-foreground">
                {t.scan_tipPropina}: {formatCurrency(groupTip, billCountry, decimalPlaces)}
              </Text>
            )}
          </View>
        )}
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t.bill_total}</Text>
          <Text className="text-xl font-bold tabular-nums text-foreground">
            {formatCurrency(groupTotal, billCountry, decimalPlaces)}
          </Text>
        </View>
        <View className="mt-3 flex-row items-center gap-2">
          <Pressable
            onPress={() => onSendGroupWhatsApp(
              group,
              members.map((m) => ({ name: m.isSelf ? t.self_label(m.name) : m.name, amount: shareDataMap.get(contactKey(m))?.total ?? 0 })),
              groupTotal,
            )}
            role="button"
            accessibilityLabel={t.share_groupWhatsapp}
            className="flex-row items-center gap-1.5 rounded-full bg-[#25D366]/15 px-3 py-1.5"
          >
            <WhatsAppIcon size={14} />
            <Text className="text-sm font-medium text-[#25D366]">{t.share_whatsapp}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default React.memo(ContactGroupSection);
