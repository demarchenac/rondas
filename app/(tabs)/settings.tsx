import { useCallback } from 'react';
import { Alert, Pressable, ScrollView, Switch, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useMutation } from 'convex/react';

import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SegmentedControl, SettingsRow, SettingsSection } from '@/components/settings';
import { TipSelector } from '@/components/TipSelector';
import { ICON_COLORS } from '@/constants/colors';
import { useThemeStore, type ThemeMode } from '@/stores/useThemeStore';
import { useSettingsStore, type Language } from '@/stores/useSettingsStore';
import { useAuth } from '@/lib/AuthContext';
import { useT } from '@/lib/i18n';
import { api } from '@/convex/_generated/api';
import { US_STATE_RATES, type Country } from '@/constants/taxes';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { colorScheme, setColorScheme } = useColorScheme();
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];
  const { mode, setMode } = useThemeStore();
  const {
    extractPhotoTime, useLocation, country, usState, defaultTipPercent, language,
    setExtractPhotoTime, setUseLocation, setCountry, setUsState, setDefaultTipPercent, setLanguage,
  } = useSettingsStore();
  const { user, signOut } = useAuth();
  const t = useT();
  const updateConfigMutation = useMutation(api.users.updateConfig);

  const syncConfig = useCallback(() => {
    if (!user) return;
    const s = useSettingsStore.getState();
    const ts = useThemeStore.getState();
    updateConfigMutation({
      workosId: user.id,
      config: {
        country: s.country,
        usState: s.usState,
        defaultTipPercent: s.defaultTipPercent,
        language: s.language,
        theme: ts.mode,
        extractPhotoTime: s.extractPhotoTime,
        useLocation: s.useLocation,
      },
    }).catch(() => {}); // fire-and-forget
  }, [user, updateConfigMutation]);

  const handleSignOut = () => {
    Alert.alert(t.settings_signOut, t.settings_signOutConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.settings_signOut,
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
    syncConfig();
  };

  const handleCountryChange = (v: Country) => { setCountry(v); syncConfig(); };
  const handleUsStateChange = (v: string) => { setUsState(v); syncConfig(); };
  const handleTipChange = (v: number) => { setDefaultTipPercent(v); syncConfig(); };
  const handleLanguageChange = (v: Language) => { setLanguage(v); syncConfig(); };
  const handleExtractPhotoTimeChange = (v: boolean) => { setExtractPhotoTime(v); syncConfig(); };
  const handleUseLocationChange = (v: boolean) => { setUseLocation(v); syncConfig(); };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="px-5 pb-2 pt-4">
        <Text className="text-3xl font-extrabold tracking-tight text-foreground">
          {t.settings_title}
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
              <IconSymbol name="crown.fill" size={24} color={iconColors.pro} />
            </View>
            <View className="flex-1 gap-1">
              <Text className="text-base font-bold text-foreground">{t.settings_upgradePro}</Text>
              <Text className="text-sm text-muted-foreground">
                {t.settings_proDescription}
              </Text>
            </View>
            <View className="rounded-full bg-pro px-3 py-1.5">
              <Text className="text-xs font-bold text-white">$1.99/mo</Text>
            </View>
          </View>
        </Pressable>

        {/* Preferences */}
        <SettingsSection title={t.settings_preferences}>
          <SettingsRow icon="sun.max.fill" iconColor="#f59e0b" label={t.settings_theme}>
            <SegmentedControl
              options={[
                { label: t.settings_themeLight, value: 'light' as ThemeMode },
                { label: t.settings_themeDark, value: 'dark' as ThemeMode },
                { label: t.settings_themeAuto, value: 'system' as ThemeMode },
              ]}
              value={mode}
              onChange={handleThemeChange}
            />
          </SettingsRow>
          <SettingsRow icon="globe" iconColor={iconColors.primary} label={t.settings_language} last>
            <SegmentedControl
              options={[
                { label: t.settings_langEnglish, value: 'en' as Language },
                { label: t.settings_langSpanish, value: 'es' as Language },
              ]}
              value={language}
              onChange={handleLanguageChange}
            />
          </SettingsRow>
        </SettingsSection>

        {/* Billing */}
        <SettingsSection title={t.settings_billing}>
          <SettingsRow icon="globe.americas.fill" iconColor="#0a7ea4" label={t.settings_country}>
            <SegmentedControl
              options={[
                { label: t.settings_countryColombia, value: 'CO' as Country },
                { label: t.settings_countryUSA, value: 'US' as Country },
              ]}
              value={country}
              onChange={handleCountryChange}
            />
          </SettingsRow>
          {country === 'US' && (
            <SettingsRow icon="map.fill" iconColor="#6366f1" label={t.settings_state}>
              <Pressable
                onPress={() => {
                  const states = Object.entries(US_STATE_RATES).map(([code, { name }]) => ({ code, name }));
                  Alert.alert(
                    t.settings_selectState,
                    undefined,
                    [
                      ...states.map(({ code, name }) => ({
                        text: `${name} (${code})`,
                        onPress: () => handleUsStateChange(code),
                      })),
                      { text: t.cancel, style: 'cancel' as const },
                    ]
                  );
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 8,
                  backgroundColor: 'rgba(148,163,184,0.1)',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: iconColors.primary }}>
                  {US_STATE_RATES[usState]?.name ?? usState}
                </Text>
                <IconSymbol name="chevron.right" size={12} color={iconColors.mutedLight} />
              </Pressable>
            </SettingsRow>
          )}
          <View className="px-4 py-3.5 border-t border-border">
            <TipSelector value={defaultTipPercent} onSelect={handleTipChange} />
          </View>
        </SettingsSection>

        {/* Scanning */}
        <SettingsSection title={t.settings_scanning}>
          <SettingsRow
            icon="clock.fill"
            iconColor="#6366f1"
            label={t.settings_extractTime}
            info={t.settings_extractTimeInfo}
          >
            <Switch
              value={extractPhotoTime}
              onValueChange={handleExtractPhotoTimeChange}
              trackColor={{ false: '#263354', true: '#38bdf8' }}
              thumbColor="#fff"
            />
          </SettingsRow>
          <SettingsRow
            icon="location.fill"
            iconColor="#10b981"
            label={t.settings_captureLocation}
            info={t.settings_captureLocationInfo}
            last
          >
            <Switch
              value={useLocation}
              onValueChange={handleUseLocationChange}
              trackColor={{ false: '#263354', true: '#38bdf8' }}
              thumbColor="#fff"
            />
          </SettingsRow>
        </SettingsSection>

        {/* Account */}
        <SettingsSection title={t.settings_account}>
          <SettingsRow
            icon="rectangle.portrait.and.arrow.right"
            iconColor="#ef4444"
            label={t.settings_signOut}
            onPress={handleSignOut}
            last
          >
            <IconSymbol name="chevron.right" size={16} color={iconColors.mutedLight} />
          </SettingsRow>
        </SettingsSection>

        {/* Footer */}
        <View className="items-center gap-1 pt-4">
          <Text className="text-xs text-muted-foreground">{t.settings_version}</Text>
          <Text className="text-xs text-muted-foreground">{t.settings_madeIn}</Text>
        </View>
      </ScrollView>
    </View>
  );
}
