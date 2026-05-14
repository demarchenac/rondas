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
  syncContacts: boolean;
  country: Country;
  usState: string;
  defaultTipPercent: number;
  impoconsumoIncluded: boolean;
  ivaIncluded: boolean;
  setHasCompletedSetup: (value: boolean) => void;
  setLanguage: (value: Language) => void;
  setExtractPhotoTime: (value: boolean) => void;
  setUseLocation: (value: boolean) => void;
  setSyncContacts: (value: boolean) => void;
  setCountry: (value: Country) => void;
  setUsState: (value: string) => void;
  setDefaultTipPercent: (value: number) => void;
  setImpoconsumoIncluded: (value: boolean) => void;
  setIvaIncluded: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      hasCompletedSetup: false,
      language: deviceLanguage,
      extractPhotoTime: true,
      useLocation: true,
      syncContacts: true,
      country: 'CO',
      usState: 'FL',
      defaultTipPercent: 10,
      impoconsumoIncluded: true,
      ivaIncluded: true,
      setHasCompletedSetup: (value) => set({ hasCompletedSetup: value }),
      setLanguage: (value) => set({ language: value }),
      setExtractPhotoTime: (value) => set({ extractPhotoTime: value }),
      setUseLocation: (value) => set({ useLocation: value }),
      setSyncContacts: (value) => set({ syncContacts: value }),
      setCountry: (value) => set({ country: value }),
      setUsState: (value) => set({ usState: value }),
      setDefaultTipPercent: (value) => set({ defaultTipPercent: value }),
      setImpoconsumoIncluded: (value) => set({ impoconsumoIncluded: value }),
      setIvaIncluded: (value) => set({ ivaIncluded: value }),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown>;
        if (version === 0) {
          return {
            ...state,
            hasCompletedSetup: true,
            language: (state.language as Language) ?? deviceLanguage,
            impoconsumoIncluded: true,
            ivaIncluded: true,
          };
        }
        if (version === 1) {
          return { ...state, impoconsumoIncluded: true, ivaIncluded: true };
        }
        return state;
      },
    }
  )
);
