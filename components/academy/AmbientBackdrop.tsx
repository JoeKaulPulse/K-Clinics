'use client';

import { motion } from 'motion/react';

// Soft, slow-drifting orbs + floating sparkles in the brand palette. Purely
// decorative ambience so the learning viewport never feels empty. Sits behind
// content (paint order), pointer-events-none, and stays gentle — never busy.

const ORBS = [
  { c: 'var(--color-gold)', size: 360, x: '-10%', y: '6%', dur: 27, dx: 46, dy: -30 },
  { c: 'var(--color-blush)', size: 300, x: '68%', y: '4%', dur: 31, dx: -34, dy: 44 },
  { c: 'var(--color-stone)', size: 320, x: '58%', y: '62%', dur: 35, dx: 34, dy: -22 },
  { c: 'var(--color-gold)', size: 240, x: '6%', y: '66%', dur: 29, dx: -28, dy: -38 },
];

export function AmbientBackdrop({ tone = 'dark', className = '' }: { tone?: 'dark' | 'light'; className?: string }) {
  const orbOpacity = tone === 'dark' ? 0.16 : 0.09;
  const sparkOpacity = tone === 'dark' ? 0.5 : 0.3;
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {ORBS.map((o, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full blur-3xl"
          style={{ width: o.size, height: o.size, left: o.x, top: o.y, background: `radial-gradient(circle, ${o.c} 0%, transparent 70%)`, opacity: orbOpacity }}
          animate={{ x: [0, o.dx, 0], y: [0, o.dy, 0], scale: [1, 1.08, 1] }}
          transition={{ duration: o.dur, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      {Array.from({ length: 12 }).map((_, i) => {
        const left = (i * 37 + 7) % 100;
        const top = (i * 53 + 11) % 100;
        return (
          <motion.span
            key={`s${i}`}
            className="absolute rounded-full bg-[var(--color-gold)]"
            style={{ left: `${left}%`, top: `${top}%`, width: i % 4 === 0 ? 5 : 3, height: i % 4 === 0 ? 5 : 3 }}
            animate={{ y: [0, -16, 0], opacity: [0.08, sparkOpacity, 0.08] }}
            transition={{ duration: 4 + (i % 5), repeat: Infinity, delay: i * 0.45, ease: 'easeInOut' }}
          />
        );
      })}
    </div>
  );
}
