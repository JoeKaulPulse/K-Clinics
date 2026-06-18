'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type Cohort = { id: string; startAt: string; endAt: string | null; accessStartAt: string | null; accessEndAt: string | null; capacity: number; location: string | null; trainer: string | null; name: string | null; status: string };
export type Course = { id: string; slug: string; title: string; level: string | null; summary: string | null; description: string | null; pricePence: number; depositPence: number | null; promoPrice: number | null; promoStartAt: string | null; promoEndAt: string | null; durationText: string | null; format: string | null; accreditations: string[]; outcomes: string[]; prerequisites: string | null; thinkificUrl: string | null; featured: boolean; active: boolean; cohorts: Cohort[] };
export type Enrolment = { id: string; courseId: string; courseTitle: string; cohortId: string | null; applicantName: string; applicantEmail: string; applicantPhone: string | null; experience: string | null; financeInterest: boolean; status: string; pricePence: number; paidPence: number; notes: string | null; createdAt: string };

const field = 'rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-sm';
const money = (p: number) => (p > 0 ? `£${(p / 100).toLocaleString('en-GB')}` : '—');
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const STATUSES = ['APPLIED', 'OFFERED', 'PAID', 'ENROLLED', 'COMPLETED', 'CANCELLED'];

async function post(payload: object) {
  return fetch('/api/admin/academy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}

export function Applications({ enrolments, courses }: { enrolments: Enrolment[]; courses: Course[] }) {
  const router = useRouter();
  async function act(payload: object) { await post(payload); router.refresh(); }
  const cohortsFor = (courseId: string) => courses.find((c) => c.id === courseId)?.cohorts ?? [];

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <h2 className="mb-1 font-[family-name:var(--font-display)] text-xl">Applications &amp; enrolments</h2>
      <p className="mb-4 text-sm text-[var(--color-stone)]">Move applicants through the pipeline, assign a cohort, and record payments (taken manually / via Clearpay).</p>
      {enrolments.length === 0 ? (
        <p className="text-sm text-[var(--color-stone)]">No applications yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-[var(--color-stone)]">
              <th scope="col" className="py-1 pr-2">Applicant</th><th scope="col" className="px-2">Course</th><th scope="col" className="px-2">Status</th><th scope="col" className="px-2">Cohort</th><th scope="col" className="px-2">Paid</th><th scope="col" className="px-2"></th>
            </tr></thead>
            <tbody>
              {enrolments.map((e) => (
                <tr key={e.id} className="border-t border-[var(--color-line)] align-top">
                  <td className="py-2 pr-2">
                    <span className="font-medium">{e.applicantName}</span>{e.financeInterest && <span className="ml-1 rounded-full bg-[var(--color-gold)]/15 px-1.5 py-0.5 text-[0.6rem] text-[var(--color-gold)]">Clearpay</span>}
                    <span className="block text-xs text-[var(--color-stone)]">{e.applicantEmail}{e.applicantPhone ? ` · ${e.applicantPhone}` : ''}</span>
                    <span className="block text-xs text-[var(--color-stone)]">{fmtDate(e.createdAt)} · {money(e.pricePence)}</span>
                    {e.experience && <span className="mt-1 block max-w-xs text-xs text-[var(--color-stone)]">{e.experience}</span>}
                  </td>
                  <td className="px-2">{e.courseTitle}</td>
                  <td className="px-2">
                    <select value={e.status} onChange={(ev) => act({ op: 'updateEnrolment', id: e.id, status: ev.target.value })} className={field}>
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-2">
                    <select value={e.cohortId ?? ''} onChange={(ev) => act({ op: 'updateEnrolment', id: e.id, cohortId: ev.target.value })} className={field}>
                      <option value="">—</option>
                      {cohortsFor(e.courseId).map((h) => <option key={h.id} value={h.id}>{h.name || fmtDate(h.startAt)}</option>)}
                    </select>
                  </td>
                  <td className="px-2">
                    <input type="number" defaultValue={e.paidPence ? e.paidPence / 100 : ''} placeholder="£" onBlur={(ev) => { const v = Math.round(Number(ev.target.value || 0) * 100); if (v !== e.paidPence) act({ op: 'updateEnrolment', id: e.id, paidPence: v }); }} className={`${field} w-20`} />
                  </td>
                  <td className="px-2 text-right"><button onClick={() => { if (confirm('Remove this application?')) act({ op: 'removeEnrolment', id: e.id }); }} className="text-xs text-[var(--color-blush)] hover:underline">Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function Courses({ courses, enrolments }: { courses: Course[]; enrolments?: Enrolment[] }) {
  const [adding, setAdding] = useState(false);
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-display)] text-xl">Courses</h2>
        <button onClick={() => setAdding((v) => !v)} className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-sm hover:border-[var(--color-gold)]">{adding ? 'Close' : '+ New course'}</button>
      </div>
      {adding && <CourseForm onDone={() => setAdding(false)} />}
      <div className="mt-4 space-y-4">
        {courses.map((c) => <CourseCard key={c.id} course={c} enrolments={(enrolments ?? []).filter((e) => e.courseId === c.id)} />)}
      </div>
    </section>
  );
}

function CourseCard({ course, enrolments }: { course: Course; enrolments: Enrolment[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  async function act(payload: object) { await post(payload); router.refresh(); }
  return (
    <div className={`rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-4 ${course.active ? '' : 'opacity-60'}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="font-medium">{course.title}</span>
          <span className="text-xs text-[var(--color-stone)]"> · {course.level || 'No level'} · {money(course.pricePence)} · {course.cohorts.length} cohort(s){course.featured ? ' · featured' : ''}</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <a href={`/admin/academy/${course.id}`} className="font-medium text-[var(--color-ink)] hover:text-[var(--color-gold)] hover:underline">Curriculum →</a>
          <button onClick={() => setEditing((v) => !v)} className="text-[var(--color-gold)] hover:underline">{editing ? 'Close' : 'Edit'}</button>
          <button onClick={() => act({ op: 'toggleCourse', id: course.id, active: !course.active })} className="text-[var(--color-stone)] hover:underline">{course.active ? 'Disable' : 'Enable'}</button>
          <button onClick={() => { if (confirm('Delete this course and its cohorts?')) act({ op: 'removeCourse', id: course.id }); }} className="text-[var(--color-blush)] hover:underline">Delete</button>
        </div>
      </div>
      {editing && <div className="mt-4"><CourseForm course={course} onDone={() => setEditing(false)} /></div>}
      <Cohorts course={course} enrolments={enrolments} />
    </div>
  );
}

function CourseForm({ course, onDone }: { course?: Course; onDone: () => void }) {
  const router = useRouter();
  const [f, setF] = useState({
    title: course?.title ?? '', level: course?.level ?? '', summary: course?.summary ?? '', description: course?.description ?? '',
    price: course ? String(course.pricePence / 100) : '', deposit: course?.depositPence ? String(course.depositPence / 100) : '',
    promoPrice: course?.promoPrice ? String(course.promoPrice / 100) : '',
    promoStartAt: course?.promoStartAt ? course.promoStartAt.slice(0, 10) : '',
    promoEndAt: course?.promoEndAt ? course.promoEndAt.slice(0, 10) : '',
    durationText: course?.durationText ?? '', format: course?.format ?? '', accreditations: (course?.accreditations ?? []).join(', '),
    outcomes: (course?.outcomes ?? []).join('\n'), prerequisites: course?.prerequisites ?? '', thinkificUrl: course?.thinkificUrl ?? '',
    featured: course?.featured ?? false,
  });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    if (!f.title.trim()) return;
    setBusy(true);
    await post({
      op: 'upsertCourse', id: course?.id, title: f.title, level: f.level, summary: f.summary, description: f.description,
      pricePence: Math.round(Number(f.price || 0) * 100), depositPence: f.deposit ? Math.round(Number(f.deposit) * 100) : null,
      promoPrice: f.promoPrice ? Math.round(Number(f.promoPrice) * 100) : null,
      promoStartAt: f.promoStartAt || null,
      promoEndAt: f.promoEndAt || null,
      durationText: f.durationText, format: f.format, accreditations: f.accreditations.split(','), outcomes: f.outcomes.split('\n'),
      prerequisites: f.prerequisites, thinkificUrl: f.thinkificUrl, featured: f.featured, active: course?.active ?? true,
    });
    setBusy(false); onDone(); router.refresh();
  }

  const L = (label: string, el: React.ReactNode) => <label className="block text-xs text-[var(--color-stone)]">{label}<br />{el}</label>;
  return (
    <div className="grid gap-3 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4 sm:grid-cols-2">
      {L('Title', <input value={f.title} onChange={(e) => set('title', e.target.value)} className={`${field} w-full`} />)}
      {L('Level', <input value={f.level} onChange={(e) => set('level', e.target.value)} placeholder="Level 4" className={`${field} w-full`} />)}
      {L('Price £', <input value={f.price} onChange={(e) => set('price', e.target.value)} className={`${field} w-full`} />)}
      {L('Deposit £ (optional)', <input value={f.deposit} onChange={(e) => set('deposit', e.target.value)} className={`${field} w-full`} />)}
      {L('Promo price £ (optional)', <input value={f.promoPrice} onChange={(e) => set('promoPrice', e.target.value)} placeholder="Leave blank to disable" className={`${field} w-full`} />)}
      {L('Promo starts (optional, blank = immediate)', <input type="date" value={f.promoStartAt} onChange={(e) => set('promoStartAt', e.target.value)} className={`${field} w-full`} />)}
      {L('Promo ends (optional, blank = never)', <input type="date" value={f.promoEndAt} onChange={(e) => set('promoEndAt', e.target.value)} className={`${field} w-full`} />)}
      <div className="sm:col-span-2">{L('Summary (card one-liner)', <input value={f.summary} onChange={(e) => set('summary', e.target.value)} className={`${field} w-full`} />)}</div>
      <div className="sm:col-span-2">{L('Description', <textarea value={f.description} onChange={(e) => set('description', e.target.value)} rows={3} className={`${field} w-full`} />)}</div>
      {L('Duration text', <input value={f.durationText} onChange={(e) => set('durationText', e.target.value)} placeholder="2 practical days + theory + exam" className={`${field} w-full`} />)}
      {L('Format', <input value={f.format} onChange={(e) => set('format', e.target.value)} placeholder="Blended" className={`${field} w-full`} />)}
      {L('Accreditations (comma)', <input value={f.accreditations} onChange={(e) => set('accreditations', e.target.value)} placeholder="OFQUAL, VTCT, CPD" className={`${field} w-full`} />)}
      {L('Thinkific URL', <input value={f.thinkificUrl} onChange={(e) => set('thinkificUrl', e.target.value)} className={`${field} w-full`} />)}
      <div className="sm:col-span-2">{L('Learning outcomes (one per line)', <textarea value={f.outcomes} onChange={(e) => set('outcomes', e.target.value)} rows={3} className={`${field} w-full`} />)}</div>
      <div className="sm:col-span-2">{L('Prerequisites', <input value={f.prerequisites} onChange={(e) => set('prerequisites', e.target.value)} className={`${field} w-full`} />)}</div>
      <label className="flex items-center gap-2 text-sm text-[var(--color-stone)]"><input type="checkbox" checked={f.featured} onChange={(e) => set('featured', e.target.checked)} className="h-4 w-4 accent-[var(--color-gold)]" />Featured</label>
      <div className="sm:col-span-2"><button onClick={save} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-60">{busy ? 'Saving…' : 'Save course'}</button></div>
    </div>
  );
}

function Cohorts({ course, enrolments }: { course: Course; enrolments: Enrolment[] }) {
  const router = useRouter();
  const [add, setAdd] = useState(false);
  const [c, setC] = useState({ name: '', startAt: '', endAt: '', accessStartAt: '', accessEndAt: '', capacity: '8', location: 'Islington', trainer: '' });
  async function act(payload: object) { await post(payload); router.refresh(); }
  async function save() {
    if (!c.startAt) return;
    await post({ op: 'upsertCohort', courseId: course.id, name: c.name || null, startAt: c.startAt, endAt: c.endAt || null, accessStartAt: c.accessStartAt || null, accessEndAt: c.accessEndAt || null, capacity: Number(c.capacity), location: c.location, trainer: c.trainer });
    setAdd(false); setC({ name: '', startAt: '', endAt: '', accessStartAt: '', accessEndAt: '', capacity: '8', location: 'Islington', trainer: '' }); router.refresh();
  }
  return (
    <div className="mt-3 border-t border-[var(--color-line)] pt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-stone)]">Cohorts — practical dates &amp; course-access window</p>
        <button onClick={() => setAdd((v) => !v)} className="text-xs text-[var(--color-gold)] hover:underline">{add ? 'Cancel' : '+ Add cohort'}</button>
      </div>
      {add && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} className={`${field} w-44`} placeholder="Cohort name (e.g. Sep 2026)" />
          <label className="text-[0.6rem] text-[var(--color-stone)]">Practical from<input type="date" value={c.startAt} onChange={(e) => setC({ ...c, startAt: e.target.value })} className={field} /></label>
          <label className="text-[0.6rem] text-[var(--color-stone)]">to<input type="date" value={c.endAt} onChange={(e) => setC({ ...c, endAt: e.target.value })} className={field} /></label>
          <label className="text-[0.6rem] text-[var(--color-stone)]">Access opens<input type="date" value={c.accessStartAt} onChange={(e) => setC({ ...c, accessStartAt: e.target.value })} className={field} /></label>
          <label className="text-[0.6rem] text-[var(--color-stone)]">Access expires<input type="date" value={c.accessEndAt} onChange={(e) => setC({ ...c, accessEndAt: e.target.value })} className={field} /></label>
          <input value={c.capacity} onChange={(e) => setC({ ...c, capacity: e.target.value })} className={`${field} w-16`} placeholder="cap" />
          <input value={c.trainer} onChange={(e) => setC({ ...c, trainer: e.target.value })} className={`${field} w-32`} placeholder="trainer" />
          <button onClick={save} className="rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs text-[var(--color-porcelain)]">Add</button>
        </div>
      )}
      {course.cohorts.length > 0 && (
        <ul className="mt-2 space-y-1.5 text-sm">
          {course.cohorts.map((h) => <CohortRow key={h.id} courseId={course.id} cohort={h} enrolments={enrolments.filter((e) => e.cohortId === h.id)} onRemove={() => { if (confirm('Remove cohort?')) act({ op: 'removeCohort', id: h.id }); }} />)}
        </ul>
      )}
    </div>
  );
}

function CohortRow({ courseId, cohort: h, enrolments, onRemove }: { courseId: string; cohort: Cohort; enrolments: Enrolment[]; onRemove: () => void }) {
  const router = useRouter();
  const init = (d: string | null) => (d ? d.slice(0, 10) : '');
  const [aStart, setAStart] = useState(init(h.accessStartAt));
  const [aEnd, setAEnd] = useState(init(h.accessEndAt));
  const [name, setName] = useState(h.name ?? '');
  const [busy, setBusy] = useState(false);
  const [showStudents, setShowStudents] = useState(false);
  const dirtyAccess = aStart !== init(h.accessStartAt) || aEnd !== init(h.accessEndAt);
  const dirtyName = name !== (h.name ?? '');
  const dirty = dirtyAccess || dirtyName;
  async function act(payload: object) { await post(payload); router.refresh(); }
  async function saveAccess() {
    setBusy(true);
    await post({ op: 'upsertCohort', id: h.id, courseId, name: name || null, startAt: h.startAt, endAt: h.endAt, accessStartAt: aStart || null, accessEndAt: aEnd || null, capacity: h.capacity, location: h.location, trainer: h.trainer, status: h.status });
    setBusy(false); router.refresh();
  }
  return (
    <li className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <input value={name} onChange={(e) => setName(e.target.value)} className={`${field} w-44`} placeholder={fmtDate(h.startAt)} title="Cohort name" />
        <span className="text-[var(--color-ink-soft)]">{fmtDate(h.startAt)}{h.endAt ? `–${fmtDate(h.endAt)}` : ''} · {h.capacity} places{h.trainer ? ` · ${h.trainer}` : ''} · {h.status}</span>
        <label className="text-[0.6rem] text-[var(--color-stone)]" title="Course access opens">access<input type="date" value={aStart} onChange={(e) => setAStart(e.target.value)} className={`${field} ml-1`} /></label>
        <span className="text-[var(--color-stone)]">→</span>
        <input type="date" value={aEnd} onChange={(e) => setAEnd(e.target.value)} className={field} title="Course access expires" />
        {dirty && <button onClick={saveAccess} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-2.5 py-1 text-[0.65rem] text-[var(--color-porcelain)] disabled:opacity-50">{busy ? '…' : 'Save'}</button>}
        <button onClick={() => setShowStudents((v) => !v)} className="text-xs text-[var(--color-gold)] hover:underline">{enrolments.length} student{enrolments.length !== 1 ? 's' : ''}</button>
        <button onClick={onRemove} className="text-xs text-[var(--color-blush)] hover:underline">Remove</button>
      </div>
      {showStudents && (
        <div className="mt-2 border-t border-[var(--color-line)] pt-2">
          {enrolments.length === 0 ? (
            <p className="text-xs text-[var(--color-stone)]">No students assigned to this cohort.</p>
          ) : (
            <ul className="space-y-1">
              {enrolments.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 text-xs">
                  <span>{e.applicantName} · {e.applicantEmail} · {e.status}</span>
                  <button onClick={() => act({ op: 'updateEnrolment', id: e.id, cohortId: '' })} className="shrink-0 text-[var(--color-stone)] hover:text-[var(--color-blush)] hover:underline">Remove from cohort</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
