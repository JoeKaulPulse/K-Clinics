'use client';

import { useState } from 'react';
import Link from 'next/link';

const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-4 py-3 text-[var(--color-ink)] outline-none focus:border-[var(--color-gold)]';
const label = 'mb-1.5 block text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]';

export function AcademyForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/academy/account/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch { /* always show confirmation */ }
    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] p-6">
        <p className="font-medium text-[var(--color-ink)]">Check your email</p>
        <p className="mt-2 text-sm text-[var(--color-stone)]">If an account exists for that address, a reset link has been sent. It's valid for 60 minutes.</p>
        <Link href="/academy/portal" className="mt-4 inline-block text-sm font-medium text-[var(--color-gold-deep)]">← Back to sign in</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className={label} htmlFor="academy-reset-email">Email address</label>
        <input id="academy-reset-email" type="email" autoComplete="email" required className={field} value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <button type="submit" disabled={loading} className="w-full rounded-full bg-[var(--color-gold-deep)] px-6 py-3.5 font-medium text-white shadow-[var(--shadow-gold)] transition-colors hover:bg-[var(--color-ink)] disabled:opacity-60">
        {loading ? 'Sending…' : 'Send reset link'}
      </button>
    </form>
  );
}
