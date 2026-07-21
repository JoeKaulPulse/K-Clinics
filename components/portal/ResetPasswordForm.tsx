'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authField, authLabel } from '@/components/portal/AuthShell';

export function ResetPasswordForm() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get('id') || '';
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const missing = !id || !token;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) return setError('Passwords don’t match.');
    if (password.length < 8) return setError('Use at least 8 characters.');
    setLoading(true);
    try {
      const res = await fetch('/api/account/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, token, password }),
      });
      const json = await res.json().catch(() => ({ ok: false, error: 'Unexpected response.' }));
      if (json.ok) {
        router.push('/account');
        router.refresh();
      } else {
        setError(json.error || 'Could not reset your password.');
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (missing) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] p-6">
        <p className="font-medium">Invalid reset link</p>
        <p className="mt-2 text-sm text-[var(--color-stone)]">This link is incomplete or has expired.</p>
        <Link href="/account/forgot-password" className="mt-4 inline-block text-sm font-medium text-[var(--color-gold-deep)]">Request a new link</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className={authLabel} htmlFor="pw">New password</label>
        <input id="pw" type="password" autoComplete="new-password" required minLength={8} className={authField} value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div>
        <label className={authLabel} htmlFor="cf">Confirm password</label>
        <input id="cf" type="password" autoComplete="new-password" required className={authField} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      {error && <p role="alert" aria-live="assertive" className="rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-4 py-2.5 text-sm text-[var(--color-ink)]">{error}</p>}
      <button type="submit" disabled={loading} className="w-full rounded-full bg-[var(--color-gold-deep)] px-6 py-3.5 font-medium text-white shadow-[var(--shadow-gold)] transition-colors hover:bg-[var(--color-ink)] disabled:opacity-60">
        {loading ? 'Saving…' : 'Set new password'}
      </button>
    </form>
  );
}
