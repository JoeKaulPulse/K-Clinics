'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { finderQuestions, scoreFinder } from '@/lib/treatment-finder';
import { getTreatment, formatPrice, suitableForGender } from '@/lib/treatments';

/** `gender` (when a signed-in client uses the finder) tailors which treatments
 *  are suggested — e.g. a man isn't shown women-specific treatments and vice
 *  versa. Anonymous visitors (gender undefined) see the full set. `prices` maps a
 *  treatment slug to its lowest live "from" price (pence), derived server-side
 *  from the admin catalogue — never hardcoded. */
export function TreatmentFinder({ gender, prices = {} }: { gender?: string | null; prices?: Record<string, number | null> } = {}) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const total = finderQuestions.length;
  const done = step >= total;
  const q = finderQuestions[step];

  const go = (delta: number) => { setDir(delta); setStep((s) => Math.max(0, Math.min(total, s + delta))); };

  const pick = (val: string) => {
    if (!q) return;
    if (q.multi) {
      const cur = (answers[q.id] as string[]) ?? [];
      setAnswers({ ...answers, [q.id]: cur.includes(val) ? cur.filter((v) => v !== val) : [...cur, val] });
    } else {
      setAnswers({ ...answers, [q.id]: val });
      setTimeout(() => go(1), 200);
    }
  };

  const isSel = (val: string) => {
    const a = answers[q?.id ?? ''];
    return Array.isArray(a) ? a.includes(val) : a === val;
  };

  const results = done
    ? scoreFinder(answers).map(getTreatment).filter((tr): tr is NonNullable<typeof tr> => Boolean(tr) && suitableForGender(tr!, gender)).slice(0, 3)
    : [];
  const progress = Math.round((Math.min(step, total) / total) * 100);

  return (
    <div className="mx-auto max-w-3xl">
      {/* Progress */}
      <div className="mb-8 flex items-center gap-4">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--color-sand)]">
          <motion.div className="h-full bg-[var(--color-gold)]" initial={false} animate={{ width: `${done ? 100 : progress}%` }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} />
        </div>
        <span className="text-xs tabular-nums text-[var(--color-stone)]">{done ? 'Done' : `${step + 1} / ${total}`}</span>
      </div>

      <AnimatePresence mode="wait" custom={dir}>
        {!done ? (
          <motion.div key={q.id} custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={trans}>
            <h2 className="font-[family-name:var(--font-display)] text-[clamp(1.6rem,1.2rem+1.6vw,2.5rem)] leading-tight">{q.prompt}</h2>
            {q.help && <p className="mt-2 text-[var(--color-stone)]">{q.help}</p>}
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {q.options.map((o) => (
                <button
                  key={o.value}
                  onClick={() => pick(o.value)}
                  aria-pressed={isSel(o.value)}
                  className={`rounded-[var(--radius-md)] border p-5 text-left text-lg transition-all ${isSel(o.value) ? 'border-[var(--color-gold)] bg-[var(--color-bone)] shadow-[var(--shadow-soft)]' : 'border-[var(--color-line)] hover:border-[var(--color-stone-soft)]'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className="mt-7 flex items-center justify-between">
              <button onClick={() => go(-1)} className={`text-sm font-medium text-[var(--color-stone)] ${step === 0 ? 'pointer-events-none opacity-0' : 'hover:text-[var(--color-ink)]'}`}>← Back</button>
              {q.multi && (
                <button onClick={() => go(1)} className="rounded-full bg-[var(--color-ink)] px-6 py-2.5 text-sm font-medium text-[var(--color-porcelain)]">Continue →</button>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div key="results" custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={trans}>
            <p className="eyebrow mb-3">Your personalised match</p>
            <h2 className="font-[family-name:var(--font-display)] text-[clamp(1.8rem,1.3rem+2vw,2.75rem)]">We’d suggest starting here.</h2>
            <p className="mt-3 max-w-xl text-[var(--color-stone)]">A guide based on your answers — your clinician will confirm the right plan at your complimentary consultation.</p>
            <div className="mt-8 grid gap-4">
              {results.map((t, i) => {
                if (!t) return null;
                const price = prices[t.slug] ?? null;
                return (
                  <Link key={t.slug} href={`/${t.slug}`} className="group flex items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]">
                    <div className="flex items-center gap-4">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-ink)] font-[family-name:var(--font-display)] text-sm text-[var(--color-gold-soft)]">{i + 1}</span>
                      <div>
                        <p className="font-[family-name:var(--font-display)] text-lg">{t.title}</p>
                        <p className="text-sm text-[var(--color-stone)]">{t.tagline}</p>
                      </div>
                    </div>
                    <span className="hidden shrink-0 text-sm text-[var(--color-gold)] sm:block">{price ? `from ${formatPrice(price)}` : 'Consult'}</span>
                  </Link>
                );
              })}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/consultation" className="rounded-full bg-[var(--color-gold)] px-7 py-3.5 font-medium text-white shadow-[var(--shadow-gold)] hover:bg-[var(--color-ink)]">Book a free consultation</Link>
              <button onClick={() => { setAnswers({}); setStep(0); setDir(-1); }} className="rounded-full border border-[var(--color-line)] px-6 py-3.5 font-medium hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]">Start over</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const slide = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 40 : -40 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -40 : 40 }),
};
const trans = { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const };
