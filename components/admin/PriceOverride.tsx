'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { overrideBookingPrice } from '@/app/admin/bookings/clinical-actions';

// BLD-1149 — adjust the agreed treatment price from the appointment page (the
// control staff had before, restored). Applies to this appointment only; the
// catalogue price is unchanged. A reason is required and the change is written
// to the booking's activity log with the before/after amounts.
const money = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0 })}`;

export function PriceOverride({ bookingId, basePence }: { bookingId: string; basePence: number }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(() => (basePence / 100).toFixed(2));
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const newPence = Math.round(parseFloat(amount || '0') * 100);
  const valid = Number.isFinite(newPence) && newPence >= 0 && reason.trim().length > 0;

  function save() {
    if (!valid || pending) return;
    setError(null);
    start(async () => {
      const res = await overrideBookingPrice(bookingId, newPence, reason.trim());
      if (res.ok) { setOpen(false); setReason(''); router.refresh(); }
      else setError(res.error || 'Could not adjust the price.');
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-[var(--color-gold-deep)] underline-offset-2 hover:underline">
        Adjust price
      </button>
    );
  }

  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bone)]/40 p-3 text-sm">
      <p className="mb-2 text-xs text-[var(--color-stone)]">Applies to this appointment only — the treatment’s standard price is unchanged. Add-ons keep their own prices.</p>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="price-override-amount" className="sr-only">New treatment price in pounds</label>
        <span className="flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2 py-1.5">
          £<input id="price-override-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-20 outline-none tabular-nums" />
        </span>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (required)"
          aria-label="Reason for the price change"
          className="min-w-[10rem] flex-1 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2 py-1.5 outline-none focus:border-[var(--color-gold)]"
        />
        <button type="button" disabled={!valid || pending} onClick={save} className="rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs font-medium text-[var(--color-porcelain)] disabled:opacity-40">
          {pending ? 'Saving…' : 'Apply'}
        </button>
        <button type="button" disabled={pending} onClick={() => { setOpen(false); setError(null); }} className="rounded-full px-3 py-1.5 text-xs text-[var(--color-stone)] hover:text-[var(--color-ink)]">
          Cancel
        </button>
      </div>
      {newPence !== basePence && Number.isFinite(newPence) && newPence >= 0 && (
        <p className="mt-2 text-xs text-[var(--color-stone)]">was {money(basePence)} → {money(newPence)}</p>
      )}
      {error && <p role="alert" aria-live="assertive" className="mt-2 text-xs text-[var(--color-blush-deep)]">{error}</p>}
    </div>
  );
}
