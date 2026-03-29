import { useSettingsStore } from '@/stores/useSettingsStore';
import { en } from '@/translations/en';
import { es } from '@/translations/es';

export type Translations = typeof en;

export function useT(): Translations {
  const language = useSettingsStore((s) => s.language);
  return language === 'es' ? es : en;
}
