import { useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ICON_COLORS } from '@/constants/colors';
import { useThemeStore, type ThemeMode } from '@/stores/useThemeStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useAuth } from '@/lib/AuthContext';

type Language = 'en' | 'es';

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </Text>
      <View className="overflow-hidden rounded-2xl border border-border bg-card">
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
      className={`flex-row items-center gap-3 px-4 py-3.5 ${!last ? 'border-b border-border' : ''} ${onPress ? 'active:bg-muted' : ''}`}
    >
      <View className="h-8 w-8 items-center justify-center rounded-lg bg-muted">
        <IconSymbol name={icon} size={18} color={iconColor} />
      </View>
      <Text className="flex-1 text-base text-foreground">{label}</Text>
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
    <View className="flex-row rounded-lg bg-muted p-0.5">
      {options.map((opt) => (
        <Pressable
          key={opt.value}
          onPress={() => onChange(opt.value)}
          className={`rounded-md px-3 py-1.5 ${
            value === opt.value
              ? 'bg-card shadow-sm shadow-black/10'
              : ''
          }`}
        >
          <Text
            className={`text-xs font-medium ${
              value === opt.value
                ? 'text-foreground'
                : 'text-muted-foreground'
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
  const { extractPhotoTime, useLocation, setExtractPhotoTime, setUseLocation } = useSettingsStore();
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
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="px-5 pb-2 pt-4">
        <Text className="text-3xl font-extrabold tracking-tight text-foreground">
          Settings
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerClassName="gap-6 pb-12 pt-4"
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View className="items-center gap-3 rounded-2xl border border-border bg-card px-6 py-6">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <Text className="text-3xl font-bold text-primary">
              {user?.firstName?.[0] ?? user?.email?.[0]?.toUpperCase() ?? '?'}
              {user?.lastName?.[0] ?? ''}
            </Text>
          </View>
          <View className="items-center gap-0.5">
            <Text className="text-lg font-semibold text-foreground">
              {user?.firstName && user?.lastName
                ? `${user.firstName} ${user.lastName}`
                : user?.email ?? 'User'}
            </Text>
            <Text className="text-sm text-muted-foreground">
              {user?.email ?? ''}
            </Text>
          </View>
        </View>

        {/* Pro Upsell */}
        <Pressable className="overflow-hidden rounded-2xl border border-pro/30 bg-pro-bg active:scale-[0.98]">
          <View className="flex-row items-center gap-4 p-5">
            <View className="h-12 w-12 items-center justify-center rounded-xl bg-pro/10">
              <IconSymbol name="crown.fill" size={24} color={colorScheme === 'dark' ? '#f59e0b' : '#d97706'} />
            </View>
            <View className="flex-1 gap-1">
              <Text className="text-base font-bold text-foreground">Upgrade to Pro</Text>
              <Text className="text-sm text-muted-foreground">
                Unlimited bills, item splits & more
              </Text>
            </View>
            <View className="rounded-full bg-pro px-3 py-1.5">
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

        {/* Scanning */}
        <SettingsSection title="Scanning">
          <SettingsRow icon="clock.fill" iconColor="#6366f1" label="Auto-extract time">
            <Switch
              value={extractPhotoTime}
              onValueChange={setExtractPhotoTime}
              trackColor={{ false: '#263354', true: '#38bdf8' }}
              thumbColor="#fff"
            />
          </SettingsRow>
          <SettingsRow icon="location.fill" iconColor="#10b981" label="Capture location" last>
            <Switch
              value={useLocation}
              onValueChange={setUseLocation}
              trackColor={{ false: '#263354', true: '#38bdf8' }}
              thumbColor="#fff"
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
          <Text className="text-xs text-muted-foreground">Rondas v0.1.0</Text>
          <Text className="text-xs text-muted-foreground">Made with love in Colombia</Text>
        </View>
      </ScrollView>
    </View>
  );
}
