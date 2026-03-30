import { View } from 'react-native';
import { Tabs, useSegments } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { TAB_COLORS } from '@/constants/colors';
import { useT } from '@/lib/i18n';
import FAB from '@/components/bills/FAB';

export default function TabLayout() {
  const { colorScheme } = useColorScheme();
  const colors = TAB_COLORS[colorScheme ?? 'light'];
  const t = useT();
  const insets = useSafeAreaInsets();
  const segments = useSegments();

  // Only show FAB on home tab
  const isHomeTab = segments[1] === undefined || (segments[1] as string) === 'index';

  return (
    <View className="flex-1">
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.active,
          tabBarInactiveTintColor: colors.inactive,
          tabBarStyle: {
            borderTopColor: colors.border,
            backgroundColor: colors.background,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t.tabs_home,
            tabBarIcon: ({ color }) => <IconSymbol size={24} name="house.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: t.tabs_settings,
            tabBarIcon: ({ color }) => <IconSymbol size={24} name="gearshape.fill" color={color} />,
          }}
        />
      </Tabs>

      {/* FAB — centered on tab bar top border */}
      {isHomeTab && <FAB bottom={49 + insets.bottom - 28} />}
    </View>
  );
}
