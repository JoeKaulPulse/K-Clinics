'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Logo } from '@/components/brand/Logo';

export default function AdminLogin() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
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
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (json.ok) {
        router.push(params.get('from') || '/admin');
        router.refresh();
      } else {
        setError(json.error || 'Login failed.');
      }
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  }

  const field =
    'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-4 py-3 outline-none transition-colors focus:border-[var(--color-gold)]';

  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center text-[var(--color-ink)]">
          <Logo />
        </div>
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-8 shadow-[var(--shadow-soft)]">
          <h1 className="font-[family-name:var(--font-display)] text-2xl">CRM sign in</h1>
          <p className="mt-1 text-sm text-[var(--color-stone)]">Staff access only.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <input className={field} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
            <input className={field} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            {error && <p className="rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-3 py-2 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-[var(--color-ink)] py-3 font-medium text-[var(--color-porcelain)] transition-colors hover:bg-[var(--color-espresso)] disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
