import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ICON_COLORS } from '@/constants/colors';
import { cn } from '@/lib/cn';

const SettingsRow = React.memo(function SettingsRow({
  icon,
  iconColor,
  label,
  info,
  children,
  onPress,
  last = false,
}: {
  icon: React.ComponentProps<typeof IconSymbol>['name'];
  iconColor: string;
  label: string;
  info?: string;
  children?: React.ReactNode;
  onPress?: () => void;
  last?: boolean;
}) {
  const [showInfo, setShowInfo] = useState(false);
  const { colorScheme } = useColorScheme();
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];
  const Wrapper = onPress ? Pressable : View;

  return (
    <View className={cn(!last && 'border-b border-border')}>
      <Wrapper
        onPress={onPress}
        className={cn('flex-row items-center gap-3 px-4 py-3.5', onPress && 'active:bg-muted')}
      >
        <View className="h-8 w-8 items-center justify-center rounded-lg bg-muted">
          <IconSymbol name={icon} size={18} color={iconColor} />
        </View>
        <Text className="flex-1 text-base text-foreground">{label}</Text>
        {info && (
          <Pressable
            onPress={() => setShowInfo((v) => !v)}
            hitSlop={8}
            className="mr-1"
          >
            <IconSymbol
              name="info.circle"
              size={18}
              color={showInfo ? iconColors.primary : iconColors.mutedLight}
            />
          </Pressable>
        )}
        {children}
      </Wrapper>
      {info && showInfo && (
        <View className="px-4 pb-3 pt-0">
          <Text className="text-xs leading-5 text-muted-foreground">
            {info}
          </Text>
        </View>
      )}
    </View>
  );
});

export default SettingsRow;
