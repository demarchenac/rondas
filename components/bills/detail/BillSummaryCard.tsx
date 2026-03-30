import React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { formatCurrency } from '@/lib/format';
import type { TaxConfig } from '@/constants/taxes';
import type { Translations } from '@/lib/i18n';

interface BillSummaryCardProps {
  base: number;
  computedTax: number;
  beforeTip: number;
  tipPercent: number;
  computedTip: number;
  total: number;
  billCountry: string;
  translatedTaxLabel: string;
  taxConfig: TaxConfig;
  iconColors: Record<string, string>;
  t: Translations;
  onTipPress: () => void;
  onUpdateTax: (value: string) => void;
}

function BillSummaryCard({
  base,
  computedTax,
  beforeTip,
  tipPercent,
  computedTip,
  total,
  billCountry,
  translatedTaxLabel,
  taxConfig,
  iconColors,
  t,
  onTipPress,
  onUpdateTax,
}: BillSummaryCardProps) {
  return (
    <View className="mx-7 mt-4 overflow-hidden rounded-xl bg-card">
      {/* Subtotal */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <Text className="text-sm text-muted-foreground">{t.bill_subtotal}</Text>
        <Text className="text-sm font-semibold tabular-nums text-foreground">
          {formatCurrency(base, billCountry)}
        </Text>
      </View>
      <View className="mx-4 h-px bg-border/30" />

      {/* Tax */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <Text className="text-sm text-muted-foreground">{translatedTaxLabel}</Text>
        {taxConfig.taxIncluded ? (
          <Text className="text-sm font-semibold tabular-nums text-muted-foreground">
            {formatCurrency(computedTax, billCountry)}
          </Text>
        ) : (
          <Input
            value={formatCurrency(computedTax, billCountry)}
            onChangeText={onUpdateTax}
            className="h-auto w-32 border-0 bg-transparent px-0 py-0 text-right text-sm font-semibold tabular-nums shadow-none"
            keyboardType="number-pad"
          />
        )}
      </View>
      <View className="mx-4 h-px bg-border/30" />

      {/* Before tip */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <Text className="text-sm font-semibold text-foreground">{t.bill_beforeTip}</Text>
        <Text className="text-sm font-semibold tabular-nums text-foreground">
          {formatCurrency(beforeTip, billCountry)}
        </Text>
      </View>
      <View className="mx-4 h-px bg-border/30" />

      {/* Tip */}
      <Pressable
        className="flex-row items-center justify-between px-4 py-3 active:bg-muted/30"
        onPress={onTipPress}
      >
        <View className="flex-row items-center gap-1">
          <Text className="text-sm text-foreground">{t.bill_tip(tipPercent)}</Text>
          <IconSymbol name="chevron.right" size={12} color={iconColors.mutedLight} />
        </View>
        <Text className="text-sm font-semibold tabular-nums text-foreground">
          {formatCurrency(computedTip, billCountry)}
        </Text>
      </Pressable>

      {/* Total — highlighted row */}
      <View className="h-px bg-border/50" />
      <View className="flex-row items-center justify-between bg-primary/5 px-4 py-4">
        <Text className="text-sm font-bold text-foreground">{t.bill_total}</Text>
        <Text className="text-2xl font-extrabold tracking-tight text-primary">
          {formatCurrency(total, billCountry)}
        </Text>
      </View>
    </View>
  );
}

export default React.memo(BillSummaryCard);
