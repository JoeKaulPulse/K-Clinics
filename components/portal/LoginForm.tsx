'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authField, authLabel } from '@/components/portal/AuthShell';
import { Turnstile } from '@/components/security/Turnstile';
import { portalTranslator, DEFAULT_LOCALE, type Locale } from '@/lib/i18n-portal';
import { isLocale } from '@/lib/i18n';

function readCookieLocale(): Locale {
  if (typeof document === 'undefined') return DEFAULT_LOCALE;
  const m = document.cookie.match(/(?:^|;\s*)kc_clang=([^;]+)/);
  return m && isLocale(m[1]) ? (m[1] as Locale) : DEFAULT_LOCALE;
}

export function LoginForm() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const router = useRouter();
  const params = useSearchParams();
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  useEffect(() => setLocale(readCookieLocale()), []);
  const t = portalTranslator(locale);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaSiteKey, setCaptchaSiteKey] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/account/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, captchaToken }),
      });
      // 404 = route not present (static GitHub Pages demo only).
      if (res.status === 404) {
        setError(t('login.preview'));
        return;
      }
      const json = await res.json().catch(() => ({ ok: false, error: 'Unexpected response.' }));
      if (json.ok) {
        // Only honour same-origin relative paths to avoid an open redirect.
        const from = params.get('from');
        router.push(from && from.startsWith('/') && !from.startsWith('//') ? from : '/account');
        router.refresh();
      } else {
        if (json.requireCaptcha && json.captchaSiteKey) setCaptchaSiteKey(json.captchaSiteKey);
        setError(json.error || t('login.failed'));
      }
    } catch {
      setError(t('error.network'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className={authLabel} htmlFor="email">{t('field.email')}</label>
        <input id="email" type="email" autoComplete="email" required className={authField} value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <label className={authLabel} htmlFor="password">{t('login.password')}</label>
          <Link href="/account/forgot-password" className="text-xs font-medium text-[var(--color-gold)]">{t('login.forgot')}</Link>
        </div>
        <input id="password" type="password" autoComplete="current-password" required className={authField} value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {captchaSiteKey && <Turnstile siteKey={captchaSiteKey} onToken={setCaptchaToken} />}
      {error && <p className="rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-4 py-2.5 text-sm text-[var(--color-ink)]">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-[var(--color-gold-deep)] px-6 py-3.5 font-medium text-white shadow-[var(--shadow-gold)] transition-colors hover:bg-[var(--color-ink)] disabled:opacity-60"
      >
        {loading ? t('login.signingIn') : t('action.signin')}
      </button>
      <p className="text-center text-sm text-[var(--color-stone)]">
        {t('login.newHere')}{' '}
        <Link href="/account/signup" className="font-medium text-[var(--color-gold)]">
          {t('login.createCta')}
        </Link>
      </p>
      <p className="text-center text-xs text-[var(--color-stone)]">
        {t('login.staff')}{' '}
        <Link href="/admin/login" className="underline">
          {t('login.crmSignin')}
        </Link>
      </p>
    </form>
  );
}
