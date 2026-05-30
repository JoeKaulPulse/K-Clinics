'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Faq } from '@/lib/treatments';

export function FaqAccordion({ faqs }: { faqs: Faq[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
      {faqs.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={i}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-6 py-6 text-left"
              aria-expanded={isOpen}
            >
              <span className="font-[family-name:var(--font-display)] text-xl leading-snug">{f.q}</span>
              <span className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[var(--color-line)] transition-colors ${isOpen ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : ''}`}>
                <span className="absolute h-[1.5px] w-3.5 bg-current" />
                <span className={`absolute h-[1.5px] w-3.5 bg-current transition-transform duration-500 ${isOpen ? 'rotate-0' : 'rotate-90'}`} />
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <p className="max-w-2xl pb-6 leading-relaxed text-[var(--color-stone)]">{f.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
