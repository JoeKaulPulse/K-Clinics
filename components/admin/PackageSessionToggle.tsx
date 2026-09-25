'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { markPackageSessionUsed, unmarkPackageSessionUsed } from '@/app/admin/bookings/actions';

// BLD-1096 — admin-only control on a CANCELLED appointment: mark that the
// client's prepaid package should still count this as a used session (e.g. the
// clinic and client agreed the session is spent rather than credited back).
// The appointment stays Cancelled either way — this only affects the package
// balance and adds a badge elsewhere on the booking.
export function PackageSessionToggle({ bookingId, usedAt, usedBy }: { bookingId: string; usedAt: string | null; usedBy: string | null }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const router = useRouter();

  if (usedAt) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--color-gold)]/50 bg-[color-mix(in_oklab,var(--color-gold)_10%,transparent)] p-4">
        <p className="text-sm font-medium text-[var(--color-ink)]">Package session used</p>
        <p className="mt-1 text-xs text-[var(--color-stone)]">
          Marked by {usedBy || 'an admin'} on {new Date(usedAt).toLocaleDateString('en-GB')} — the treatment didn’t take place, but one session was deducted from the client’s package.
        </p>
        {error && <p role="alert" aria-live="assertive" className="mt-2 text-xs text-[var(--color-blush-deep)]">{error}</p>}
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => {
            const r = await unmarkPackageSessionUsed(bookingId);
            if (r.ok) router.refresh(); else setError(r.error || 'Could not undo.');
          })}
          className="mt-2 text-xs text-[var(--color-gold-deep)] underline-offset-2 hover:underline disabled:opacity-40"
        >
          {pending ? 'Reverting…' : 'Undo — restore the session to the package'}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-4">
      <p className="text-sm font-medium">Package session (admin only)</p>
      <p className="mt-1 text-xs text-[var(--color-stone)]">
        If this cancellation should still count as a used session on the client’s prepaid package, mark it below. The appointment stays Cancelled.
      </p>
      {error && <p role="alert" aria-live="assertive" className="mt-2 text-xs text-[var(--color-blush-deep)]">{error}</p>}
      {!confirm ? (
        <button type="button" onClick={() => setConfirm(true)} className="mt-2 rounded-full border border-[var(--color-line)] px-4 py-1.5 text-xs font-medium hover:bg-[var(--color-bone)]">
          Mark as package session used…
        </button>
      ) : (
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => start(async () => {
              const r = await markPackageSessionUsed(bookingId);
              if (r.ok) { setConfirm(false); router.refresh(); } else setError(r.error || 'Could not mark.');
            })}
            className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-xs font-medium text-[var(--color-porcelain)] disabled:opacity-60"
          >
            {pending ? 'Saving…' : 'Confirm — deduct one session'}
          </button>
          <button type="button" onClick={() => setConfirm(false)} className="text-xs text-[var(--color-stone)]">Cancel</button>
        </div>
      )}
    </div>
  );
}
