'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type CourseOption = { id: string; title: string; level: string | null };

async function post(payload: object) {
  return fetch('/api/admin/academy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}

// Tetiana (student management): enrol an EXISTING trainee onto another course
// straight from their profile, so one person's Level 2/3/4 all hang off the same
// student record. The enrol op matches on email (`ensureStudentForOffer`), so
// reusing this trainee's email never creates a second profile — it just adds an
// enrolment. Courses they're already on are filtered out before they reach here.
export function EnrolInCourse({ studentEmail, studentName, courses }: { studentEmail: string; studentName: string; courses: CourseOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState('');
  const [sendLink, setSendLink] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (courses.length === 0) {
    return <span className="text-xs text-[var(--color-stone)]">Enrolled on every course</span>;
  }

  async function submit() {
    if (!courseId) { setError('Choose a course first.'); return; }
    setBusy(true); setError('');
    const res = await post({ op: 'enrolStudent', courseId, email: studentEmail, name: studentName, status: 'ENROLLED', sendLink });
    const json = await res.json().catch(() => ({ ok: false }));
    setBusy(false);
    if (!json.ok) { setError(json.error || 'Could not enrol. Please try again.'); return; }
    setOpen(false); setCourseId(''); setError('');
    router.refresh();
  }

  if (!open) {
    return <button onClick={() => setOpen(true)} className="rounded-full border border-[var(--color-gold)] px-4 py-1.5 text-xs text-[var(--color-gold-deep)] hover:bg-[var(--color-gold)]/10">+ Enrol in another course</button>;
  }

  return (
    <div className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bone)] p-4">
      <p className="text-sm font-medium">Enrol {studentName} in another course</p>
      <p className="mt-0.5 text-xs text-[var(--color-stone)]">This adds the course to their existing profile — it won’t create a new student record.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select value={courseId} onChange={(e) => { setCourseId(e.target.value); setError(''); }} className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm">
          <option value="">Choose a course…</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}{c.level ? ` (${c.level})` : ''}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-[var(--color-stone)]">
          <input type="checkbox" checked={sendLink} onChange={(e) => setSendLink(e.target.checked)} /> Email them a portal link
        </label>
        <button onClick={submit} disabled={busy} className="rounded-full border border-[var(--color-gold)] px-4 py-1.5 text-sm text-[var(--color-gold-deep)] hover:bg-[var(--color-gold)]/10 disabled:opacity-50">{busy ? 'Enrolling…' : 'Enrol'}</button>
        <button onClick={() => { setOpen(false); setError(''); }} disabled={busy} className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)] disabled:opacity-50">Cancel</button>
      </div>
      {error && <p role="alert" aria-live="assertive" className="mt-2 text-xs text-[var(--color-blush-deep)]">{error}</p>}
    </div>
  );
}
