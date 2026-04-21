import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, View, Platform } from 'react-native';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useMutation } from 'convex/react';
import { useRouter, type Href } from 'expo-router';

import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SegmentedControl, SettingsRow, SettingsSection } from '@/components/settings';
import { TipSelector } from '@/components/TipSelector';
import USStatePicker from '@/components/settings/USStatePicker';
import { ICON_COLORS } from '@/constants/colors';
import { useThemeStore, type ThemeMode } from '@/stores/useThemeStore';
import { useSettingsStore, type Language } from '@/stores/useSettingsStore';
import { useAuth } from '@/lib/AuthContext';
import { useT } from '@/lib/i18n';
import { api } from '@/convex/_generated/api';
import { US_STATE_RATES, type Country } from '@/constants/taxes';
import { Input } from '@/components/ui/input';
import * as Updates from 'expo-updates';
import { cn } from '@/lib/cn';
import { useProGate } from '@/hooks/useProGate';
import { presentCodeRedemptionSheet, presentCustomerCenter } from '@/lib/revenueCat';

function formatOtaDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = d.getHours() % 12 || 12;
  const min = String(d.getMinutes()).padStart(2, '0');
  const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
  return `${y}-${m}-${day} ${h}:${min} ${ampm}`;
}

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
  const router = useRouter();
  const updateConfigMutation = useMutation(api.users.updateConfig);
  const redeemCode = useMutation(api.promoCodes.redeemCode);
  const [statePickerVisible, setStatePickerVisible] = useState(false);
  const { isPro } = useProGate();
  const [promoCode, setPromoCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [showPromoInput, setShowPromoInput] = useState(false);

  const handleRedeemCode = useCallback(async () => {
    if (!user || !promoCode.trim()) return;
    setRedeeming(true);
    try {
      await redeemCode({ workosId: user.id, code: promoCode.trim() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t.promo_success);
      setPromoCode('');
      setShowPromoInput(false);
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = (err as Error).message ?? '';
      let label = t.promo_invalid;
      if (msg.includes('expired')) label = t.promo_expired;
      else if (msg.includes('max_uses')) label = t.promo_maxUses;
      else if (msg.includes('already_pro')) label = t.promo_alreadyPro;
      Alert.alert(label);
    } finally {
      setRedeeming(false);
    }
  }, [user, promoCode, redeemCode, t]);

  const handleStoreRedeem = useCallback(async () => {
    if (Platform.OS !== 'ios') return;
    try {
      await presentCodeRedemptionSheet();
    } catch (err) {
      if (__DEV__) console.warn('[Settings] store redeem failed:', err);
    }
  }, []);

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

  const handleSignOut = useCallback(() => {
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
  }, [t, signOut]);

  const handleThemeChange = useCallback((newMode: ThemeMode) => {
    setMode(newMode);
    if (newMode !== 'system') setColorScheme(newMode);
    syncConfig();
  }, [setMode, setColorScheme, syncConfig]);

  const handleCountryChange = useCallback((v: Country) => { setCountry(v); syncConfig(); }, [setCountry, syncConfig]);
  const handleUsStateChange = useCallback((v: string) => { setUsState(v); syncConfig(); }, [setUsState, syncConfig]);
  const handleTipChange = useCallback((v: number) => { setDefaultTipPercent(v); syncConfig(); }, [setDefaultTipPercent, syncConfig]);
  const handleLanguageChange = useCallback((v: Language) => { setLanguage(v); syncConfig(); }, [setLanguage, syncConfig]);
  const handleExtractPhotoTimeChange = useCallback((v: boolean) => { setExtractPhotoTime(v); syncConfig(); }, [setExtractPhotoTime, syncConfig]);
  const handleUseLocationChange = useCallback((v: boolean) => { setUseLocation(v); syncConfig(); }, [setUseLocation, syncConfig]);

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
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View className="items-center gap-3 rounded-2xl border border-border bg-card px-6 py-6">
          <View className="relative">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <Text className="text-3xl font-bold text-primary">
                {user?.firstName?.[0] ?? user?.email?.[0]?.toUpperCase() ?? '?'}
                {user?.lastName?.[0] ?? ''}
              </Text>
            </View>
            {isPro && (
              <View className="absolute bottom-0 right-0 h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-pro">
                <IconSymbol name="crown.fill" size={12} color="#fff" />
              </View>
            )}
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

        {/* Pro Upsell / Active card */}
        {isPro ? (
          <Pressable
            onPress={() => presentCustomerCenter().catch(() => {})}
            className="overflow-hidden rounded-2xl border border-pro/30 bg-pro-bg active:scale-[0.98]"
          >
            <View className="flex-row items-center gap-4 p-5">
              <View className="h-12 w-12 items-center justify-center rounded-xl bg-pro/10">
                <IconSymbol name="crown.fill" size={24} color={iconColors.pro} />
              </View>
              <View className="flex-1 gap-1">
                <Text className="text-base font-bold text-foreground">{t.settings_proActive}</Text>
                <Text className="text-sm text-muted-foreground">
                  {t.settings_manageSubscription}
                </Text>
              </View>
              <IconSymbol name="chevron.right" size={14} color={iconColors.muted} />
            </View>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => router.push('/paywall' as Href)}
            className="overflow-hidden rounded-2xl border border-pro/30 bg-pro-bg active:scale-[0.98]"
          >
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
                <Text className="text-xs font-bold text-white">{t.settings_proPrice(country)}</Text>
              </View>
            </View>
          </Pressable>
        )}

        {/* Promo code section */}
        {!isPro && (
          <View className="gap-2">
            {!showPromoInput ? (
              <Pressable onPress={() => setShowPromoInput(true)} className="items-center py-2">
                <Text className="text-sm font-medium text-muted-foreground">{t.settings_promoCode}</Text>
              </Pressable>
            ) : (
              <View className="gap-2 rounded-2xl border border-border bg-card p-4">
                <Text className="text-sm font-semibold text-foreground">{t.promo_title}</Text>
                <View className="flex-row gap-2">
                  <Input
                    value={promoCode}
                    onChangeText={setPromoCode}
                    placeholder={t.settings_promoCodePlaceholder}
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="flex-1"
                  />
                  <Pressable
                    onPress={handleRedeemCode}
                    disabled={redeeming || !promoCode.trim()}
                    className={cn(
                      'items-center justify-center rounded-xl bg-primary px-4',
                      (redeeming || !promoCode.trim()) && 'opacity-50',
                    )}
                  >
                    {redeeming ? (
                      <ActivityIndicator color={iconColors.primaryForeground} size="small" />
                    ) : (
                      <Text className="text-sm font-semibold text-primary-foreground">
                        {t.settings_promoCodeRedeem}
                      </Text>
                    )}
                  </Pressable>
                </View>
                {Platform.OS === 'ios' && (
                  <Pressable onPress={handleStoreRedeem} className="items-center py-2">
                    <Text className="text-xs font-medium text-muted-foreground">
                      {t.settings_promoCodeStoreRedeem}
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        )}

        {/* Preferences */}
        <SettingsSection title={t.settings_preferences}>
          <SettingsRow icon="sun.max.fill" iconColor={iconColors.pro} label={t.settings_theme}>
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
          <SettingsRow icon="globe.americas.fill" iconColor={iconColors.primary} label={t.settings_country}>
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
            <SettingsRow icon="map.fill" iconColor={iconColors.accent} label={t.settings_state}>
              <Pressable
                onPress={() => setStatePickerVisible(true)}
                className="flex-row items-center gap-1 rounded-lg bg-muted-foreground/10 px-2.5 py-1"
              >
                <Text className="text-[13px] font-semibold text-primary">
                  {US_STATE_RATES[usState]?.name ?? usState}
                </Text>
                <IconSymbol name="chevron.right" size={12} color={iconColors.mutedLight} />
              </Pressable>
            </SettingsRow>
          )}
          {country === 'US' && (
            <USStatePicker
              visible={statePickerVisible}
              selected={usState}
              onSelect={handleUsStateChange}
              onClose={() => setStatePickerVisible(false)}
            />
          )}
          <View className="px-4 py-3.5 border-t border-border">
            <TipSelector value={defaultTipPercent} onSelect={handleTipChange} />
          </View>
        </SettingsSection>

        {/* Scanning */}
        <SettingsSection title={t.settings_scanning}>
          <SettingsRow
            icon="clock.fill"
            iconColor={iconColors.accent}
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
            iconColor={iconColors.success}
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
            iconColor={iconColors.destructive}
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
          {Updates.updateId && (
            <Text className="text-[10px] text-muted-foreground/60">
              OTA: {Updates.updateId.slice(0, 8)}{Updates.createdAt ? ` · ${formatOtaDate(Updates.createdAt)}` : ''}
            </Text>
          )}
          <Text className="text-xs text-muted-foreground">{t.settings_madeIn}</Text>
        </View>
      </ScrollView>
    </View>
  );
}
