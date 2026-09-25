'use client';

import { useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui/Dialog';
import { setPackageManualPayment, type ManualPaymentStatus } from '@/app/admin/bookings/actions';

// BLD-1824 — let authorised admins correct a package's payment status when it
// was settled outside the online booking flow (bank transfer, in-clinic
// terminal, cash). Sits on the client profile's Packages card, which is itself
// a <Link> to the booking.
//
// That surrounding <Link> is why this file looks the way it does:
//
//  1. The trigger button calls preventDefault() as well as stopPropagation().
//     stopPropagation alone only stops Next's <Link> click HANDLER — the anchor
//     is still a real <a href>, and its default navigation is cancelled by
//     preventDefault, nothing else.
//  2. The dialog is rendered through a PORTAL to document.body. <Dialog> renders
//     inline, so without this the whole modal — backdrop, <select>, <input>,
//     Cancel and Save — would be DOM descendants of that anchor, and every click
//     inside it would navigate the page away (a full reload, since the React
//     handler is stopped but the href is not). Clicking Save would have started
//     the server action and then immediately navigated off it. React events
//     still bubble through the React tree from a portal, so the wrapper's
//     stopPropagation below is still needed and still does its job.

const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold-deep)] focus-visible:ring-2 focus-visible:ring-[var(--color-gold-deep)]';

export type ManualPayment = {
  status: ManualPaymentStatus | null;
  method: string | null;
  amountPence: number | null;
  at: string | null;
};

export function PackagePaymentControl({ purchaseBookingId, manual }: { purchaseBookingId: string; manual: ManualPayment }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [status, setStatus] = useState<ManualPaymentStatus>(manual.status ?? 'PAID');
  const [method, setMethod] = useState(manual.method ?? '');
  const [amount, setAmount] = useState(manual.amountPence != null ? (manual.amountPence / 100).toFixed(2) : '');

  function openDialog(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setError('');
    setStatus(manual.status ?? 'PAID');
    setMethod(manual.method ?? '');
    setAmount(manual.amountPence != null ? (manual.amountPence / 100).toFixed(2) : '');
    setOpen(true);
  }

  function close() {
    if (pending) return;
    setOpen(false);
    setError('');
  }

  function save() {
    const amountPence = amount.trim() ? Math.round(parseFloat(amount) * 100) : undefined;
    if (amount.trim() && !(amountPence! > 0)) { setError('Enter a valid amount, or leave it blank.'); return; }
    start(async () => {
      const r = await setPackageManualPayment(purchaseBookingId, status, { method: method.trim() || undefined, amountPence });
      if (r.ok) { setOpen(false); router.refresh(); } else setError(r.error || 'Could not save.');
    });
  }

  const dialog = (
    <Dialog open={open} onClose={close} labelledby={`pkg-payment-title-${purchaseBookingId}`}>
      <div className="w-full max-w-md rounded-t-[var(--radius-xl)] bg-[var(--color-porcelain)] p-6 shadow-[var(--shadow-lift)] sm:rounded-[var(--radius-xl)]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h2 id={`pkg-payment-title-${purchaseBookingId}`} className="font-[family-name:var(--font-display)] text-xl">Package payment status</h2>
          <button type="button" onClick={close} aria-label="Close" className="text-[var(--color-stone)] hover:text-[var(--color-ink)]"><span aria-hidden="true">✕</span></button>
        </div>
        <p className="mt-1 text-xs text-[var(--color-stone)]">For a course paid outside the online booking flow (bank transfer, in-clinic terminal, cash).</p>

        <div className="mt-3 space-y-3">
          <label className="block text-xs text-[var(--color-stone)]">Status *<br />
            <select value={status} onChange={(e) => setStatus(e.target.value as ManualPaymentStatus)} className={`${field} mt-1`}>
              <option value="PAID">Paid</option>
              <option value="PARTIALLY_PAID">Partially paid</option>
              <option value="NOT_PAID">Not paid</option>
            </select>
          </label>
          {status !== 'NOT_PAID' && (
            <>
              <label className="block text-xs text-[var(--color-stone)]">Payment method<br />
                <input value={method} onChange={(e) => setMethod(e.target.value)} placeholder="e.g. Bank transfer, card terminal, cash" className={`${field} mt-1`} />
              </label>
              <label className="block text-xs text-[var(--color-stone)]">Amount paid (£)<br />
                <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" className={`${field} mt-1`} />
              </label>
            </>
          )}
          {error && <p role="alert" aria-live="assertive" className="rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-3 py-2 text-sm">{error}</p>}
        </div>

        <div className="mt-4 flex justify-end gap-3">
          <button type="button" onClick={close} disabled={pending} className="px-4 py-2 text-sm text-[var(--color-stone)] disabled:opacity-50">Cancel</button>
          <button type="button" onClick={save} disabled={pending} className="rounded-full bg-[var(--color-gold-deep)] px-5 py-2 text-sm font-medium text-white disabled:opacity-60">
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Dialog>
  );

  return (
    <span onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={openDialog} className="rounded-full border border-[var(--color-line)] px-2.5 py-0.5 text-xs text-[var(--color-stone)] hover:border-[var(--color-gold-deep)] hover:text-[var(--color-ink)]">
        {manual.status ? 'Edit payment' : 'Record payment'}
      </button>
      {/* `open &&` keeps createPortal off the server render (document only
          exists in the browser); `open` can only ever become true from a click. */}
      {open && createPortal(dialog, document.body)}
    </span>
  );
}
