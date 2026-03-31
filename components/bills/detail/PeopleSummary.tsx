import React, { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Image } from '@/lib/expo-image';
import * as Haptics from 'expo-haptics';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import { computeContactTotal } from '@/lib/billSplit';
import type { TaxConfig } from '@/constants/taxes';
import type { Id } from '@/convex/_generated/dataModel';
import type { Translations } from '@/lib/i18n';

interface ResolvedContact {
  contactId: Id<'contacts'>;
  name: string;
  phone?: string;
  imageUri?: string;
  items: string[];
  amount: number;
  paid: boolean;
}

interface BillItem {
  id?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface PeopleSummaryProps {
  contacts: ResolvedContact[];
  billItems: BillItem[];
  billCountry: string;
  taxConfig: TaxConfig;
  tipPercent: number;
  iconColors: Record<string, string>;
  t: Translations;
  onTogglePaid: (contactId: Id<'contacts'>) => void;
}

function PeopleSummary({
  contacts,
  billItems,
  billCountry,
  taxConfig,
  tipPercent,
  iconColors,
  t,
  onTogglePaid,
}: PeopleSummaryProps) {
  const paidCount = contacts.filter((c) => c.paid).length;
  const allPaid = paidCount === contacts.length;

  const contactTotals = useMemo(() => {
    return contacts.map((c) => ({
      ...c,
      total: computeContactTotal(c, billItems, contacts, taxConfig, tipPercent),
    }));
  }, [contacts, billItems, taxConfig, tipPercent]);

  const handleToggle = (contactId: Id<'contacts'>) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onTogglePaid(contactId);
  };

  return (
    <View className="mt-3">
      {/* Section header */}
      <View className="mb-2 flex-row items-center justify-between px-7">
        <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t.people_title}
        </Text>
        <View
          className={cn(
            'rounded-full px-2 py-0.5',
            allPaid ? 'bg-emerald-500/15' : 'bg-amber-500/15',
          )}
        >
          <Text
            className={cn(
              'text-[11px] font-semibold',
              allPaid ? 'text-emerald-500' : 'text-amber-500',
            )}
          >
            {t.people_paidCount(paidCount, contacts.length)}
          </Text>
        </View>
      </View>

      {/* Horizontal scroll of person pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 px-7 pb-2"
      >
        {contactTotals.map((c) => (
          <Pressable
            key={String(c.contactId)}
            onPress={() => handleToggle(c.contactId)}
            className={cn(
              'min-w-[140px] rounded-xl border-l-[3px] bg-card px-3.5 py-2 active:opacity-80',
              c.paid ? 'border-l-emerald-500' : 'border-l-amber-500',
            )}
          >
            {/* Row 1: Avatar + Name + Paid icon */}
            <View className="flex-row items-center gap-2">
              {c.imageUri ? (
                <Image source={{ uri: c.imageUri }} className="h-6 w-6 rounded-full" />
              ) : (
                <View className="h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                  <Text className="text-[10px] font-bold text-primary">
                    {(c.name[0] ?? '?').toUpperCase()}
                  </Text>
                </View>
              )}
              <Text className="flex-1 text-xs font-semibold text-foreground" numberOfLines={1}>
                {c.name}
              </Text>
              <IconSymbol
                name={c.paid ? 'checkmark.circle.fill' : 'circle'}
                size={16}
                color={c.paid ? '#10b981' : iconColors.mutedLight}
              />
            </View>
            {/* Row 2: Amount · Item count */}
            <View className="mt-1 flex-row items-center gap-1">
              <Text className="text-xs font-bold tabular-nums text-foreground">
                {formatCurrency(c.total, billCountry)}
              </Text>
              <Text className="text-[11px] text-muted-foreground">·</Text>
              <Text className="text-[11px] text-muted-foreground">
                {t.people_items(c.items.length)}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export default React.memo(PeopleSummary);
