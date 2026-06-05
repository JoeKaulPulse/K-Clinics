'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authField, authLabel } from '@/components/portal/AuthShell';
import { Turnstile } from '@/components/security/Turnstile';
import { startAuthentication } from '@simplewebauthn/browser';

export function AdminLoginForm() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [twoFactor, setTwoFactor] = useState(false);
  const [captchaSiteKey, setCaptchaSiteKey] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, code, captchaToken }),
      });
      const json = await res.json();
      if (json.ok) {
        // Only honour same-origin relative paths to avoid an open redirect.
        const from = params.get('from');
        const dest = from && from.startsWith('/') && !from.startsWith('//') ? from : '/admin';
        router.push(json.setup ? '/admin/profile?setup2fa=1' : dest);
        router.refresh();
        return;
      }
      if (json.twoFactor) { setTwoFactor(true); setError(json.error || ''); }
      if (json.requireCaptcha && json.captchaSiteKey) setCaptchaSiteKey(json.captchaSiteKey);
      if (!json.twoFactor) setError(json.error || 'Login failed.');
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function passkeyLogin() {
    setLoading(true); setError('');
    try {
      const o = await fetch('/api/admin/passkey-login/options', { method: 'POST' }).then((r) => r.json());
      if (!o.ok) { setError(o.error || 'Passkey sign-in unavailable.'); return; }
      const resp = await startAuthentication({ optionsJSON: o.options });
      const v = await fetch('/api/admin/passkey-login/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ response: resp }) }).then((r) => r.json());
      if (!v.ok) { setError(v.error || 'Could not sign in with that passkey.'); return; }
      const from = params.get('from');
      router.push(from && from.startsWith('/') && !from.startsWith('//') ? from : '/admin');
      router.refresh();
    } catch {
      setError('Passkey sign-in was cancelled.');
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className={authLabel} htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="email" required disabled={twoFactor} className={authField} value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className={authLabel} htmlFor="password">Password</label>
        <input id="password" type="password" autoComplete="current-password" required disabled={twoFactor} className={authField} value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>

      {twoFactor && (
        <div>
          <label className={authLabel} htmlFor="code">Authentication code</label>
          <input id="code" inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="6-digit code or recovery code" className={authField} value={code} onChange={(e) => setCode(e.target.value)} />
          <p className="mt-1.5 text-xs text-[var(--color-stone)]">Enter the code from your authenticator app, or a recovery code.</p>
        </div>
      )}

      {captchaSiteKey && !twoFactor && <Turnstile siteKey={captchaSiteKey} onToken={setCaptchaToken} />}

      {error && <p className="rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-4 py-2.5 text-sm text-[var(--color-ink)]">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-[var(--color-gold)] px-6 py-3.5 font-medium text-white shadow-[var(--shadow-gold)] transition-colors hover:bg-[var(--color-ink)] disabled:opacity-60"
      >
        {loading ? 'Signing in…' : twoFactor ? 'Verify & sign in' : 'Sign in to the CRM'}
      </button>

      {!twoFactor && (
        <>
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-[var(--color-stone-soft)]">
            <span className="h-px flex-1 bg-[var(--color-line)]" /> or <span className="h-px flex-1 bg-[var(--color-line)]" />
          </div>
          <button
            type="button"
            onClick={passkeyLogin}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-[var(--color-line)] px-6 py-3.5 font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-gold)] disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a5 5 0 0 0-5 5v3M7 10a5 5 0 0 1 10 0c0 6-1 9-2 11M12 11v4M9 21c1-2 1.5-4 1.5-6" /></svg>
            Sign in with Face ID / Touch ID
          </button>
        </>
      )}
      <p className="text-center text-xs text-[var(--color-stone)]">
        Authorised personnel only · activity is logged. Are you a client?{' '}
        <Link href="/account/login" className="font-medium text-[var(--color-gold)]">Client sign in</Link>
      </p>
    </form>
  );
}
