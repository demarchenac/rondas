import React from 'react';
import { Pressable, View } from 'react-native';
import { GlassView } from 'expo-glass-effect';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import type { Id } from '@convex/_generated/dataModel';
import type { Translations } from '@/lib/i18n';
import ContactRow from './ContactRow';
import { GROUP_TINTS_BG, type ResolvedContact, type ContactShareData } from './types';

export interface ContactGroupSectionProps {
  group: { id: string; contactIds: Id<'contacts'>[]; name: string };
  members: ResolvedContact[];
  groupIndex: number;
  shareDataMap: Map<string, ContactShareData>;
  isEqualSplit: boolean;
  billCountry: string;
  contactCount: number;
  translatedTaxLabel: string;
  useGlass: boolean;
  iconColors: Record<string, string>;
  t: Translations;
  capturingIndex: number | null;
  onEditGroup: (groupId: string, memberIds: Set<string>) => void;
  onTogglePaid: (contactId: string) => void;
  onSendWhatsApp: (contact: ResolvedContact) => void;
  onShareInfographic: (index: number, name: string) => void;
  getContactIndex: (contact: ResolvedContact) => number;
}

function ContactGroupSection({
  group, members, groupIndex, shareDataMap, isEqualSplit,
  billCountry, contactCount, translatedTaxLabel, useGlass, iconColors, t, capturingIndex,
  onEditGroup, onTogglePaid, onSendWhatsApp, onShareInfographic, getContactIndex,
}: ContactGroupSectionProps) {
  const tintBg = GROUP_TINTS_BG[groupIndex % GROUP_TINTS_BG.length];

  let groupTotal = 0;
  let groupTax = 0;
  let groupTip = 0;
  for (const member of members) {
    const memberShare = shareDataMap.get(String(member.contactId));
    if (memberShare) { groupTotal += memberShare.total; groupTax += memberShare.tax; groupTip += memberShare.tip; }
  }

  return (
    <View className={cn('-mx-7 mb-4 px-7 py-4', tintBg)}>
      <View className="mb-3 flex-row items-center gap-2">
        <Pressable
          onPress={() => onEditGroup(group.id, new Set(members.map((member) => String(member.contactId))))}
          accessibilityRole="button"
          accessibilityLabel={`Edit group ${group.name}`}
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

      {members.map((member, memberIndex) => {
        const memberShareData = shareDataMap.get(String(member.contactId));
        if (!memberShareData) return null;
        return (
          <View key={String(member.contactId)} className={cn(memberIndex < members.length - 1 && 'mb-4')}>
            <ContactRow
              contact={member}
              contactIndex={getContactIndex(member)}
              shareData={memberShareData}
              isEqualSplit={isEqualSplit}
              billCountry={billCountry}
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
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t.bill_total}</Text>
          <Text className="text-xl font-bold tabular-nums text-foreground">
            {formatCurrency(groupTotal, billCountry)}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default React.memo(ContactGroupSection);
