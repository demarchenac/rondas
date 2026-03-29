import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Country } from '@/constants/taxes';

export type Language = 'en' | 'es';

const deviceLanguage: Language =
  getLocales()[0]?.languageCode === 'es' ? 'es' : 'en';

interface SettingsState {
  hasCompletedSetup: boolean;
  language: Language;
  extractPhotoTime: boolean;
  useLocation: boolean;
  country: Country;
  usState: string;
  defaultTipPercent: number;
  setHasCompletedSetup: (value: boolean) => void;
  setLanguage: (value: Language) => void;
  setExtractPhotoTime: (value: boolean) => void;
  setUseLocation: (value: boolean) => void;
  setCountry: (value: Country) => void;
  setUsState: (value: string) => void;
  setDefaultTipPercent: (value: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      hasCompletedSetup: false,
      language: deviceLanguage,
      extractPhotoTime: true,
      useLocation: true,
      country: 'CO',
      usState: 'FL',
      defaultTipPercent: 10,
      setHasCompletedSetup: (value) => set({ hasCompletedSetup: value }),
      setLanguage: (value) => set({ language: value }),
      setExtractPhotoTime: (value) => set({ extractPhotoTime: value }),
      setUseLocation: (value) => set({ useLocation: value }),
      setCountry: (value) => set({ country: value }),
      setUsState: (value) => set({ usState: value }),
      setDefaultTipPercent: (value) => set({ defaultTipPercent: value }),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown>;
        if (version === 0) {
          return {
            ...state,
            hasCompletedSetup: true,
            language: (state.language as Language) ?? deviceLanguage,
          };
        }
        return state;
      },
    }
  )
);
