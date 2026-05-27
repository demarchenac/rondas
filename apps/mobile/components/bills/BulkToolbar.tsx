import React from 'react';
import { Platform, View, Pressable } from 'react-native';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
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

  const useGlass = Platform.OS === 'ios' && isGlassEffectAPIAvailable();

  if (selectedItemIds.size === 0) return null;

  return (
    <View style={{ backgroundColor: 'transparent', marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable onPress={onAssign} style={{ flex: 1, backgroundColor: 'transparent' }} className="active:opacity-80">
          {useGlass ? (
            <GlassView isInteractive tintColor={iconColors.primary + '0D'} style={{ borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
              <IconSymbol name="person.crop.circle" size={16} color={iconColors.primary} />
              <Text className="text-sm font-semibold text-primary">{t.bulk_assign}</Text>
            </GlassView>
          ) : (
            <View className="flex-row items-center justify-center gap-1.5 rounded-xl border border-primary/20 bg-primary/10 py-3">
              <IconSymbol name="person.crop.circle" size={16} color={iconColors.primary} />
              <Text className="text-sm font-semibold text-primary">{t.bulk_assign}</Text>
            </View>
          )}
        </Pressable>

        {hasContactsOnSelection && (
          <Pressable onPress={onUnassign} style={{ flex: 1, backgroundColor: 'transparent' }} className="active:opacity-80">
            {useGlass ? (
              <GlassView isInteractive tintColor={iconColors.pro + '0D'} style={{ borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
                <IconSymbol name="person.crop.circle" size={16} color={iconColors.pro} />
                <Text className="text-sm font-semibold text-state-unresolved">{t.bulk_unassign}</Text>
              </GlassView>
            ) : (
              <View className="flex-row items-center justify-center gap-1.5 rounded-xl border border-state-unresolved/20 bg-state-unresolved/10 py-3">
                <IconSymbol name="person.crop.circle" size={16} color={iconColors.pro} />
                <Text className="text-sm font-semibold text-state-unresolved">{t.bulk_unassign}</Text>
              </View>
            )}
          </Pressable>
        )}

        <Pressable onPress={onDelete} style={{ flex: 1, backgroundColor: 'transparent' }} className="active:opacity-80">
          {useGlass ? (
            <GlassView isInteractive tintColor={iconColors.destructive + '0D'} style={{ borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
              <IconSymbol name="xmark" size={14} color={iconColors.destructive} />
              <Text className="text-sm font-semibold text-destructive">{t.bulk_delete}</Text>
            </GlassView>
          ) : (
            <View className="flex-row items-center justify-center gap-1.5 rounded-xl border border-destructive/20 bg-destructive/10 py-3">
              <IconSymbol name="xmark" size={14} color={iconColors.destructive} />
              <Text className="text-sm font-semibold text-destructive">{t.bulk_delete}</Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}

export default React.memo(BulkToolbar);
