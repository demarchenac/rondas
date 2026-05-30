import React from 'react';
import { Pressable, View } from 'react-native';
import { GlassView } from 'expo-glass-effect';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import type { Translations } from '@/lib/i18n';

export interface GroupConfirmToolbarProps {
  selectedCount: number;
  isEditing: boolean;
  useGlass: boolean;
  iconColors: Record<string, string>;
  t: Translations;
  onConfirm: () => void;
}

function GroupConfirmToolbar({ selectedCount, isEditing, useGlass, iconColors, t, onConfirm }: GroupConfirmToolbarProps) {
  const canGroup = selectedCount >= 2;
  const showUngroup = isEditing && !canGroup;

  const label = showUngroup ? t.people_ungroup : t.people_groupCount(selectedCount);

  return (
    <View className="px-7 pb-4">
      <Pressable
        onPress={onConfirm}
        disabled={!canGroup && !showUngroup}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{ backgroundColor: 'transparent' }}
      >
        {showUngroup ? (
          useGlass ? (
            <GlassView isInteractive tintColor={'#ef4444' + '1A'} style={{ borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' }}>
              <Text className="text-sm font-semibold text-destructive">{t.people_ungroup}</Text>
            </GlassView>
          ) : (
            <View className="items-center rounded-xl bg-destructive/10 py-3.5">
              <Text className="text-sm font-semibold text-destructive">{t.people_ungroup}</Text>
            </View>
          )
        ) : useGlass && canGroup ? (
          <GlassView isInteractive tintColor={iconColors.primary + '1A'} style={{ borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' }}>
            <Text className="text-sm font-semibold text-primary">{t.people_groupCount(selectedCount)}</Text>
          </GlassView>
        ) : (
          <View className={cn('items-center rounded-xl py-3.5', canGroup ? 'bg-primary' : 'bg-muted')}>
            <Text className={cn('text-sm font-semibold', canGroup ? 'text-primary-foreground' : 'text-muted-foreground')}>
              {t.people_groupCount(selectedCount)}
            </Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

export default React.memo(GroupConfirmToolbar);
