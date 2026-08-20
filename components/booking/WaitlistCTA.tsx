'use client';

import { useState } from 'react';

// BLD-133 — "notify me if a slot frees" shown when a chosen day is fully booked.
//
// Lives in its own module (BLD-1421) because two flows use it: the fresh
// booking flow (BookingFlow.tsx) and the reschedule flow
// (app/(marketing)/booking/manage/ManageClient.tsx). Importing it from
// BookingFlow instead would pull that whole module — and with it the Stripe
// React SDK and the booking wizard — into the manage-booking page's client
// bundle, which is reached from a link in every confirmation email.
//
// `client` only needs firstName/email to prefill the form — a narrower type
// than BookingFlow's ClientInfo, so callers without a signed-in session (the
// token-based manage-booking page) don't have to fabricate the rest of it.
export function WaitlistCTA({ treatmentSlug, treatmentTitle, date, client }: { treatmentSlug: string; treatmentTitle: string; date: string; client: { firstName: string; email: string } }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(client.firstName || '');
  const [email, setEmail] = useState(client.email || '');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const inp = 'min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm focus:border-[var(--color-gold)] focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]';
  const dayLabel = new Date(date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  async function join() {
    setErr('');
    if (!name.trim() || !/\S+@\S+\.\S+/.test(email)) { setErr('Enter your name and a valid email.'); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/waitlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ treatmentSlug, name, email, fromDate: date, toDate: date }) }).then((x) => x.json());
      if (r.ok) setDone(true); else setErr(r.error || 'Could not join the waitlist.');
    } catch { setErr('Network error — please try again.'); } finally { setBusy(false); }
  }

  if (done) return <p className="mt-3 rounded-[var(--radius-sm)] bg-[var(--color-gold)]/10 px-3 py-2 text-sm text-[var(--color-ink)]">You’re on the waitlist for {dayLabel} — we’ll email you if a slot opens.</p>;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="mt-3 rounded-full border border-[var(--color-gold)] px-4 py-2 text-sm text-[var(--color-gold-deep)] transition-colors hover:bg-[var(--color-gold)]/10">🔔 Notify me if a slot opens that day</button>;
  return (
    <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bone)]/50 p-3">
      <p className="text-sm text-[var(--color-stone)]">We’ll email you if a {treatmentTitle} slot frees up on {dayLabel}.</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" aria-label="Your name" className={inp} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" aria-label="Email" className={inp} />
        <button type="button" onClick={join} disabled={busy} className="rounded-full bg-[var(--color-gold-deep)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Joining…' : 'Join waitlist'}</button>
      </div>
      {err && <p role="alert" aria-live="assertive" className="mt-1 text-xs text-[var(--color-blush-deep)]">{err}</p>}
    </div>
  );
}
