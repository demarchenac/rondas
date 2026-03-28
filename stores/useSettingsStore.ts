import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Country } from '@/constants/taxes';

interface SettingsState {
  extractPhotoTime: boolean;
  useLocation: boolean;
  country: Country;
  usState: string;
  defaultTipPercent: number;
  setExtractPhotoTime: (value: boolean) => void;
  setUseLocation: (value: boolean) => void;
  setCountry: (value: Country) => void;
  setUsState: (value: string) => void;
  setDefaultTipPercent: (value: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      extractPhotoTime: true,
      useLocation: false,
      country: 'CO',
      usState: 'FL',
      defaultTipPercent: 10,
      setExtractPhotoTime: (value) => set({ extractPhotoTime: value }),
      setUseLocation: (value) => set({ useLocation: value }),
      setCountry: (value) => set({ country: value }),
      setUsState: (value) => set({ usState: value }),
      setDefaultTipPercent: (value) => set({ defaultTipPercent: value }),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
