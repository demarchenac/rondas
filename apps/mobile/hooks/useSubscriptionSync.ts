import { useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
import { initRevenueCat, logoutRevenueCat } from '@/lib/revenueCat';

export function useSubscriptionSync(userId: string | undefined) {
  const proStatus = useQuery(
    api.users.getProStatus,
    userId ? {} : 'skip',
  );

  useEffect(() => {
    if (!userId) {
      logoutRevenueCat();
      return;
    }
    initRevenueCat(userId);
  }, [userId]);

  useEffect(() => {
    if (!proStatus) return;
    useSubscriptionStore.getState().setProOverride(proStatus.proOverride);
    useSubscriptionStore.getState().setTotalBillsCreated(proStatus.totalBillsCreated);
  }, [proStatus]);
}
