import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { I18nContext, LOCALE_STORAGE_KEY, PAGE_COPY, initialLocale } from './i18n.js';
import type { Locale } from './i18n.js';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    } catch {
      // Storage may be unavailable; language switching still works for this page view.
    }
  }, []);

  const pick = useCallback(
    (vietnamese: string, english: string) => (locale === 'vi' ? vietnamese : english),
    [locale],
  );

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = PAGE_COPY[locale].title;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', PAGE_COPY[locale].description);
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, pick }), [locale, pick, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
