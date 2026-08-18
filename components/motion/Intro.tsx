'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { KMark, ClinicsWordmark } from '@/components/brand/marks';

// Total on-screen budget: HOLD_MS visible, then EXIT_S sliding away — kept
// well under a second so the curtain never sits between a visitor and the
// page for long (BLD-1359). Click/tap anywhere skips straight to the exit.
const HOLD_MS = 400;
const EXIT_S = 0.25;

/**
 * Brand intro curtain — on first load of the session, a refined ink panel
 * with the K mark wipes upward to reveal the page. Shows once per session,
 * and skips entirely for reduced-motion and for paid-traffic landings
 * (gclid/fbclid/utm_*), where intent is already high and the curtain would
 * only hide the CTA. Dismisses instantly on click/tap for anyone who wants
 * in sooner.
 */
export function Intro() {
  const reduce = useReducedMotion();
  const searchParams = useSearchParams();
  const [show, setShow] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (reduce) return;
    if (sessionStorage.getItem('kc_intro_seen')) return;

    // Paid traffic (ad click landing straight on /book, etc.) is already
    // high-intent — never block the CTA with the curtain.
    const isPaidLanding =
      searchParams.has('gclid') ||
      searchParams.has('fbclid') ||
      Array.from(searchParams.keys()).some((key) => key.toLowerCase().startsWith('utm_'));
    if (isPaidLanding) {
      sessionStorage.setItem('kc_intro_seen', '1');
      return;
    }

    setShow(true);
    sessionStorage.setItem('kc_intro_seen', '1');
    // Lock scroll during the intro.
    document.body.style.overflow = 'hidden';
    timerRef.current = setTimeout(() => {
      setShow(false);
      document.body.style.overflow = '';
    }, HOLD_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      document.body.style.overflow = '';
    };
  }, [reduce, searchParams]);

  const skip = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShow(false);
    document.body.style.overflow = '';
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="intro"
          className="fixed inset-0 z-[100] grid cursor-pointer place-items-center bg-[var(--color-ink)]"
          initial={{ y: 0 }}
          exit={{ y: '-100%' }}
          transition={{ duration: EXIT_S, ease: [0.76, 0, 0.24, 1] }}
          onClick={skip}
          role="button"
          aria-label="Skip intro"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center text-[var(--color-porcelain)]"
          >
            <span className="h-20 w-12">
              <KMark />
            </span>
            {/* CLINICS wordmark SVG (not text), revealed just after the K. */}
            <motion.span
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16, duration: 0.14 }}
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
