import { es, type Translations } from './es';
import { en } from './en';

export type Locale = 'es' | 'en';

const translations: Record<Locale, Translations> = { es, en };

export function getTranslations(locale: Locale): Translations {
  return translations[locale] ?? translations.es;
}

export function getLocaleFromPath(pathname: string): Locale {
  if (pathname.startsWith('/en')) return 'en';
  return 'es';
}

export type { Translations };
