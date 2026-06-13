'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Markdown } from '@/components/academy/Markdown';
import { Glyph } from '@/components/ui/Glyph';
import type { CourseLearning, LessonView, QuizView } from '@/lib/lms';

function ytId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

type Step =
  | { kind: 'intro' }
  | { kind: 'lesson'; mi: number; li: number }
  | { kind: 'quiz'; mi: number }
  | { kind: 'done' };

/** Default minimum dwell time (seconds) on a lesson before it can be completed —
 *  a gentle anti-skip gate when an author hasn't set a specific minSeconds. */
const DEFAULT_MIN = 8;

export function ImmersiveCourse({ learning, slug, mode = 'learn', onExit }: { learning: CourseLearning; slug?: string; mode?: 'learn' | 'preview'; onExit?: () => void }) {
  const steps = useMemo<Step[]>(() => {
    const s: Step[] = [{ kind: 'intro' }];
    learning.modules.forEach((m, mi) => {
      m.lessons.forEach((_, li) => s.push({ kind: 'lesson', mi, li }));
      if (m.quiz) s.push({ kind: 'quiz', mi });
    });
    s.push({ kind: 'done' });
    return s;
  }, [learning]);

  const [doneLessons, setDoneLessons] = useState<Set<string>>(() => new Set(learning.modules.flatMap((m) => m.lessons.filter((l) => l.done).map((l) => l.id))));
  const [quizPassed, setQuizPassed] = useState<Set<string>>(() => new Set(learning.modules.filter((m) => m.quiz?.passed).map((m) => m.quiz!.id)));

  const isStepComplete = (st: Step): boolean => {
    if (st.kind === 'lesson') return doneLessons.has(learning.modules[st.mi].lessons[st.li].id);
    if (st.kind === 'quiz') { const q = learning.modules[st.mi].quiz; return q ? quizPassed.has(q.id) : true; }
    return true;
  };

  const doneContentCount = steps.filter((s) => (s.kind === 'lesson' || s.kind === 'quiz') && isStepComplete(s)).length;
  const contentCount = steps.filter((s) => s.kind === 'lesson' || s.kind === 'quiz').length;
  const pct = contentCount > 0 ? Math.round((doneContentCount / contentCount) * 100) : 0;

  // Resume point: first incomplete content step (or intro on a fresh start).
  const firstIncomplete = useMemo(() => {
    for (let i = 0; i < steps.length; i++) if (!isStepComplete(steps[i])) return i;
    return steps.length - 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const startedFresh = doneContentCount === 0;

  const [idx, setIdx] = useState(startedFresh ? 0 : firstIncomplete);
  const [maxReached, setMaxReached] = useState(mode === 'preview' ? steps.length - 1 : firstIncomplete);
  const step = steps[idx];

  // Lock background scroll while the full-screen overlay is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const ceiling = mode === 'preview' ? steps.length - 1 : maxReached;
  const go = (to: number) => { if (to >= 0 && to < steps.length && to <= ceiling) setIdx(to); };
  const advance = () => { setMaxReached((m) => Math.max(m, Math.min(idx + 1, steps.length - 1))); setIdx((i) => Math.min(i + 1, steps.length - 1)); };

  async function finishLesson(lesson: LessonView, seconds: number) {
    setDoneLessons((s) => new Set(s).add(lesson.id));
    if (mode === 'learn') {
      await fetch('/api/academy/lesson', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonId: lesson.id, secondsSpent: seconds }) }).catch(() => {});
    }
    advance();
  }
  function finishQuiz(quizId: string, passed: boolean) {
    if (passed) setQuizPassed((s) => new Set(s).add(quizId));
    advance();
  }

  const moduleLabel = step.kind === 'lesson' || step.kind === 'quiz' ? learning.modules[step.mi]?.title : null;
  const allComplete = learning.modules.length > 0 && learning.modules.every((m) => m.lessons.every((l) => doneLessons.has(l.id)) && (!m.quiz || quizPassed.has(m.quiz.id)));

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[var(--color-ink)] text-[var(--color-porcelain)]">
      {/* Top bar: exit · progress · counter */}
      <header className="flex items-center gap-4 border-b border-white/10 px-4 py-3 sm:px-6">
        <button onClick={onExit} aria-label="Exit course" className="grid h-9 w-9 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="m3 3 10 10M13 3 3 13" /></svg>
        </button>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/12">
          <div className="h-full rounded-full bg-[var(--color-gold)] transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
        <span className="shrink-0 text-xs tabular-nums text-white/70">{pct}%</span>
        {mode === 'preview' && <span className="shrink-0 rounded-full bg-[var(--color-gold)]/20 px-2.5 py-1 text-[0.65rem] font-medium uppercase tracking-wide text-[var(--color-gold)]">Preview</span>}
      </header>

      {moduleLabel && (
        <div className="border-b border-white/5 px-4 py-2 text-center text-xs uppercase tracking-[0.16em] text-white/45 sm:px-6">{moduleLabel}</div>
      )}

      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div key={idx} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.32, ease: 'easeOut' }} className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
            {step.kind === 'intro' && <IntroStep learning={learning} onBegin={() => go(Math.min(1, ceiling))} canBegin={ceiling >= 1} />}
            {step.kind === 'lesson' && (
              <LessonStep
                key={learning.modules[step.mi].lessons[step.li].id}
                lesson={learning.modules[step.mi].lessons[step.li]}
                reviewing={idx < maxReached && isStepComplete(step)}
                preview={mode === 'preview'}
                onContinue={(secs) => finishLesson(learning.modules[step.mi].lessons[step.li], secs)}
                onNext={advance}
              />
            )}
            {step.kind === 'quiz' && learning.modules[step.mi].quiz && (
              <QuizStep
                key={learning.modules[step.mi].quiz!.id}
                quiz={learning.modules[step.mi].quiz!}
                preview={mode === 'preview'}
                onFinish={(passed) => finishQuiz(learning.modules[step.mi].quiz!.id, passed)}
              />
            )}
            {step.kind === 'done' && <DoneStep slug={slug} preview={mode === 'preview'} complete={allComplete} onExit={onExit} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Back link (review only) */}
      {idx > 0 && step.kind !== 'done' && (
        <button onClick={() => go(idx - 1)} className="absolute bottom-4 left-4 text-xs text-white/40 transition-colors hover:text-white/80 sm:bottom-6 sm:left-6">← Back</button>
      )}
    </div>
  );
}

function IntroStep({ learning, onBegin, canBegin }: { learning: CourseLearning; onBegin: () => void; canBegin: boolean }) {
  return (
    <div className="text-center">
      {learning.course.level && <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-gold)]">{learning.course.level}</p>}
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl leading-tight sm:text-4xl">{learning.course.title}</h1>
      {learning.course.welcome && <p className="mx-auto mt-4 max-w-xl text-white/70">{learning.course.welcome}</p>}
      {learning.course.objectives.length > 0 && (
        <div className="mx-auto mt-8 max-w-md rounded-[var(--radius-lg)] border border-white/12 bg-white/5 p-6 text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/50">By the end of this course you will</p>
          <ul className="mt-3 space-y-2.5">
            {learning.course.objectives.map((o, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-white/85"><span className="mt-0.5 text-[var(--color-gold)]">✦</span>{o}</li>
            ))}
          </ul>
        </div>
      )}
      <button onClick={onBegin} disabled={!canBegin} className="mt-9 rounded-full bg-[var(--color-gold)] px-9 py-3 text-sm font-semibold text-[var(--color-ink)] transition-transform hover:scale-[1.02] disabled:opacity-50">
        {canBegin ? 'Begin →' : 'No lessons yet'}
      </button>
    </div>
  );
}

function LessonStep({ lesson, reviewing, preview, onContinue, onNext }: { lesson: LessonView; reviewing: boolean; preview: boolean; onContinue: (seconds: number) => void; onNext: () => void }) {
  const required = lesson.minSeconds != null ? lesson.minSeconds : DEFAULT_MIN;
  const [secs, setSecs] = useState(0);
  const [busy, setBusy] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (reviewing) return; // no timer when re-reading completed content
    const t = setInterval(() => setSecs(Math.round((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [reviewing]);

  const remaining = Math.max(0, required - secs);
  const gated = !reviewing && !preview && remaining > 0;
  const id = lesson.videoUrl ? ytId(lesson.videoUrl) : null;

  return (
    <article>
      <p className="text-xs uppercase tracking-[0.16em] text-white/45">{lesson.durationMin ? `${lesson.durationMin} min lesson` : 'Lesson'}</p>
      <h2 className="mt-2 font-[family-name:var(--font-display)] text-2xl sm:text-3xl">{lesson.title}</h2>

      {lesson.objectives.length > 0 && (
        <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--color-gold)]/25 bg-[var(--color-gold)]/8 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-gold)]">In this lesson you will</p>
          <ul className="mt-2 space-y-1.5">{lesson.objectives.map((o, i) => <li key={i} className="flex gap-2 text-sm text-white/85"><span className="text-[var(--color-gold)]">›</span>{o}</li>)}</ul>
        </div>
      )}

      {lesson.videoUrl && id && (
        <div className="mt-6 aspect-video w-full overflow-hidden rounded-[var(--radius-lg)] border border-white/12">
          <iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${id}`} title={lesson.title} loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
      )}
      {lesson.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={lesson.imageUrl} alt={lesson.title} className="mt-6 w-full rounded-[var(--radius-lg)] border border-white/12" />
      )}

      <div className="mt-5"><Markdown text={lesson.body} tone="dark" /></div>

      {lesson.keyPoints.length > 0 && (
        <div className="mt-6 rounded-[var(--radius-lg)] border border-white/12 bg-white/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/50">Key points</p>
          <ul className="mt-3 space-y-2">{lesson.keyPoints.map((p, i) => <li key={i} className="flex gap-2.5 text-sm text-white/85"><span className="mt-0.5 text-[var(--color-gold)]">✦</span>{p}</li>)}</ul>
        </div>
      )}

      {lesson.studyTips.length > 0 && (
        <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--color-gold)]/30 bg-[var(--color-gold)]/10 p-5">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-gold)]"><Glyph name="sparkle" className="h-3.5 w-3.5" /> Exam &amp; study tips</p>
          <ul className="mt-3 space-y-2">{lesson.studyTips.map((p, i) => <li key={i} className="flex gap-2.5 text-sm text-white/90"><span className="mt-0.5">💡</span>{p}</li>)}</ul>
        </div>
      )}

      {lesson.homework && (
        <div className="mt-5 rounded-[var(--radius-lg)] border border-white/12 bg-white/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/50">Homework</p>
          <div className="mt-2 text-sm"><Markdown text={lesson.homework} tone="dark" /></div>
        </div>
      )}

      {(lesson.citations.length > 0 || lesson.examRefs.length > 0) && (
        <div className="mt-5 space-y-2 text-xs text-white/45">
          {lesson.examRefs.length > 0 && <p>Maps to: {lesson.examRefs.join(' · ')}</p>}
          {lesson.citations.length > 0 && <p>Sources: {lesson.citations.map((c, i) => <span key={i}>{i > 0 && ' · '}<a href={c.url} target="_blank" rel="noopener noreferrer" className="underline decoration-white/30 hover:text-white/80">{c.label}</a></span>)}</p>}
        </div>
      )}

      <div className="mt-9 flex items-center justify-center border-t border-white/10 pt-7">
        {reviewing ? (
          <button onClick={onNext} className="rounded-full bg-white/15 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/25">Next →</button>
        ) : (
          <button
            onClick={() => { if (gated) return; setBusy(true); onContinue(Math.round((Date.now() - startedAt.current) / 1000)); }}
            disabled={gated || busy}
            className="rounded-full bg-[var(--color-gold)] px-8 py-3 text-sm font-semibold text-[var(--color-ink)] transition-transform enabled:hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {gated ? `Keep reading… ${remaining}s` : busy ? 'Saving…' : 'Mark complete & continue →'}
          </button>
        )}
      </div>
    </article>
  );
}

type Checked = { correct: boolean; correctIndices: number[]; explanation: string | null };

function QuizStep({ quiz, preview, onFinish }: { quiz: QuizView; preview: boolean; onFinish: (passed: boolean) => void }) {
  const [qi, setQi] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [checked, setChecked] = useState<Checked | null>(null);
  const [showTip, setShowTip] = useState(false);
  const [busy, setBusy] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const answersRef = useRef<Record<string, number[]>>({});
  const [done, setDone] = useState<null | { scorePct: number; passed: boolean }>(null);

  const q = quiz.questions[qi];
  const multi = q?.type === 'MULTI';
  const last = qi === quiz.questions.length - 1;

  function toggle(oi: number) {
    if (checked) return;
    setSelected((cur) => (multi ? (cur.includes(oi) ? cur.filter((x) => x !== oi) : [...cur, oi]) : [oi]));
  }

  async function check() {
    if (!selected.length || checked) return;
    answersRef.current[q.id] = selected;
    setBusy(true);
    try {
      let res: Checked;
      if (q.correct !== undefined) {
        // Preview: answer key is present — grade locally.
        const correctIndices = [...q.correct].sort();
        const given = [...selected].sort();
        res = { correct: correctIndices.length === given.length && correctIndices.every((v, i) => v === given[i]), correctIndices, explanation: q.explanation ?? null };
      } else {
        const r = await fetch('/api/academy/quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'check', quizId: quiz.id, questionId: q.id, answer: selected }) }).then((x) => x.json());
        res = { correct: !!r.correct, correctIndices: r.correctIndices ?? [], explanation: r.explanation ?? null };
      }
      if (res.correct) setCorrectCount((c) => c + 1);
      setChecked(res);
    } catch { setChecked({ correct: false, correctIndices: [], explanation: null }); }
    finally { setBusy(false); }
  }

  async function next() {
    if (!last) { setQi((i) => i + 1); setSelected([]); setChecked(null); setShowTip(false); return; }
    // Finish: record the attempt (learn) or compute locally (preview).
    setBusy(true);
    const localPct = Math.round((correctCount / quiz.questions.length) * 100);
    let scorePct = localPct, passed = localPct >= quiz.passMark;
    if (!preview) {
      try {
        const r = await fetch('/api/academy/quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quizId: quiz.id, answers: answersRef.current }) }).then((x) => x.json());
        if (r.ok) { scorePct = r.scorePct; passed = r.passed; }
      } catch { /* fall back to local */ }
    }
    setBusy(false);
    setDone({ scorePct, passed });
  }

  function retry() { setQi(0); setSelected([]); setChecked(null); setShowTip(false); setCorrectCount(0); answersRef.current = {}; setDone(null); }

  if (done) {
    return (
      <div className="text-center">
        <div className={`mx-auto grid h-20 w-20 place-items-center rounded-full ${done.passed ? 'bg-[var(--color-gold)]/20' : 'bg-white/10'}`}>
          <span className="text-3xl">{done.passed ? '🏆' : '📘'}</span>
        </div>
        <h2 className="mt-5 font-[family-name:var(--font-display)] text-3xl">{done.passed ? 'Passed!' : 'Not quite yet'}</h2>
        <p className="mt-2 text-white/70">You scored <strong className="text-white">{done.scorePct}%</strong> — {quiz.passMark}% needed to pass.</p>
        <div className="mt-8 flex items-center justify-center gap-3">
          {!done.passed && <button onClick={retry} className="rounded-full bg-white/15 px-7 py-3 text-sm font-semibold text-white hover:bg-white/25">Try again</button>}
          <button onClick={() => onFinish(done.passed)} className="rounded-full bg-[var(--color-gold)] px-7 py-3 text-sm font-semibold text-[var(--color-ink)] hover:scale-[1.02]">Continue →</button>
        </div>
      </div>
    );
  }

  if (!q) return <p className="text-center text-white/60">This assessment has no questions yet.</p>;

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-white/45">
        <span className="uppercase tracking-[0.16em]">{quiz.title}</span>
        <span className="tabular-nums">Question {qi + 1} / {quiz.questions.length}</span>
      </div>
      <h2 className="mt-4 font-[family-name:var(--font-display)] text-2xl leading-snug">{q.prompt}{multi && <span className="ml-2 align-middle text-xs font-normal text-white/45">(select all that apply)</span>}</h2>
      {q.imageUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={q.imageUrl} alt="" className="mt-4 max-h-64 rounded-[var(--radius-md)]" />}

      <div className="mt-6 space-y-2.5">
        {q.options.map((opt, oi) => {
          const chosen = selected.includes(oi);
          const isC = checked?.correctIndices.includes(oi);
          const cls = checked
            ? isC ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/15' : chosen ? 'border-red-400/60 bg-red-400/10' : 'border-white/10 opacity-60'
            : chosen ? 'border-white bg-white/10' : 'border-white/15 hover:border-white/40';
          return (
            <button key={oi} onClick={() => toggle(oi)} disabled={!!checked} className={`flex w-full items-center gap-3 rounded-[var(--radius-md)] border px-4 py-3 text-left text-sm transition-colors ${cls}`}>
              <span className={`grid h-5 w-5 shrink-0 place-items-center ${multi ? 'rounded-[4px]' : 'rounded-full'} border text-[0.7rem] ${chosen ? 'border-white bg-white text-[var(--color-ink)]' : 'border-white/40'}`}>{chosen ? '✓' : ''}</span>
              <span className="flex-1">{opt}</span>
              {checked && isC && <span className="text-xs font-medium text-[var(--color-gold)]">✓</span>}
            </button>
          );
        })}
      </div>

      {q.tip && !checked && (
        <div className="mt-4">
          {showTip ? (
            <p className="rounded-[var(--radius-md)] border border-[var(--color-gold)]/25 bg-[var(--color-gold)]/8 px-4 py-2.5 text-sm text-white/85">💡 {q.tip}</p>
          ) : (
            <button onClick={() => setShowTip(true)} className="text-sm text-[var(--color-gold)] hover:underline">Need a hint?</button>
          )}
        </div>
      )}

      {checked && (
        <div className={`mt-5 rounded-[var(--radius-lg)] border p-4 ${checked.correct ? 'border-[var(--color-gold)]/40 bg-[var(--color-gold)]/10' : 'border-red-400/40 bg-red-400/10'}`}>
          <p className="font-semibold">{checked.correct ? '✓ Correct' : '✗ Not quite'}</p>
          {checked.explanation && <p className="mt-1 text-sm text-white/80">{checked.explanation}</p>}
        </div>
      )}

      <div className="mt-7 flex justify-center border-t border-white/10 pt-6">
        {checked ? (
          <button onClick={next} disabled={busy} className="rounded-full bg-[var(--color-gold)] px-8 py-3 text-sm font-semibold text-[var(--color-ink)] hover:scale-[1.02] disabled:opacity-60">{busy ? '…' : last ? 'See result →' : 'Continue →'}</button>
        ) : (
          <button onClick={check} disabled={!selected.length || busy} className="rounded-full bg-[var(--color-gold)] px-8 py-3 text-sm font-semibold text-[var(--color-ink)] enabled:hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Checking…' : 'Check'}</button>
        )}
      </div>
    </div>
  );
}

function DoneStep({ slug, preview, complete, onExit }: { slug?: string; preview: boolean; complete: boolean; onExit?: () => void }) {
  return (
    <div className="text-center">
      <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-[var(--color-gold)]/20"><Glyph name="cap" className="h-10 w-10 text-[var(--color-gold)]" /></div>
      <h2 className="mt-6 font-[family-name:var(--font-display)] text-3xl">{preview ? 'End of preview' : complete ? 'Course complete' : 'Great progress'}</h2>
      <p className="mx-auto mt-3 max-w-md text-white/70">
        {preview ? 'You’ve reached the end of the course in preview mode. Nothing was recorded.' : complete ? 'You’ve completed every lesson and passed every assessment. Your certificate is ready.' : 'You’ve reached the end of the available content. Keep going — finish any remaining assessments to unlock your certificate.'}
      </p>
      <div className="mt-8 flex items-center justify-center gap-3">
        {!preview && complete && slug && (
          <a href={`/academy/learn/${slug}/certificate`} className="rounded-full bg-[var(--color-gold)] px-7 py-3 text-sm font-semibold text-[var(--color-ink)] hover:scale-[1.02]">View certificate</a>
        )}
        <button onClick={onExit} className="rounded-full bg-white/15 px-7 py-3 text-sm font-semibold text-white hover:bg-white/25">{preview ? 'Close preview' : 'Back to course'}</button>
      </div>
    </div>
  );
}
