import React from 'react';
import { Pressable, View } from 'react-native';
import { GlassView } from 'expo-glass-effect';
import { Text } from '@/components/ui/text';
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

  let label: string;
  let tintColor: string;
  let textClass: string;
  let bgClass: string;

  if (showUngroup) {
    label = t.people_ungroup;
    tintColor = '#ef44441A';
    textClass = 'text-sm font-semibold text-destructive';
    bgClass = 'items-center rounded-xl bg-destructive/10 py-3.5';
  } else if (canGroup) {
    label = t.people_groupCount(selectedCount);
    tintColor = iconColors.primary + '1A';
    textClass = 'text-sm font-semibold text-primary-foreground';
    bgClass = 'items-center rounded-xl bg-primary py-3.5';
  } else {
    label = t.people_groupCount(selectedCount);
    tintColor = '';
    textClass = 'text-sm font-semibold text-muted-foreground';
    bgClass = 'items-center rounded-xl bg-muted py-3.5';
  }

  const showGlass = useGlass && (showUngroup || canGroup);

  return (
    <View className="px-7 pb-4">
      <Pressable
        onPress={onConfirm}
        disabled={!canGroup && !showUngroup}
        role="button"
        accessibilityLabel={label}
        style={{ backgroundColor: 'transparent' }}
      >
        {showGlass ? (
          <GlassView isInteractive tintColor={tintColor} style={{ borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' }}>
            <Text className={textClass}>{label}</Text>
          </GlassView>
        ) : (
          <View className={bgClass}>
            <Text className={textClass}>{label}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

export default React.memo(GroupConfirmToolbar);
