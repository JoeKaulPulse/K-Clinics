'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { authField, authLabel } from '@/components/portal/AuthShell';
import { portalTranslator, DEFAULT_LOCALE, type Locale } from '@/lib/i18n-portal';
import { isLocale } from '@/lib/i18n';

function readCookieLocale(): Locale {
  if (typeof document === 'undefined') return DEFAULT_LOCALE;
  const m = document.cookie.match(/(?:^|;\s*)kc_clang=([^;]+)/);
  return m && isLocale(m[1]) ? (m[1] as Locale) : DEFAULT_LOCALE;
}

export function ForgotPasswordForm() {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  useEffect(() => setLocale(readCookieLocale()), []);
  const t = portalTranslator(locale);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/account/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {
      /* always show the same confirmation */
    } finally {
      setSent(true);
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] p-6">
        <p className="font-medium">{t('forgot.title')}</p>
        <p className="mt-2 text-sm text-[var(--color-stone)]">{t('forgot.sent')}</p>
        <Link href="/account/login" className="mt-4 inline-block text-sm font-medium text-[var(--color-gold)]">← {t('forgot.back')}</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className={authLabel} htmlFor="email">{t('field.email')}</label>
        <input id="email" type="email" autoComplete="email" required className={authField} value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <button type="submit" disabled={loading} className="w-full rounded-full bg-[var(--color-gold)] px-6 py-3.5 font-medium text-white shadow-[var(--shadow-gold)] transition-colors hover:bg-[var(--color-ink)] disabled:opacity-60">
        {loading ? t('forgot.sending') : t('forgot.send')}
      </button>
      <p className="text-center text-sm text-[var(--color-stone)]">
        {t('login.newHere')} <Link href="/account/login" className="font-medium text-[var(--color-gold)]">{t('action.signin')}</Link>
      </p>
    </form>
  );
}
