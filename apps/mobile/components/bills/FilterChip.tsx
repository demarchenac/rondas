import React, { type ReactNode, useCallback } from 'react';
import { Pressable, View } from 'react-native';
import { cva } from 'class-variance-authority';
import * as Haptics from 'expo-haptics';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { cn } from '@/lib/cn';

const filterChipVariants = cva('flex-row items-center gap-1.5 rounded-full px-3.5 py-1.5', {
  variants: {
    active: {
      true: 'bg-primary',
      false: 'border border-border bg-card',
    },
  },
  defaultVariants: { active: false },
});

const filterChipTextVariants = cva('text-xs font-semibold', {
  variants: {
    active: {
      true: 'text-primary-foreground',
      false: 'text-muted-foreground',
    },
  },
  defaultVariants: { active: false },
});

export interface FilterChipProps {
  label: string;
  count?: number;
  isActive: boolean;
  onPress: () => void;
  onDismiss?: () => void;
  icon?: ReactNode;
}

function FilterChip({ label, isActive, onPress, count, onDismiss, icon }: FilterChipProps) {
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  const handleDismiss = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDismiss?.();
  }, [onDismiss]);

  return (
    <Pressable
      onPress={handlePress}
      className={filterChipVariants({ active: isActive })}
    >
      {icon}
      <Text className={filterChipTextVariants({ active: isActive })}>
        {label}
      </Text>
      {count !== undefined && count > 0 && (
        <View
          className={cn(
            'min-w-[16px] h-4 rounded-full items-center justify-center px-1',
            isActive ? 'bg-white/25' : 'bg-muted-foreground/20',
          )}
        >
          <Text
            className={cn(
              'text-[9px] font-bold',
              isActive ? 'text-white' : 'text-muted-foreground',
            )}
          >
            {count}
          </Text>
        </View>
      )}
      {onDismiss && (
        <Pressable onPress={handleDismiss} hitSlop={6}>
          <IconSymbol
            name="xmark"
            size={10}
            color={isActive ? 'rgba(255,255,255,0.7)' : 'rgba(128,128,128,0.7)'}
          />
        </Pressable>
      )}
    </Pressable>
  );
}

export default React.memo(FilterChip);
