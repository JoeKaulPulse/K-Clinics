'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Labels = {
  use: string; title: string; hint: string; applied: string;
  apply: string; remove: string; cancel: string;
};

/** Inline points-redemption control on an upcoming, priced booking.
 *  `maxPence` is 50% of the price; `balancePence` is what the client can afford. */
export function RedeemPoints({
  bookingId, pricePence, appliedPence, maxPence, balancePence, currency, labels,
}: {
  bookingId: string;
  pricePence: number;
  appliedPence: number;
  maxPence: number;
  balancePence: number;
  currency: (pence: number) => string;
  labels: Labels;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // The most the client can apply here: lesser of the 50% cap and their balance,
  // rounded down to whole pounds.
  const ceilingPence = Math.floor(Math.min(maxPence, balancePence) / 100) * 100;
  const [pounds, setPounds] = useState(Math.floor(Math.max(appliedPence, ceilingPence) / 100));

  async function send(points: number) {
    setBusy(true); setErr('');
    const res = await fetch('/api/account/rewards/redeem', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId, points }),
    });
    setBusy(false);
    if (res.ok) { setOpen(false); router.refresh(); }
    else { const j = await res.json().catch(() => ({})); setErr(j.error || 'Could not apply points.'); }
  }

  if (appliedPence > 0 && !open) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-[var(--color-jade)]/12 px-3 py-1.5 text-sm font-medium text-[var(--color-jade)]">
          {labels.applied.replace('{amount}', currency(appliedPence))}
          <button onClick={() => send(0)} disabled={busy} className="text-xs underline opacity-80 hover:opacity-100">{labels.remove}</button>
        </span>
        {err && <span className="text-xs text-[var(--color-blush)]">{err}</span>}
      </span>
    );
  }

  if (!open) {
    // Nothing to redeem yet — only offer if they have at least £1 available here.
    if (ceilingPence < 100) return null;
    return (
      <button onClick={() => setOpen(true)} className="rounded-full border border-[var(--color-gold)] px-4 py-2 text-sm font-medium text-[var(--color-gold)] hover:bg-[var(--color-gold)]/10">
        {labels.use}
      </button>
    );
  }

  const maxPounds = Math.floor(ceilingPence / 100);

  return (
    <div className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
      <p className="text-sm font-medium">{labels.title}</p>
      <p className="mt-1 text-xs text-[var(--color-stone)]">
        {labels.hint.replace('{max}', currency(ceilingPence)).replace('{balance}', String(Math.floor(balancePence / 100) * 100))}
      </p>
      <div className="mt-3 flex items-center gap-3">
        <input
          type="range" min={0} max={maxPounds} step={1} value={pounds}
          onChange={(e) => setPounds(Number(e.target.value))}
          className="flex-1 accent-[var(--color-gold)]"
        />
        <span className="w-20 text-right font-[family-name:var(--font-display)] text-lg text-[var(--color-gold)]">−{currency(pounds * 100)}</span>
      </div>
      {err && <p className="mt-2 text-xs text-[var(--color-blush)]">{err}</p>}
      <div className="mt-3 flex gap-2">
        <button onClick={() => send(pounds * 100)} disabled={busy} className="rounded-full bg-[var(--color-gold)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-ink)] disabled:opacity-60">
          {busy ? '…' : labels.apply}
        </button>
        <button onClick={() => { setOpen(false); setErr(''); }} className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-medium text-[var(--color-stone)]">{labels.cancel}</button>
      </div>
    </div>
  );
}
