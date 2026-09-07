import { createContext, useContext, useEffect, useMemo, useState, type JSX, type ReactNode } from 'react';
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, readStoredLocale, type Locale } from './locale';

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (english: string, vietnamese: string) => string;
}

const I18nContext = createContext<I18nValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => undefined,
  t: (english) => english
});

export function I18nProvider({ children }: { children: ReactNode }): JSX.Element {
  const [locale, setLocale] = useState<Locale>(readBrowserLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
    try { window.localStorage.setItem(LOCALE_STORAGE_KEY, locale); } catch { /* The selected language still applies for this session. */ }
  }, [locale]);

  const value = useMemo<I18nValue>(() => ({
    locale,
    setLocale,
    t: (english, vietnamese) => locale === 'vi' ? vietnamese : english
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function readBrowserLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try { return readStoredLocale(window.localStorage); } catch { return DEFAULT_LOCALE; }
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}
