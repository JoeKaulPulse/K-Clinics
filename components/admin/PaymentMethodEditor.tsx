'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateBookingPaymentMethod } from '@/app/admin/bookings/actions';
import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/payment-methods';

// BLD-1874 — correct the payment method recorded against a charged booking.
// Amount/reference/charge date are untouched; only the descriptive label
// changes, and the correction is audited (old → new, who, when).
export function PaymentMethodEditor({ bookingId, method }: { bookingId: string; method: string | null }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<PaymentMethod>((method as PaymentMethod) || 'card');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function save() {
    if (pending) return;
    setError(null);
    start(async () => {
      const res = await updateBookingPaymentMethod(bookingId, value);
      if (res.ok) { setOpen(false); router.refresh(); }
      else setError(res.error || 'Could not update the payment method.');
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-[var(--color-gold-deep)] underline-offset-2 hover:underline">
        {method ? 'Correct payment method' : 'Set payment method'}
      </button>
    );
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <label htmlFor="payment-method-select" className="sr-only">Payment method</label>
      <select
        id="payment-method-select"
        value={value}
        onChange={(e) => setValue(e.target.value as PaymentMethod)}
        className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-2 py-1.5 text-xs outline-none focus:border-[var(--color-gold-deep)] focus-visible:ring-2 focus-visible:ring-[var(--color-gold-deep)]"
      >
        {(Object.entries(PAYMENT_METHODS) as [PaymentMethod, string][]).map(([v, label]) => (
          <option key={v} value={v}>{label}</option>
        ))}
      </select>
      <button type="button" disabled={pending} onClick={save} className="rounded-full bg-[var(--color-ink)] px-3 py-1 text-xs font-medium text-[var(--color-porcelain)] disabled:opacity-40">
        {pending ? 'Saving…' : 'Save'}
      </button>
      <button type="button" disabled={pending} onClick={() => { setOpen(false); setError(null); }} className="rounded-full px-3 py-1 text-xs text-[var(--color-stone)] hover:text-[var(--color-ink)]">
        Cancel
      </button>
      {error && <p role="alert" aria-live="assertive" className="w-full text-xs text-[var(--color-blush-deep)]">{error}</p>}
    </div>
  );
}
