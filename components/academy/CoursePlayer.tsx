'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Markdown } from '@/components/academy/Markdown';
import { Glyph } from '@/components/ui/Glyph';
import type { CourseLearning, ModuleView, LessonView, QuizView } from '@/lib/lms';

function ytId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

type Sel = { type: 'lesson'; moduleId: string; lessonId: string } | { type: 'quiz'; moduleId: string };

export function CoursePlayer({ learning, slug }: { learning: CourseLearning; slug: string }) {
  // Local progress mirrors the server so the UI updates without a reload.
  const [doneLessons, setDoneLessons] = useState<Set<string>>(() => new Set(learning.modules.flatMap((m) => m.lessons.filter((l) => l.done).map((l) => l.id))));
  const [quizState, setQuizState] = useState<Record<string, { passed: boolean; best: number | null }>>(() => {
    const o: Record<string, { passed: boolean; best: number | null }> = {};
    for (const m of learning.modules) if (m.quiz) o[m.quiz.id] = { passed: m.quiz.passed, best: m.quiz.bestScore };
    return o;
  });

  const firstUndone = useMemo(() => {
    for (const m of learning.modules) {
      for (const l of m.lessons) if (!learning.modules.flatMap((x) => x.lessons).find((y) => y.id === l.id)?.done) return { type: 'lesson', moduleId: m.id, lessonId: l.id } as Sel;
    }
    const f = learning.modules[0];
    return f?.lessons[0] ? ({ type: 'lesson', moduleId: f.id, lessonId: f.lessons[0].id } as Sel) : null;
  }, [learning]);
  const [sel, setSel] = useState<Sel | null>(firstUndone);

  const totals = useMemo(() => {
    let total = 0, done = 0;
    for (const m of learning.modules) {
      for (const l of m.lessons) { total++; if (doneLessons.has(l.id)) done++; }
      if (m.quiz) { total++; if (quizState[m.quiz.id]?.passed) done++; }
    }
    return { pct: total ? Math.round((done / total) * 100) : 0, allDone: total > 0 && done === total };
  }, [learning, doneLessons, quizState]);

  const curModule = learning.modules.find((m) => m.id === sel?.moduleId) ?? null;
  const curLesson = sel?.type === 'lesson' ? curModule?.lessons.find((l) => l.id === sel.lessonId) ?? null : null;
  const curQuiz = sel?.type === 'quiz' ? curModule?.quiz ?? null : null;

  async function markComplete(lessonId: string) {
    setDoneLessons((s) => new Set(s).add(lessonId)); // optimistic
    await fetch('/api/academy/lesson', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonId }) }).catch(() => {});
  }

  const moduleComplete = (m: ModuleView) => m.lessons.every((l) => doneLessons.has(l.id)) && (!m.quiz || quizState[m.quiz.id]?.passed);

  return (
    <div className="grid gap-8 lg:grid-cols-[320px_1fr] lg:items-start">
      {/* Sidebar */}
      <aside className="lg:sticky lg:top-24">
        <Link href="/academy/portal" className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">← Trainee portal</Link>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-2xl leading-tight">{learning.course.title}</h1>
        {learning.course.level && <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--color-gold)]">{learning.course.level}</p>}

        {/* Progress bar */}
        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between text-xs text-[var(--color-stone)]"><span>Your progress</span><span className="font-medium text-[var(--color-ink)]">{totals.pct}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--color-line)]"><div className="h-full rounded-full bg-[var(--color-gold)] transition-[width] duration-500" style={{ width: `${totals.pct}%` }} /></div>
        </div>

        {totals.allDone && (
          <Link href={`/academy/learn/${slug}/certificate`} className="mt-4 flex items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-ink)] px-4 py-2.5 text-center text-sm font-medium text-[var(--color-porcelain)]"><Glyph name="cap" className="h-4 w-4" /> View your certificate</Link>
        )}

        <nav className="mt-6 space-y-4">
          {learning.modules.map((m, mi) => (
            <div key={m.id}>
              <p className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-stone)]">
                <span className={`grid h-4 w-4 place-items-center rounded-full text-[0.6rem] ${moduleComplete(m) ? 'bg-[var(--color-gold)] text-white' : 'border border-[var(--color-line)]'}`}>{moduleComplete(m) ? '✓' : mi + 1}</span>
                {m.title}
              </p>
              <ul className="space-y-0.5 border-l border-[var(--color-line)] pl-3">
                {m.lessons.map((l) => {
                  const active = sel?.type === 'lesson' && sel.lessonId === l.id;
                  return (
                    <li key={l.id}>
                      <button onClick={() => setSel({ type: 'lesson', moduleId: m.id, lessonId: l.id })} className={`flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-left text-sm transition-colors ${active ? 'bg-[var(--color-bone)] text-[var(--color-ink)]' : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-bone)]'}`}>
                        <span className={`text-xs ${doneLessons.has(l.id) ? 'text-[var(--color-gold)]' : 'text-[var(--color-stone-soft)]'}`}>{doneLessons.has(l.id) ? '✓' : '○'}</span>
                        <span className="flex-1">{l.title}</span>
                      </button>
                    </li>
                  );
                })}
                {m.quiz && (
                  <li>
                    <button onClick={() => setSel({ type: 'quiz', moduleId: m.id })} className={`flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-left text-sm transition-colors ${sel?.type === 'quiz' && sel.moduleId === m.id ? 'bg-[var(--color-bone)] text-[var(--color-ink)]' : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-bone)]'}`}>
                      <span className={`text-xs ${quizState[m.quiz.id]?.passed ? 'text-[var(--color-gold)]' : 'text-[var(--color-stone-soft)]'}`}>{quizState[m.quiz.id]?.passed ? '✓' : '◆'}</span>
                      <span className="flex-1 font-medium">{m.quiz.title}</span>
                    </button>
                  </li>
                )}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main panel */}
      <div className="min-h-[60vh] rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6 md:p-10">
        {curLesson && <LessonPanel lesson={curLesson} done={doneLessons.has(curLesson.id)} onComplete={() => markComplete(curLesson.id)} />}
        {curQuiz && (
          <QuizPanel
            quiz={curQuiz}
            state={quizState[curQuiz.id]}
            onGraded={(passed, best) => setQuizState((s) => ({ ...s, [curQuiz.id]: { passed: s[curQuiz.id]?.passed || passed, best: Math.max(s[curQuiz.id]?.best ?? 0, best) } }))}
          />
        )}
        {!curLesson && !curQuiz && <p className="text-[var(--color-stone)]">Select a lesson to begin.</p>}
      </div>
    </div>
  );
}

function LessonPanel({ lesson, done, onComplete }: { lesson: LessonView; done: boolean; onComplete: () => void }) {
  const id = lesson.videoUrl ? ytId(lesson.videoUrl) : null;
  return (
    <article>
      <p className="eyebrow mb-2">{lesson.durationMin ? `${lesson.durationMin} min` : 'Lesson'}</p>
      <h2 className="font-[family-name:var(--font-display)] text-2xl md:text-3xl">{lesson.title}</h2>

      {lesson.videoUrl && (
        <div className="mt-6">
          <p className="eyebrow mb-2 text-xs">Watch first</p>
          {id ? (
            <div className="aspect-video w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)]">
              <iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${id}`} title={lesson.title} loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
          ) : (
            <a href={lesson.videoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] px-5 py-2.5 text-sm font-medium hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]">▶ Watch explainer videos</a>
          )}
        </div>
      )}

      {lesson.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={lesson.imageUrl} alt={lesson.title} className="mt-6 w-full rounded-[var(--radius-lg)] border border-[var(--color-line)]" />
      )}

      <div className="mt-2"><Markdown text={lesson.body} /></div>

      {lesson.keyPoints.length > 0 && (
        <div className="mt-7 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] p-5">
          <p className="eyebrow mb-3">Key points</p>
          <ul className="space-y-2">{lesson.keyPoints.map((p, i) => <li key={i} className="flex gap-2.5 text-sm text-[var(--color-ink-soft)]"><span className="mt-1 text-[var(--color-gold)]">✦</span>{p}</li>)}</ul>
        </div>
      )}

      {(lesson.citations.length > 0 || lesson.resources.length > 0) && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {lesson.citations.length > 0 && (
            <div><p className="eyebrow mb-2 text-xs">References</p><ul className="space-y-1 text-sm">{lesson.citations.map((c, i) => <li key={i}><a href={c.url} target="_blank" rel="noopener noreferrer" className="link-underline text-[var(--color-ink-soft)]">{c.label} ↗</a></li>)}</ul></div>
          )}
          {lesson.resources.length > 0 && (
            <div><p className="eyebrow mb-2 text-xs">Further reading</p><ul className="space-y-1 text-sm">{lesson.resources.map((c, i) => <li key={i}><a href={c.url} target="_blank" rel="noopener noreferrer" className="link-underline text-[var(--color-ink-soft)]">{c.label} ↗</a></li>)}</ul></div>
          )}
        </div>
      )}

      <div className="mt-8 flex items-center gap-4 border-t border-[var(--color-line)] pt-6">
        {done ? (
          <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-gold)]">✓ Lesson complete</span>
        ) : (
          <button onClick={onComplete} className="rounded-full bg-[var(--color-ink)] px-6 py-2.5 text-sm font-medium text-[var(--color-porcelain)] hover:bg-[var(--color-espresso)]">Mark as complete</button>
        )}
      </div>
    </article>
  );
}

function QuizPanel({ quiz, state, onGraded }: { quiz: QuizView; state?: { passed: boolean; best: number | null }; onGraded: (passed: boolean, best: number) => void }) {
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [result, setResult] = useState<null | { scorePct: number; passed: boolean; passMark: number; results: { questionId: string; correct: boolean; correctIndices: number[]; explanation: string | null }[] }>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  function toggle(qid: string, idx: number, multi: boolean) {
    setAnswers((a) => {
      const cur = a[qid] ?? [];
      if (multi) return { ...a, [qid]: cur.includes(idx) ? cur.filter((x) => x !== idx) : [...cur, idx] };
      return { ...a, [qid]: [idx] };
    });
  }

  async function submit() {
    if (Object.keys(answers).length < quiz.questions.length) { setErr('Please answer every question.'); return; }
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/academy/quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quizId: quiz.id, answers }) });
      const j = await res.json();
      if (j.ok) { setResult(j); onGraded(j.passed, j.scorePct); }
      else setErr(j.error || 'Could not submit.');
    } catch { setErr('Network error.'); }
    finally { setBusy(false); }
  }

  function retake() { setAnswers({}); setResult(null); setErr(''); }
  const resById = (qid: string) => result?.results.find((r) => r.questionId === qid);

  return (
    <div>
      <p className="eyebrow mb-2">Assessment · {quiz.passMark}% to pass</p>
      <h2 className="font-[family-name:var(--font-display)] text-2xl md:text-3xl">{quiz.title}</h2>
      {state?.passed && !result && <p className="mt-2 text-sm font-medium text-[var(--color-gold)]">✓ Passed{state.best != null ? ` · best score ${state.best}%` : ''}. You can retake it any time.</p>}

      {result && (
        <div className={`mt-5 rounded-[var(--radius-lg)] border p-5 ${result.passed ? 'border-[var(--color-gold)]/40 bg-[var(--color-gold)]/8' : 'border-[var(--color-blush)]/40 bg-[var(--color-blush)]/8'}`}>
          <p className="flex items-center gap-2 font-[family-name:var(--font-display)] text-2xl">{result.passed && <Glyph name="sparkle" className="h-5 w-5 text-[var(--color-gold)]" />}{result.passed ? 'Passed' : 'Not quite yet'}</p>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">You scored <strong>{result.scorePct}%</strong> ({result.passMark}% needed). {result.passed ? 'Well done — the module is complete.' : 'Review the feedback below and try again.'}</p>
        </div>
      )}

      <ol className="mt-6 space-y-6">
        {quiz.questions.map((q, qi) => {
          const multi = q.type === 'MULTI';
          const r = resById(q.id);
          return (
            <li key={q.id} className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] p-5">
              <p className="font-medium">{qi + 1}. {q.prompt}{multi && <span className="ml-2 text-xs font-normal text-[var(--color-stone)]">(select all that apply)</span>}</p>
              {q.imageUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={q.imageUrl} alt="" className="mt-3 max-h-60 rounded-[var(--radius-md)]" />}
              <div className="mt-3 space-y-2">
                {q.options.map((opt, oi) => {
                  const chosen = (answers[q.id] ?? []).includes(oi);
                  const isCorrect = r?.correctIndices.includes(oi);
                  const stateCls = r ? (isCorrect ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/10' : chosen ? 'border-[var(--color-blush)] bg-[var(--color-blush)]/10' : 'border-[var(--color-line)]') : chosen ? 'border-[var(--color-ink)] bg-[var(--color-porcelain)]' : 'border-[var(--color-line)] hover:border-[var(--color-stone-soft)]';
                  return (
                    <button key={oi} disabled={!!result} onClick={() => toggle(q.id, oi, multi)} className={`flex w-full items-center gap-3 rounded-[var(--radius-sm)] border px-4 py-2.5 text-left text-sm transition-colors ${stateCls}`}>
                      <span className={`grid h-4 w-4 shrink-0 place-items-center ${multi ? 'rounded-[3px]' : 'rounded-full'} border ${chosen ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-white' : 'border-[var(--color-stone-soft)]'}`}>{chosen ? '✓' : ''}</span>
                      <span className="flex-1">{opt}</span>
                      {r && isCorrect && <span className="text-xs font-medium text-[var(--color-gold)]">correct</span>}
                    </button>
                  );
                })}
              </div>
              {r && r.explanation && <p className="mt-3 rounded-[var(--radius-sm)] bg-[var(--color-porcelain)] px-4 py-2.5 text-sm text-[var(--color-ink-soft)]"><strong>Why:</strong> {r.explanation}</p>}
            </li>
          );
        })}
      </ol>

      {err && <p className="mt-4 text-sm text-[var(--color-blush)]">{err}</p>}
      <div className="mt-6">
        {result ? (
          <button onClick={retake} className="rounded-full bg-[var(--color-ink)] px-6 py-2.5 text-sm font-medium text-[var(--color-porcelain)] hover:bg-[var(--color-espresso)]">Retake assessment</button>
        ) : (
          <button onClick={submit} disabled={busy} className="rounded-full bg-[var(--color-gold)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-ink)] disabled:opacity-60">{busy ? 'Marking…' : 'Submit answers'}</button>
        )}
      </div>
    </div>
  );
}
