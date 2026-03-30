import { View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ICON_COLORS } from '@/constants/colors';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useT } from '@/lib/i18n';

export default function OfflineBanner() {
  const isConnected = useNetworkStatus();
  const t = useT();
  const { colorScheme } = useColorScheme();
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];

  if (isConnected) return null;

  return (
    <View className="flex-row items-center justify-center gap-2 bg-destructive/15 px-4 py-2">
      <IconSymbol name="wifi.slash" size={14} color={iconColors.destructive} />
      <Text className="text-xs font-medium text-destructive">{t.offline_banner}</Text>
    </View>
  );
}
