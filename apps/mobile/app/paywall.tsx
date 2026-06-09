import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View, Platform , useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

import * as Sentry from '@sentry/react-native';
import { getErrorCode } from '@/lib/convexError';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ICON_COLORS } from '@/constants/colors';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n';
import { useAuth } from '@/lib/AuthContext';
import { useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useCustomAlert } from '@/components/ui/custom-alert';
import {
  getOffering,
  purchasePackage,
  restorePurchases,
  presentCodeRedemptionSheet,
} from '@/lib/revenueCat';
import { posthog } from '@/lib/posthog';

type SelectedPlan = 'monthly' | 'yearly';

export default function PaywallScreen() {
  const router = useRouter();
  const t = useT();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const iconColors = ICON_COLORS[colorScheme ?? 'light'];
  const { user } = useAuth();
  const redeemCode = useMutation(api.promoCodes.redeemCode);
  const { alert } = useCustomAlert();

  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [isLoadingOffering, setLoadingOffering] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<SelectedPlan>('yearly');
  const [isPurchasing, setPurchasing] = useState(false);
  const [isShowingPromoInput, setShowPromoInput] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [isRedeeming, setRedeeming] = useState(false);

  useEffect(() => {
    posthog.capture('paywall_viewed');
    let cancelled = false;
    getOffering().then(async (o) => {
      if (cancelled) return;
      setOffering(o);
      setLoadingOffering(false);
    }).catch((err) => {
      if (cancelled) return;
      if (__DEV__) console.warn('[Paywall] getOffering error:', err);
      Sentry.captureException(err, { tags: { feature: 'paywall' } });
      setLoadingOffering(false);
    });
    return () => { cancelled = true; };
  }, [router]);

  const monthlyPkg: PurchasesPackage | null = offering?.monthly ?? null;
  const yearlyPkg: PurchasesPackage | null = offering?.annual ?? null;

  const handlePurchase = useCallback(async () => {
    const pkg = selectedPlan === 'monthly' ? monthlyPkg : yearlyPkg;
    if (!pkg) return;

    setPurchasing(true);
    try {
      const success = await purchasePackage(pkg);
      if (success) {
        posthog.capture('subscription_purchased', { plan: selectedPlan });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
      }
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t.error, t.error_mutationFailed);
      if (__DEV__) console.warn('[Paywall] purchase failed:', err);
      Sentry.captureException(err, { tags: { feature: 'paywall' } });
    } finally {
      setPurchasing(false);
    }
  }, [selectedPlan, monthlyPkg, yearlyPkg, router, t, alert]);

  const handleRestore = useCallback(async () => {
    try {
      const success = await restorePurchases();
      if (success) {
        posthog.capture('subscription_restored');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        alert(t.paywall_restoreSuccess);
        router.back();
      } else {
        alert(t.paywall_restoreFailed);
      }
    } catch (err) {
      alert(t.error, t.error_mutationFailed);
      if (__DEV__) console.warn('[Paywall] restore failed:', err);
      Sentry.captureException(err, { tags: { feature: 'paywall' } });
    }
  }, [router, t, alert]);

  const handleRedeem = useCallback(async () => {
    if (!user || !promoCode.trim()) return;
    setRedeeming(true);
    try {
      await redeemCode({ code: promoCode.trim() });
      posthog.capture('promo_code_redeemed');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      alert(t.promo_success);
      router.back();
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const code = getErrorCode(err);
      let label = t.promo_invalid;
      if (code === 'EXPIRED_CODE') label = t.promo_expired;
      else if (code === 'LIMIT_REACHED') label = t.promo_maxUses;
      else if (code === 'ALREADY_PRO') label = t.promo_alreadyPro;
      alert(label);
    } finally {
      setRedeeming(false);
    }
  }, [user, promoCode, redeemCode, router, t, alert]);

  const handleStoreRedeem = useCallback(async () => {
    if (Platform.OS !== 'ios') return;
    try {
      await presentCodeRedemptionSheet();
    } catch (err) {
      if (__DEV__) console.warn('[Paywall] store redeem failed:', err);
      Sentry.captureException(err, { tags: { feature: 'paywall' } });
    }
  }, []);

  const features = [
    t.paywall_feature_scan,
    t.paywall_feature_bills,
    t.paywall_feature_payments,
    t.paywall_feature_history,
  ];

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View className="flex-row items-center justify-between px-5 py-3">
          <Pressable onPress={() => router.back()} className="h-9 w-9 items-center justify-center rounded-full bg-muted/60">
            <IconSymbol name="xmark" size={14} color={iconColors.foreground} />
          </Pressable>
          <View className="w-9" />
        </View>

        <View className="items-center px-6 pb-6 pt-2">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-pro/15">
            <IconSymbol name="crown.fill" size={32} color={iconColors.pro} />
          </View>
          <Text className="text-center text-3xl font-extrabold tracking-tight text-foreground">
            {t.paywall_title}
          </Text>
          <Text className="mt-2 text-center text-base text-muted-foreground">
            {t.paywall_subtitle}
          </Text>
        </View>

        <View className="gap-3 px-6">
          {features.map((label) => (
            <View key={label} className="flex-row items-center gap-3">
              <View className="h-6 w-6 items-center justify-center rounded-full bg-primary/15">
                <IconSymbol name="checkmark" size={12} color={iconColors.primary} />
              </View>
              <Text className="flex-1 text-lg font-medium text-foreground">{label}</Text>
            </View>
          ))}
        </View>

        <View className="mt-8 gap-3 px-6">
          {isLoadingOffering ? (
            <View className="items-center py-8">
              <ActivityIndicator color={iconColors.primary} />
              <Text className="mt-3 text-base text-muted-foreground">{t.paywall_loading}</Text>
            </View>
          ) : !offering || (!monthlyPkg && !yearlyPkg) ? (
            <View className="rounded-2xl border border-border bg-muted/30 p-6">
              <Text className="text-center text-base text-muted-foreground">
                {t.paywall_unavailable}
              </Text>
            </View>
          ) : (
            <>
              {yearlyPkg && (
                <PlanOption
                  plan="yearly"
                  title={t.paywall_yearly}
                  priceText={yearlyPkg.product.priceString}
                  suffix={t.paywall_perYear}
                  badge={t.paywall_yearlySavings}
                  selected={selectedPlan === 'yearly'}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedPlan('yearly');
                  }}
                />
              )}
              {monthlyPkg && (
                <PlanOption
                  plan="monthly"
                  title={t.paywall_monthly}
                  priceText={monthlyPkg.product.priceString}
                  suffix={t.paywall_perMonth}
                  selected={selectedPlan === 'monthly'}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedPlan('monthly');
                  }}
                />
              )}
            </>
          )}
        </View>

        {offering && (monthlyPkg || yearlyPkg) && (
          <View className="mt-6 px-6">
            <Pressable
              onPress={handlePurchase}
              disabled={isPurchasing}
              className={cn(
                'items-center justify-center rounded-2xl bg-primary py-4',
                isPurchasing && 'opacity-60',
              )}
            >
              {isPurchasing ? (
                <ActivityIndicator color={iconColors.primaryForeground} />
              ) : (
                <Text className="text-lg font-bold text-primary-foreground">
                  {t.paywall_purchase}
                </Text>
              )}
            </Pressable>
          </View>
        )}

        <View className="mt-6 gap-4 px-6">
          <Pressable onPress={handleRestore} className="items-center py-2">
            <Text className="text-base font-medium text-primary">{t.paywall_restore}</Text>
          </Pressable>

          {!isShowingPromoInput ? (
            <Pressable onPress={() => setShowPromoInput(true)} className="items-center py-2">
              <Text className="text-base font-medium text-muted-foreground">{t.paywall_promoCode}</Text>
            </Pressable>
          ) : (
            <View className="gap-2">
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
                  onPress={handleRedeem}
                  disabled={isRedeeming || !promoCode.trim()}
                  className={cn(
                    'items-center justify-center rounded-xl bg-primary px-4',
                    (isRedeeming || !promoCode.trim()) && 'opacity-50',
                  )}
                >
                  {isRedeeming ? (
                    <ActivityIndicator color={iconColors.primaryForeground} size="small" />
                  ) : (
                    <Text className="text-base font-semibold text-primary-foreground">
                      {t.settings_promoCodeRedeem}
                    </Text>
                  )}
                </Pressable>
              </View>
              {Platform.OS === 'ios' && (
                <Pressable onPress={handleStoreRedeem} className="items-center py-2">
                  <Text className="text-base font-medium text-muted-foreground">
                    {t.settings_promoCodeStoreRedeem}
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

interface PlanOptionProps {
  plan: SelectedPlan;
  title: string;
  priceText: string;
  suffix: string;
  badge?: string;
  selected: boolean;
  onPress: () => void;
}

function PlanOption({ title, priceText, suffix, badge, selected, onPress }: PlanOptionProps) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'flex-row items-center justify-between rounded-2xl border-2 px-5 py-4',
        selected ? 'border-primary bg-primary/5' : 'border-border bg-card',
      )}
    >
      <View className="flex-1 gap-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-lg font-bold text-foreground">{title}</Text>
          {badge && (
            <View className="rounded-full bg-pro/15 px-2 py-0.5">
              <Text className="text-sm font-bold text-pro">{badge}</Text>
            </View>
          )}
        </View>
      </View>
      <Text className="text-lg font-bold text-foreground">
        {priceText}
        <Text className="text-base font-medium text-muted-foreground">{suffix}</Text>
      </Text>
    </Pressable>
  );
}
