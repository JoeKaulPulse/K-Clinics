'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useReducedMotionSafe } from '@/components/motion/use-reduced-motion-safe';
import { Stars } from '@/components/ui/Stars';

const AUTOPLAY_MS = 6000;

export type TestimonialCard = { author: string; body: string; treatment?: string; source?: 'google' | 'internal' };

export function Testimonials({ reviews, rating }: { reviews: TestimonialCard[]; rating?: { average: number; count: number } | null }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotionSafe();
  const go = (dir: number) => setI((p) => (p + dir + reviews.length) % reviews.length);

  // Auto-advance, pausing on hover / reduced-motion.
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (reduce || paused || reviews.length < 2) return;
    timer.current = setInterval(() => setI((p) => (p + 1) % reviews.length), AUTOPLAY_MS);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [reduce, paused, reviews.length]);

  if (reviews.length === 0) return null;
  const r = reviews[i];

  return (
    <div
      className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div>
        <p className="eyebrow mb-4">In our clients’ words</p>
        <h2 className="text-title text-[var(--color-porcelain)]">
          The mark of our work is how quietly it speaks.
        </h2>
        {rating && rating.count > 0 && (
          <div className="mt-8 flex items-center gap-4">
            <Stars rating={rating.average} size="h-5 w-5" colorClass="text-[var(--color-gold-soft)]" />
            <p className="text-sm text-[color-mix(in_oklab,var(--color-porcelain)_70%,transparent)]">
              {rating.average.toFixed(1)}/5 from {rating.count} verified review{rating.count === 1 ? '' : 's'}
            </p>
          </div>
        )}
      </div>

      <div className="relative">
        <span className="font-[family-name:var(--font-display)] text-[6rem] leading-none text-[var(--color-gold)]/40">“</span>
        <div className="relative min-h-[220px]">
          <AnimatePresence mode="wait">
            <motion.blockquote
              key={i}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0"
            >
              <p className="font-[family-name:var(--font-display)] text-2xl leading-snug text-[var(--color-porcelain)] md:text-[1.75rem]">
                {r.body}
              </p>
              <footer className="mt-6 text-sm text-[color-mix(in_oklab,var(--color-porcelain)_72%,transparent)]">
                <span className="font-medium text-[var(--color-gold-soft)]">{r.author}</span>
                {r.treatment ? ` — ${r.treatment}` : ''}
                {r.source === 'google' ? ' · via Google' : ''}
              </footer>
            </motion.blockquote>
          </AnimatePresence>
        </div>

        {reviews.length > 1 && (
          <div className="mt-8 flex items-center gap-5">
            <div className="flex gap-3">
              <button
                onClick={() => go(-1)}
                aria-label="Previous testimonial"
                className="grid h-11 w-11 place-items-center rounded-full border border-white/20 text-[var(--color-porcelain)] transition-colors hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]"
              >
                ←
              </button>
              <button
                onClick={() => go(1)}
                aria-label="Next testimonial"
                className="grid h-11 w-11 place-items-center rounded-full border border-white/20 text-[var(--color-porcelain)] transition-colors hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]"
              >
                →
              </button>
            </div>
            {/* Progress dots */}
            <div className="flex items-center gap-2">
              {reviews.map((_, d) => (
                <button
                  key={d}
                  onClick={() => setI(d)}
                  aria-label={`Testimonial ${d + 1}`}
                  className="group relative h-2 overflow-hidden rounded-full bg-white/20 transition-all"
                  style={{ width: d === i ? 28 : 8 }}
                >
                  {d === i && !reduce && !paused && (
                    <motion.span
                      key={`fill-${i}`}
                      className="absolute inset-0 origin-left bg-[var(--color-gold-soft)]"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: AUTOPLAY_MS / 1000, ease: 'linear' }}
                    />
                  )}
                  {d === i && (reduce || paused) && <span className="absolute inset-0 bg-[var(--color-gold-soft)]" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
