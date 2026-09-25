'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { reassignPractitioner } from '@/app/admin/bookings/actions';

export type ClinicianOpt = { id: string; name: string };

// BLD-211 — change the practitioner/specialist assigned to a booking.
export function PractitionerReassign({ bookingId, current, clinicians }: { bookingId: string; current: string | null; clinicians: ClinicianOpt[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current ?? '');
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  // BLD-1886: a practitioner double-booking clash comes back as a warning, not
  // a hard error — offer "Reassign anyway" instead of just showing the message.
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  const currentName = clinicians.find((c) => c.id === current)?.name;

  function save(force = false) {
    setErr(null);
    start(async () => {
      const r = await reassignPractitioner(bookingId, value || null, { force });
      if (r.ok) { setEditing(false); setConflictWarning(null); router.refresh(); }
      else if (r.code === 'PRACTITIONER_CONFLICT') setConflictWarning(r.error || 'That clinician already has an overlapping appointment.');
      else { setErr(r.error || 'Could not reassign.'); setConflictWarning(null); }
    });
  }

  if (!editing) {
    return (
      <p className="mt-6 text-sm text-[var(--color-stone)]">
        Assigned clinician: <span className="font-medium text-[var(--color-ink)]">{currentName || 'Unassigned'}</span>
        <button onClick={() => { setValue(current ?? ''); setEditing(true); }} className="ml-3 rounded-full border border-[var(--color-line)] px-2.5 py-1 text-xs hover:bg-[var(--color-bone)]">Change</button>
      </p>
    );
  }

  return (
    <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-[var(--color-stone)]">Assigned clinician:</span>
      <select value={value} onChange={(e) => { setValue(e.target.value); setConflictWarning(null); }} className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 text-sm outline-none focus:border-[var(--color-gold-deep)] focus-visible:ring-2 focus-visible:ring-[var(--color-gold-deep)]">
        <option value="">Unassigned</option>
        {clinicians.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <button onClick={() => save(false)} disabled={pending} className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-xs font-medium text-[var(--color-porcelain)] disabled:opacity-50">{pending ? 'Saving…' : 'Save'}</button>
      <button onClick={() => { setEditing(false); setErr(null); setConflictWarning(null); }} className="text-xs text-[var(--color-stone)] hover:text-[var(--color-ink)]">Cancel</button>
      {err && <span className="w-full text-xs text-[var(--color-blush-deep)]">{err}</span>}
      {conflictWarning && (
        <span className="flex w-full flex-wrap items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-gold)] bg-[var(--color-gold)]/10 p-2 text-xs text-[var(--color-ink)]">
          {conflictWarning}
          <button onClick={() => save(true)} disabled={pending} className="rounded-full bg-[var(--color-gold-deep)] px-3 py-1 text-xs font-medium text-white disabled:opacity-60">{pending ? 'Saving…' : 'Reassign anyway'}</button>
        </span>
      )}
      {clinicians.length === 0 && <span className="w-full text-xs text-[var(--color-stone)]">No clinicians are set up to perform this treatment — set competencies under Schedules.</span>}
    </div>
  );
}
