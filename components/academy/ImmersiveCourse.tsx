'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { KMascot, KCelebration, KSpeech, type CelebrationVariant } from '@/components/academy/KMascot';
import { buildLessonFlow, coerceSteps, type FlowStep, type SayStep, type TeachStep, type AskStep, type Register } from '@/components/academy/lessonFlow';
import { Illustration, matchIllustration, type IlloKey, type IlloLevel } from '@/components/academy/Illustrations';
import { AmbientBackdrop } from '@/components/academy/AmbientBackdrop';
import { ExplainerPlayer } from '@/components/academy/ExplainerPlayer';
import { HomeworkPanel } from '@/components/academy/HomeworkPanel';
import { academyLevel } from '@/lib/academy-levels';
import { isMascotMuted, setMascotMuted } from '@/components/academy/mascotVoice';
import type { CourseLearning, LessonView, QuizView } from '@/lib/lms';

// Session-scoped illustration exposure: the more a learner sees a concept, the
// vaguer its illustration (and the less the hint is offered) — guiding early,
// fading later. Provided by ImmersiveCourse, read by the teach/ask cards.
const ArtCtx = createContext<{ levelFor: (k: IlloKey) => IlloLevel; seeArt: (k: IlloKey) => void }>({ levelFor: () => 'full', seeArt: () => {} });

const KNOWN_ART: IlloKey[] = ['skin-layers', 'hair-cycle', 'light-spectrum', 'fitzpatrick', 'collagen', 'safety', 'concept'];
function resolveArt(art: string | undefined, text: string): IlloKey | null {
  if (art && KNOWN_ART.includes(art as IlloKey)) return art as IlloKey;
  if (art?.startsWith('video:')) return null;
  return matchIllustration(text);
}

type AwardedBadge = { key: string; name: string; icon: string };
type Celebration = { variant: Exclude<CelebrationVariant, 'idle'>; title: string; subtitle?: string; badgeIcon?: string };
const badgeCelebrations = (badges: AwardedBadge[] = []): Celebration[] => badges.map((b) => ({ variant: 'badge', title: 'Badge unlocked', subtitle: b.name, badgeIcon: b.icon }));

function ytId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

type Step =
  | { kind: 'intro' }
  | { kind: 'lesson'; mi: number; li: number }
  | { kind: 'quiz'; mi: number }
  | { kind: 'done' };

export function ImmersiveCourse({ learning, slug, mode = 'learn', xp = 0, register = 'mid', onExit }: { learning: CourseLearning; slug?: string; mode?: 'learn' | 'preview'; xp?: number; register?: Register; onExit?: () => void }) {
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
  const [celebs, setCelebs] = useState<(Celebration & { id: number })[]>([]);
  const idRef = useRef(0);
  const enqueue = (...cs: Celebration[]) => { setCelebs((q) => [...q, ...cs.map((c) => ({ ...c, id: ++idRef.current }))]); };
  const completedCelebrated = useRef(false);
  const lessonsThisSession = useRef(0);

  const [artSeen, setArtSeen] = useState<Record<string, number>>({});
  const levelFor = (k: IlloKey): IlloLevel => { const n = artSeen[k] || 0; return n === 0 ? 'full' : n < 3 ? 'reduced' : 'minimal'; };
  const seeArt = (k: IlloKey) => { setArtSeen((s) => ({ ...s, [k]: (s[k] || 0) + 1 })); };

  // Live HUD: XP/level (base + what's earned this session) and time on task.
  const [sessionXp, setSessionXp] = useState(0);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => setSessionSeconds(Math.round((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  const lvl = academyLevel(xp + sessionXp);

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
    setSessionXp((x) => x + 10);
    lessonsThisSession.current += 1;
    const pacing = lessonsThisSession.current % 3 === 0 ? 'Great pace — a short break now helps it stick.' : undefined;
    const cs: Celebration[] = [{ variant: 'cheer', title: 'Lesson complete', subtitle: pacing }];
    if (mode === 'learn') {
      const r = await fetch('/api/academy/lesson', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonId: lesson.id, secondsSpent: seconds }) }).then((x) => x.json()).catch(() => null);
      cs.push(...badgeCelebrations(r?.newBadges));
    }
    enqueue(...cs);
    advance();
  }
  function finishQuiz(quizId: string, result: { passed: boolean; scorePct: number; newBadges: AwardedBadge[] }) {
    if (result.passed) { setQuizPassed((s) => new Set(s).add(quizId)); setSessionXp((x) => x + 25); }
    enqueue(...badgeCelebrations(result.newBadges));
    advance();
  }
  // One interspersed multiple-choice check per lesson, drawn from the module's
  // question bank (server-graded in learn mode; answer key present in preview).
  function formativeFor(st: Step): AskStep | null {
    if (st.kind !== 'lesson') return null;
    const m = learning.modules[st.mi];
    if (!m.quiz || m.quiz.questions.length === 0) return null;
    const q = m.quiz.questions[st.li % m.quiz.questions.length];
    return { kind: 'ask', prompt: q.prompt, qtype: q.type as AskStep['qtype'], options: q.options, tip: q.tip ?? undefined, quizId: m.quiz.id, questionId: q.id, ...(q.correct !== undefined ? { correct: q.correct } : {}) };
  }

  const moduleLabel = step.kind === 'lesson' || step.kind === 'quiz' ? learning.modules[step.mi]?.title : null;
  const allComplete = learning.modules.length > 0 && learning.modules.every((m) => m.lessons.every((l) => doneLessons.has(l.id)) && (!m.quiz || quizPassed.has(m.quiz.id)));

  // Celebrate finishing the whole course, once, when the final step is reached.
  useEffect(() => {
    if (step.kind === 'done' && allComplete && !completedCelebrated.current) {
      completedCelebrated.current = true;
      enqueue({ variant: 'complete', title: 'Course complete', subtitle: 'Every lesson and assessment done' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, allComplete]);

  return (
    <ArtCtx.Provider value={{ levelFor, seeArt }}>
    <div className="fixed inset-0 z-[200] flex flex-col bg-[var(--color-ink)] text-[var(--color-porcelain)]" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <AmbientBackdrop tone="dark" />
      {/* Top bar: exit · progress · counter */}
      <header className="relative z-10 flex items-center gap-4 border-b border-white/10 px-4 py-3 sm:px-6">
        <button onClick={onExit} aria-label="Exit course" className="grid h-9 w-9 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="m3 3 10 10M13 3 3 13" /></svg>
        </button>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/12">
          <div className="h-full rounded-full bg-[var(--color-gold)] transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
        <span className="shrink-0 text-xs tabular-nums text-white/70">{pct}%</span>
        <MuteToggle />
        {mode === 'preview' && <span className="shrink-0 rounded-full bg-[var(--color-gold)]/20 px-2.5 py-1 text-[0.65rem] font-medium uppercase tracking-wide text-[var(--color-gold)]">Preview</span>}
      </header>

      <div className="relative z-10 flex items-center justify-center gap-4 border-b border-white/5 px-4 py-1.5 text-[0.7rem] text-white/55 sm:gap-7">
        <span className="inline-flex items-center gap-1.5"><span className="grid h-4 w-4 place-items-center rounded-full bg-[var(--color-gold)] text-[0.6rem] font-bold text-[var(--color-ink)]">{lvl.level}</span>{lvl.title}</span>
        <span className="tabular-nums">{(xp + sessionXp).toLocaleString()} XP{sessionXp > 0 && <span className="text-[var(--color-gold)]"> +{sessionXp}</span>}</span>
        <span className="tabular-nums">⏱ {Math.floor(sessionSeconds / 60)}:{String(sessionSeconds % 60).padStart(2, '0')}</span>
      </div>

      {moduleLabel && (
        <div className="relative z-10 border-b border-white/5 px-4 py-2 text-center text-xs uppercase tracking-[0.16em] text-white/45 sm:px-6">{moduleLabel}</div>
      )}

      <div className="relative z-10 flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div key={idx} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.32, ease: 'easeOut' }} className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center px-5 py-6">
            {step.kind === 'intro' && <IntroStep learning={learning} onBegin={() => go(Math.min(1, ceiling))} canBegin={ceiling >= 1} />}
            {step.kind === 'lesson' && (
              <LessonStep
                key={learning.modules[step.mi].lessons[step.li].id}
                lesson={learning.modules[step.mi].lessons[step.li]}
                reviewing={idx < maxReached && isStepComplete(step)}
                preview={mode === 'preview'}
                formative={formativeFor(step)}
                register={register}
                onContinue={(secs) => finishLesson(learning.modules[step.mi].lessons[step.li], secs)}
                onNext={advance}
              />
            )}
            {step.kind === 'quiz' && learning.modules[step.mi].quiz && (
              <QuizStep
                key={learning.modules[step.mi].quiz!.id}
                quiz={learning.modules[step.mi].quiz!}
                preview={mode === 'preview'}
                onFinish={(result) => finishQuiz(learning.modules[step.mi].quiz!.id, result)}
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

      {/* Mascot celebrations */}
      <AnimatePresence>
        {celebs[0] && <KCelebration key={celebs[0].id} variant={celebs[0].variant} title={celebs[0].title} subtitle={celebs[0].subtitle} badgeIcon={celebs[0].badgeIcon} onDone={() => setCelebs((q) => q.slice(1))} />}
      </AnimatePresence>
    </div>
    </ArtCtx.Provider>
  );
}

function MuteToggle() {
  const [muted, setMuted] = useState(false);
  useEffect(() => setMuted(isMascotMuted()), []);
  return (
    <button onClick={() => { const m = !muted; setMascotMuted(m); setMuted(m); }} aria-label={muted ? 'Unmute the mascot' : 'Mute the mascot'} title={muted ? 'Unmute K' : 'Mute K'} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white">
      {muted ? (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M11 5 6 9H2v6h4l5 4V5Z" /><path d="m23 9-6 6M17 9l6 6" /></svg>
      ) : (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M11 5 6 9H2v6h4l5 4V5Z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" /></svg>
      )}
    </button>
  );
}

function IntroStep({ learning, onBegin, canBegin }: { learning: CourseLearning; onBegin: () => void; canBegin: boolean }) {
  return (
    <div className="text-center">
      <KMascot variant="idle" size={60} className="mx-auto mb-3" />
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

function LessonStep({ lesson, reviewing, preview, formative, register, onContinue, onNext }: { lesson: LessonView; reviewing: boolean; preview: boolean; formative?: AskStep | null; register: Register; onContinue: (seconds: number) => void; onNext: () => void }) {
  const flow = useMemo<FlowStep[]>(() => {
    const authored = !!coerceSteps(lesson.steps);
    const base = buildLessonFlow({ title: lesson.title, body: lesson.body, objectives: lesson.objectives, studyTips: lesson.studyTips, homework: lesson.homework, steps: lesson.steps }, register);
    // Auto-chunked lessons get one interspersed check, just before the closing line.
    const withAsk = !authored && formative && base.length > 1 ? [...base.slice(0, -1), formative as FlowStep, base[base.length - 1]] : base;
    let videoArt: string | null = null;
    if (lesson.videoUrl) { const yt = ytId(lesson.videoUrl); videoArt = yt ? `video:yt:${yt}` : `video:url:${encodeURIComponent(lesson.videoUrl)}`; }
    return videoArt ? [{ kind: 'teach', title: 'Watch first', text: '', art: videoArt }, ...withAsk] : withAsk;
  }, [lesson, formative, register]);

  const [mi, setMi] = useState(0);
  const [showExplainer, setShowExplainer] = useState(false);
  const startedAt = useRef(Date.now());
  const cur = flow[Math.min(mi, flow.length - 1)];
  const last = mi >= flow.length - 1;
  const explainerPoints = lesson.keyPoints.length >= 2 ? lesson.keyPoints : lesson.objectives;

  function advanceMicro() {
    if (last) { if (reviewing) onNext(); else onContinue(Math.round((Date.now() - startedAt.current) / 1000)); return; }
    setMi((i) => i + 1);
  }
  const pct = flow.length > 1 ? Math.round((mi / (flow.length - 1)) * 100) : 100;

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <span className="truncate text-xs uppercase tracking-[0.16em] text-white/40">{lesson.title}</span>
        {explainerPoints.length >= 2 && <button onClick={() => setShowExplainer(true)} className="ml-auto shrink-0 rounded-full border border-white/20 px-2.5 py-1 text-[0.65rem] font-medium text-white/70 transition-colors hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]">▶ Explainer</button>}
        <span className={`shrink-0 text-xs tabular-nums text-white/30 ${explainerPoints.length >= 2 ? '' : 'ml-auto'}`}>{Math.min(mi + 1, flow.length)} / {flow.length}</span>
      </div>
      {showExplainer && <ExplainerPlayer title={lesson.title} points={explainerPoints} onClose={() => setShowExplainer(false)} />}
      <div className="mb-8 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[var(--color-gold)]/70 transition-[width] duration-300" style={{ width: `${pct}%` }} /></div>

      <AnimatePresence mode="wait">
        <motion.div key={mi} initial={{ opacity: 0, x: 22 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: 0.26, ease: 'easeOut' }}>
          {cur.kind === 'say' && <SayMicro step={cur} onContinue={advanceMicro} instant={reviewing || preview} />}
          {cur.kind === 'teach' && <TeachMicro step={cur} onContinue={advanceMicro} gated={!reviewing && !preview} />}
          {cur.kind === 'ask' && <AskMicro step={cur} onContinue={advanceMicro} />}
        </motion.div>
      </AnimatePresence>

      {lesson.pdfUrls.length > 0 && (
        <div className="mt-6 rounded-[var(--radius-lg)] border border-white/10 bg-white/5 p-4">
          <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-white/40">Lesson resources</p>
          <ul className="space-y-2">
            {lesson.pdfUrls.map((url) => {
              const raw = url.split('/').pop() ?? 'Document';
              const name = (() => { try { return decodeURIComponent(raw); } catch { return raw; } })().replace(/^\d+-/, '');
              const viewOnly = lesson.pdfNoDownload?.includes(url) ?? false;
              return (
                <li key={url}>
                  <a href={url} target="_blank" rel="noreferrer" {...(viewOnly ? {} : { download: name })} className="flex items-center gap-2.5 text-sm text-white/80 transition-colors hover:text-[var(--color-gold)]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-[var(--color-gold)]/70"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></svg>
                    <span className="truncate">{name}</span>
                    <span className="ml-auto shrink-0 text-[0.65rem] text-white/30">{viewOnly ? 'View only' : 'Download'}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {lesson.requiresHomework && <HomeworkPanel lessonId={lesson.id} submission={lesson.submission} />}
    </div>
  );
}

function SayMicro({ step, onContinue, instant }: { step: SayStep; onContinue: () => void; instant: boolean }) {
  const [ready, setReady] = useState(instant);
  return (
    <div className="flex flex-col items-center py-4 text-center">
      <KSpeech text={step.text} mood={step.mood} onTyped={() => setReady(true)} />
      <button onClick={onContinue} disabled={!ready} className="mt-9 rounded-full bg-[var(--color-gold)] px-8 py-3 text-sm font-semibold text-[var(--color-ink)] transition-all enabled:hover:scale-[1.02] disabled:opacity-0">Continue →</button>
    </div>
  );
}

function TeachMicro({ step, onContinue, gated }: { step: TeachStep; onContinue: () => void; gated: boolean }) {
  const { levelFor, seeArt } = useContext(ArtCtx);
  const [waited, setWaited] = useState(!gated);
  useEffect(() => {
    if (!gated) { setWaited(true); return; }
    setWaited(false);
    const t = setTimeout(() => setWaited(true), 1600);
    return () => clearTimeout(t);
  }, [gated, step]);
  const v = step.art?.startsWith('video:') ? step.art.slice(6) : null;
  const ytv = v?.startsWith('yt:') ? v.slice(3) : null;
  const filev = v?.startsWith('url:') ? decodeURIComponent(v.slice(4)) : null;
  const art = v ? null : resolveArt(step.art, `${step.title ?? ''} ${step.text}`);
  const [lvl] = useState<IlloLevel>(() => (art ? levelFor(art) : 'full'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (art) seeArt(art); }, []);
  return (
    <div className="flex flex-col items-center text-center">
      {step.title && <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)]">{step.title}</p>}
      {ytv ? (
        <div className="aspect-video w-full max-w-md overflow-hidden rounded-[var(--radius-lg)] border border-white/12"><iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${ytv}`} title="Lesson video" loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div>
      ) : filev ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video controls playsInline className="aspect-video w-full max-w-md rounded-[var(--radius-lg)] border border-white/12" src={filev} />
      ) : (
        <>
          {art && <div className="mb-5 w-full max-w-[190px]"><Illustration name={art} level={lvl} /></div>}
          <p className="max-w-md whitespace-pre-line text-lg leading-relaxed text-white/90 sm:text-xl">{step.text}</p>
        </>
      )}
      <KMascot variant="idle" size={28} className="mt-7 opacity-70" />
      <button onClick={onContinue} disabled={!waited} className="mt-5 rounded-full bg-[var(--color-gold)] px-8 py-3 text-sm font-semibold text-[var(--color-ink)] transition-transform enabled:hover:scale-[1.02] disabled:opacity-50">Continue →</button>
    </div>
  );
}

function AskMicro({ step, onContinue }: { step: AskStep; onContinue: () => void }) {
  const { levelFor, seeArt } = useContext(ArtCtx);
  const multi = step.qtype === 'MULTI';
  const word = step.qtype === 'WORD'; // "select the right word" — fill the blank from tiles
  const [selected, setSelected] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [correctIdx, setCorrectIdx] = useState<number[]>(step.correct ?? []);
  const [explanation, setExplanation] = useState<string | null>(step.explanation ?? null);
  const art = resolveArt(step.art, step.prompt);
  const [lvl] = useState<IlloLevel>(() => (art ? levelFor(art) : 'full'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (art) seeArt(art); }, []);
  const hintAllowed = !art || lvl !== 'minimal'; // hints get less freely offered as a topic recurs
  const toggle = (oi: number) => { if (checked) return; setSelected((c) => (multi ? (c.includes(oi) ? c.filter((x) => x !== oi) : [...c, oi]) : [oi])); };

  async function check() {
    if (step.correct) {
      const a = [...step.correct].sort(), b = [...selected].sort();
      setCorrect(a.length === b.length && a.every((v, i) => v === b[i]));
      setChecked(true); return;
    }
    if (step.quizId && step.questionId) {
      setBusy(true);
      const r = await fetch('/api/academy/quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'check', quizId: step.quizId, questionId: step.questionId, answer: selected }) }).then((x) => x.json()).catch(() => ({}));
      setBusy(false);
      setCorrect(!!r.correct); setCorrectIdx(r.correctIndices ?? []); setExplanation(r.explanation ?? null);
      setChecked(true); return;
    }
    setCorrect(false); setChecked(true);
  }

  return (
    <div className="py-2">
      <p className="text-xs uppercase tracking-[0.16em] text-white/40">{word ? 'Select the right word' : 'Quick check'}</p>
      {word ? (
        <p className="mt-3 font-[family-name:var(--font-display)] text-2xl leading-relaxed">
          {step.prompt.split('___')[0]}
          <span className={`mx-1 inline-block min-w-[5ch] rounded-md border-b-2 px-2 text-center ${selected[0] != null ? 'border-[var(--color-gold)] text-[var(--color-gold)]' : 'border-white/40 text-white/30'}`}>{selected[0] != null ? step.options[selected[0]] : '  '}</span>
          {step.prompt.split('___')[1] ?? ''}
        </p>
      ) : (
        <h3 className="mt-2 font-[family-name:var(--font-display)] text-2xl leading-snug">{step.prompt}{multi && <span className="ml-2 align-middle text-xs font-normal text-white/45">(select all)</span>}</h3>
      )}
      {art && <div className="mt-4"><Illustration name={art} level={lvl} /></div>}
      {word ? (
        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          {step.options.map((opt, oi) => {
            const chosen = selected.includes(oi);
            const showC = checked && correctIdx.includes(oi);
            const cls = checked ? (showC ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/15 text-[var(--color-gold)]' : chosen ? 'border-red-400/60 bg-red-400/10' : 'border-white/10 opacity-50') : chosen ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/15' : 'border-white/25 hover:border-white/50';
            return <button key={oi} onClick={() => toggle(oi)} disabled={checked} className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${cls}`}>{opt}</button>;
          })}
        </div>
      ) : (
        <div className="mt-5 space-y-2.5">
          {step.options.map((opt, oi) => {
            const chosen = selected.includes(oi);
            const showC = checked && correctIdx.includes(oi);
            const cls = checked ? (showC ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/15' : chosen ? 'border-red-400/60 bg-red-400/10' : 'border-white/10 opacity-60') : chosen ? 'border-white bg-white/10' : 'border-white/15 hover:border-white/40';
            return (
              <button key={oi} onClick={() => toggle(oi)} disabled={checked} className={`flex w-full items-center gap-3 rounded-[var(--radius-md)] border px-4 py-3 text-left text-sm transition-colors ${cls}`}>
                <span className={`grid h-5 w-5 shrink-0 place-items-center ${multi ? 'rounded-[4px]' : 'rounded-full'} border text-[0.7rem] ${chosen ? 'border-white bg-white text-[var(--color-ink)]' : 'border-white/40'}`}>{chosen ? '✓' : ''}</span>
                <span className="flex-1">{opt}</span>
                {checked && showC && <span className="text-xs text-[var(--color-gold)]">✓</span>}
              </button>
            );
          })}
        </div>
      )}
      {step.tip && !checked && hintAllowed && (
        <div className="mt-3">{showTip ? <p className="rounded-[var(--radius-md)] border border-[var(--color-gold)]/25 bg-[var(--color-gold)]/8 px-4 py-2.5 text-sm text-white/85">💡 {step.tip}</p> : <button onClick={() => setShowTip(true)} className="text-sm text-[var(--color-gold)] hover:underline">Need a hint?</button>}</div>
      )}
      {checked && (
        <div className={`mt-5 rounded-[var(--radius-lg)] border p-4 ${correct ? 'border-[var(--color-gold)]/40 bg-[var(--color-gold)]/10' : 'border-red-400/40 bg-red-400/10'}`}>
          <p className="font-semibold">{correct ? '✓ Correct' : '✗ Not quite'}</p>
          {explanation && <p className="mt-1 text-sm text-white/80">{explanation}</p>}
        </div>
      )}
      <div className="mt-7 flex justify-center">
        {checked ? (
          <button onClick={onContinue} className="rounded-full bg-[var(--color-gold)] px-8 py-3 text-sm font-semibold text-[var(--color-ink)] hover:scale-[1.02]">Continue →</button>
        ) : (
          <button onClick={check} disabled={!selected.length || busy} className="rounded-full bg-[var(--color-gold)] px-8 py-3 text-sm font-semibold text-[var(--color-ink)] enabled:hover:scale-[1.02] disabled:opacity-50">{busy ? 'Checking…' : 'Check'}</button>
        )}
      </div>
    </div>
  );
}

type Checked = { correct: boolean; correctIndices: number[]; explanation: string | null };

function QuizStep({ quiz, preview, onFinish }: { quiz: QuizView; preview: boolean; onFinish: (result: { passed: boolean; scorePct: number; newBadges: AwardedBadge[] }) => void }) {
  const [qi, setQi] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [checked, setChecked] = useState<Checked | null>(null);
  const [showTip, setShowTip] = useState(false);
  const [busy, setBusy] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const answersRef = useRef<Record<string, number[]>>({});
  const [done, setDone] = useState<null | { scorePct: number; passed: boolean; newBadges: AwardedBadge[] }>(null);

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
    let newBadges: AwardedBadge[] = [];
    if (!preview) {
      try {
        const r = await fetch('/api/academy/quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quizId: quiz.id, answers: answersRef.current }) }).then((x) => x.json());
        if (r.ok) { scorePct = r.scorePct; passed = r.passed; newBadges = r.newBadges ?? []; }
      } catch { /* fall back to local */ }
    }
    setBusy(false);
    setDone({ scorePct, passed, newBadges });
  }

  function retry() { setQi(0); setSelected([]); setChecked(null); setShowTip(false); setCorrectCount(0); answersRef.current = {}; setDone(null); }

  if (done) {
    return (
      <div className="text-center">
        {done.passed ? (
          <KMascot variant={done.scorePct === 100 ? 'perfect' : 'pass'} size={78} className="mx-auto" />
        ) : (
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-white/10"><span className="text-3xl">📘</span></div>
        )}
        <h2 className="mt-5 font-[family-name:var(--font-display)] text-3xl">{done.passed ? (done.scorePct === 100 ? 'Flawless!' : 'Passed!') : 'Not quite yet'}</h2>
        <p className="mt-2 text-white/70">You scored <strong className="text-white">{done.scorePct}%</strong> — {quiz.passMark}% needed to pass.</p>
        <div className="mt-8 flex items-center justify-center gap-3">
          {!done.passed && <button onClick={retry} className="rounded-full bg-white/15 px-7 py-3 text-sm font-semibold text-white hover:bg-white/25">Try again</button>}
          <button onClick={() => onFinish({ passed: done.passed, scorePct: done.scorePct, newBadges: done.newBadges })} className="rounded-full bg-[var(--color-gold)] px-7 py-3 text-sm font-semibold text-[var(--color-ink)] hover:scale-[1.02]">Continue →</button>
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
      <KMascot variant={complete && !preview ? 'complete' : 'idle'} size={84} className="mx-auto" />
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
