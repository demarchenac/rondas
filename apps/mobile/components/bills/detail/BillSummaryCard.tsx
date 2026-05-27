import React from 'react';
import { Pressable, Switch, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { formatCurrency } from '@/lib/format';
import type { TaxConfig } from '@/constants/taxes';
import type { Translations } from '@/lib/i18n';

interface BillSummaryCardProps {
  base: number;
  computedTax: number;
  beforeTip: number;
  tipPercent: number;
  useCustomTip: boolean;
  computedTip: number;
  total: number;
  billCountry: string;
  translatedTaxLabel: string;
  taxConfig: TaxConfig;
  iconColors: Record<string, string>;
  t: Translations;
  showTaxToggle?: boolean;
  taxIncluded?: boolean;
  onToggleTaxIncluded?: () => void;
  decimalPlaces?: number;
  onTipPress: () => void;
}

function BillSummaryCard({
  base,
  computedTax,
  beforeTip,
  tipPercent,
  useCustomTip,
  computedTip,
  total,
  billCountry,
  translatedTaxLabel,
  taxConfig,
  iconColors,
  t,
  showTaxToggle,
  taxIncluded,
  decimalPlaces,
  onToggleTaxIncluded,
  onTipPress,
}: BillSummaryCardProps) {

  return (
    <View className="mx-7 mt-4 overflow-hidden rounded-xl bg-card">
      {/* Subtotal */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <Text className="text-base text-muted-foreground">{t.bill_subtotal}</Text>
        <Text className="text-base font-semibold tabular-nums text-foreground">
          {formatCurrency(base, billCountry, decimalPlaces)}
        </Text>
      </View>
      <View className="mx-4 h-px bg-border/30" />

      {/* Tax */}
      <View className="px-4 py-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-base text-muted-foreground">{translatedTaxLabel}</Text>
              {showTaxToggle && (
                <Switch
                  value={taxIncluded ?? true}
                  onValueChange={() => onToggleTaxIncluded?.()}
                  style={{ transform: [{ scale: 0.7 }] }}
                  trackColor={{ false: '#263354', true: '#38bdf8' }}
                  thumbColor="#fff"
                />
              )}
            </View>
            {showTaxToggle && (
              <Text className="mt-0.5 text-sm text-muted-foreground">
                {taxIncluded ? t.settings_taxIncludedHint : t.settings_taxSeparateHint}
              </Text>
            )}
          </View>
          <Text className="text-base font-semibold tabular-nums text-muted-foreground">
            {formatCurrency(computedTax, billCountry, decimalPlaces)}
          </Text>
        </View>
      </View>
      <View className="mx-4 h-px bg-border/30" />

      {/* Before tip */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <Text className="text-base font-semibold text-foreground">{t.bill_beforeTip}</Text>
        <Text className="text-base font-semibold tabular-nums text-foreground">
          {formatCurrency(beforeTip, billCountry, decimalPlaces)}
        </Text>
      </View>
      <View className="mx-4 h-px bg-border/30" />

      {/* Tip */}
      <Pressable
        className="flex-row items-center justify-between px-4 py-3 active:bg-muted/30"
        onPress={onTipPress}
      >
        <View className="flex-row items-center gap-1">
          <Text className="text-base text-foreground">
            {useCustomTip ? t.bill_tipCustom : t.bill_tip(tipPercent)}
          </Text>
          <IconSymbol name="chevron.right" size={12} color={iconColors.mutedLight} />
        </View>
        <Text className="text-base font-semibold tabular-nums text-foreground">
          {formatCurrency(computedTip, billCountry, decimalPlaces)}
        </Text>
      </Pressable>

      {/* Total — highlighted row */}
      <View className="h-px bg-border/50" />
      <View className="flex-row items-center justify-between bg-primary/5 px-4 py-4">
        <Text className="text-base font-bold text-foreground">{t.bill_total}</Text>
        <Text className="text-3xl font-extrabold tracking-tight text-primary">
          {formatCurrency(total, billCountry, decimalPlaces)}
        </Text>
      </View>
    </View>
  );
}

export default React.memo(BillSummaryCard);
