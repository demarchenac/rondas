import { create } from 'zustand';

interface SubscriptionState {
  isPro: boolean;
  proOverride: boolean;
  totalBillsCreated: number;
  loading: boolean;
  setRevenueCatPro: (value: boolean) => void;
  setProOverride: (value: boolean) => void;
  setTotalBillsCreated: (value: number) => void;
  setLoading: (value: boolean) => void;
  reset: () => void;
}

export const useSubscriptionStore = create<SubscriptionState>()((set) => ({
  isPro: false,
  proOverride: false,
  totalBillsCreated: 0,
  loading: true,
  setRevenueCatPro: (value) => set({ isPro: value }),
  setProOverride: (value) => set({ proOverride: value }),
  setTotalBillsCreated: (value) => set({ totalBillsCreated: value }),
  setLoading: (value) => set({ loading: value }),
  reset: () => set({ isPro: false, proOverride: false, totalBillsCreated: 0, loading: true }),
}));
