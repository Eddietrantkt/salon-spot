export type Locale = 'en' | 'vi';

export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_STORAGE_KEY = 'salon-spot.locale';

export function normalizeLocale(value: unknown): Locale {
  return value === 'vi' ? 'vi' : DEFAULT_LOCALE;
}

export function readStoredLocale(storage?: Pick<Storage, 'getItem'> | null): Locale {
  if (!storage) return DEFAULT_LOCALE;
  try {
    return normalizeLocale(storage.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return DEFAULT_LOCALE;
  }
}
