'use client';

import { motion, useReducedMotion } from 'motion/react';

/** Generative gradient "art" used in place of stock imagery.
 *  Layered mesh + drifting orbs + a slow metallic sheen + grain — always text-free.
 *  Designed to read as rich, hand-crafted depth rather than a flat gradient. */
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
    { x: '10%', y: '16%', s: 300, d: 0, c: to },
    { x: '74%', y: '12%', s: 380, d: 1.5, c: from },
    { x: '60%', y: '70%', s: 320, d: 0.8, c: to },
    { x: '20%', y: '80%', s: 240, d: 2.2, c: from },
  ];

  return (
    <div
      className={`grain relative overflow-hidden ${className}`}
      style={{
        backgroundColor: from,
        backgroundImage: `linear-gradient(135deg, ${from}, ${to})`,
      }}
      aria-hidden
    >
      {/* Layered mesh for depth */}
      <span
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(60% 60% at 78% 18%, ${from}cc, transparent 60%), radial-gradient(50% 50% at 22% 82%, ${to}b3, transparent 60%)`,
        }}
      />

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
            opacity: 0.5,
            mixBlendMode: 'soft-light',
          }}
          whileInView={
            reduce ? undefined : { x: [0, 26, -18, 0], y: [0, -22, 16, 0], scale: [1, 1.14, 0.94, 1] }
          }
          viewport={{ margin: '0px' }}
          transition={{ duration: 17 + i * 3 + seed, repeat: Infinity, ease: 'easeInOut', delay: o.d }}
        />
      ))}

      {/* Slow-rotating metallic sheen — the "luxury" tell (pauses off-screen) */}
      <motion.span
        className="pointer-events-none absolute -inset-1/4"
        style={{
          background:
            'conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,0.10) 40deg, transparent 90deg, transparent 270deg, rgba(255,255,255,0.07) 310deg, transparent 360deg)',
          mixBlendMode: 'overlay',
        }}
        whileInView={reduce ? undefined : { rotate: 360 }}
        viewport={{ margin: '0px' }}
        transition={{ duration: 60 + seed * 4, repeat: Infinity, ease: 'linear' }}
      />

      {/* Top light + bottom shade + vignette */}
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,rgba(255,255,255,0.30),transparent_55%)]" />
      <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(42,36,32,0.40),transparent_46%)]" />
      <span className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(42,36,32,0.35)]" />
    </div>
  );
}
