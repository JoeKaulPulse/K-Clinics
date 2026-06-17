'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import type { Question, Questionnaire } from '@/lib/questionnaires';
import { isVisible } from '@/lib/questionnaires';
import { portalTranslator, type Locale } from '@/lib/i18n-portal';

type Answers = Record<string, unknown>;

export function AssessmentRunner({ q, locale = 'en' }: { q: Questionnaire; locale?: Locale }) {
  const router = useRouter();
  const t = portalTranslator(locale);
  const [answers, setAnswers] = useState<Answers>({});
  const [i, setI] = useState(-1); // -1 = intro screen
  const [dir, setDir] = useState(1);
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  // Visible questions given current answers (conditional branches).
  const visible = useMemo(() => q.questions.filter((qq) => isVisible(qq, answers)), [q.questions, answers]);
  const total = visible.length;
  // `i === total` is the review/submit screen — `current` must be null there so
  // the submit screen renders (a Math.min clamp here previously re-showed the last
  // question, hiding the submit button and showing "total+1/total", e.g. "6/5").
  const current = i >= 0 && i < total ? visible[i] : null;
  const progress = i < 0 ? 0 : Math.min(100, Math.round(((i + 1) / total) * 100));

  const set = (id: string, v: unknown) => setAnswers((p) => ({ ...p, [id]: v }));

  const answeredOk = (qq: Question | null): boolean => {
    if (!qq) return true;
    if (!qq.required) return true;
    const v = answers[qq.id];
    if (qq.type === 'multi') return Array.isArray(v) && v.length > 0;
    return v !== undefined && v !== '' && v !== null;
  };

  function go(delta: number) {
    setDir(delta);
    setI((prev) => {
      const nextIdx = prev + delta;
      return Math.max(-1, Math.min(total, nextIdx));
    });
  }

  // Auto-advance for single-choice / boolean for a slick feel.
  function pickAndAdvance(id: string, v: unknown) {
    set(id, v);
    setTimeout(() => go(1), 180);
  }

  async function submit() {
    setStatus('saving');
    setError('');
    try {
      const res = await fetch('/api/account/assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: q.key, answers }),
      });
      const json = await res.json();
      if (json.ok) setStatus('done');
      else { setError(json.error || t('error.couldNotSave')); setStatus('error'); }
    } catch {
      setError(t('error.network'));
      setStatus('error');
    }
  }

  // ── Completion screen ──
  if (status === 'done') {
    return (
      <Centered>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-[var(--color-ink)] text-[var(--color-gold-soft)]">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <h2 className="font-[family-name:var(--font-display)] text-3xl">{t('assess.doneTitle')}</h2>
          <p className="mx-auto mt-3 max-w-sm text-[var(--color-stone)]">
            {t('assess.doneBody', { form: q.title.toLowerCase() })}
          </p>
          <Link href="/account" className="mt-7 inline-block rounded-full bg-[var(--color-gold)] px-6 py-3 font-medium text-white hover:bg-[var(--color-ink)]">
            {t('assess.backToPortal')}
          </Link>
        </motion.div>
      </Centered>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar: progress + exit */}
      <div className="sticky top-0 z-10 bg-[var(--color-porcelain)]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-4 px-6 py-4">
          <Link href="/account" aria-label="Save & exit" className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">✕</Link>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--color-sand)]">
            <motion.div className="h-full bg-[var(--color-gold)]" initial={false} animate={{ width: `${progress}%` }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} />
          </div>
          <span className="w-10 text-right text-xs tabular-nums text-[var(--color-stone)]">{i < 0 || i >= total ? '' : `${i + 1}/${total}`}</span>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-10">
        <AnimatePresence mode="wait" custom={dir}>
          {i < 0 ? (
            <motion.div key="intro" custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={trans}>
              <p className="eyebrow mb-3">{q.title} · {t('assess.aboutMin', { n: q.estMinutes })}</p>
              <h1 className="font-[family-name:var(--font-display)] text-[clamp(2rem,1.4rem+2.4vw,3.25rem)] leading-[1.08]">{q.title}</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-[var(--color-stone)]">{q.intro}</p>
              <div className="mt-8 flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bone)] px-4 py-3 text-sm text-[var(--color-stone)]">
                <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-[var(--color-gold)]" fill="none"><path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                {t('assess.encrypted')}
              </div>
              <button onClick={() => go(1)} className="mt-9 rounded-full bg-[var(--color-gold)] px-7 py-3.5 font-medium text-white shadow-[var(--shadow-gold)] hover:bg-[var(--color-ink)]">
                {t('assess.begin')}
              </button>
            </motion.div>
          ) : current ? (
            <motion.div key={current.id} custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={trans}>
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-[0.6rem] font-medium uppercase tracking-[0.14em] ${current.required ? 'bg-[var(--color-gold)]/15 text-[var(--color-ink)]' : 'bg-[var(--color-bone)] text-[var(--color-stone)]'}`}>{current.required ? t('assess.required') : t('assess.optional')}</span>
              <h2 className="mt-2 font-[family-name:var(--font-display)] text-[clamp(1.6rem,1.2rem+1.6vw,2.5rem)] leading-[1.12]">{current.prompt}</h2>
              {current.help && <p className="mt-3 text-[var(--color-stone)]">{current.help}</p>}
              <div className="mt-8">
                <Field q={current} value={answers[current.id]} set={set} pick={pickAndAdvance} />
              </div>
            </motion.div>
          ) : (
            // Review / submit screen
            <motion.div key="review" custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={trans}>
              <p className="eyebrow mb-3">{t('assess.almost')}</p>
              <h2 className="font-[family-name:var(--font-display)] text-[clamp(1.8rem,1.3rem+2vw,2.75rem)]">{t('assess.readySubmit')}</h2>
              <p className="mt-4 max-w-lg text-[var(--color-stone)]">
                {t('assess.submitIntro')}
              </p>
              {error && <p className="mt-5 rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-4 py-2.5 text-sm text-[var(--color-ink)]">{error}</p>}
              <button onClick={submit} disabled={status === 'saving'} className="mt-8 rounded-full bg-[var(--color-gold)] px-7 py-3.5 font-medium text-white shadow-[var(--shadow-gold)] hover:bg-[var(--color-ink)] disabled:opacity-60">
                {status === 'saving' ? t('assess.saving') : t('assess.submit')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 pb-10">
        <button onClick={() => go(-1)} className={`text-sm font-medium text-[var(--color-stone)] transition-opacity ${i < 0 ? 'pointer-events-none opacity-0' : 'hover:text-[var(--color-ink)]'}`}>{t('assess.back')}</button>
        {i >= 0 && i < total && (
          <button
            onClick={() => answeredOk(current) && go(1)}
            disabled={!answeredOk(current)}
            className="rounded-full bg-[var(--color-ink)] px-6 py-2.5 text-sm font-medium text-[var(--color-porcelain)] transition-opacity disabled:opacity-40"
          >
            {current?.required ? t('assess.continue') : t('assess.continueSkip')} →
          </button>
        )}
      </div>
    </div>
  );
}

const slide = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 48 : -48 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -48 : 48 }),
};
const trans = { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const };

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-screen place-items-center px-6">{children}</div>;
}

function Field({ q, value, set, pick }: { q: Question; value: unknown; set: (id: string, v: unknown) => void; pick: (id: string, v: unknown) => void }) {
  if (q.type === 'single' || q.type === 'boolean') {
    // BLD-405: guard against custom boolean questions saved before the options fix.
    const opts = q.options ?? (q.type === 'boolean' ? [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] : []);
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {opts.map((o) => {
          const on = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => pick(q.id, o.value)}
              className={`rounded-[var(--radius-md)] border p-5 text-left text-lg transition-all ${on ? 'border-[var(--color-gold)] bg-[var(--color-bone)] shadow-[var(--shadow-soft)]' : 'border-[var(--color-line)] hover:border-[var(--color-stone-soft)]'}`}
            >
              <span className="flex items-center justify-between">
                {o.label}
                <span className={`grid h-5 w-5 place-items-center rounded-full border ${on ? 'border-[var(--color-gold)] bg-[var(--color-gold)] text-white' : 'border-[var(--color-stone-soft)]'}`}>
                  {on && <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  if (q.type === 'multi') {
    const arr = (Array.isArray(value) ? value : []) as string[];
    const toggle = (v: string) => {
      if (v === 'none') return set(q.id, arr.includes('none') ? [] : ['none']);
      const next = arr.filter((x) => x !== 'none');
      set(q.id, next.includes(v) ? next.filter((x) => x !== v) : [...next, v]);
    };
    return (
      <div className="flex flex-wrap gap-2.5">
        {q.options!.map((o) => {
          const on = arr.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => toggle(o.value)}
              className={`rounded-full border px-5 py-2.5 transition-all ${on ? 'border-[var(--color-gold)] bg-[var(--color-gold)] text-white' : 'border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-stone-soft)]'}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    );
  }

  if (q.type === 'longtext') {
    return <textarea autoFocus rows={4} placeholder={q.placeholder} className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-4 py-3 text-lg outline-none focus:border-[var(--color-gold)]" value={(value as string) || ''} onChange={(e) => set(q.id, e.target.value)} />;
  }
  if (q.type === 'date') {
    return <input type="date" autoFocus className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-4 py-3 text-lg outline-none focus:border-[var(--color-gold)]" value={(value as string) || ''} onChange={(e) => set(q.id, e.target.value)} />;
  }
  // text
  return <input type="text" autoFocus placeholder={q.placeholder} className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-4 py-3 text-lg outline-none focus:border-[var(--color-gold)]" value={(value as string) || ''} onChange={(e) => set(q.id, e.target.value)} />;
}
