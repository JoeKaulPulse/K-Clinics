'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { linkBookingToPackage, unlinkBookingFromPackage } from '@/app/admin/bookings/actions';

// BLD-1375 — attach an appointment booked outside the package flow to the
// client's prepaid course, so it counts against the course balance (or detach
// one linked in error). Server action re-validates everything; this is just the
// picker.
export type LinkablePackage = { purchaseBookingId: string; label: string; sessionsTotal: number; sessionsRemaining: number; paid: boolean };

export function PackageLinkControl({ bookingId, linked, options }: { bookingId: string; linked: boolean; options: LinkablePackage[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState(options.length === 1 ? options[0].purchaseBookingId : '');
  const router = useRouter();

  if (linked) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-4">
        <p className="text-sm font-medium">Linked to a course package</p>
        <p className="mt-1 text-xs text-[var(--color-stone)]">This appointment counts against the client’s prepaid course balance.</p>
        {error && <p role="alert" aria-live="assertive" className="mt-2 text-xs text-[var(--color-blush-deep)]">{error}</p>}
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => {
            const r = await unlinkBookingFromPackage(bookingId);
            if (r.ok) router.refresh(); else setError(r.error || 'Could not unlink.');
          })}
          className="mt-2 text-xs text-[var(--color-gold-deep)] underline-offset-2 hover:underline disabled:opacity-40"
        >
          {pending ? 'Unlinking…' : 'Unlink — remove it from the course balance'}
        </button>
      </div>
    );
  }

  if (!options.length) return null;
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-4">
      <p className="text-sm font-medium">Link to a course package</p>
      <p className="mt-1 text-xs text-[var(--color-stone)]">
        This client has a prepaid course for this treatment. Link the appointment so it counts as one of the course’s sessions instead of a separate visit.
      </p>
      {error && <p role="alert" aria-live="assertive" className="mt-2 text-xs text-[var(--color-blush-deep)]">{error}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {options.length > 1 ? (
          <select
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            aria-label="Course package"
            className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-1.5 text-xs"
          >
            <option value="">Choose a course…</option>
            {options.map((o) => (
              <option key={o.purchaseBookingId} value={o.purchaseBookingId}>
                {o.label} — {o.sessionsRemaining} of {o.sessionsTotal} left{o.paid ? '' : ' (unpaid)'}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-[var(--color-ink-soft)]">
            {options[0].label} — {options[0].sessionsRemaining} of {options[0].sessionsTotal} left{options[0].paid ? '' : ' (unpaid)'}
          </span>
        )}
        <button
          type="button"
          disabled={pending || !choice}
          onClick={() => start(async () => {
            const r = await linkBookingToPackage(bookingId, choice);
            if (r.ok) router.refresh(); else setError(r.error || 'Could not link.');
          })}
          className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-xs font-medium text-[var(--color-porcelain)] disabled:opacity-60"
        >
          {pending ? 'Linking…' : 'Link appointment'}
        </button>
      </div>
    </div>
  );
}
