import React from 'react';
import { Pressable, Switch, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { formatCurrency } from '@/lib/format';
import { useBufferedInput } from '@/hooks/useBufferedInput';
import CurrencyInput from '@/components/form/CurrencyInput';
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
  onTipPress: () => void;
  onUpdateTax: (value: string) => void;
  onUpdateCustomTip: (tip: number) => void;
  onToggleCustomTip: (enabled: boolean) => void;
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
  onTipPress,
  onUpdateTax,
  onUpdateCustomTip,
  onToggleCustomTip,
}: BillSummaryCardProps) {
  const taxInput = useBufferedInput(String(computedTax), (v) => onUpdateTax(v));
  const tipInput = useBufferedInput(String(computedTip), (v) => onUpdateCustomTip(Number(v) || 0));

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
          <CurrencyInput
            value={Number(taxInput.value) || 0}
            onChangeValue={(n) => taxInput.onChangeText(String(n))}
            onFocus={taxInput.onFocus}
            onBlur={taxInput.onBlur}
            country={billCountry}
            className="h-auto w-32 border-0 bg-transparent px-0 py-0 text-right text-sm font-semibold tabular-nums shadow-none"
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

      {/* Tip — percentage selector or custom input */}
      {useCustomTip ? (
        <View className="px-4 py-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Text className="text-sm text-foreground">{t.bill_customTip}</Text>
              <Switch
                value={true}
                onValueChange={(v) => onToggleCustomTip(v)}
                trackColor={{ true: iconColors.primary }}
                style={{ transform: [{ scale: 0.8 }] }}
              />
            </View>
            <CurrencyInput
              value={Number(tipInput.value) || 0}
              onChangeValue={(n) => tipInput.onChangeText(String(n))}
              onFocus={tipInput.onFocus}
              onBlur={tipInput.onBlur}
              country={billCountry}
              className="h-auto w-32 border-0 bg-transparent px-0 py-0 text-right text-sm font-semibold tabular-nums shadow-none"
            />
          </View>
        </View>
      ) : (
        <View className="px-4 py-3">
          <View className="flex-row items-center justify-between">
            <Pressable
              className="flex-row items-center gap-1 active:opacity-70"
              onPress={onTipPress}
            >
              <Text className="text-sm text-foreground">{t.bill_tip(tipPercent)}</Text>
              <IconSymbol name="chevron.right" size={12} color={iconColors.mutedLight} />
            </Pressable>
            <View className="flex-row items-center gap-2">
              {computedTip > 0 && (
                <Text className="text-sm font-semibold tabular-nums text-foreground">
                  {formatCurrency(computedTip, billCountry)}
                </Text>
              )}
              <Switch
                value={false}
                onValueChange={(v) => onToggleCustomTip(v)}
                trackColor={{ true: iconColors.primary }}
                style={{ transform: [{ scale: 0.8 }] }}
              />
            </View>
          </View>
          {/* Show read-only custom value if bill has one from before */}
          {(computedTip === 0 && tipPercent === 0) ? null : null}
        </View>
      )}

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
