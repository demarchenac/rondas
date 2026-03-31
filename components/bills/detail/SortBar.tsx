import React, { useCallback } from 'react';
import { ScrollView, View } from 'react-native';
import FilterChip from '@/components/bills/FilterChip';
import type { Translations } from '@/lib/i18n';

type SortStrategy = 'original' | 'price-asc' | 'price-desc' | 'alpha-asc' | 'alpha-desc';

interface SortBarProps {
  sortStrategy: SortStrategy;
  onSortChange: (strategy: SortStrategy) => void;
  multiSelectMode: boolean;
  selectedCount: number;
  onToggleMultiSelect: () => void;
  t: Translations;
}

function SortBar({
  sortStrategy,
  onSortChange,
  multiSelectMode,
  selectedCount,
  onToggleMultiSelect,
  t,
}: SortBarProps) {
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

  const bulkLabel = multiSelectMode
    ? (selectedCount > 0 ? `${t.bill_selected(selectedCount)}` : t.cancel)
    : t.bill_bulkEdit;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-1.5 px-7 pb-2"
    >
      <FilterChip
        label={t.sort_receipt as string}
        isActive={sortStrategy === 'original'}
        onPress={() => onSortChange('original')}
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
      {/* Spacer */}
      <View className="w-px bg-border/30 mx-0.5 my-1" />
      {/* Bulk edit chip */}
      <FilterChip
        label={bulkLabel}
        isActive={multiSelectMode}
        onPress={onToggleMultiSelect}
      />
    </ScrollView>
  );
}

export default React.memo(SortBar);
