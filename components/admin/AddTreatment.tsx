'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addTreatmentToBooking } from '@/app/admin/bookings/clinical-actions';

// PRJ-63 — add a treatment to an appointment mid-session. Picks a service variant
// (canonical price) and posts to addTreatmentToBooking, which creates the add-on
// line item and raises the booking total — so billing + the receipt stay in sync.
type VariantOption = { id: string; label: string; pricePence: number };

const money = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0 })}`;

export function AddTreatment({ bookingId, variants }: { bookingId: string; variants: VariantOption[] }) {
  const [variantId, setVariantId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (variants.length === 0) return null;
  const selected = variants.find((v) => v.id === variantId);

  function add() {
    if (!variantId || pending) return;
    setError(null);
    start(async () => {
      const res = await addTreatmentToBooking(bookingId, variantId);
      if (res.ok) { setVariantId(''); router.refresh(); }
      else setError(res.error || 'Could not add the treatment.');
    });
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-line)] bg-[var(--color-bone)]/40 p-4">
      <p className="eyebrow mb-2 text-[var(--color-stone)]">Add a treatment</p>
      <p className="mb-3 text-xs text-[var(--color-stone)]">Adds it to this appointment and updates the total to charge.</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={variantId}
          onChange={(e) => setVariantId(e.target.value)}
          disabled={pending}
          className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]"
        >
          <option value="">Choose a treatment…</option>
          {variants.map((v) => (
            <option key={v.id} value={v.id}>{v.label}{v.pricePence > 0 ? ` — ${money(v.pricePence)}` : ' — on consultation'}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={add}
          disabled={!variantId || pending}
          className="shrink-0 rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-[var(--color-porcelain)] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Adding…' : selected && selected.pricePence > 0 ? `Add · ${money(selected.pricePence)}` : 'Add'}
        </button>
      </div>
      {error && <p role="alert" aria-live="assertive" className="mt-2 text-xs text-[#b23b3b]">{error}</p>}
    </div>
  );
}
