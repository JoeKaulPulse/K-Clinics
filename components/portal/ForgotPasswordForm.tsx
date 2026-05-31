'use client';

import { useState } from 'react';
import Link from 'next/link';
import { authField, authLabel } from '@/components/portal/AuthShell';

export function ForgotPasswordForm() {
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
        <p className="font-medium">Check your inbox</p>
        <p className="mt-2 text-sm text-[var(--color-stone)]">
          If an account exists for <strong>{email}</strong>, we’ve emailed a link to reset your password. It’s valid for 60 minutes.
        </p>
        <Link href="/account/login" className="mt-4 inline-block text-sm font-medium text-[var(--color-gold)]">← Back to sign in</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className={authLabel} htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="email" required className={authField} value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <button type="submit" disabled={loading} className="w-full rounded-full bg-[var(--color-gold)] px-6 py-3.5 font-medium text-white shadow-[var(--shadow-gold)] transition-colors hover:bg-[var(--color-ink)] disabled:opacity-60">
        {loading ? 'Sending…' : 'Send reset link'}
      </button>
      <p className="text-center text-sm text-[var(--color-stone)]">
        Remembered it? <Link href="/account/login" className="font-medium text-[var(--color-gold)]">Sign in</Link>
      </p>
    </form>
  );
}
