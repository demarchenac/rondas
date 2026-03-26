import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ICON_COLORS } from '@/constants/colors';
import { useThemeStore, type ThemeMode } from '@/stores/useThemeStore';
import { useAuth } from '@/lib/AuthContext';

type Language = 'en' | 'es';

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground dark:text-dark-muted-fg">
        {title}
      </Text>
      <View className="overflow-hidden rounded-2xl border border-border bg-card dark:border-dark-border dark:bg-dark-card">
        {children}
      </View>
    </View>
  );
}

function SettingsRow({
  icon,
  iconColor,
  label,
  children,
  onPress,
  last = false,
}: {
  icon: React.ComponentProps<typeof IconSymbol>['name'];
  iconColor: string;
  label: string;
  children?: React.ReactNode;
  onPress?: () => void;
  last?: boolean;
}) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper
      onPress={onPress}
      className={`flex-row items-center gap-3 px-4 py-3.5 ${!last ? 'border-b border-border dark:border-dark-border' : ''} ${onPress ? 'active:bg-muted dark:active:bg-dark-muted' : ''}`}
    >
      <View className="h-8 w-8 items-center justify-center rounded-lg bg-muted dark:bg-dark-muted">
        <IconSymbol name={icon} size={18} color={iconColor} />
      </View>
      <Text className="flex-1 text-base text-foreground dark:text-dark-fg">{label}</Text>
      {children}
    </Wrapper>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View className="flex-row rounded-lg bg-muted p-0.5 dark:bg-dark-muted">
      {options.map((opt) => (
        <Pressable
          key={opt.value}
          onPress={() => onChange(opt.value)}
          className={`rounded-md px-3 py-1.5 ${
            value === opt.value
              ? 'bg-card shadow-sm shadow-black/10 dark:bg-dark-border'
              : ''
          }`}
        >
          <Text
            className={`text-xs font-medium ${
              value === opt.value
                ? 'text-foreground dark:text-dark-fg'
                : 'text-muted-foreground dark:text-dark-muted-fg'
            }`}
          >
            {opt.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { colorScheme, setColorScheme } = useColorScheme();
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];
  const { mode, setMode } = useThemeStore();
  const { user, signOut } = useAuth();
  const [language, setLanguage] = useState<Language>('en');

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await signOut();
        },
      },
    ]);
  };

  const handleThemeChange = (newMode: ThemeMode) => {
    setMode(newMode);
    setColorScheme(newMode === 'system' ? undefined : newMode);
  };

  return (
    <View className="flex-1 bg-background dark:bg-dark-bg" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="px-5 pb-2 pt-4">
        <Text className="text-3xl font-extrabold tracking-tight text-foreground dark:text-dark-fg">
          Settings
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerClassName="gap-6 pb-12 pt-4"
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View className="items-center gap-3 rounded-2xl border border-border bg-card px-6 py-6 dark:border-dark-border dark:bg-dark-card">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-primary/10 dark:bg-dark-primary/15">
            <Text className="text-3xl font-bold text-primary dark:text-dark-primary">
              {user?.firstName?.[0] ?? user?.email?.[0]?.toUpperCase() ?? '?'}
              {user?.lastName?.[0] ?? ''}
            </Text>
          </View>
          <View className="items-center gap-0.5">
            <Text className="text-lg font-semibold text-foreground dark:text-dark-fg">
              {user?.firstName && user?.lastName
                ? `${user.firstName} ${user.lastName}`
                : user?.email ?? 'User'}
            </Text>
            <Text className="text-sm text-muted-foreground dark:text-dark-muted-fg">
              {user?.email ?? ''}
            </Text>
          </View>
        </View>

        {/* Pro Upsell */}
        <Pressable className="overflow-hidden rounded-2xl border border-pro/30 bg-pro-bg active:scale-[0.98] dark:border-dark-pro/25 dark:bg-dark-pro-bg">
          <View className="flex-row items-center gap-4 p-5">
            <View className="h-12 w-12 items-center justify-center rounded-xl bg-pro/10 dark:bg-dark-pro/15">
              <IconSymbol name="crown.fill" size={24} color={colorScheme === 'dark' ? '#f59e0b' : '#d97706'} />
            </View>
            <View className="flex-1 gap-1">
              <Text className="text-base font-bold text-foreground dark:text-dark-fg">Upgrade to Pro</Text>
              <Text className="text-sm text-muted-foreground dark:text-dark-muted-fg">
                Unlimited bills, item splits & more
              </Text>
            </View>
            <View className="rounded-full bg-pro px-3 py-1.5 dark:bg-dark-pro">
              <Text className="text-xs font-bold text-white">$1.99/mo</Text>
            </View>
          </View>
        </Pressable>

        {/* Preferences */}
        <SettingsSection title="Preferences">
          <SettingsRow icon="sun.max.fill" iconColor="#f59e0b" label="Theme">
            <SegmentedControl
              options={[
                { label: 'Light', value: 'light' as ThemeMode },
                { label: 'Dark', value: 'dark' as ThemeMode },
                { label: 'Auto', value: 'system' as ThemeMode },
              ]}
              value={mode}
              onChange={handleThemeChange}
            />
          </SettingsRow>
          <SettingsRow icon="globe" iconColor={iconColors.primary} label="Language" last>
            <SegmentedControl
              options={[
                { label: 'English', value: 'en' as Language },
                { label: 'Español', value: 'es' as Language },
              ]}
              value={language}
              onChange={setLanguage}
            />
          </SettingsRow>
        </SettingsSection>

        {/* Account */}
        <SettingsSection title="Account">
          <SettingsRow
            icon="rectangle.portrait.and.arrow.right"
            iconColor="#ef4444"
            label="Sign Out"
            onPress={handleSignOut}
            last
          >
            <IconSymbol name="chevron.right" size={16} color={iconColors.mutedLight} />
          </SettingsRow>
        </SettingsSection>

        {/* Footer */}
        <View className="items-center gap-1 pt-4">
          <Text className="text-xs text-muted-foreground dark:text-dark-muted-fg">Rondas v0.1.0</Text>
          <Text className="text-xs text-muted-foreground dark:text-dark-muted-fg">Made with love in Colombia</Text>
        </View>
      </ScrollView>
    </View>
  );
}
