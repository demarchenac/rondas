import { Tabs } from 'expo-router';
import { useColorScheme } from 'nativewind';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { TAB_COLORS } from '@/constants/colors';
import { useT } from '@/lib/i18n';

export default function TabLayout() {
  const { colorScheme } = useColorScheme();
  const colors = TAB_COLORS[colorScheme ?? 'light'];
  const t = useT();

  return (
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
  );
}
