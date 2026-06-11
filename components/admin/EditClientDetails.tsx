'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { editClient } from '@/app/admin/clients/actions';

// BLD-199 — staff edit a client's details. Saves write an admin-only audit entry.
export type EditableClient = {
  id: string; firstName: string; lastName: string | null; email: string; phone: string | null;
  dob: string | null; gender: string | null; genderSelfDescribe: string | null;
  allergies: string | null; notes: string | null; marketingOptIn: boolean;
};

const GENDERS = [
  { value: '', label: '—' }, { value: 'FEMALE', label: 'Female' }, { value: 'MALE', label: 'Male' },
  { value: 'NON_BINARY', label: 'Non-binary' }, { value: 'OTHER', label: 'Other / self-describe' }, { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
];
const f = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]';

export function EditClientDetails({ client }: { client: EditableClient }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [d, setD] = useState({
    firstName: client.firstName, lastName: client.lastName ?? '', email: client.email, phone: client.phone ?? '',
    dob: client.dob ?? '', gender: client.gender ?? '', genderSelfDescribe: client.genderSelfDescribe ?? '',
    allergies: client.allergies ?? '', notes: client.notes ?? '', marketingOptIn: client.marketingOptIn,
  });
  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD((p) => ({ ...p, [k]: v }));

  function save() {
    setError(null);
    if (!d.firstName.trim()) { setError('First name is required.'); return; }
    start(async () => {
      const r = await editClient(client.id, d);
      if (r.ok) { setOpen(false); router.refresh(); }
      else setError(r.error || 'Could not save.');
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-bone)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]">
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 13.5 13 4.5l2.5 2.5L6.5 16H4z" /><path d="M11.5 6 14 8.5" /></svg>
        Edit details
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6" onClick={() => !pending && setOpen(false)}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[var(--radius-xl)] bg-[var(--color-porcelain)] p-6 shadow-[var(--shadow-lift)] sm:rounded-[var(--radius-xl)] md:p-7" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">Edit client details</h2>
          <button onClick={() => setOpen(false)} className="text-[var(--color-stone)] hover:text-[var(--color-ink)]">✕</button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-[var(--color-stone)]">First name<input className={`${f} mt-1`} value={d.firstName} onChange={(e) => set('firstName', e.target.value)} /></label>
            <label className="text-xs text-[var(--color-stone)]">Last name<input className={`${f} mt-1`} value={d.lastName} onChange={(e) => set('lastName', e.target.value)} /></label>
          </div>
          <label className="block text-xs text-[var(--color-stone)]">Email<input type="email" className={`${f} mt-1`} value={d.email} onChange={(e) => set('email', e.target.value)} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-[var(--color-stone)]">Phone<input type="tel" className={`${f} mt-1`} value={d.phone} onChange={(e) => set('phone', e.target.value)} /></label>
            <label className="text-xs text-[var(--color-stone)]">Date of birth<input type="date" className={`${f} mt-1`} value={d.dob ? d.dob.slice(0, 10) : ''} onChange={(e) => set('dob', e.target.value)} /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-[var(--color-stone)]">Gender
              <select className={`${f} mt-1`} value={d.gender} onChange={(e) => set('gender', e.target.value)}>
                {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </label>
            {d.gender === 'OTHER' && <label className="text-xs text-[var(--color-stone)]">Self-described<input className={`${f} mt-1`} value={d.genderSelfDescribe} onChange={(e) => set('genderSelfDescribe', e.target.value)} /></label>}
          </div>
          <label className="block text-xs text-[var(--color-stone)]">Allergies / dietary notes<input className={`${f} mt-1`} value={d.allergies} onChange={(e) => set('allergies', e.target.value)} /></label>
          <label className="block text-xs text-[var(--color-stone)]">Notes<textarea rows={2} className={`${f} mt-1`} value={d.notes} onChange={(e) => set('notes', e.target.value)} /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.marketingOptIn} onChange={(e) => set('marketingOptIn', e.target.checked)} /> Marketing opt-in</label>
          {error && <p className="rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-3 py-2 text-sm">{error}</p>}
          <p className="text-xs text-[var(--color-stone-soft)]">Changes are recorded in the admin-only activity log.</p>
          <div className="flex justify-end gap-3 pt-1">
            <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-[var(--color-stone)]">Cancel</button>
            <button onClick={save} disabled={pending} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm font-medium text-[var(--color-porcelain)] disabled:opacity-50">{pending ? 'Saving…' : 'Save changes'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
