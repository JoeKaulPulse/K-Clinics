'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { removeAddonTreatment } from '@/app/admin/bookings/clinical-actions';

// BLD-1895 — an add-on treatment couldn't be removed once added. A small
// inline confirm (not window.confirm, per the existing BLD-1559 accessibility
// fix) rather than a full dialog: removing a line item is low-risk and easily
// undone by adding it back, so a lighter-weight control fits.
export function RemoveAddonButton({ bookingId, itemId }: { bookingId: string; itemId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    setError(null);
    start(async () => {
      const res = await removeAddonTreatment(bookingId, itemId);
      if (res.ok) router.refresh();
      else {
        // Leave the confirm state so the error (rendered below) is visible.
        setConfirming(false);
        setError(res.error || 'Could not remove.');
      }
    });
  }

  if (confirming) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 text-xs">
        <span className="text-[var(--color-stone)]">Remove?</span>
        <button type="button" onClick={remove} disabled={pending} className="text-[var(--color-blush-deep)] hover:underline disabled:opacity-50">{pending ? '…' : 'Yes'}</button>
        <button type="button" onClick={() => setConfirming(false)} disabled={pending} className="text-[var(--color-stone)] hover:underline disabled:opacity-50">No</button>
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      <button type="button" onClick={() => setConfirming(true)} aria-label="Remove this add-on" className="text-xs text-[var(--color-stone)] hover:text-[var(--color-blush-deep)] hover:underline">
        Remove
      </button>
      {error && <span role="alert" className="text-xs text-[var(--color-blush-deep)]">{error}</span>}
    </span>
  );
}
