import React from 'react';
import { View, Pressable } from 'react-native';
import { useColorScheme } from 'nativewind';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ICON_COLORS } from '@/constants/colors';
import { useT } from '@/lib/i18n';

interface BulkToolbarProps {
  selectedItemIds: Set<string>;
  hasContactsOnSelection: boolean;
  onAssign: () => void;
  onUnassign: () => void;
  onDelete: () => void;
}

function BulkToolbar({ selectedItemIds, hasContactsOnSelection, onAssign, onUnassign, onDelete }: BulkToolbarProps) {
  const t = useT();
  const { colorScheme } = useColorScheme();
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];

  if (selectedItemIds.size === 0) return null;

  return (
    <View className="border-t border-border/30 px-7 pb-2 pt-3">
      <View className="flex-row gap-2">
        {/* Assign contact */}
        <Pressable
          onPress={onAssign}
          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-primary/20 bg-primary/10 py-3"
        >
          <IconSymbol name="person.crop.circle" size={16} color={iconColors.primary} />
          <Text className="text-xs font-semibold text-primary">{t.bulk_assign}</Text>
        </Pressable>

        {/* Remove contact — only if any selected item has contacts */}
        {hasContactsOnSelection && (
          <Pressable
            onPress={onUnassign}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-state-unresolved/20 bg-state-unresolved/10 py-3"
          >
            <IconSymbol name="person.crop.circle" size={16} color={iconColors.pro} />
            <Text className="text-xs font-semibold text-state-unresolved">{t.bulk_unassign}</Text>
          </Pressable>
        )}

        {/* Delete items */}
        <Pressable
          onPress={onDelete}
          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-destructive/20 bg-destructive/10 py-3"
        >
          <IconSymbol name="xmark" size={14} color={iconColors.destructive} />
          <Text className="text-xs font-semibold text-destructive">{t.bulk_delete}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default BulkToolbar;
