'use client';

import { createContext, useContext } from 'react';
import { translator, type Locale } from '@/lib/i18n';

type T = (key: string, vars?: Record<string, string | number>) => string;
const Ctx = createContext<{ locale: Locale; t: T }>({ locale: 'en', t: (k) => k });

/** Provides the active CRM locale + a `t()` function to client components.
 *  Initialised with the server-resolved locale so there's no flash. */
export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <Ctx.Provider value={{ locale, t: translator(locale) }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx);
}

/** Convenience hook returning just the `t()` function. */
export function useT(): T {
  return useContext(Ctx).t;
}
