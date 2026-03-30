import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from 'convex/react';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SegmentedControl, SettingsSection, SettingsRow } from '@/components/settings';
import { TipSelector } from '@/components/TipSelector';
import { useSettingsStore, type Language } from '@/stores/useSettingsStore';
import { useThemeStore, type ThemeMode } from '@/stores/useThemeStore';
import { useAuth } from '@/lib/AuthContext';
import { useT } from '@/lib/i18n';
import { api } from '@/convex/_generated/api';
import type { Country } from '@/constants/taxes';

export default function SetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setColorScheme } = useColorScheme();
  const { user } = useAuth();
  const updateConfig = useMutation(api.users.updateConfig);
  const settingsStore = useSettingsStore();
  const themeStore = useThemeStore();

  const [country, setCountry] = useState<Country>('CO');
  const [tip, setTip] = useState(10);
  const [language, setLanguage] = useState<Language>('es');
  const [theme, setTheme] = useState<ThemeMode>('dark');

  // Sync store language on mount so useT() renders in the default language
  useEffect(() => {
    settingsStore.setLanguage('es');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    settingsStore.setLanguage(lang);
  };

  const t = useT();

  const handleGetStarted = async () => {
    // Save config locally
    settingsStore.setCountry(country);
    settingsStore.setDefaultTipPercent(tip);
    settingsStore.setLanguage(language);
    themeStore.setMode(theme);
    setColorScheme(theme === 'system' ? undefined : theme);

    // Save config to Convex
    if (user) {
      await updateConfig({
        workosId: user.id,
        config: {
          country,
          defaultTipPercent: tip,
          language,
          theme,
          extractPhotoTime: settingsStore.extractPhotoTime,
          useLocation: settingsStore.useLocation,
        },
      });
    }

    settingsStore.setHasCompletedSetup(true);
    router.replace('/(tabs)');
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1 px-5"
        contentContainerClassName="gap-6 pb-12 pt-6"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="items-center gap-2 py-6">
          <View className="mb-2 h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <IconSymbol name="receipt" size={32} color="#0a7ea4" />
          </View>
          <Text className="text-2xl font-extrabold tracking-tight text-foreground">
            {t.setup_welcome}
          </Text>
          <Text className="text-center text-sm text-muted-foreground">
            {t.setup_subtitle}
          </Text>
        </View>

        {/* Country */}
        <SettingsSection title={t.settings_country}>
          <SettingsRow icon="globe.americas.fill" iconColor="#0a7ea4" label={t.settings_country} last>
            <SegmentedControl
              options={[
                { label: t.settings_countryColombia, value: 'CO' as Country },
                { label: t.settings_countryUSA, value: 'US' as Country },
              ]}
              value={country}
              onChange={setCountry}
            />
          </SettingsRow>
        </SettingsSection>

        {/* Default Tip */}
        <SettingsSection title={t.settings_defaultTip}>
          <View className="px-4 py-3.5">
            <TipSelector value={tip} onSelect={setTip} />
          </View>
        </SettingsSection>

        {/* Language */}
        <SettingsSection title={t.settings_language}>
          <SettingsRow icon="globe" iconColor="#0a7ea4" label={t.settings_language} last>
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

        {/* Theme */}
        <SettingsSection title={t.settings_theme}>
          <SettingsRow icon="sun.max.fill" iconColor="#f59e0b" label={t.settings_theme} last>
            <SegmentedControl
              options={[
                { label: t.settings_themeLight, value: 'light' as ThemeMode },
                { label: t.settings_themeDark, value: 'dark' as ThemeMode },
                { label: t.settings_themeAuto, value: 'system' as ThemeMode },
              ]}
              value={theme}
              onChange={setTheme}
            />
          </SettingsRow>
        </SettingsSection>

        {/* CTA */}
        <Button size="lg" className="mt-2" onPress={handleGetStarted}>
          <Text>{t.setup_getStarted}</Text>
        </Button>
      </ScrollView>
    </View>
  );
}
