'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { KMark, ClinicsWordmark } from '@/components/brand/marks';

/**
 * Brand intro curtain — on first load of the session, a refined ink panel with
 * the self-drawing K wipes upward to reveal the page. Shows once per session,
 * skips entirely for reduced-motion. Keeps it brief (~1.6s) so it never annoys.
 */
export function Intro() {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (reduce) return;
    if (sessionStorage.getItem('kc_intro_seen')) return;
    setShow(true);
    sessionStorage.setItem('kc_intro_seen', '1');
    // Lock scroll during the intro.
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => {
      setShow(false);
      document.body.style.overflow = '';
    }, 1750);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = '';
    };
  }, [reduce]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="intro"
          className="fixed inset-0 z-[100] grid place-items-center bg-[var(--color-ink)]"
          initial={{ y: 0 }}
          exit={{ y: '-100%' }}
          transition={{ duration: 0.9, ease: [0.76, 0, 0.24, 1] }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center text-[var(--color-porcelain)]"
          >
            <span className="h-20 w-12">
              <KMark animated />
            </span>
            {/* CLINICS wordmark SVG (not text), revealed as the K finishes drawing. */}
            <motion.span
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.75, duration: 0.6 }}
              className="mt-5 block h-[0.85rem] w-[9rem] text-[var(--color-gold-soft)]"
            >
              <ClinicsWordmark />
            </motion.span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
