import React, { useCallback } from 'react';
import { ScrollView, View , useColorScheme } from 'react-native';
import FilterChip from '@/components/bills/FilterChip';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ICON_COLORS } from '@/constants/colors';
import type { Translations } from '@/lib/i18n';
import type { SortStrategy } from '@/lib/types';

interface SortBarProps {
  sortStrategy: SortStrategy;
  onSortChange: (strategy: SortStrategy) => void;
  t: Translations;
}

function SortBar({
  sortStrategy,
  onSortChange,
  t,
}: SortBarProps) {
  const colorScheme = useColorScheme();
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];

  const handlePricePress = useCallback(() => {
    if (sortStrategy === 'price-desc') onSortChange('price-asc');
    else if (sortStrategy === 'price-asc') onSortChange('price-desc');
    else onSortChange('price-desc');
  }, [sortStrategy, onSortChange]);

  const handleAlphaPress = useCallback(() => {
    if (sortStrategy === 'alpha-asc') onSortChange('alpha-desc');
    else if (sortStrategy === 'alpha-desc') onSortChange('alpha-asc');
    else onSortChange('alpha-asc');
  }, [sortStrategy, onSortChange]);

  const priceLabel = sortStrategy === 'price-asc' ? t.sort_priceAsc : t.sort_priceDesc;
  const alphaLabel = sortStrategy === 'alpha-desc' ? t.sort_alphaDesc : t.sort_alphaAsc;
  const isPrice = sortStrategy === 'price-asc' || sortStrategy === 'price-desc';
  const isAlpha = sortStrategy === 'alpha-asc' || sortStrategy === 'alpha-desc';
  const isOriginal = sortStrategy === 'original';

  return (
    <View className="flex-row items-center pb-2">
      {/* Sort chips — scrollable */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-1.5 pl-7"
        className="flex-1"
      >
        <FilterChip
          label={t.sort_receipt as string}
          isActive={isOriginal}
          onPress={() => onSortChange('original')}
          icon={
            <IconSymbol
              name="receipt"
              size={12}
              color={isOriginal ? iconColors.primaryForeground : iconColors.muted}
            />
          }
        />
        <FilterChip
          label={priceLabel as string}
          isActive={isPrice}
          onPress={handlePricePress}
        />
        <FilterChip
          label={alphaLabel as string}
          isActive={isAlpha}
          onPress={handleAlphaPress}
        />
      </ScrollView>
    </View>
  );
}

export default React.memo(SortBar);
