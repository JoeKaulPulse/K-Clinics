'use client';

import { motion, type Variants } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useReducedMotionSafe } from '@/components/motion/use-reduced-motion-safe';

type Props = {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  as?: 'div' | 'section' | 'li' | 'span';
  once?: boolean;
};

// BLD-1171: whileInView starts children at opacity 0 and relies on the
// intersection observer firing — on some load paths it never does (confirmed
// live: in-viewport sections stayed invisible with no scroll), and the old
// wrapper ignored prefers-reduced-motion entirely.
//
// BLD-997: that first fallback was a ONE-SHOT check 1500ms after mount, and it
// only rescued elements already INSIDE the viewport. Anything below the fold got
// no backstop at all and stayed entirely at the mercy of the observer this hook
// exists because we don't trust — so a section a little under the fold could sit
// at opacity 0 for the whole visit. The Academy banner sits directly beneath a
// hero whose padding alone is ~340px, which put it squarely in that gap.
//
// Two independent mechanisms now, because they fail differently and neither can
// ever HIDE anything — the worst case of either misfiring is content revealed
// early:
//   1. our own IntersectionObserver, separate from framer-motion's, which fires
//      whenever the element scrolls into view for the life of the page;
//   2. the original in-viewport timer, kept because it is the only rescue left
//      if IntersectionObserver itself is what's misbehaving.
function useViewportFallback() {
  const ref = useRef<HTMLElement | null>(null);
  const [forceShow, setForceShow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    // No IntersectionObserver at all: show the content rather than risk hiding it.
    if (typeof IntersectionObserver === 'undefined') { setForceShow(true); return; }

    let io: IntersectionObserver | null = null;
    if (el) {
      io = new IntersectionObserver(
        (entries) => { if (entries.some((e) => e.isIntersecting)) { setForceShow(true); io?.disconnect(); } },
        { rootMargin: '0px 0px -5% 0px' },
      );
      io.observe(el);
    }

    const t = setTimeout(() => {
      const node = ref.current;
      if (!node) return;
      const r = node.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) setForceShow(true);
    }, 1500);

    return () => { io?.disconnect(); clearTimeout(t); };
  }, []);
  return { ref, forceShow };
}

/** Premium scroll-reveal: a soft rise + fade, honouring reduced-motion. */
export function Reveal({ children, className, delay = 0, y = 28, as = 'div', once = true }: Props) {
  const MotionTag = motion[as];
  const reduce = useReducedMotionSafe();
  const { ref, forceShow } = useViewportFallback();

  const variants: Variants = {
    hidden: { opacity: 0, y },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] },
    },
  };

  if (reduce) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <MotionTag
      ref={ref as never}
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="show"
      animate={forceShow ? 'show' : undefined}
      viewport={{ once, margin: '-12% 0px -12% 0px' }}
    >
      {children}
    </MotionTag>
  );
}

/** Staggered container for revealing children in sequence. */
export function Stagger({
  children,
  className,
  delay = 0,
  gap = 0.04,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  gap?: number;
}) {
  const reduce = useReducedMotionSafe();
  const { ref, forceShow } = useViewportFallback();

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      ref={ref as never}
      className={className}
      initial="hidden"
      whileInView="show"
      animate={forceShow ? 'show' : undefined}
      viewport={{ once: true, margin: '-10% 0px -10% 0px' }}
      variants={{ show: { transition: { staggerChildren: gap, delayChildren: delay } } }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  y = 24,
}: {
  children: ReactNode;
  className?: string;
  y?: number;
}) {
  const reduce = useReducedMotionSafe();
  // When the parent Stagger renders statically (reduced motion), this must not
  // apply its own hidden state — a bare motion.div with a "hidden" variant and
  // no parent propagation would leave children invisible.
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y },
        show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } },
      }}
    >
      {children}
    </motion.div>
  );
}
