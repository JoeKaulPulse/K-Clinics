'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { reviews } from '@/lib/reviews';
import { site } from '@/lib/site';

export function Testimonials() {
  const [i, setI] = useState(0);
  const r = reviews[i];
  const go = (dir: number) => setI((p) => (p + dir + reviews.length) % reviews.length);

  return (
    <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
      <div>
        <p className="eyebrow mb-4">Loved by London</p>
        <h2 className="text-title text-[var(--color-porcelain)]">
          The mark of our work is how quietly it speaks.
        </h2>
        <div className="mt-8 flex items-center gap-4">
          <div className="flex text-[var(--color-gold-soft)]" aria-hidden>
            {Array.from({ length: 5 }).map((_, s) => (
              <svg key={s} viewBox="0 0 20 20" className="h-5 w-5 fill-current">
                <path d="M10 1l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9 4.8 17.2l1-5.8L1.5 7.3l5.9-.9z" />
              </svg>
            ))}
          </div>
          <p className="text-sm text-[color-mix(in_oklab,var(--color-porcelain)_70%,transparent)]">
            {site.ratingValue}/5 from {site.reviewCount}+ reviews
          </p>
        </div>
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
                {r.quote}
              </p>
              <footer className="mt-6 text-sm text-[color-mix(in_oklab,var(--color-porcelain)_72%,transparent)]">
                <span className="font-medium text-[var(--color-gold-soft)]">{r.name}</span> — {r.treatment}
                {r.location ? `, ${r.location}` : ''}
              </footer>
            </motion.blockquote>
          </AnimatePresence>
        </div>

        <div className="mt-8 flex gap-3">
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
      </div>
    </div>
  );
}
