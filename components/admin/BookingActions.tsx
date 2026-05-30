'use client';

import { useState, useTransition } from 'react';
import { chargeBookingAction, setBookingStatus, cancelBookingAction } from '@/app/admin/bookings/actions';

const money = (p: number) => `£${(p / 100).toFixed(2)}`;

export function BookingActions({
  bookingId,
  status,
  pricePence,
  within24h,
  charged,
}: {
  bookingId: string;
  status: string;
  pricePence: number;
  within24h: boolean;
  charged: number | null;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  const [amount, setAmount] = useState((pricePence / 100).toFixed(2));
  const [waive, setWaive] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);

  const active = status === 'CONFIRMED' || status === 'PENDING';
  const completed = status === 'COMPLETED';

  return (
    <div className="space-y-6">
      {msg && <p className="rounded-[var(--radius-sm)] bg-[var(--color-porcelain)] px-4 py-3 text-sm">{msg}</p>}

      {/* Status controls */}
      {active && (
        <div className="flex flex-wrap gap-2">
          <button disabled={pending} onClick={() => start(async () => { await setBookingStatus(bookingId, 'COMPLETED'); setMsg('Marked completed.'); })}
            className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-60">Mark completed</button>
          <button disabled={pending} onClick={() => start(async () => { await setBookingStatus(bookingId, 'NO_SHOW'); setMsg('Marked no-show.'); })}
            className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm hover:bg-[var(--color-bone)] disabled:opacity-60">No-show</button>
        </div>
      )}

      {/* Charge (delivered service) */}
      {(active || completed) && !charged && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
          <p className="mb-2 text-sm font-medium">Charge card on file</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-[var(--color-stone)]">£</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal"
              className="w-28 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bone)] px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" />
            <button disabled={pending} onClick={() => start(async () => {
              const pence = Math.round(parseFloat(amount) * 100);
              const r = await chargeBookingAction(bookingId, pence);
              setMsg(r.ok ? `Charged ${money(pence)} ✓` : r.error || 'Charge failed');
            })} className="rounded-full bg-[var(--color-gold)] px-5 py-2 text-sm text-white disabled:opacity-60">
              {pending ? 'Charging…' : 'Charge now'}
            </button>
          </div>
          <p className="mt-2 text-xs text-[var(--color-stone)]">{pricePence > 0 ? `Booked price ${money(pricePence)}. Adjust for add-ons or discounts.` : 'On-consultation booking — set the assessed amount.'}</p>
        </div>
      )}

      {charged != null && (
        <p className="rounded-[var(--radius-sm)] bg-[var(--color-jade)]/12 px-4 py-3 text-sm text-[var(--color-jade)]">Charged {money(charged)}.</p>
      )}

      {/* Cancel with override */}
      {active && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-4">
          <p className="mb-2 text-sm font-medium">Cancel booking</p>
          {within24h && (
            <p className="mb-2 text-xs text-[var(--color-stone)]">Within 24h — the full fee ({money(pricePence)}) will be charged unless waived.</p>
          )}
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)"
            className="mb-2 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" />
          {within24h && (
            <label className="mb-3 flex items-center gap-2 text-sm text-[var(--color-stone)]">
              <input type="checkbox" checked={waive} onChange={(e) => setWaive(e.target.checked)} className="h-4 w-4 accent-[var(--color-gold)]" />
              Waive the late-cancellation fee (override)
            </label>
          )}
          {!confirmCancel ? (
            <button onClick={() => setConfirmCancel(true)} className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm hover:bg-[var(--color-bone)]">Cancel booking…</button>
          ) : (
            <div className="flex items-center gap-3">
              <button disabled={pending} onClick={() => start(async () => {
                const r = await cancelBookingAction(bookingId, { reason, waiveFee: waive });
                setMsg(r.ok ? (r.charged ? `Cancelled — charged ${money(r.charged)}.` : 'Cancelled — no charge.') : r.error || 'Failed');
                setConfirmCancel(false);
              })} className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-60">{pending ? 'Cancelling…' : 'Confirm cancel'}</button>
              <button onClick={() => setConfirmCancel(false)} className="text-sm text-[var(--color-stone)]">Keep</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
