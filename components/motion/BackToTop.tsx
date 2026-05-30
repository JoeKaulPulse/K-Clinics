'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

/** A discreet floating control that appears after scrolling and glides to top. */
export function BackToTop() {
  const [show, setShow] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 1400);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.button
          initial={{ opacity: 0, y: 16, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.9 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          onClick={() => window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })}
          aria-label="Back to top"
          className="group fixed bottom-6 right-6 z-40 grid h-12 w-12 place-items-center rounded-full border border-[var(--color-line)] bg-[color-mix(in_oklab,var(--color-porcelain)_85%,transparent)] text-[var(--color-ink)] shadow-[var(--shadow-soft)] backdrop-blur-xl transition-colors hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] lg:bottom-8 lg:right-8"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform duration-500 [transition-timing-function:var(--ease-spring)] group-hover:-translate-y-0.5" fill="none">
            <path d="M10 16V4M5 9l5-5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
