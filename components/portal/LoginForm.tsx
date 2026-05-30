'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authField, authLabel } from '@/components/portal/AuthShell';

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (json.ok) {
        router.push(params.get('from') || '/account');
        router.refresh();
      } else {
        setError(json.error || 'Sign in failed.');
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className={authLabel} htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="email" required className={authField} value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className={authLabel} htmlFor="password">Password</label>
        <input id="password" type="password" autoComplete="current-password" required className={authField} value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p className="rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-4 py-2.5 text-sm text-[var(--color-ink)]">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-[var(--color-gold)] px-6 py-3.5 font-medium text-white shadow-[var(--shadow-gold)] transition-colors hover:bg-[var(--color-ink)] disabled:opacity-60"
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="text-center text-sm text-[var(--color-stone)]">
        New here?{' '}
        <Link href="/account/signup" className="font-medium text-[var(--color-gold)]">
          Create an account — get 15% off
        </Link>
      </p>
      <p className="text-center text-xs text-[var(--color-stone)]">
        Staff & clinicians:{' '}
        <Link href="/admin/login" className="underline">
          CRM sign in
        </Link>
      </p>
    </form>
  );
}
