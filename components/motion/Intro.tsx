'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { KMark, ClinicsWordmark } from '@/components/brand/marks';

// Total on-screen budget: HOLD_MS visible, then EXIT_S sliding away — kept
// well under a second so the curtain never sits between a visitor and the
// page for long (BLD-1359). Click, tap, Enter/Space or Escape skips it.
const HOLD_MS = 400;
const EXIT_S = 0.25;

/** Ad-click / campaign params, matching the set lib/attribution.ts already
 *  treats as paid traffic. Read from window.location rather than
 *  useSearchParams() so nothing ties the intro's lifetime to the router's
 *  URL state — see the effect below. */
function isPaidLanding(search: string): boolean {
  const p = new URLSearchParams(search);
  if (p.has('gclid') || p.has('fbclid') || p.has('ttclid')) return true;
  return Array.from(p.keys()).some((key) => key.toLowerCase().startsWith('utm_'));
}

/**
 * Brand intro curtain — on first load of the session, a refined ink panel
 * with the K mark wipes upward to reveal the page. Shows once per session,
 * and skips entirely for reduced-motion and for paid-traffic landings
 * (gclid/fbclid/ttclid/utm_*), where intent is already high and the curtain
 * would only hide the CTA. Click, tap, Enter/Space or Escape dismisses it
 * immediately for anyone who wants in sooner.
 */
export function Intro() {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Decided once per mount, so a re-run of the effect re-arms the dismiss timer
  // instead of hitting the sessionStorage guard and leaving the curtain up with
  // nothing left to take it down.
  const decisionRef = useRef<'show' | 'skip' | null>(null);
  const doneRef = useRef(false);

  const dismiss = useCallback(() => {
    doneRef.current = true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setShow(false);
    document.body.style.overflow = '';
  }, []);

  useEffect(() => {
    if (reduce) return;

    if (decisionRef.current === null) {
      if (sessionStorage.getItem('kc_intro_seen')) {
        decisionRef.current = 'skip';
      } else {
        sessionStorage.setItem('kc_intro_seen', '1');
        // Paid traffic (an ad click landing straight on /book, etc.) is already
        // high-intent — never block the CTA with the curtain.
        decisionRef.current = isPaidLanding(window.location.search) ? 'skip' : 'show';
      }
    }
    if (decisionRef.current !== 'show' || doneRef.current) return;

    setShow(true);
    document.body.style.overflow = 'hidden'; // lock scroll during the intro
    timerRef.current = setTimeout(dismiss, HOLD_MS);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      document.body.style.overflow = '';
    };
  }, [reduce, dismiss]);

  // Keyboard parity with click/tap. Escape works wherever focus happens to be;
  // the curtain itself is focusable, so Tab → Enter/Space skips it too.
  useEffect(() => {
    if (!show) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [show, dismiss]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="intro"
          className="fixed inset-0 z-[100] grid cursor-pointer place-items-center bg-[var(--color-ink)]"
          initial={{ y: 0 }}
          exit={{ y: '-100%' }}
          transition={{ duration: EXIT_S, ease: [0.76, 0, 0.24, 1] }}
          onClick={dismiss}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              dismiss();
            }
          }}
          role="button"
          tabIndex={0}
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
