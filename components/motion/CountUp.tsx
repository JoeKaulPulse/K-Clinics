'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView } from 'motion/react';
import { useReducedMotionSafe } from '@/components/motion/use-reduced-motion-safe';

/** Counts a numeric value up when scrolled into view. Preserves any
 *  non-numeric prefix/suffix (e.g. "15+", "4.9", "100%"). */
export function CountUp({ value, className = '' }: { value: string; className?: string }) {
  const reduce = useReducedMotionSafe();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-15%' });
  const [display, setDisplay] = useState(reduce ? value : initial(value));

  useEffect(() => {
    if (!inView || reduce) {
      setDisplay(value);
      return;
    }
    const match = value.match(/([\d.]+)/);
    if (!match) {
      setDisplay(value);
      return;
    }
    const target = parseFloat(match[1]);
    const decimals = (match[1].split('.')[1] || '').length;
    const prefix = value.slice(0, match.index);
    const suffix = value.slice((match.index ?? 0) + match[1].length);
    const duration = 1400;
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      const current = (target * eased).toFixed(decimals);
      setDisplay(`${prefix}${current}${suffix}`);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, reduce]);

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
}

function initial(value: string) {
  return value.replace(/[\d.]+/, (n) => (n.includes('.') ? '0.0' : '0'));
}
