'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authField, authLabel } from '@/components/portal/AuthShell';
import { Turnstile } from '@/components/security/Turnstile';
import { startAuthentication } from '@simplewebauthn/browser';

export function AdminLoginForm({ ssoEnabled = false }: { ssoEnabled?: boolean }) {
  return (
    <Suspense fallback={null}>
      <Inner ssoEnabled={ssoEnabled} />
    </Suspense>
  );
}

// "Sign in with Google" outcomes routed back from the OAuth callback (?sso=…).
// `tone: 'info'` reads as a calm notice; anything else as a soft error.
const SSO_NOTICES: Record<string, { tone: 'info' | 'error'; text: string }> = {
  pending: { tone: 'info', text: 'Your account has been created and is waiting for an owner to approve it. You can sign in once it’s switched on.' },
  deactivated: { tone: 'error', text: 'This account has been deactivated. Please contact an owner.' },
  domain: { tone: 'error', text: 'That Google account isn’t on an approved K-Clinics Workspace domain.' },
  unavailable: { tone: 'info', text: 'Google sign-in isn’t available right now — please use your email and password.' },
  error: { tone: 'error', text: 'Google sign-in didn’t complete. Please try again.' },
};

function Inner({ ssoEnabled }: { ssoEnabled: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const ssoNotice = SSO_NOTICES[params.get('sso') ?? ''];
  const fromParam = params.get('from');
  const googleHref = `/api/admin/oauth/google/start${fromParam && fromParam.startsWith('/') ? `?from=${encodeURIComponent(fromParam)}` : ''}`;
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
      {ssoNotice && (
        <p className={`rounded-[var(--radius-sm)] px-4 py-2.5 text-sm ${ssoNotice.tone === 'info' ? 'bg-[var(--color-bone)] text-[var(--color-ink)]' : 'bg-[var(--color-blush)]/25 text-[var(--color-ink)]'}`}>
          {ssoNotice.text}
        </p>
      )}
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

      {error && <p role="alert" aria-live="assertive" className="rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-4 py-2.5 text-sm text-[var(--color-ink)]">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-[var(--color-gold)] px-6 py-3.5 font-medium text-white shadow-[var(--shadow-gold)] transition-colors hover:bg-[var(--color-ink)] disabled:opacity-60"
      >
        {loading ? 'Signing in…' : twoFactor ? 'Verify & sign in' : 'Sign in to the CRM'}
      </button>

      {!twoFactor && (
        <>
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-[var(--color-stone)]">
            <span className="h-px flex-1 bg-[var(--color-line)]" /> or <span className="h-px flex-1 bg-[var(--color-line)]" />
          </div>
          {ssoEnabled && (
            <a
              href={googleHref}
              className="flex w-full items-center justify-center gap-2.5 rounded-full border border-[var(--color-line)] px-6 py-3.5 font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-gold)]"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
                <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
              </svg>
              Sign in with Google
            </a>
          )}
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
        <Link href="/account/login" className="font-medium text-[var(--color-gold-deep)]">Client sign in</Link>
      </p>
    </form>
  );
}
