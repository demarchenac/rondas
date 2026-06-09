import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { formatCurrency, parseCurrency } from '@/lib/format';
import type { IconPalette } from '@/constants/colors';
import type { Translations } from '@/lib/i18n';

interface ReviewSummaryProps {
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  billTotal: number;
  country: string;
  iconColors: IconPalette;
  t: Translations;
  onTaxChange: (value: number) => void;
  onTipChange: (value: number) => void;
}

function ReviewSummary({
  subtotal,
  tax,
  tip,
  total,
  billTotal,
  country,
  iconColors,
  t,
  onTaxChange,
  onTipChange,
}: ReviewSummaryProps) {
  return (
    <>
      <View className="mx-7 h-px bg-border/40" />

      <View className="flex-row items-center justify-between px-7 py-3">
        <Text className="text-base text-muted-foreground">{t.scan_subtotal}</Text>
        <Text className="text-base font-semibold tabular-nums text-foreground">
          {formatCurrency(subtotal, country)}
        </Text>
      </View>

      <View className="flex-row items-center justify-between px-7 py-3">
        <Text className="text-base text-foreground">{t.scan_taxIva}</Text>
        <Input
          value={formatCurrency(tax, country)}
          onChangeText={(text) => onTaxChange(parseCurrency(text, country))}
          className="h-auto w-32 border-0 bg-transparent px-0 py-0 text-right text-base font-semibold tabular-nums shadow-none"
          keyboardType="number-pad"
        />
      </View>

      <View className="flex-row items-center justify-between px-7 py-3">
        <Text className="text-base text-foreground">{t.scan_tipPropina}</Text>
        <Input
          value={tip === 0 ? '' : formatCurrency(tip, country)}
          onChangeText={(text) => onTipChange(parseCurrency(text, country))}
          className="h-auto w-32 border-0 bg-transparent px-0 py-0 text-right text-base font-semibold tabular-nums shadow-none"
          placeholder="$0"
          placeholderTextColor={iconColors.mutedLight}
          keyboardType="number-pad"
        />
      </View>

      <View className="mx-7 h-px bg-border/40" />
      <View className="flex-row items-center justify-between px-7 py-4">
        <View>
          <Text className="text-base font-bold text-foreground">{t.scan_total}</Text>
          {billTotal > 0 && billTotal !== total && (
            <Text className="mt-0.5 text-sm text-muted-foreground">
              Bill: {formatCurrency(billTotal, country)}
            </Text>
          )}
        </View>
        <Text className="text-3xl font-extrabold tracking-tight text-primary">
          {formatCurrency(total, country)}
        </Text>
      </View>
    </>
  );
}

export default React.memo(ReviewSummary);
