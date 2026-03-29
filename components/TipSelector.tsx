import React from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n';

const TIP_OPTIONS = [0, 5, 10, 15, 18, 20] as const;

interface TipSelectorProps {
  value: number;
  onSelect: (percent: number) => void;
}

export const TipSelector = React.memo(function TipSelector({ value, onSelect }: TipSelectorProps) {
  const t = useT();

  return (
    <View>
      <View className="flex-row items-center gap-3 mb-3">
        <View className="h-8 w-8 items-center justify-center rounded-lg bg-muted">
          <IconSymbol name="percent" size={18} color="#f59e0b" />
        </View>
        <Text className="text-base text-foreground">{t.settings_tipPercentage}</Text>
      </View>
      <View className="flex-row gap-2">
        {TIP_OPTIONS.map((pct) => (
          <Pressable
            key={pct}
            onPress={() => onSelect(pct)}
            className={cn(
              'flex-1 items-center rounded-[10px] border-[1.5px] py-2',
              value === pct
                ? 'bg-primary/15 border-primary/35'
                : 'bg-muted-foreground/[0.06] border-muted-foreground/12',
            )}
          >
            <Text
              className={cn(
                'text-[13px] font-bold',
                value === pct ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {pct}%
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
});
