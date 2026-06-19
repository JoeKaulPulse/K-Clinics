'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Markdown } from '@/components/academy/Markdown';
import { Glyph } from '@/components/ui/Glyph';
import { LessonMedia, Downloads } from '@/components/academy/LessonMedia';
import { LessonEngagement } from '@/components/academy/LessonEngagement';
import type { CourseLearning, ModuleView, LessonView, QuizView } from '@/lib/lms';

const fmtReleaseDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

type Sel = { type: 'lesson'; moduleId: string; lessonId: string } | { type: 'quiz'; moduleId: string } | { type: 'resources' };

export function CoursePlayer({ learning, slug }: { learning: CourseLearning; slug: string }) {
  // Local progress mirrors the server so the UI updates without a reload.
  const [doneLessons, setDoneLessons] = useState<Set<string>>(() => new Set(learning.modules.flatMap((m) => m.lessons.filter((l) => l.done).map((l) => l.id))));
  const [quizState, setQuizState] = useState<Record<string, { passed: boolean; best: number | null }>>(() => {
    const o: Record<string, { passed: boolean; best: number | null }> = {};
    for (const m of learning.modules) if (m.quiz) o[m.quiz.id] = { passed: m.quiz.passed, best: m.quiz.bestScore };
    return o;
  });

  // Flat, ordered list of navigable items (locked modules excluded) — drives resume
  // and the "Next →" button.
  const flat = useMemo<Sel[]>(() => {
    const out: Sel[] = [];
    for (const m of learning.modules) {
      if (m.lockedUntil) continue;
      for (const l of m.lessons) out.push({ type: 'lesson', moduleId: m.id, lessonId: l.id });
      if (m.quiz) out.push({ type: 'quiz', moduleId: m.id });
    }
    return out;
  }, [learning]);
  const firstUndone = useMemo<Sel | null>(() => {
    const doneL = new Set(learning.modules.flatMap((m) => m.lessons.filter((l) => l.done).map((l) => l.id)));
    const passedQ = new Set(learning.modules.filter((m) => m.quiz?.passed).map((m) => m.quiz!.id));
    for (const m of learning.modules) {
      if (m.lockedUntil) continue;
      for (const l of m.lessons) if (!doneL.has(l.id)) return { type: 'lesson', moduleId: m.id, lessonId: l.id };
      if (m.quiz && !passedQ.has(m.quiz.id)) return { type: 'quiz', moduleId: m.id };
    }
    return flat[0] ?? null;
  }, [learning, flat]);
  const [sel, setSel] = useState<Sel | null>(firstUndone);
  const selKey = (s: Sel | null) => (!s ? '' : s.type === 'lesson' ? `l:${s.lessonId}` : s.type === 'quiz' ? `q:${s.moduleId}` : 'resources');
  // All downloadable files across released modules, for a single "Resources" view.
  const allAttachments = useMemo(() => learning.modules.flatMap((m) => (m.lockedUntil ? [] : m.lessons.flatMap((l) => l.attachments))), [learning]);
  const nextSel = useMemo<Sel | null>(() => {
    const i = flat.findIndex((s) => selKey(s) === selKey(sel));
    return i >= 0 && i + 1 < flat.length ? flat[i + 1] : null;
  }, [flat, sel]);
  const goNext = nextSel ? () => { setSel(nextSel); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); } : undefined;

  const totals = useMemo(() => {
    let total = 0, done = 0;
    for (const m of learning.modules) {
      for (const l of m.lessons) { total++; if (doneLessons.has(l.id)) done++; }
      if (m.quiz) { total++; if (quizState[m.quiz.id]?.passed) done++; }
    }
    return { pct: total ? Math.round((done / total) * 100) : 0, allDone: total > 0 && done === total };
  }, [learning, doneLessons, quizState]);

  const curModule = learning.modules.find((m) => m.id === (sel && sel.type !== 'resources' ? sel.moduleId : undefined)) ?? null;
  const curLesson = sel?.type === 'lesson' ? curModule?.lessons.find((l) => l.id === sel.lessonId) ?? null : null;
  const curQuiz = sel?.type === 'quiz' ? curModule?.quiz ?? null : null;

  // Gamification parity with the immersive player: surface earned badges as a
  // transient toast when a lesson is completed or a quiz passed in the outline.
  const [badgeToast, setBadgeToast] = useState<{ key: string; name: string; icon: string }[]>([]);
  function pushBadges(b?: { key: string; name: string; icon: string }[]) {
    if (!b?.length) return;
    setBadgeToast(b);
    setTimeout(() => setBadgeToast([]), 4500);
  }

  async function markComplete(lessonId: string) {
    setDoneLessons((s) => new Set(s).add(lessonId)); // optimistic
    const r = await fetch('/api/academy/lesson', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonId }) }).then((x) => x.json()).catch(() => null);
    pushBadges(r?.newBadges);
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
          {learning.modules.map((m, mi) => {
            if (m.lockedUntil) {
              // Drip-locked module: shown in the outline, content withheld until release.
              return (
                <div key={m.id} className="opacity-70">
                  <p className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-stone)]">
                    <span className="grid h-4 w-4 place-items-center rounded-full border border-[var(--color-line)] text-[0.6rem]">🔒</span>
                    {m.title}
                  </p>
                  <div className="border-l border-[var(--color-line)] pl-3">
                    <ul className="space-y-0.5">
                      {m.lessons.map((l) => (
                        <li key={l.id} className="flex items-center gap-2 px-2.5 py-1.5 text-sm text-[var(--color-stone)]"><span className="text-xs">🔒</span><span className="flex-1">{l.title}</span></li>
                      ))}
                    </ul>
                    <p className="mt-1 px-2.5 text-[0.7rem] text-[var(--color-stone)]">Unlocks {fmtReleaseDate(m.lockedUntil)}</p>
                  </div>
                </div>
              );
            }
            return (
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
                        <span className={`text-xs ${doneLessons.has(l.id) ? 'text-[var(--color-gold)]' : 'text-[var(--color-stone)]'}`}>{doneLessons.has(l.id) ? '✓' : '○'}</span>
                        <span className="flex-1">{l.title}</span>
                      </button>
                    </li>
                  );
                })}
                {m.quiz && (
                  <li>
                    <button onClick={() => setSel({ type: 'quiz', moduleId: m.id })} className={`flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-left text-sm transition-colors ${sel?.type === 'quiz' && sel.moduleId === m.id ? 'bg-[var(--color-bone)] text-[var(--color-ink)]' : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-bone)]'}`}>
                      <span className={`text-xs ${quizState[m.quiz.id]?.passed ? 'text-[var(--color-gold)]' : 'text-[var(--color-stone)]'}`}>{quizState[m.quiz.id]?.passed ? '✓' : '◆'}</span>
                      <span className="flex-1 font-medium">{m.quiz.title}</span>
                    </button>
                  </li>
                )}
              </ul>
            </div>
            );
          })}
          {allAttachments.length > 0 && (
            <button onClick={() => setSel({ type: 'resources' })} className={`flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-left text-sm transition-colors ${sel?.type === 'resources' ? 'bg-[var(--color-bone)] text-[var(--color-ink)]' : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-bone)]'}`}>
              <span className="text-xs text-[var(--color-stone)]">↓</span>
              <span className="flex-1 font-medium">Resources &amp; downloads</span>
            </button>
          )}
        </nav>
      </aside>

      {/* Main panel */}
      <div className="min-h-[60vh] rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6 md:p-10">
        {curLesson && <LessonPanel lesson={curLesson} done={doneLessons.has(curLesson.id)} onComplete={() => markComplete(curLesson.id)} onNext={goNext} />}
        {curQuiz && (
          <QuizPanel
            quiz={curQuiz}
            state={quizState[curQuiz.id]}
            onGraded={(passed, best) => setQuizState((s) => ({ ...s, [curQuiz.id]: { passed: s[curQuiz.id]?.passed || passed, best: Math.max(s[curQuiz.id]?.best ?? 0, best) } }))}
            onBadges={pushBadges}
            onNext={goNext}
          />
        )}
        {sel?.type === 'resources' && (
          <div>
            <p className="eyebrow mb-2">All course materials</p>
            <h2 className="font-[family-name:var(--font-display)] text-2xl md:text-3xl">Resources &amp; downloads</h2>
            <p className="mt-2 text-sm text-[var(--color-stone)]">Everything attached across this course — lesson materials and homework — in one place.</p>
            {allAttachments.length > 0
              ? <Downloads items={allAttachments} />
              : <p className="mt-6 text-sm text-[var(--color-stone)]">No downloadable files yet.</p>}
          </div>
        )}
        {!curLesson && !curQuiz && sel?.type !== 'resources' && <p className="text-[var(--color-stone)]">Select a lesson to begin.</p>}
      </div>

      {/* Earned-badge toast (parity with the immersive celebrations) */}
      {badgeToast.length > 0 && (
        <div className="fixed inset-x-0 bottom-6 z-[120] flex justify-center px-4" role="status" aria-live="polite">
          <div className="flex items-center gap-3 rounded-full border border-[var(--color-gold)] bg-[var(--color-porcelain)] px-5 py-3 shadow-[var(--shadow-soft)]">
            <span className="text-xl">{badgeToast[0].icon}</span>
            <span className="text-sm font-medium text-[var(--color-ink)]">{badgeToast.length === 1 ? `Badge earned — ${badgeToast[0].name}` : `${badgeToast.length} badges earned!`}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function LessonPanel({ lesson, done, onComplete, onNext }: { lesson: LessonView; done: boolean; onComplete: () => void; onNext?: () => void }) {
  return (
    <article>
      <p className="eyebrow mb-2">{lesson.durationMin ? `${lesson.durationMin} min` : 'Lesson'}</p>
      <h2 className="font-[family-name:var(--font-display)] text-2xl md:text-3xl">{lesson.title}</h2>

      <LessonMedia lesson={lesson} onComplete={done ? undefined : onComplete} />

      {/* A still image still shows for non-video lessons that supplied one. */}
      {lesson.imageUrl && !lesson.videoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={lesson.imageUrl} alt={lesson.title} className="mt-6 w-full rounded-[var(--radius-lg)] border border-[var(--color-line)]" />
      )}

      <div className="mt-2"><Markdown text={lesson.body} /></div>

      <Downloads items={lesson.attachments} />

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
            <div><p className="eyebrow mb-2 text-xs">Further reading</p><ul className="space-y-1 text-sm">{lesson.resources.map((c, i) => {
              const isPdf = /\.pdf(\?|$)/i.test(c.url);
              return <li key={i}>{isPdf ? (<a href={c.url} download target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 link-underline text-[var(--color-ink-soft)]"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>{c.label} ↓</a>) : (<a href={c.url} target="_blank" rel="noopener noreferrer" className="link-underline text-[var(--color-ink-soft)]">{c.label} ↗</a>)}</li>;
            })}</ul></div>
          )}
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--color-line)] pt-6">
        {done
          ? <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-gold)]">✓ Lesson complete</span>
          : <span className="text-sm text-[var(--color-stone)]">Finished? Mark it complete to track your progress.</span>}
        {onNext
          ? <button onClick={() => { if (!done) onComplete(); onNext(); }} className="rounded-full bg-[var(--color-gold)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-ink)]">{done ? 'Next lesson →' : 'Complete & continue →'}</button>
          : (!done && <button onClick={onComplete} className="rounded-full bg-[var(--color-ink)] px-6 py-2.5 text-sm font-medium text-[var(--color-porcelain)] hover:bg-[var(--color-espresso)]">Mark as complete</button>)}
      </div>

      <LessonEngagement lessonId={lesson.id} />
    </article>
  );
}

type QuizResult = { scorePct: number; passed: boolean; passMark: number; results: { questionId: string; correct: boolean; correctIndices: number[]; explanation: string | null }[] };

function QuizPanel({ quiz, state, onGraded, onBadges, onNext }: { quiz: QuizView; state?: { passed: boolean; best: number | null }; onGraded: (passed: boolean, best: number) => void; onBadges?: (b?: { key: string; name: string; icon: string }[]) => void; onNext?: () => void }) {
  const [answers, setAnswers] = useState<Record<string, number[] | string>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [round, setRound] = useState(0); // bumped on retake to reshuffle + reset timer

  const attemptsLeft = quiz.maxAttempts ? Math.max(0, quiz.maxAttempts - quiz.attemptsUsed) : null;
  const noAttemptsLeft = !quiz.isSurvey && attemptsLeft === 0;

  // Per-question display order for options (shuffled when enabled). Maps display
  // position → ORIGINAL index, so what we send for grading stays original-indexed.
  const optionOrder = useMemo<Record<string, number[]>>(() => {
    const o: Record<string, number[]> = {};
    for (const q of quiz.questions) {
      const idxs = q.options.map((_, i) => i);
      if (quiz.shuffleOptions) for (let i = idxs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idxs[i], idxs[j]] = [idxs[j], idxs[i]]; }
      o[q.id] = idxs;
    }
    return o;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz, round]);

  const [secondsLeft, setSecondsLeft] = useState<number | null>(quiz.timeLimitMin ? quiz.timeLimitMin * 60 : null);

  function getArr(qid: string): number[] { const v = answers[qid]; return Array.isArray(v) ? v : []; }
  function toggle(qid: string, idx: number, multi: boolean) {
    if (result) return;
    setAnswers((a) => {
      const cur = Array.isArray(a[qid]) ? (a[qid] as number[]) : [];
      if (multi) return { ...a, [qid]: cur.includes(idx) ? cur.filter((x) => x !== idx) : [...cur, idx] };
      return { ...a, [qid]: [idx] };
    });
  }
  function setText(qid: string, text: string) { if (!result) setAnswers((a) => ({ ...a, [qid]: text })); }

  async function submit(force = false) {
    if (busy || result) return;
    let toSend: Record<string, number[] | string> = answers;
    if (force) {
      // Timer ran out — submit what we have, filling blanks so the count is complete.
      toSend = { ...answers };
      for (const q of quiz.questions) if (!(q.id in toSend)) toSend[q.id] = q.type === 'SHORT' ? '' : [];
    } else if (!quiz.isSurvey) {
      const answered = quiz.questions.filter((q) => { const v = answers[q.id]; return q.type === 'SHORT' ? typeof v === 'string' && v.trim() : Array.isArray(v) && v.length; });
      if (answered.length < quiz.questions.length) { setErr('Please answer every question.'); return; }
    }
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/academy/quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quizId: quiz.id, answers: toSend }) });
      const j = await res.json();
      if (j.ok) { setResult(j); onGraded(j.passed, j.scorePct); onBadges?.(j.newBadges); }
      else setErr(j.error || 'Could not submit.');
    } catch { setErr('Network error.'); }
    finally { setBusy(false); }
  }

  // Countdown for timed assessments; auto-submits at zero.
  useEffect(() => {
    if (result || secondsLeft == null || noAttemptsLeft) return;
    if (secondsLeft <= 0) { submit(true); return; }
    const t = setTimeout(() => setSecondsLeft((s) => (s == null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, result, noAttemptsLeft]);

  function retake() { setAnswers({}); setResult(null); setErr(''); setRound((n) => n + 1); setSecondsLeft(quiz.timeLimitMin ? quiz.timeLimitMin * 60 : null); }
  const resById = (qid: string) => result?.results.find((r) => r.questionId === qid);
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const isSurveyResult = result && quiz.isSurvey;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow mb-2">{quiz.isSurvey ? 'Survey · your feedback' : `Assessment · ${quiz.passMark}% to pass`}</p>
          <h2 className="font-[family-name:var(--font-display)] text-2xl md:text-3xl">{quiz.title}</h2>
        </div>
        {!result && secondsLeft != null && !noAttemptsLeft && (
          <span className={`rounded-full px-3 py-1 text-sm font-medium tabular-nums ${secondsLeft <= 30 ? 'bg-[var(--color-blush)]/15 text-[var(--color-blush)]' : 'bg-[var(--color-bone)] text-[var(--color-ink-soft)]'}`}>⏱ {mmss(secondsLeft)}</span>
        )}
      </div>
      <p className="mt-1 text-xs text-[var(--color-stone)]">
        {quiz.questions.length} question{quiz.questions.length === 1 ? '' : 's'}
        {quiz.timeLimitMin ? ` · ${quiz.timeLimitMin} min` : ''}
        {attemptsLeft != null ? ` · ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left` : ''}
      </p>
      {state?.passed && !result && !quiz.isSurvey && <p className="mt-2 text-sm font-medium text-[var(--color-gold)]">✓ Passed{state.best != null ? ` · best score ${state.best}%` : ''}. You can retake it any time.</p>}

      {result && !quiz.isSurvey && (
        <div className={`mt-5 rounded-[var(--radius-lg)] border p-5 ${result.passed ? 'border-[var(--color-gold)]/40 bg-[var(--color-gold)]/8' : 'border-[var(--color-blush)]/40 bg-[var(--color-blush)]/8'}`}>
          <p className="flex items-center gap-2 font-[family-name:var(--font-display)] text-2xl">{result.passed && <Glyph name="sparkle" className="h-5 w-5 text-[var(--color-gold)]" />}{result.passed ? 'Passed' : 'Not quite yet'}</p>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">You scored <strong>{result.scorePct}%</strong> ({result.passMark}% needed). {result.passed ? 'Well done — the module is complete.' : 'Review the feedback below and try again.'}</p>
        </div>
      )}
      {isSurveyResult && (
        <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--color-gold)]/40 bg-[var(--color-gold)]/8 p-5">
          <p className="font-[family-name:var(--font-display)] text-2xl">Thank you</p>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Your feedback has been recorded.</p>
        </div>
      )}

      {noAttemptsLeft && !result ? (
        <p className="mt-6 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] p-5 text-sm text-[var(--color-stone)]">You’ve used all your attempts for this assessment.{state?.best != null ? ` Your best score was ${state.best}%.` : ''}</p>
      ) : (
      <ol className="mt-6 space-y-6">
        {quiz.questions.map((q, qi) => {
          const multi = q.type === 'MULTI';
          const r = resById(q.id);
          return (
            <li key={q.id} className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] p-5">
              <p className="font-medium">{qi + 1}. {q.prompt}{multi && <span className="ml-2 text-xs font-normal text-[var(--color-stone)]">(select all that apply)</span>}</p>
              {q.imageUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={q.imageUrl} alt="" className="mt-3 max-h-60 rounded-[var(--radius-md)]" />}
              {q.type === 'SHORT' ? (
                <div className="mt-3">
                  <input
                    type="text"
                    disabled={!!result}
                    value={typeof answers[q.id] === 'string' ? (answers[q.id] as string) : ''}
                    onChange={(e) => setText(q.id, e.target.value)}
                    placeholder="Type your answer…"
                    className={`w-full rounded-[var(--radius-sm)] border px-4 py-2.5 text-sm ${r ? (r.correct ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/10' : 'border-[var(--color-blush)] bg-[var(--color-blush)]/10') : 'border-[var(--color-line)] bg-white focus:border-[var(--color-gold)] focus:outline-none'}`}
                  />
                  {r && <p className={`mt-2 text-xs font-medium ${r.correct ? 'text-[var(--color-gold)]' : 'text-[var(--color-blush)]'}`}>{r.correct ? '✓ Correct' : '✗ Not quite'}</p>}
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {optionOrder[q.id].map((origIdx) => {
                    const opt = q.options[origIdx];
                    const chosen = getArr(q.id).includes(origIdx);
                    const isCorrect = r?.correctIndices.includes(origIdx);
                    const stateCls = r ? (isCorrect ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/10' : chosen ? 'border-[var(--color-blush)] bg-[var(--color-blush)]/10' : 'border-[var(--color-line)]') : chosen ? 'border-[var(--color-ink)] bg-[var(--color-porcelain)]' : 'border-[var(--color-line)] hover:border-[var(--color-stone-soft)]';
                    return (
                      <button key={origIdx} disabled={!!result} onClick={() => toggle(q.id, origIdx, multi)} className={`flex w-full items-center gap-3 rounded-[var(--radius-sm)] border px-4 py-2.5 text-left text-sm transition-colors ${stateCls}`}>
                        <span className={`grid h-4 w-4 shrink-0 place-items-center ${multi ? 'rounded-[3px]' : 'rounded-full'} border ${chosen ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-white' : 'border-[var(--color-stone-soft)]'}`}>{chosen ? '✓' : ''}</span>
                        <span className="flex-1">{opt}</span>
                        {r && isCorrect && <span className="text-xs font-medium text-[var(--color-gold)]">correct</span>}
                      </button>
                    );
                  })}
                </div>
              )}
              {r && r.explanation && <p className="mt-3 rounded-[var(--radius-sm)] bg-[var(--color-porcelain)] px-4 py-2.5 text-sm text-[var(--color-ink-soft)]"><strong>{quiz.isSurvey ? 'Note' : 'Why'}:</strong> {r.explanation}</p>}
            </li>
          );
        })}
      </ol>
      )}

      {err && <p className="mt-4 text-sm text-[var(--color-blush)]">{err}</p>}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {result ? (
          !quiz.isSurvey && !noAttemptsLeft && <button onClick={retake} className="rounded-full bg-[var(--color-ink)] px-6 py-2.5 text-sm font-medium text-[var(--color-porcelain)] hover:bg-[var(--color-espresso)]">Retake assessment</button>
        ) : !noAttemptsLeft && (
          <button onClick={() => submit(false)} disabled={busy} className="rounded-full bg-[var(--color-gold)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-ink)] disabled:opacity-60">{busy ? 'Marking…' : quiz.isSurvey ? 'Submit feedback' : 'Submit answers'}</button>
        )}
        {onNext && (result?.passed || state?.passed || isSurveyResult) && (
          <button onClick={onNext} className="rounded-full bg-[var(--color-gold)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-ink)]">Next →</button>
        )}
      </div>
    </div>
  );
}
