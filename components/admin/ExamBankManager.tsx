'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type CourseRef = { id: string; title: string };
export type QView = { id: string; courseId: string | null; topic: string | null; difficulty: string; examBoard: string | null; prompt: string; type: string; options: string[]; correct: number[]; explanation: string | null; tip: string | null; active: boolean };
export type PView = { id: string; courseId: string | null; title: string; examBoard: string | null; year: number | null; description: string | null; fileUrl: string | null; active: boolean; order: number };

const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-sm';
const lbl = 'block text-xs font-medium text-[var(--color-stone)]';
const btnDark = 'rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-xs font-medium text-[var(--color-porcelain)] disabled:opacity-50';

async function post(payload: object) {
  return fetch('/api/admin/exam-bank', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then((r) => r.json()).catch(() => ({ ok: false }));
}

export function ExamBankManager({ courses, questions, papers }: { courses: CourseRef[]; questions: QView[]; papers: PView[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const titleById = useMemo(() => new Map(courses.map((c) => [c.id, c.title])), [courses]);

  async function act(payload: object) { setBusy(true); const r = await post(payload); setBusy(false); if (r.ok) router.refresh(); else alert(r.error || 'Failed.'); return r; }
  const shown = filter === 'all' ? questions : questions.filter((q) => q.courseId === filter);

  return (
    <div className="space-y-10">
      {/* Question bank */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl">Question bank</h2>
            <p className="text-sm text-[var(--color-stone)]">{questions.length} question{questions.length === 1 ? '' : 's'}. Trainees draw randomised practice sets from these.</p>
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className={`${field} w-auto`}>
            <option value="all">All courses</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>

        <ImportRow courses={courses} busy={busy} act={act} />

        <div className="mt-4 space-y-2">
          {shown.map((q) => <QuestionRow key={q.id} q={q} courses={courses} courseTitle={q.courseId ? titleById.get(q.courseId) ?? null : null} busy={busy} act={act} />)}
          {shown.length === 0 && <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-line)] p-4 text-sm text-[var(--color-stone-soft)]">No questions yet. Import from a course’s quizzes above, or add one below.</p>}
        </div>
        <QuestionForm courses={courses} defaultCourseId={filter === 'all' ? courses[0]?.id ?? '' : filter} busy={busy} act={act} />
      </section>

      {/* Past papers */}
      <section>
        <h2 className="font-[family-name:var(--font-display)] text-xl">Exam papers &amp; specimens</h2>
        <p className="text-sm text-[var(--color-stone)]">Historic / specimen papers shown to trainees on the practice page.</p>
        <div className="mt-4 space-y-2">
          {papers.map((p) => <PaperRow key={p.id} p={p} courses={courses} courseTitle={p.courseId ? titleById.get(p.courseId) ?? null : null} busy={busy} act={act} />)}
        </div>
        <PaperForm courses={courses} busy={busy} act={act} />
      </section>
    </div>
  );
}

type Act = (payload: object) => Promise<{ ok: boolean; created?: number; error?: string }>;

function ImportRow({ courses, busy, act }: { courses: CourseRef[]; busy: boolean; act: Act }) {
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '');
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bone)] p-3">
      <span className="text-xs text-[var(--color-stone)]">Bootstrap the bank from a course’s module quizzes:</span>
      <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className={`${field} w-auto`}>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
      <button onClick={async () => { const r = await act({ op: 'importFromQuizzes', courseId }); if (r.ok) alert(`Imported ${r.created ?? 0} new question(s).`); }} disabled={busy || !courseId} className={btnDark}>Import from quizzes</button>
    </div>
  );
}

function QuestionRow({ q, courses, courseTitle, busy, act }: { q: QView; courses: CourseRef[]; courseTitle: string | null; busy: boolean; act: Act }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white ${q.active ? '' : 'opacity-60'}`}>
      <div className="flex items-center gap-2 p-2.5">
        <button onClick={() => setOpen((v) => !v)} className="text-[var(--color-stone)]">{open ? '▾' : '▸'}</button>
        <span className="flex-1 text-sm">{q.prompt}</span>
        <span className="rounded-full bg-[var(--color-porcelain)] px-2 py-0.5 text-[0.6rem] uppercase tracking-wide text-[var(--color-stone)]">{q.type}</span>
        {courseTitle && <span className="hidden text-xs text-[var(--color-stone-soft)] sm:inline">{courseTitle}</span>}
        <button onClick={() => act({ op: 'toggleQuestion', id: q.id, active: !q.active })} disabled={busy} className="text-xs text-[var(--color-stone)] hover:underline">{q.active ? 'Disable' : 'Enable'}</button>
        <button onClick={() => { if (confirm('Delete this question?')) act({ op: 'deleteQuestion', id: q.id }); }} disabled={busy} className="text-xs text-[var(--color-blush)] hover:underline">Delete</button>
      </div>
      {open && <div className="border-t border-[var(--color-line)] p-3"><QuestionForm courses={courses} existing={q} busy={busy} act={act} /></div>}
    </div>
  );
}

function QuestionForm({ courses, existing, defaultCourseId, busy, act }: { courses: CourseRef[]; existing?: QView; defaultCourseId?: string; busy: boolean; act: Act }) {
  const [open, setOpen] = useState(!!existing);
  const [f, setF] = useState({
    courseId: existing?.courseId ?? defaultCourseId ?? '', topic: existing?.topic ?? '', difficulty: existing?.difficulty ?? 'STANDARD',
    examBoard: existing?.examBoard ?? '', prompt: existing?.prompt ?? '', type: existing?.type ?? 'SINGLE',
    options: existing?.options?.length ? existing.options : ['', ''], correct: existing?.correct ?? [], explanation: existing?.explanation ?? '', tip: existing?.tip ?? '',
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const setOpt = (i: number, v: string) => setF((s) => ({ ...s, options: s.options.map((x, k) => (k === i ? v : x)) }));
  const toggleCorrect = (i: number) => setF((s) => ({ ...s, correct: s.type === 'MULTI' ? (s.correct.includes(i) ? s.correct.filter((x) => x !== i) : [...s.correct, i]) : [i] }));
  const changeType = (t: string) => setF((s) => ({ ...s, type: t, ...(t === 'TRUEFALSE' ? { options: ['True', 'False'], correct: s.correct[0] === 1 ? [1] : [0] } : {}) }));

  async function save() {
    const r = await act({ op: 'upsertQuestion', id: existing?.id, ...f });
    if (r.ok && !existing) setF({ courseId: f.courseId, topic: f.topic, difficulty: 'STANDARD', examBoard: f.examBoard, prompt: '', type: 'SINGLE', options: ['', ''], correct: [], explanation: '', tip: '' });
  }

  if (!existing && !open) return <button onClick={() => setOpen(true)} className="mt-3 text-xs font-medium text-[var(--color-gold)] hover:underline">+ Add a question</button>;

  return (
    <div className={existing ? '' : 'mt-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bone)] p-3'}>
      <label className={lbl}>Question<textarea rows={2} className={`${field} mt-1`} value={f.prompt} onChange={(e) => set('prompt', e.target.value)} /></label>
      <div className="mt-2 grid gap-2 sm:grid-cols-4">
        <label className={lbl}>Course<select className={`${field} mt-1`} value={f.courseId} onChange={(e) => set('courseId', e.target.value)}><option value="">— none —</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
        <label className={lbl}>Topic<input className={`${field} mt-1`} value={f.topic} onChange={(e) => set('topic', e.target.value)} placeholder="Anatomy" /></label>
        <label className={lbl}>Difficulty<select className={`${field} mt-1`} value={f.difficulty} onChange={(e) => set('difficulty', e.target.value)}><option>FOUNDATION</option><option>STANDARD</option><option>STRETCH</option></select></label>
        <label className={lbl}>Exam board<input className={`${field} mt-1`} value={f.examBoard} onChange={(e) => set('examBoard', e.target.value)} placeholder="VTCT" /></label>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <label className={lbl}>Type<select className={`${field} mt-1 w-40`} value={f.type} onChange={(e) => changeType(e.target.value)}><option value="SINGLE">Single answer</option><option value="MULTI">Multiple answers</option><option value="TRUEFALSE">True / False</option></select></label>
        <span className="self-end pb-1.5 text-xs text-[var(--color-stone-soft)]">{f.type === 'MULTI' ? 'Tick all correct' : 'Pick the correct one'}</span>
      </div>
      <div className="mt-2 space-y-1.5">
        {f.options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type={f.type === 'MULTI' ? 'checkbox' : 'radio'} checked={f.correct.includes(i)} onChange={() => toggleCorrect(i)} className="h-4 w-4 accent-[var(--color-gold)]" />
            <input className={field} value={o} onChange={(e) => setOpt(i, e.target.value)} disabled={f.type === 'TRUEFALSE'} />
            {f.type !== 'TRUEFALSE' && f.options.length > 2 && <button onClick={() => setF((s) => ({ ...s, options: s.options.filter((_, k) => k !== i), correct: s.correct.filter((k) => k !== i).map((k) => (k > i ? k - 1 : k)) }))} className="text-xs text-[var(--color-blush)]">✕</button>}
          </div>
        ))}
        {f.type !== 'TRUEFALSE' && <button onClick={() => setF((s) => ({ ...s, options: [...s.options, ''] }))} className="text-xs font-medium text-[var(--color-gold)] hover:underline">+ Add option</button>}
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className={lbl}>Hint (optional)<input className={`${field} mt-1`} value={f.tip} onChange={(e) => set('tip', e.target.value)} /></label>
        <label className={lbl}>Explanation (after answering)<input className={`${field} mt-1`} value={f.explanation} onChange={(e) => set('explanation', e.target.value)} /></label>
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={save} disabled={busy} className={btnDark}>{existing ? 'Save question' : 'Add question'}</button>
        {!existing && <button onClick={() => setOpen(false)} className="text-xs text-[var(--color-stone)] hover:underline">Close</button>}
      </div>
    </div>
  );
}

function PaperRow({ p, courses, courseTitle, busy, act }: { p: PView; courses: CourseRef[]; courseTitle: string | null; busy: boolean; act: Act }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white">
      <div className="flex items-center gap-2 p-2.5">
        <button onClick={() => setOpen((v) => !v)} className="text-[var(--color-stone)]">{open ? '▾' : '▸'}</button>
        <span className="flex-1 text-sm">{p.title}</span>
        <span className="text-xs text-[var(--color-stone-soft)]">{[p.examBoard, p.year, courseTitle].filter(Boolean).join(' · ')}</span>
        <button onClick={() => { if (confirm('Delete this paper?')) act({ op: 'deletePaper', id: p.id }); }} disabled={busy} className="text-xs text-[var(--color-blush)] hover:underline">Delete</button>
      </div>
      {open && <div className="border-t border-[var(--color-line)] p-3"><PaperForm courses={courses} existing={p} busy={busy} act={act} /></div>}
    </div>
  );
}

function PaperForm({ courses, existing, busy, act }: { courses: CourseRef[]; existing?: PView; busy: boolean; act: Act }) {
  const [open, setOpen] = useState(!!existing);
  const [f, setF] = useState({ courseId: existing?.courseId ?? '', title: existing?.title ?? '', examBoard: existing?.examBoard ?? '', year: existing?.year ?? '', description: existing?.description ?? '', fileUrl: existing?.fileUrl ?? '' });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  async function save() { const r = await act({ op: 'upsertPaper', id: existing?.id, ...f }); if (r.ok && !existing) setF({ courseId: '', title: '', examBoard: '', year: '', description: '', fileUrl: '' }); }
  if (!existing && !open) return <button onClick={() => setOpen(true)} className="mt-3 text-xs font-medium text-[var(--color-gold)] hover:underline">+ Add a paper</button>;
  return (
    <div className={existing ? '' : 'mt-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bone)] p-3'}>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className={lbl}>Title<input className={`${field} mt-1`} value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="VTCT Level 4 — Specimen paper" /></label>
        <label className={lbl}>Course<select className={`${field} mt-1`} value={f.courseId} onChange={(e) => set('courseId', e.target.value)}><option value="">— none —</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
        <label className={lbl}>Exam board<input className={`${field} mt-1`} value={f.examBoard} onChange={(e) => set('examBoard', e.target.value)} placeholder="VTCT" /></label>
        <label className={lbl}>Year<input type="number" className={`${field} mt-1`} value={f.year} onChange={(e) => set('year', e.target.value as never)} /></label>
      </div>
      <label className={`${lbl} mt-2 block`}>Link to paper (PDF / URL)<input className={`${field} mt-1`} value={f.fileUrl} onChange={(e) => set('fileUrl', e.target.value)} placeholder="https://…" /></label>
      <label className={`${lbl} mt-2 block`}>Description / how to use it<textarea rows={2} className={`${field} mt-1`} value={f.description} onChange={(e) => set('description', e.target.value)} /></label>
      <div className="mt-3 flex gap-2">
        <button onClick={save} disabled={busy} className={btnDark}>{existing ? 'Save paper' : 'Add paper'}</button>
        {!existing && <button onClick={() => setOpen(false)} className="text-xs text-[var(--color-stone)] hover:underline">Close</button>}
      </div>
    </div>
  );
}
