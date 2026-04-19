import { useCallback } from 'react';
import { useRouter, type Href } from 'expo-router';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';

export const TRIAL_BILL_LIMIT = 2;
export const FREE_MONTHLY_BILL_LIMIT = 3;
export const FREE_HISTORY_DAYS = 90;

export function useProGate() {
  const router = useRouter();
  const isPro = useSubscriptionStore((s) => s.isPro);
  const proOverride = useSubscriptionStore((s) => s.proOverride);
  const totalBillsCreated = useSubscriptionStore((s) => s.totalBillsCreated);

  const hasPro = isPro || proOverride;
  const inTrial = !hasPro && totalBillsCreated < TRIAL_BILL_LIMIT;
  const unlocked = hasPro || inTrial;

  const showPaywall = useCallback(() => {
    router.push('/paywall' as Href);
  }, [router]);

  return {
    isPro: hasPro,
    inTrial,
    unlocked,
    totalBillsCreated,
    showPaywall,
  };
}
