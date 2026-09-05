'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trackLead } from '@/lib/analytics-events';

// Share-to-claim reward: after sharing, the visitor enters their name + email to
// create an account and receive a single-use discount code (issued + emailed by
// /api/kiosk/results/[id]/claim, which is share-gated server-side).
export function ClaimReward({ resultId, hasShared = false }: { resultId: string; hasShared?: boolean }) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  // BLD-1420: explicit, off-by-default marketing tick — same pattern as
  // EnquiryForm/GiftVoucherFlow/GroupBookingForm, replacing the old passive
  // "by continuing you agree" text that implied consent without a checkbox.
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ code: string; pct: number; days: number } | null>(null);

  async function claim() {
    if (busy) return;
    setBusy(true); setError('');
    // BLD-1637: shared with the server-side Lead event (sendLead) so Meta
    // CAPI/GA4 can dedupe against this browser pixel — same pattern as
    // ConsultForm/GroupBookingForm/TreatmentFinder.
    const eventId = globalThis.crypto.randomUUID();
    try {
      const r = await fetch(`/api/kiosk/results/${resultId}/claim`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, firstName, marketingOptIn, eventId }),
      }).then((x) => x.json());
      if (r.ok) {
        setDone({ code: r.code, pct: r.pct, days: r.days });
        try { trackLead({ eventId: r.eventId || eventId, detail: { source: 'kiosk' } }); } catch { /* analytics best-effort */ }
      } else setError(r.error || 'Could not claim — please try again.');
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
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-3 text-base outline-none focus:border-[var(--color-gold)] focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" placeholder="Email" autoComplete="email"
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-3 text-base outline-none focus:border-[var(--color-gold)] focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]" />
      </div>
      {/* BLD-1420: explicit, off-by-default opt-in — same wording/consent-stamping
          pattern as EnquiryForm/GiftVoucherFlow (marketingConsentFields('kiosk')
          in lib/kiosk.ts), instead of implying consent from passive text. */}
      <label className="mt-4 flex items-start gap-3 text-left text-sm text-[var(--color-stone)]">
        <input type="checkbox" checked={marketingOptIn} onChange={(e) => setMarketingOptIn(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--color-gold)]" />
        Keep me updated with offers, events and skincare tips. Unsubscribe anytime.
      </label>
      {error && <p role="alert" aria-live="assertive" className="mt-3 text-center text-sm text-[var(--color-blush-deep)]">{error}</p>}
      <button onClick={claim} disabled={busy || !email.trim() || !firstName.trim()}
        className="mt-4 w-full rounded-[var(--radius-md)] bg-[var(--color-gold)] px-4 py-4 text-base font-medium text-[var(--color-ink)] transition hover:opacity-90 disabled:opacity-50">
        {busy ? 'Claiming…' : 'Create account & claim →'}
      </button>
      <p className="mt-2 text-center text-[0.7rem] text-[var(--color-stone)]">Your reward code is issued either way. Single use, valid a limited number of days.</p>
    </div>
  );
}
