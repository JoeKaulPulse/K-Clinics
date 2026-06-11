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

  const currentName = clinicians.find((c) => c.id === current)?.name;

  function save() {
    setErr(null);
    start(async () => {
      const r = await reassignPractitioner(bookingId, value || null);
      if (r.ok) { setEditing(false); router.refresh(); } else setErr(r.error || 'Could not reassign.');
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
      <select value={value} onChange={(e) => setValue(e.target.value)} className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]">
        <option value="">Unassigned</option>
        {clinicians.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <button onClick={save} disabled={pending} className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-xs font-medium text-[var(--color-porcelain)] disabled:opacity-50">{pending ? 'Saving…' : 'Save'}</button>
      <button onClick={() => { setEditing(false); setErr(null); }} className="text-xs text-[var(--color-stone)] hover:text-[var(--color-ink)]">Cancel</button>
      {err && <span className="w-full text-xs text-[var(--color-blush-deep)]">{err}</span>}
      {clinicians.length === 0 && <span className="w-full text-xs text-[var(--color-stone-soft)]">No clinicians are set up to perform this treatment — set competencies under Schedules.</span>}
    </div>
  );
}
