'use client';

import { useState } from 'react';
import Link from 'next/link';
import { scheduleFollowUpAction } from '@/app/admin/bookings/create-action';

// Staff-only follow-up scheduler on the booking detail. Pre-fills the recommended
// next-session date for course treatments, checks room/clinician availability on
// submit, and books the appointment for the same client + treatment. Not shown to
// clients. Times are entered in the booker's local time (UK clinic = Europe/London).
export function ScheduleFollowUp({
  fromBookingId,
  recommendedDate,
  recommendedTime,
  recommendedLabel,
}: {
  fromBookingId: string;
  recommendedDate: string | null; // YYYY-MM-DD
  recommendedTime: string | null; // HH:MM
  recommendedLabel: string | null; // e.g. "about 4 weeks"
}) {
  const [date, setDate] = useState(recommendedDate ?? '');
  const [time, setTime] = useState(recommendedTime ?? '');
  const [override, setOverride] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [clash, setClash] = useState(false);
  const [done, setDone] = useState<{ id: string; when: string } | null>(null);

  async function book() {
    if (!date || !time) { setError('Pick a date and a time.'); return; }
    setBusy(true); setError(''); setClash(false);
    const startISO = new Date(`${date}T${time}`).toISOString();
    const res = await scheduleFollowUpAction({ fromBookingId, startISO, override });
    setBusy(false);
    if (res.ok) {
      setDone({ id: res.bookingId!, when: new Date(startISO).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) });
    } else {
      setError(res.error || 'Could not book this time.');
      if ((res as { clash?: boolean }).clash) setClash(true);
    }
  }

  if (done) {
    return (
      <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-jade)]/40 bg-[color-mix(in_oklab,var(--color-jade)_9%,transparent)] p-5">
        <p className="eyebrow mb-1 text-[var(--color-jade)]">Follow-up booked</p>
        <p className="text-sm text-[var(--color-ink)]">Next appointment booked for <strong>{done.when}</strong>.</p>
        <div className="mt-3 flex flex-wrap gap-4">
          <Link href={`/admin/bookings/${done.id}`} className="text-sm text-[var(--color-gold)] hover:underline">Open appointment →</Link>
          <button type="button" onClick={() => setDone(null)} className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">Book another</button>
        </div>
      </div>
    );
  }

  const field = 'mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm';
  return (
    <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <p className="eyebrow mb-1 text-[var(--color-stone)]">Schedule follow-up</p>
      <p className="text-sm text-[var(--color-stone)]">
        {recommendedLabel ? `Recommended in ${recommendedLabel}. ` : ''}Book the client&rsquo;s next appointment now. We check room and clinician availability before confirming.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="text-xs text-[var(--color-stone)]">Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
        </label>
        <label className="text-xs text-[var(--color-stone)]">Time
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={field} />
        </label>
      </div>
      {error && <p role="alert" aria-live="assertive" className="mt-2 text-sm text-[#b23b3b]">{error}</p>}
      {clash && (
        <label className="mt-2 flex items-center gap-2 text-xs text-[var(--color-stone)]">
          <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} className="h-4 w-4 accent-[var(--color-gold)]" />
          Book anyway — override the clash
        </label>
      )}
      <button
        type="button"
        onClick={book}
        disabled={busy}
        className="mt-3 rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm font-medium text-[var(--color-porcelain)] transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none"
      >
        {busy ? 'Checking availability…' : 'Check availability & book'}
      </button>
      <p className="mt-2 text-[0.7rem] text-[var(--color-stone)]">Staff only. Syncs to Google Calendar once that connection is set up.</p>
    </div>
  );
}
