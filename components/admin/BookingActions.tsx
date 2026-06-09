'use client';

import { useState, useTransition } from 'react';
import { chargeBookingAction, refundBookingAction, setBookingStatus, cancelBookingAction } from '@/app/admin/bookings/actions';

const money = (p: number) => `£${(p / 100).toFixed(2)}`;

export function BookingActions({
  bookingId,
  status,
  pricePence,
  within24h,
  charged,
  refunded = null,
  refundableUntil = null,
  canManage = true,
  canCharge = true,
}: {
  bookingId: string;
  status: string;
  pricePence: number;
  within24h: boolean;
  charged: number | null;
  refunded?: number | null;
  refundableUntil?: string | null;
  canManage?: boolean;
  canCharge?: boolean;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  const [amount, setAmount] = useState((pricePence / 100).toFixed(2));
  const [waive, setWaive] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmCharge, setConfirmCharge] = useState(false);

  const refundedPence = refunded ?? 0;
  const remainingRefund = Math.max(0, (charged ?? 0) - refundedPence);
  const windowOpen = refundableUntil ? Date.now() < new Date(refundableUntil).getTime() : false;
  const [refundAmt, setRefundAmt] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [confirmRefund, setConfirmRefund] = useState(false);

  const active = status === 'CONFIRMED' || status === 'PENDING';
  const completed = status === 'COMPLETED';

  if (!canManage && !canCharge) {
    return <p className="rounded-[var(--radius-sm)] bg-[var(--color-bone)] px-4 py-3 text-sm text-[var(--color-stone)]">You don’t have permission to manage or charge this appointment.</p>;
  }

  return (
    <div className="space-y-6">
      {msg && <p className="rounded-[var(--radius-sm)] bg-[var(--color-porcelain)] px-4 py-3 text-sm">{msg}</p>}

      {/* Status controls */}
      {active && canManage && (
        <div className="flex flex-wrap gap-2">
          <button disabled={pending} onClick={() => start(async () => { const r = await setBookingStatus(bookingId, 'COMPLETED'); setMsg(r.ok ? 'Marked completed.' : r.error || 'Could not update.'); })}
            className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-60">Mark completed</button>
          <button disabled={pending} onClick={() => start(async () => { const r = await setBookingStatus(bookingId, 'NO_SHOW'); setMsg(r.ok ? 'Marked no-show.' : r.error || 'Could not update.'); })}
            className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm hover:bg-[var(--color-bone)] disabled:opacity-60">No-show</button>
        </div>
      )}

      {/* Undo a mis-clicked status — reset a no-show (or a not-yet-charged
          completion) back to confirmed. Hidden once a charge has been taken. */}
      {canManage && (status === 'NO_SHOW' || (completed && charged == null)) && (
        <div className="flex flex-wrap items-center gap-2">
          <button disabled={pending} onClick={() => start(async () => { const r = await setBookingStatus(bookingId, 'CONFIRMED'); setMsg(r.ok ? 'Reset to confirmed.' : r.error || 'Could not update.'); })}
            className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm hover:bg-[var(--color-bone)] disabled:opacity-60">↩ Reset to confirmed</button>
          <span className="text-xs text-[var(--color-stone)]">{status === 'NO_SHOW' ? 'Marked no-show by mistake? Put it back to confirmed.' : 'Re-open this appointment — it hasn’t been charged.'}</span>
        </div>
      )}

      {/* Charge — gated behind completion so a client is never charged before
          their treatment is delivered. */}
      {canCharge && active && !charged && (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-line)] bg-[var(--color-bone)] p-4">
          <p className="text-sm font-medium text-[var(--color-stone)]">Take payment</p>
          <p className="mt-1 text-xs text-[var(--color-stone)]">Available once the appointment is marked <strong>completed</strong> — this prevents charging before the treatment is delivered.</p>
        </div>
      )}
      {canCharge && completed && !charged && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
          <p className="mb-2 text-sm font-medium">Charge card on file</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-[var(--color-stone)]">£</span>
            <input value={amount} onChange={(e) => { setAmount(e.target.value); setConfirmCharge(false); }} inputMode="decimal"
              className="w-28 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bone)] px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" />
            {!confirmCharge ? (
              <button disabled={pending || !(parseFloat(amount) > 0)} onClick={() => setConfirmCharge(true)}
                className="rounded-full bg-[var(--color-gold)] px-5 py-2 text-sm text-white disabled:opacity-60">Charge now…</button>
            ) : (
              <span className="flex items-center gap-2">
                <button disabled={pending} onClick={() => start(async () => {
                  const pence = Math.round(parseFloat(amount) * 100);
                  const r = await chargeBookingAction(bookingId, pence);
                  setMsg(r.ok ? `Charged ${money(pence)} ✓` : r.error || 'Charge failed');
                  setConfirmCharge(false);
                })} className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-60">
                  {pending ? 'Charging…' : `Confirm — charge ${money(Math.round((parseFloat(amount) || 0) * 100))}`}
                </button>
                <button onClick={() => setConfirmCharge(false)} className="text-sm text-[var(--color-stone)]">Cancel</button>
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-[var(--color-stone)]">{pricePence > 0 ? `Booked price ${money(pricePence)}. Adjust for add-ons or discounts.` : 'On-consultation booking — set the assessed amount.'}</p>
        </div>
      )}

      {charged != null && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
          <p className="text-sm">
            <span className="text-[var(--color-jade)]">Charged {money(charged)}</span>
            {refundedPence > 0 && <span className="text-[var(--color-stone)]"> · refunded {money(refundedPence)}{remainingRefund === 0 ? ' (full)' : ''}</span>}
          </p>

          {canCharge && remainingRefund > 0 && windowOpen && (
            <div className="mt-3">
              <p className="mb-2 text-sm font-medium">Refund the client</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-[var(--color-stone)]">£</span>
                <input value={refundAmt} onChange={(e) => { setRefundAmt(e.target.value); setConfirmRefund(false); }} inputMode="decimal" placeholder={(remainingRefund / 100).toFixed(2)}
                  className="w-28 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bone)] px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" />
                <input value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="Reason (optional)"
                  className="min-w-[8rem] flex-1 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bone)] px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" />
              </div>
              {(() => { const pence = Math.round((parseFloat(refundAmt) || remainingRefund / 100) * 100); return (
                !confirmRefund ? (
                  <button disabled={pending} onClick={() => setConfirmRefund(true)} className="mt-2 rounded-full border border-[var(--color-line)] px-5 py-2 text-sm hover:bg-[var(--color-bone)]">Refund…</button>
                ) : (
                  <span className="mt-2 flex flex-wrap items-center gap-2">
                    <button disabled={pending} onClick={() => start(async () => {
                      const r = await refundBookingAction(bookingId, pence, refundReason);
                      setMsg(r.ok ? `Refunded ${money(pence)} ✓` : r.error || 'Refund failed');
                      setConfirmRefund(false); setRefundAmt('');
                    })} className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-60">
                      {pending ? 'Refunding…' : `Confirm — refund ${money(pence)}`}
                    </button>
                    <button onClick={() => setConfirmRefund(false)} className="text-sm text-[var(--color-stone)]">Cancel</button>
                  </span>
                )); })()}
              <p className="mt-2 text-xs text-[var(--color-stone)]">Up to {money(remainingRefund)} refundable · until {new Date(refundableUntil!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}. Goes back to the card used.</p>
            </div>
          )}
          {remainingRefund > 0 && !windowOpen && <p className="mt-2 text-xs text-[var(--color-stone-soft)]">The refund window for this payment has passed — refund in Stripe directly if still possible.</p>}
        </div>
      )}

      {/* Cancel with override */}
      {canManage && active && (
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
                setMsg(r.ok ? (r.charged ? `Cancelled — charged ${money(r.charged)}.` : r.feeFailed ? 'Cancelled — late fee FAILED, please follow up.' : r.requiresAction ? 'Cancelled — fee needs card authentication (client emailed).' : 'Cancelled — no charge.') : r.error || 'Failed');
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
