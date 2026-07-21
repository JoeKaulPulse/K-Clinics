'use client';

import { useState } from 'react';
import Link from 'next/link';

// Share-to-claim reward: after sharing, the visitor enters their name + email to
// create an account and receive a single-use discount code (issued + emailed by
// /api/kiosk/results/[id]/claim, which is share-gated server-side).
export function ClaimReward({ resultId, hasShared = false }: { resultId: string; hasShared?: boolean }) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ code: string; pct: number; days: number } | null>(null);

  async function claim() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const r = await fetch(`/api/kiosk/results/${resultId}/claim`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, firstName }),
      }).then((x) => x.json());
      if (r.ok) setDone({ code: r.code, pct: r.pct, days: r.days });
      else setError(r.error || 'Could not claim — please try again.');
    } catch { setError('Network error — please try again.'); }
    finally { setBusy(false); }
  }

  if (!hasShared) {
    return (
      <div className="mx-auto mt-5 w-full max-w-md rounded-[var(--radius-lg)] bg-[var(--color-porcelain)]/20 border border-[var(--color-gold-soft)]/30 p-6 text-center text-[var(--color-porcelain)]">
        <p className="font-[family-name:var(--font-display)] text-xl">🎁 Unlock your reward</p>
        <p className="mt-2 text-sm text-[var(--color-blush)]">Share your score above — then come back here to claim a discount off your first treatment.</p>
        <div className="mt-4 flex items-center justify-center gap-2 text-[var(--color-stone)] text-xs">
          <span className="text-lg">↑</span>
          <span>Share to unlock</span>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto mt-5 w-full max-w-md rounded-[var(--radius-lg)] bg-[var(--color-porcelain)] p-6 text-center text-[var(--color-ink)] shadow-xl">
        <p className="font-[family-name:var(--font-display)] text-xl">Your {done.pct}% reward 🎁</p>
        <p className="mt-2 text-sm text-[var(--color-stone)]">Quote this code when you book your first treatment. We’ve emailed it to you too.</p>
        <p className="mx-auto mt-4 inline-block rounded-[var(--radius-md)] border-2 border-dashed border-[var(--color-gold)] px-5 py-3 font-[family-name:var(--font-mono,monospace)] text-2xl tracking-widest">{done.code}</p>
        <p className="mt-3 text-xs text-[var(--color-stone)]">Single use · valid {done.days} days · ages 18+.</p>
        <Link href="/book" className="mt-5 block rounded-[var(--radius-md)] bg-[var(--color-ink)] px-4 py-3 text-base font-medium text-[var(--color-porcelain)] transition hover:opacity-90">Book your treatment →</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-5 w-full max-w-md rounded-[var(--radius-lg)] bg-[var(--color-porcelain)] p-6 text-[var(--color-ink)] shadow-xl">
      <p className="text-center font-[family-name:var(--font-display)] text-xl">Claim your reward</p>
      <p className="mt-1 text-center text-sm text-[var(--color-stone)]">Shared it? Create your account to unlock a discount off your first treatment.</p>
      <div className="mt-4 space-y-2">
        <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" autoComplete="given-name"
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-3 text-base outline-none focus:border-[var(--color-gold)]" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" placeholder="Email" autoComplete="email"
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-3 text-base outline-none focus:border-[var(--color-gold)]" />
      </div>
      {error && <p role="alert" aria-live="assertive" className="mt-3 text-center text-sm text-[var(--color-blush)]">{error}</p>}
      <button onClick={claim} disabled={busy || !email.trim() || !firstName.trim()}
        className="mt-4 w-full rounded-[var(--radius-md)] bg-[var(--color-gold)] px-4 py-4 text-base font-medium text-[var(--color-ink)] transition hover:opacity-90 disabled:opacity-50">
        {busy ? 'Claiming…' : 'Create account & claim →'}
      </button>
      <p className="mt-2 text-center text-[0.7rem] text-[var(--color-stone)]">By continuing you agree to receive your reward and occasional offers. Unsubscribe anytime.</p>
    </div>
  );
}
