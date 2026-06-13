'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { approveBookingRequestAction, cancelBookingAction } from '@/app/admin/bookings/actions';

// Approve / decline panel for a same-day appointment REQUEST. Shown on the booking
// detail when status is REQUESTED. Approving re-checks availability and confirms;
// declining cancels and lets the client know.
export function SameDayRequestActions({ bookingId, when }: { bookingId: string; when: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'approve' | 'decline' | null>(null);
  const [error, setError] = useState('');

  async function approve() {
    setBusy('approve'); setError('');
    const res = await approveBookingRequestAction(bookingId);
    setBusy(null);
    if (res.ok) router.refresh();
    else setError(res.error || 'Could not approve this request.');
  }

  async function decline() {
    if (!window.confirm('Decline this same-day request? The client will be told we can’t fit them in today.')) return;
    setBusy('decline'); setError('');
    const res = await cancelBookingAction(bookingId, { reason: 'Same-day request could not be accommodated', waiveFee: true });
    setBusy(null);
    if (res.ok) router.refresh();
    else setError(res.error || 'Could not decline this request.');
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-gold)]/50 bg-[color-mix(in_oklab,var(--color-gold)_10%,transparent)] p-5">
      <p className="eyebrow mb-1 text-[var(--color-gold-deep)]">Same-day request — needs a decision</p>
      <p className="text-sm text-[var(--color-ink)]">
        A client asked to come in today{when ? ` at ${when}` : ''}. Approve to confirm the appointment and notify them, or decline.
      </p>
      {error && <p className="mt-2 text-sm text-[#b23b3b]">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={approve} disabled={!!busy} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm font-medium text-[var(--color-porcelain)] transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none">
          {busy === 'approve' ? 'Approving…' : 'Approve & confirm'}
        </button>
        <button type="button" onClick={decline} disabled={!!busy} className="rounded-full border border-[var(--color-line)] px-5 py-2 text-sm font-medium hover:bg-[var(--color-bone)] disabled:opacity-50">
          {busy === 'decline' ? 'Declining…' : 'Decline'}
        </button>
      </div>
    </div>
  );
}
