'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Link = { label: string; url: string };
type Lesson = { id: string; title: string; durationMin: number | null; videoUrl: string | null; imageUrl: string | null; body: string; keyPoints: string[]; citations: Link[]; resources: Link[] };
type Question = { id: string; prompt: string; type: string; options: string[]; correct: number[]; explanation: string | null; imageUrl: string | null };
type Quiz = { id: string; title: string; passMark: number; questions: Question[] };
type Module = { id: string; title: string; summary: string | null; lessons: Lesson[]; quiz: Quiz | null };
type Course = { id: string; title: string; modules: Module[] };

const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]';
const label = 'block text-xs font-medium text-[var(--color-stone)]';
const btnDark = 'rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-xs font-medium text-[var(--color-porcelain)] disabled:opacity-50';
const btnGhost = 'rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs hover:border-[var(--color-gold)]';

async function post(payload: object) {
  const r = await fetch('/api/admin/lms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return r.json().catch(() => ({ ok: false }));
}
const linksToText = (a: Link[]) => a.map((x) => `${x.label} | ${x.url}`).join('\n');
const textToLinks = (t: string): Link[] => t.split('\n').map((l) => { const i = l.indexOf('|'); if (i < 0) return null; const label = l.slice(0, i).trim(); const url = l.slice(i + 1).trim(); return label && url ? { label, url } : null; }).filter(Boolean) as Link[];
const listToText = (a: string[]) => a.join('\n');
const textToList = (t: string) => t.split('\n').map((s) => s.trim()).filter(Boolean);

export function CurriculumManager({ course }: { course: Course }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function act(payload: object) { setBusy(true); const r = await post(payload); setBusy(false); if (r.ok) router.refresh(); else alert(r.error || 'Failed.'); return r; }
  const moveModule = (i: number, dir: number) => { const ids = course.modules.map((m) => m.id); const j = i + dir; if (j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; act({ op: 'reorderModules', ids }); };

  return (
    <div className="space-y-5">
      {course.modules.map((m, i) => (
        <ModuleCard key={m.id} module={m} index={i} total={course.modules.length} busy={busy} act={act} onMove={(d) => moveModule(i, d)} />
      ))}
      <button onClick={() => act({ op: 'createModule', courseId: course.id, title: `Module ${course.modules.length + 1}` })} disabled={busy} className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)] px-5 py-3 text-sm text-[var(--color-stone)] hover:border-[var(--color-gold)] hover:text-[var(--color-ink)]">+ Add module</button>
    </div>
  );
}

type Act = (payload: object) => Promise<{ ok: boolean; id?: string; error?: string }>;

function ModuleCard({ module: m, index, total, busy, act, onMove }: { module: Module; index: number; total: number; busy: boolean; act: Act; onMove: (d: number) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(m.title);
  const [summary, setSummary] = useState(m.summary ?? '');

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <button onClick={() => setOpen((v) => !v)} className="text-[var(--color-stone)]">{open ? '▾' : '▸'}</button>
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-stone-soft)]">Module {index + 1}</span>
        <span className="flex-1 font-[family-name:var(--font-display)] text-lg">{m.title}</span>
        <span className="text-xs text-[var(--color-stone-soft)]">{m.lessons.length} lessons · {m.quiz ? `${m.quiz.questions.length} Q` : 'no quiz'}</span>
        <button onClick={() => onMove(-1)} disabled={busy || index === 0} className={btnGhost}>↑</button>
        <button onClick={() => onMove(1)} disabled={busy || index === total - 1} className={btnGhost}>↓</button>
        <button onClick={() => { if (confirm('Delete this module and all its lessons/quiz?')) act({ op: 'deleteModule', id: m.id }); }} disabled={busy} className="text-xs text-[var(--color-blush)] hover:underline">Delete</button>
      </div>

      {open && (
        <div className="space-y-5 border-t border-[var(--color-line)] p-4">
          {/* Module fields */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>Title<input className={`${field} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
            <label className={label}>Summary<input className={`${field} mt-1`} value={summary} onChange={(e) => setSummary(e.target.value)} /></label>
          </div>
          <button onClick={() => act({ op: 'updateModule', id: m.id, title, summary })} disabled={busy} className={btnDark}>Save module</button>

          {/* Lessons */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">Lessons</p>
            <div className="space-y-2">
              {m.lessons.map((l, li) => <LessonRow key={l.id} lesson={l} index={li} total={m.lessons.length} busy={busy} act={act} lessonIds={m.lessons.map((x) => x.id)} />)}
            </div>
            <button onClick={() => act({ op: 'createLesson', moduleId: m.id })} disabled={busy} className="mt-2 text-xs font-medium text-[var(--color-gold)] hover:underline">+ Add lesson</button>
          </div>

          {/* Quiz */}
          <QuizBlock module={m} busy={busy} act={act} />
        </div>
      )}
    </div>
  );
}

function LessonRow({ lesson: l, index, total, busy, act, lessonIds }: { lesson: Lesson; index: number; total: number; busy: boolean; act: Act; lessonIds: string[] }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: l.title, durationMin: l.durationMin ?? '', videoUrl: l.videoUrl ?? '', imageUrl: l.imageUrl ?? '', body: l.body, keyPoints: listToText(l.keyPoints), citations: linksToText(l.citations), resources: linksToText(l.resources) });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const move = (d: number) => { const ids = [...lessonIds]; const j = index + d; if (j < 0 || j >= ids.length) return; [ids[index], ids[j]] = [ids[j], ids[index]]; act({ op: 'reorderLessons', ids }); };

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white">
      <div className="flex items-center gap-2 p-2.5">
        <button onClick={() => setOpen((v) => !v)} className="text-[var(--color-stone)]">{open ? '▾' : '▸'}</button>
        <span className="flex-1 text-sm">{l.title}</span>
        <button onClick={() => move(-1)} disabled={busy || index === 0} className={btnGhost}>↑</button>
        <button onClick={() => move(1)} disabled={busy || index === total - 1} className={btnGhost}>↓</button>
        <button onClick={() => { if (confirm('Delete this lesson?')) act({ op: 'deleteLesson', id: l.id }); }} disabled={busy} className="text-xs text-[var(--color-blush)] hover:underline">Delete</button>
      </div>
      {open && (
        <div className="space-y-3 border-t border-[var(--color-line)] p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>Title<input className={`${field} mt-1`} value={f.title} onChange={(e) => set('title', e.target.value)} /></label>
            <label className={label}>Duration (min)<input type="number" className={`${field} mt-1`} value={f.durationMin} onChange={(e) => set('durationMin', e.target.value as never)} /></label>
            <label className={label}>Video URL (YouTube watch/embed, or any link)<input className={`${field} mt-1`} value={f.videoUrl} onChange={(e) => set('videoUrl', e.target.value)} placeholder="https://www.youtube.com/watch?v=…" /></label>
            <label className={label}>Image URL (optional)<input className={`${field} mt-1`} value={f.imageUrl} onChange={(e) => set('imageUrl', e.target.value)} /></label>
          </div>
          <label className={label}>Lesson content (Markdown: ## headings, - bullets, **bold**)<textarea rows={8} className={`${field} mt-1 font-mono text-xs`} value={f.body} onChange={(e) => set('body', e.target.value)} /></label>
          <label className={label}>Key points (one per line)<textarea rows={3} className={`${field} mt-1`} value={f.keyPoints} onChange={(e) => set('keyPoints', e.target.value)} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>References (one per line: Label | https://url)<textarea rows={3} className={`${field} mt-1 text-xs`} value={f.citations} onChange={(e) => set('citations', e.target.value)} /></label>
            <label className={label}>Further reading (Label | https://url)<textarea rows={3} className={`${field} mt-1 text-xs`} value={f.resources} onChange={(e) => set('resources', e.target.value)} /></label>
          </div>
          <button onClick={() => act({ op: 'updateLesson', id: l.id, title: f.title, durationMin: f.durationMin, videoUrl: f.videoUrl, imageUrl: f.imageUrl, body: f.body, keyPoints: textToList(f.keyPoints), citations: textToLinks(f.citations), resources: textToLinks(f.resources) })} disabled={busy} className={btnDark}>Save lesson</button>
        </div>
      )}
    </div>
  );
}

function QuizBlock({ module: m, busy, act }: { module: Module; busy: boolean; act: Act }) {
  const [title, setTitle] = useState(m.quiz?.title ?? `${m.title} assessment`);
  const [passMark, setPassMark] = useState(m.quiz?.passMark ?? 70);
  if (!m.quiz) {
    return (
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">Assessment</p>
        <button onClick={() => act({ op: 'upsertQuiz', moduleId: m.id, title, passMark })} disabled={busy} className="text-xs font-medium text-[var(--color-gold)] hover:underline">+ Add a quiz to this module</button>
      </div>
    );
  }
  const q = m.quiz;
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">Assessment</p>
      <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className={`${label} flex-1`}>Quiz title<input className={`${field} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label className={label}>Pass mark %<input type="number" min={1} max={100} className={`${field} mt-1 w-24`} value={passMark} onChange={(e) => setPassMark(Number(e.target.value))} /></label>
          <button onClick={() => act({ op: 'upsertQuiz', moduleId: m.id, title, passMark })} disabled={busy} className={btnDark}>Save</button>
          <button onClick={() => { if (confirm('Delete this quiz and its questions?')) act({ op: 'deleteQuiz', id: q.id }); }} disabled={busy} className="text-xs text-[var(--color-blush)] hover:underline">Delete quiz</button>
        </div>
        <div className="mt-3 space-y-2">
          {q.questions.map((qq, qi) => <QuestionRow key={qq.id} q={qq} index={qi} total={q.questions.length} busy={busy} act={act} ids={q.questions.map((x) => x.id)} />)}
        </div>
        <button onClick={() => act({ op: 'createQuestion', quizId: q.id })} disabled={busy} className="mt-2 text-xs font-medium text-[var(--color-gold)] hover:underline">+ Add question</button>
      </div>
    </div>
  );
}

function QuestionRow({ q, index, total, busy, act, ids }: { q: Question; index: number; total: number; busy: boolean; act: Act; ids: string[] }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState(q.prompt);
  const [type, setType] = useState(q.type);
  const [explanation, setExplanation] = useState(q.explanation ?? '');
  const [options, setOptions] = useState<string[]>(q.options.length ? q.options : ['', '']);
  const [correct, setCorrect] = useState<number[]>(q.correct);

  const move = (d: number) => { const a = [...ids]; const j = index + d; if (j < 0 || j >= a.length) return; [a[index], a[j]] = [a[j], a[index]]; act({ op: 'reorderQuestions', ids: a }); };
  const setOpt = (i: number, v: string) => setOptions((o) => o.map((x, k) => (k === i ? v : x)));
  const addOpt = () => setOptions((o) => [...o, '']);
  const delOpt = (i: number) => { setOptions((o) => o.filter((_, k) => k !== i)); setCorrect((c) => c.filter((k) => k !== i).map((k) => (k > i ? k - 1 : k))); };
  const toggleCorrect = (i: number) => {
    if (type === 'MULTI') setCorrect((c) => (c.includes(i) ? c.filter((k) => k !== i) : [...c, i]));
    else setCorrect([i]);
  };
  const changeType = (t: string) => {
    setType(t);
    if (t === 'TRUEFALSE') { setOptions(['True', 'False']); setCorrect((c) => (c[0] === 1 ? [1] : [0])); }
    else if (t === 'SINGLE') setCorrect((c) => (c.length ? [c[0]] : [0]));
  };

  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bone)]">
      <div className="flex items-center gap-2 p-2.5">
        <button onClick={() => setOpen((v) => !v)} className="text-[var(--color-stone)]">{open ? '▾' : '▸'}</button>
        <span className="flex-1 text-sm">{index + 1}. {q.prompt}</span>
        <span className="rounded-full bg-[var(--color-porcelain)] px-2 py-0.5 text-[0.6rem] uppercase tracking-wide text-[var(--color-stone)]">{q.type}</span>
        <button onClick={() => move(-1)} disabled={busy || index === 0} className={btnGhost}>↑</button>
        <button onClick={() => move(1)} disabled={busy || index === total - 1} className={btnGhost}>↓</button>
        <button onClick={() => { if (confirm('Delete this question?')) act({ op: 'deleteQuestion', id: q.id }); }} disabled={busy} className="text-xs text-[var(--color-blush)] hover:underline">Delete</button>
      </div>
      {open && (
        <div className="space-y-3 border-t border-[var(--color-line)] p-3">
          <label className={label}>Question<textarea rows={2} className={`${field} mt-1`} value={prompt} onChange={(e) => setPrompt(e.target.value)} /></label>
          <div className="flex items-center gap-3">
            <label className={label}>Type
              <select className={`${field} mt-1 w-44`} value={type} onChange={(e) => changeType(e.target.value)}>
                <option value="SINGLE">Single answer</option>
                <option value="MULTI">Multiple answers</option>
                <option value="TRUEFALSE">True / False</option>
              </select>
            </label>
            <span className="self-end pb-2 text-xs text-[var(--color-stone-soft)]">{type === 'MULTI' ? 'Tick all correct answers' : 'Select the one correct answer'}</span>
          </div>
          <div>
            <p className={label}>Options</p>
            <div className="mt-1 space-y-2">
              {options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type={type === 'MULTI' ? 'checkbox' : 'radio'} checked={correct.includes(i)} onChange={() => toggleCorrect(i)} className="h-4 w-4 accent-[var(--color-gold)]" />
                  <input className={field} value={o} onChange={(e) => setOpt(i, e.target.value)} disabled={type === 'TRUEFALSE'} />
                  {type !== 'TRUEFALSE' && options.length > 2 && <button onClick={() => delOpt(i)} className="text-xs text-[var(--color-blush)]">✕</button>}
                </div>
              ))}
            </div>
            {type !== 'TRUEFALSE' && <button onClick={addOpt} className="mt-2 text-xs font-medium text-[var(--color-gold)] hover:underline">+ Add option</button>}
          </div>
          <label className={label}>Explanation (shown after answering)<textarea rows={2} className={`${field} mt-1`} value={explanation} onChange={(e) => setExplanation(e.target.value)} /></label>
          <button onClick={() => act({ op: 'updateQuestion', id: q.id, prompt, type, options, correct, explanation })} disabled={busy} className={btnDark}>Save question</button>
        </div>
      )}
    </div>
  );
}
