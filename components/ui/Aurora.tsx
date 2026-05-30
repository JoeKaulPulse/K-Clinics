'use client';

import { motion, useReducedMotion } from 'motion/react';

/** Soft, slow-drifting champagne/rose aurora for dark sections — adds living
 *  depth behind content. Purely decorative; sits behind via negative z. */
export function Aurora({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion();
  const blobs = [
    { c: 'var(--color-gold)', x: '15%', y: '20%', s: 520 },
    { c: 'var(--color-jade)', x: '78%', y: '30%', s: 560 },
    { c: 'var(--color-blush)', x: '55%', y: '85%', s: 460 },
  ];
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {blobs.map((b, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full blur-[90px]"
          style={{ left: b.x, top: b.y, width: b.s, height: b.s, background: b.c, opacity: 0.14 }}
          animate={reduce ? undefined : { x: [0, 40, -30, 0], y: [0, -30, 24, 0], scale: [1, 1.15, 0.92, 1] }}
          transition={{ duration: 22 + i * 5, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}
