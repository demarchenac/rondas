import React from 'react';
import { ScrollView } from 'react-native';
import FilterChip from '@/components/bills/FilterChip';
import type { Translations } from '@/lib/i18n';

type SortStrategy = 'original' | 'price-asc' | 'price-desc' | 'alpha-asc' | 'alpha-desc';

interface SortBarProps {
  sortStrategy: SortStrategy;
  onSortChange: (strategy: SortStrategy) => void;
  t: Translations;
}

const SORT_OPTIONS: { key: SortStrategy; labelKey: keyof Translations }[] = [
  { key: 'original', labelKey: 'sort_receipt' },
  { key: 'price-desc', labelKey: 'sort_priceDesc' },
  { key: 'price-asc', labelKey: 'sort_priceAsc' },
  { key: 'alpha-asc', labelKey: 'sort_alphaAsc' },
  { key: 'alpha-desc', labelKey: 'sort_alphaDesc' },
];

function SortBar({ sortStrategy, onSortChange, t }: SortBarProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-1.5 px-7 pb-2"
    >
      {SORT_OPTIONS.map((opt) => (
        <FilterChip
          key={opt.key}
          label={t[opt.labelKey] as string}
          isActive={sortStrategy === opt.key}
          onPress={() => onSortChange(opt.key)}
        />
      ))}
    </ScrollView>
  );
}

export default React.memo(SortBar);
