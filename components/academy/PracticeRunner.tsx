'use client';

import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { KMascot, KCelebration } from '@/components/academy/KMascot';

type Course = { id: string; title: string; questionCount: number };
type AwardedBadge = { key: string; name: string; icon: string };
type Q = { id: string; prompt: string; type: string; options: string[]; tip: string | null };
type Checked = { correct: boolean; correctIndices: number[]; explanation: string | null };

async function api(body: object) {
  return fetch('/api/academy/practice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => ({ ok: false }));
}

/** Test-anytime practice: pick a course, get a randomised set from the exam bank,
 *  answer one at a time with hints + immediate feedback, see your score. */
export function PracticeRunner({ courses }: { courses: Course[] }) {
  const [phase, setPhase] = useState<'pick' | 'run' | 'done'>('pick');
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '');
  const [count, setCount] = useState(10);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [qi, setQi] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [checked, setChecked] = useState<Checked | null>(null);
  const [showTip, setShowTip] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [scorePct, setScorePct] = useState(0);
  const [badgeQueue, setBadgeQueue] = useState<AwardedBadge[]>([]);

  if (courses.length === 0) {
    return <p className="text-sm text-[var(--color-stone)]">No practice questions are available for your courses yet. Your tutor is adding them — check back soon.</p>;
  }

  async function start() {
    setBusy(true); setErr('');
    const r = await api({ action: 'start', courseId, count });
    setBusy(false);
    if (!r.ok) { setErr(r.error || 'Could not start practice.'); return; }
    setQuestions(r.questions); setQi(0); setSelected([]); setChecked(null); setShowTip(false); setCorrectCount(0); setPhase('run');
  }

  const q = questions[qi];
  const multi = q?.type === 'MULTI';
  const last = qi === questions.length - 1;
  const toggle = (oi: number) => { if (checked) return; setSelected((c) => (multi ? (c.includes(oi) ? c.filter((x) => x !== oi) : [...c, oi]) : [oi])); };

  async function check() {
    if (!selected.length || checked) return;
    setBusy(true);
    const r = await api({ action: 'check', questionId: q.id, answer: selected });
    setBusy(false);
    const res: Checked = { correct: !!r.correct, correctIndices: r.correctIndices ?? [], explanation: r.explanation ?? null };
    if (res.correct) setCorrectCount((c) => c + 1);
    setChecked(res);
  }

  async function next() {
    if (!last) { setQi((i) => i + 1); setSelected([]); setChecked(null); setShowTip(false); return; }
    setBusy(true);
    const r = await api({ action: 'submit', courseId, total: questions.length, correct: correctCount });
    setBusy(false);
    setScorePct(typeof r.scorePct === 'number' ? r.scorePct : Math.round((correctCount / questions.length) * 100));
    setBadgeQueue(Array.isArray(r.newBadges) ? r.newBadges : []);
    setPhase('done');
  }

  if (phase === 'pick') {
    return (
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
        <p className="font-[family-name:var(--font-display)] text-xl">Test your knowledge</p>
        <p className="mt-1 text-sm text-[var(--color-stone)]">A fresh set of exam-style questions, drawn at random. Practise as often as you like.</p>
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">Course</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {courses.map((c) => (
              <button key={c.id} onClick={() => setCourseId(c.id)} className={`rounded-full border px-4 py-2 text-sm transition-colors ${courseId === c.id ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'border-[var(--color-line)] hover:border-[var(--color-gold)]'}`}>
                {c.title} <span className="opacity-60">· {c.questionCount}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">How many questions</p>
          <div className="mt-2 flex gap-2">
            {[10, 20, 30].map((n) => (
              <button key={n} onClick={() => setCount(n)} className={`rounded-full border px-4 py-2 text-sm transition-colors ${count === n ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'border-[var(--color-line)] hover:border-[var(--color-gold)]'}`}>{n}</button>
            ))}
          </div>
        </div>
        {err && <p role="alert" aria-live="assertive" className="mt-4 text-sm text-[var(--color-blush-deep)]">{err}</p>}
        <button onClick={start} disabled={busy || !courseId} className="mt-6 rounded-full bg-[var(--color-gold-deep)] px-7 py-3 text-sm font-semibold text-white hover:bg-[var(--color-ink)] disabled:opacity-60">{busy ? 'Loading…' : 'Start practice →'}</button>
      </div>
    );
  }

  if (phase === 'done') {
    const passed = scorePct >= 70;
    return (
      <>
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-8 text-center">
          {passed ? <KMascot variant={scorePct === 100 ? 'perfect' : 'pass'} size={68} className="mx-auto" /> : <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[var(--color-bone)]"><span className="text-3xl">📈</span></div>}
          <p className="mt-4 font-[family-name:var(--font-display)] text-3xl">{scorePct}%</p>
          <p className="mt-1 text-sm text-[var(--color-stone)]">You got {correctCount} of {questions.length} right.</p>
          <div className="mt-6 flex justify-center gap-3">
            <button onClick={() => setPhase('pick')} className="rounded-full border border-[var(--color-line)] px-6 py-2.5 text-sm font-medium hover:border-[var(--color-gold)]">Choose another set</button>
            <button onClick={start} className="rounded-full bg-[var(--color-gold-deep)] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-ink)]">Practise again</button>
          </div>
        </div>
        <AnimatePresence>
          {badgeQueue[0] && <KCelebration key={badgeQueue[0].key} variant="badge" title="Badge unlocked" subtitle={badgeQueue[0].name} badgeIcon={badgeQueue[0].icon} onDone={() => setBadgeQueue((q) => q.slice(1))} />}
        </AnimatePresence>
      </>
    );
  }

  if (!q) return null;
  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
      <div className="flex items-center justify-between text-xs text-[var(--color-stone)]">
        <span className="uppercase tracking-wide">Practice</span>
        <span className="tabular-nums">{qi + 1} / {questions.length} · {correctCount} correct</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-line)]"><div className="h-full rounded-full bg-[var(--color-gold)] transition-[width] duration-300" style={{ width: `${(qi / questions.length) * 100}%` }} /></div>

      <h3 className="mt-5 font-[family-name:var(--font-display)] text-xl leading-snug">{q.prompt}{multi && <span className="ml-2 align-middle text-xs font-normal text-[var(--color-stone)]">(select all that apply)</span>}</h3>

      <div className="mt-4 space-y-2.5">
        {q.options.map((opt, oi) => {
          const chosen = selected.includes(oi);
          const isC = checked?.correctIndices.includes(oi);
          const cls = checked
            ? isC ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/10' : chosen ? 'border-[var(--color-blush)] bg-[var(--color-blush)]/10' : 'border-[var(--color-line)] opacity-70'
            : chosen ? 'border-[var(--color-ink)] bg-white' : 'border-[var(--color-line)] hover:border-[var(--color-stone-soft)]';
          return (
            <button key={oi} onClick={() => toggle(oi)} disabled={!!checked} className={`flex w-full items-center gap-3 rounded-[var(--radius-md)] border px-4 py-3 text-left text-sm transition-colors ${cls}`}>
              <span className={`grid h-5 w-5 shrink-0 place-items-center ${multi ? 'rounded-[4px]' : 'rounded-full'} border text-[0.7rem] ${chosen ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-white' : 'border-[var(--color-stone-soft)]'}`}>{chosen ? '✓' : ''}</span>
              <span className="flex-1">{opt}</span>
              {checked && isC && <span className="text-xs font-medium text-[var(--color-gold-deep)]">✓</span>}
            </button>
          );
        })}
      </div>

      {q.tip && !checked && (
        <div className="mt-3">
          {showTip ? <p className="rounded-[var(--radius-md)] border border-[var(--color-gold)]/25 bg-[var(--color-gold)]/8 px-4 py-2.5 text-sm text-[var(--color-ink-soft)]">💡 {q.tip}</p> : <button onClick={() => setShowTip(true)} className="text-sm font-medium text-[var(--color-gold-deep)] hover:underline">Need a hint?</button>}
        </div>
      )}

      {checked && (
        <div className={`mt-4 rounded-[var(--radius-md)] border p-4 ${checked.correct ? 'border-[var(--color-gold)]/40 bg-[var(--color-gold)]/8' : 'border-[var(--color-blush)]/40 bg-[var(--color-blush)]/8'}`}>
          <p className="text-sm font-semibold">{checked.correct ? '✓ Correct' : '✗ Not quite'}</p>
          {checked.explanation && <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{checked.explanation}</p>}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        {checked ? (
          <button onClick={next} disabled={busy} className="rounded-full bg-[var(--color-gold-deep)] px-7 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-ink)] disabled:opacity-60">{busy ? '…' : last ? 'See score →' : 'Next →'}</button>
        ) : (
          <button onClick={check} disabled={!selected.length || busy} className="rounded-full bg-[var(--color-ink)] px-7 py-2.5 text-sm font-semibold text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Checking…' : 'Check'}</button>
        )}
      </div>
    </div>
  );
}
