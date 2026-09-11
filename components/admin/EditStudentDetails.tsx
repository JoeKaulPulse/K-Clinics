'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { editStudent } from '@/app/admin/academy/students/actions';
import { Dialog } from '@/components/ui/Dialog';

// BLD-1732 — admin-only edit of a trainee's first/last name. Email is never
// shown here (it stays locked); saves write an admin-only audit entry.
const f = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)] focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]';

export function EditStudentDetails({ studentId, firstName, lastName }: { studentId: string; firstName: string; lastName: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [d, setD] = useState({ firstName, lastName: lastName ?? '' });
  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD((p) => ({ ...p, [k]: v }));

  function save() {
    setError(null);
    if (!d.firstName.trim()) { setError('First name is required.'); return; }
    start(async () => {
      const r = await editStudent(studentId, d);
      if (r.ok) { setOpen(false); router.refresh(); }
      else setError(r.error || 'Could not save.');
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-bone)]">
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 13.5 13 4.5l2.5 2.5L6.5 16H4z" /><path d="M11.5 6 14 8.5" /></svg>
        Edit name
      </button>
    );
  }

  return (
    <Dialog open={open} onClose={() => { if (!pending) setOpen(false); }} labelledby="edit-student-title">
      <div className="w-full max-w-md rounded-t-[var(--radius-xl)] bg-[var(--color-porcelain)] p-6 shadow-[var(--shadow-lift)] sm:rounded-[var(--radius-xl)] md:p-7">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="edit-student-title" className="font-[family-name:var(--font-display)] text-2xl">Edit trainee name</h2>
          <button onClick={() => setOpen(false)} aria-label="Close" className="text-[var(--color-stone)] hover:text-[var(--color-ink)]"><span aria-hidden="true">✕</span></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-[var(--color-stone)]">First name<input className={`${f} mt-1`} value={d.firstName} onChange={(e) => set('firstName', e.target.value)} /></label>
            <label className="text-xs text-[var(--color-stone)]">Last name<input className={`${f} mt-1`} value={d.lastName} onChange={(e) => set('lastName', e.target.value)} /></label>
          </div>
          <p className="text-xs text-[var(--color-stone)]">Email address is locked — trainees sign in with it, so it can’t be changed here.</p>
          {error && <p role="alert" aria-live="assertive" className="rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-3 py-2 text-sm">{error}</p>}
          <p className="text-xs text-[var(--color-stone)]">Changes are recorded in the admin-only activity log. Trainees can’t change their own name from the academy portal.</p>
          <div className="flex justify-end gap-3 pt-1">
            <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-[var(--color-stone)]">Cancel</button>
            <button onClick={save} disabled={pending} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm font-medium text-[var(--color-porcelain)] disabled:opacity-50">{pending ? 'Saving…' : 'Save changes'}</button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
