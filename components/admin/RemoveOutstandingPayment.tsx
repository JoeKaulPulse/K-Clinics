'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui/Dialog';
import { removeOutstandingPayment } from '@/app/admin/bookings/actions';

// BLD-1893 — completely remove an incorrectly-generated late-cancel/no-show
// fee, rather than only being able to charge it or waive it at the moment of
// cancellation. Sits next to each outstanding item on the client profile and
// on the appointment itself. Clearing it lifts the client's online-booking
// block automatically (same derived balance BLD-1066 already reads).

const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold-deep)] focus-visible:ring-2 focus-visible:ring-[var(--color-gold-deep)]';

export function RemoveOutstandingPayment({ bookingId, treatmentTitle, pricePence }: { bookingId: string; treatmentTitle: string; pricePence: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');

  function close() {
    if (busy) return;
    setOpen(false);
    setError('');
    setReason('');
  }

  async function remove() {
    if (!reason.trim()) { setError('Add a reason explaining why this payment is being removed.'); return; }
    setBusy(true); setError('');
    const r = await removeOutstandingPayment(bookingId, reason.trim()).catch(() => ({ ok: false, error: 'Could not remove.' }));
    setBusy(false);
    if (r.ok) {
      setOpen(false);
      router.refresh();
    } else {
      setError(r.error || 'Could not remove.');
    }
  }

  return (
    <span className="inline-flex items-center text-xs">
      <button type="button" onClick={() => { setError(''); setOpen(true); }} disabled={busy} className="text-[var(--color-blush-deep)] hover:underline disabled:opacity-50">
        Remove
      </button>

      <Dialog open={open} onClose={close} labelledby={`remove-outstanding-title-${bookingId}`}>
        <div className="w-full max-w-md rounded-t-[var(--radius-xl)] bg-[var(--color-porcelain)] p-6 shadow-[var(--shadow-lift)] sm:rounded-[var(--radius-xl)]">
          <div className="mb-1 flex items-center justify-between">
            <h2 id={`remove-outstanding-title-${bookingId}`} className="font-[family-name:var(--font-display)] text-xl">Remove outstanding payment</h2>
            <button onClick={close} aria-label="Close" className="text-[var(--color-stone)] hover:text-[var(--color-ink)]"><span aria-hidden="true">✕</span></button>
          </div>
          <p className="mt-2 text-sm text-[var(--color-stone)]">
            {treatmentTitle} · £{(pricePence / 100).toFixed(2)}. This clears the balance completely — the client won’t be charged for it and any booking block it caused is lifted immediately. This can’t be undone from here.
          </p>

          <div className="mt-3 space-y-3">
            <label className="block text-xs text-[var(--color-stone)]">Reason *<br />
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} autoFocus placeholder="e.g. generated in error — client cancelled outside the 24h window"
                className={`${field} mt-1`} />
            </label>
            {error && <p role="alert" aria-live="assertive" className="rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-3 py-2 text-sm">{error}</p>}
          </div>

          <div className="mt-4 flex justify-end gap-3">
            <button onClick={close} disabled={busy} className="px-4 py-2 text-sm text-[var(--color-stone)] disabled:opacity-50">Cancel</button>
            <button onClick={remove} disabled={busy} className="rounded-full bg-[var(--color-blush-deep)] px-5 py-2 text-sm font-medium text-white disabled:opacity-60">
              {busy ? 'Removing…' : 'Remove payment'}
            </button>
          </div>
        </div>
      </Dialog>
    </span>
  );
}
