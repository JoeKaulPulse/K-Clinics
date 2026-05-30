'use client';

import { motion, useReducedMotion } from 'motion/react';

/** Generative gradient "art" used in place of stock imagery.
 *  Soft drifting orbs + film grain over a two-stop gradient — always text-free. */
export function GenerativeArt({
  from,
  to,
  className = '',
  seed = 0,
}: {
  from: string;
  to: string;
  className?: string;
  seed?: number;
}) {
  const reduce = useReducedMotion();
  const orbs = [
    { x: '12%', y: '20%', s: 240, d: 0, c: to },
    { x: '70%', y: '18%', s: 320, d: 1.5, c: from },
    { x: '58%', y: '68%', s: 280, d: 0.8, c: to },
    { x: '24%', y: '76%', s: 200, d: 2.2, c: from },
  ];

  return (
    <div
      className={`grain relative overflow-hidden ${className}`}
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
      aria-hidden
    >
      {orbs.map((o, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full blur-3xl"
          style={{
            left: o.x,
            top: o.y,
            width: o.s,
            height: o.s,
            background: o.c,
            opacity: 0.55,
            mixBlendMode: 'soft-light',
          }}
          animate={
            reduce
              ? undefined
              : { x: [0, 24, -16, 0], y: [0, -20, 14, 0], scale: [1, 1.12, 0.96, 1] }
          }
          transition={{ duration: 16 + i * 3 + seed, repeat: Infinity, ease: 'easeInOut', delay: o.d }}
        />
      ))}
      {/* Sheen sweep */}
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,rgba(255,255,255,0.28),transparent_55%)]" />
      <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(43,29,36,0.32),transparent_45%)]" />
    </div>
  );
}
