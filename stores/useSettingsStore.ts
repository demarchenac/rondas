import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface SettingsState {
  extractPhotoTime: boolean;
  useLocation: boolean;
  setExtractPhotoTime: (value: boolean) => void;
  setUseLocation: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      extractPhotoTime: true,
      useLocation: false,
      setExtractPhotoTime: (value) => set({ extractPhotoTime: value }),
      setUseLocation: (value) => set({ useLocation: value }),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
