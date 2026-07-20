'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// BLD-528: dedicated Cohorts board — create cohorts and control each cohort's
// lesson-access window in one place, across all courses.
export type CohortLite = { id: string; name: string | null; startAt: string; endAt: string | null; accessStartAt: string | null; accessEndAt: string | null; capacity: number; location: string | null; trainer: string | null; status: string };
export type CourseLite = { id: string; title: string; modules: { id: string; title: string }[]; cohorts: CohortLite[] };
export type EnrolLite = { id: string; courseId: string; cohortId: string | null; name: string; email: string; status: string };
export type ReleaseLite = { cohortId: string; moduleId: string; releaseAt: string };

const field = 'rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-sm';
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

async function post(payload: object) {
  return fetch('/api/admin/academy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}

export function CohortsBoard({ courses, enrolments, releases = [] }: { courses: CourseLite[]; enrolments: EnrolLite[]; releases?: ReleaseLite[] }) {
  const router = useRouter();
  async function act(payload: object) { await post(payload); router.refresh(); }
  const total = courses.reduce((n, c) => n + c.cohorts.length, 0);
  const releaseFor = (cohortId: string) => new Map(releases.filter((r) => r.cohortId === cohortId).map((r) => [r.moduleId, r.releaseAt]));

  return (
    <div className="space-y-6">
      <NewCohort courses={courses} onDone={() => router.refresh()} />
      {total === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 text-center text-sm text-[var(--color-stone)]">No cohorts yet. Create one above — a cohort is a start group with its own practical dates and lesson-access window.</p>
      ) : (
        courses.filter((c) => c.cohorts.length > 0).map((c) => (
          <section key={c.id} className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
            <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">{c.title}</h2>
            <ul className="space-y-2">
              {c.cohorts.map((h) => <CohortRow key={h.id} courseId={c.id} cohort={h} students={enrolments.filter((e) => e.cohortId === h.id)} modules={c.modules} releases={releaseFor(h.id)} onAct={act} />)}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function NewCohort({ courses, onDone }: { courses: CourseLite[]; onDone: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [c, setC] = useState({ courseId: '', name: '', startAt: '', endAt: '', accessStartAt: '', accessEndAt: '', capacity: '8', location: 'Islington', trainer: '' });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof c>(k: K, v: (typeof c)[K]) => setC((p) => ({ ...p, [k]: v }));
  async function save() {
    if (!c.courseId || !c.startAt) return;
    setBusy(true);
    await post({ op: 'upsertCohort', courseId: c.courseId, name: c.name || null, startAt: c.startAt, endAt: c.endAt || null, accessStartAt: c.accessStartAt || null, accessEndAt: c.accessEndAt || null, capacity: Number(c.capacity), location: c.location, trainer: c.trainer });
    setBusy(false); setOpen(false); setC({ courseId: '', name: '', startAt: '', endAt: '', accessStartAt: '', accessEndAt: '', capacity: '8', location: 'Islington', trainer: '' }); router.refresh(); onDone();
  }
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg">New cohort</h2>
          <p className="text-sm text-[var(--color-stone)]">A start group with its own practical dates and lesson-access window. Leave access dates blank for “open as soon as enrolled, never expires”.</p>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-sm hover:border-[var(--color-gold)]">{open ? 'Close' : '+ New cohort'}</button>
      </div>
      {open && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-xs text-[var(--color-stone)]">Course<br />
            <select value={c.courseId} onChange={(e) => set('courseId', e.target.value)} className={`${field} w-full`}>
              <option value="">— choose a course —</option>
              {courses.map((co) => <option key={co.id} value={co.id}>{co.title}</option>)}
            </select>
          </label>
          <label className="block text-xs text-[var(--color-stone)]">Cohort name<br /><input value={c.name} onChange={(e) => set('name', e.target.value)} className={`${field} w-full`} placeholder="e.g. Sept 2026" /></label>
          <label className="block text-xs text-[var(--color-stone)]">Trainer<br /><input value={c.trainer} onChange={(e) => set('trainer', e.target.value)} className={`${field} w-full`} /></label>
          <label className="block text-xs text-[var(--color-stone)]">Practical from<br /><input type="date" value={c.startAt} onChange={(e) => set('startAt', e.target.value)} className={`${field} w-full`} /></label>
          <label className="block text-xs text-[var(--color-stone)]">Practical to<br /><input type="date" value={c.endAt} onChange={(e) => set('endAt', e.target.value)} className={`${field} w-full`} /></label>
          <label className="block text-xs text-[var(--color-stone)]">Capacity<br /><input value={c.capacity} onChange={(e) => set('capacity', e.target.value)} className={`${field} w-full`} /></label>
          <label className="block text-xs text-[var(--color-stone)]">Lesson access opens<br /><input type="date" value={c.accessStartAt} onChange={(e) => set('accessStartAt', e.target.value)} className={`${field} w-full`} /></label>
          <label className="block text-xs text-[var(--color-stone)]">Lesson access expires<br /><input type="date" value={c.accessEndAt} onChange={(e) => set('accessEndAt', e.target.value)} className={`${field} w-full`} /></label>
          <div className="flex items-end"><button onClick={save} disabled={busy || !c.courseId || !c.startAt} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-60">{busy ? 'Saving…' : 'Create cohort'}</button></div>
        </div>
      )}
    </section>
  );
}

function CohortRow({ courseId, cohort: h, students, modules, releases, onAct }: { courseId: string; cohort: CohortLite; students: EnrolLite[]; modules: { id: string; title: string }[]; releases: Map<string, string>; onAct: (p: object) => Promise<void> }) {
  const [name, setName] = useState(h.name ?? '');
  const [aStart, setAStart] = useState(day(h.accessStartAt));
  const [aEnd, setAEnd] = useState(day(h.accessEndAt));
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [showRelease, setShowRelease] = useState(false);
  const dirty = name !== (h.name ?? '') || aStart !== day(h.accessStartAt) || aEnd !== day(h.accessEndAt);
  async function save() {
    setBusy(true);
    await onAct({ op: 'upsertCohort', id: h.id, courseId, name: name || null, startAt: h.startAt, endAt: h.endAt, accessStartAt: aStart || null, accessEndAt: aEnd || null, capacity: h.capacity, location: h.location, trainer: h.trainer, status: h.status });
    setBusy(false);
  }
  return (
    <li className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white p-3">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
        <label className="text-[0.6rem] text-[var(--color-stone)]">Name<br /><input value={name} onChange={(e) => setName(e.target.value)} className={`${field} w-40`} placeholder={fmtDate(h.startAt)} /></label>
        <span className="pb-1.5 text-sm text-[var(--color-ink-soft)]">Practical {fmtDate(h.startAt)}{h.endAt ? `–${fmtDate(h.endAt)}` : ''} · {h.capacity} places{h.trainer ? ` · ${h.trainer}` : ''}</span>
        <label className="text-[0.6rem] text-[var(--color-stone)]">Access opens<br /><input type="date" value={aStart} onChange={(e) => setAStart(e.target.value)} className={field} /></label>
        <label className="text-[0.6rem] text-[var(--color-stone)]">Access expires<br /><input type="date" value={aEnd} onChange={(e) => setAEnd(e.target.value)} className={field} /></label>
        {dirty && <button onClick={save} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs text-[var(--color-porcelain)] disabled:opacity-50">{busy ? '…' : 'Save'}</button>}
        <button onClick={() => setShowRelease((v) => !v)} className="pb-1.5 text-xs text-[var(--color-gold-deep)] hover:underline">Release schedule</button>
        <button onClick={() => setShow((v) => !v)} className="pb-1.5 text-xs text-[var(--color-gold-deep)] hover:underline">{students.length} student{students.length !== 1 ? 's' : ''}</button>
        <button onClick={() => { if (confirm('Remove this cohort?')) onAct({ op: 'removeCohort', id: h.id }); }} className="pb-1.5 text-xs text-[var(--color-blush-deep)] hover:underline">Delete</button>
      </div>
      {showRelease && (
        <div className="mt-2 border-t border-[var(--color-line)] pt-2">
          <p className="mb-2 text-xs text-[var(--color-stone)]">Set a release date to <strong>lock a module</strong> for this cohort until then. Leave blank to keep it open now. Lessons in a locked module are hidden from students until the date.</p>
          {modules.length === 0 ? <p className="text-xs text-[var(--color-stone)]">This course has no modules yet — add them in the curriculum editor.</p> : (
            <ul className="space-y-1.5">
              {modules.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="min-w-[12rem] flex-1 truncate">{m.title}</span>
                  <input
                    type="date"
                    defaultValue={day(releases.get(m.id) ?? null)}
                    onChange={(e) => onAct({ op: 'setModuleRelease', cohortId: h.id, moduleId: m.id, releaseAt: e.target.value || null })}
                    className={field}
                    aria-label={`Release date for ${m.title}`}
                  />
                  {releases.get(m.id) && new Date(releases.get(m.id)!).getTime() > Date.now()
                    ? <span className="text-[0.7rem] text-[var(--color-stone)]">🔒 unlocks {fmtDate(releases.get(m.id)!)}</span>
                    : <span className="text-[0.7rem] text-[var(--color-stone)]">open</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {show && (
        <div className="mt-2 border-t border-[var(--color-line)] pt-2">
          {students.length === 0 ? <p className="text-xs text-[var(--color-stone)]">No students assigned. Use “Add a student to a course” on the Applications page, or set a learner’s cohort there.</p> : (
            <ul className="space-y-1 text-xs">
              {students.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2">
                  <span>{e.name} · {e.email} · {e.status}</span>
                  <button onClick={() => onAct({ op: 'updateEnrolment', id: e.id, cohortId: '' })} className="text-[var(--color-stone)] hover:text-[var(--color-blush-deep)] hover:underline">Remove from cohort</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
