import 'server-only';
import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/i18n';

export const LOCALE_COOKIE = 'kc_lang';

/** The current CRM UI locale from the cookie (set when a user picks a language,
 *  and seeded from their stored preference at login). */
export async function getLocale(): Promise<Locale> {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : DEFAULT_LOCALE;
}
