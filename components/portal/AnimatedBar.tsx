'use client';

import { motion } from 'motion/react';

/** A progress bar that fills from 0 to `pct`% when scrolled into view.
 *  Honours reduced-motion via MotionProvider (reducedMotion="user"). */
export function AnimatedBar({ pct, color, className = '' }: { pct: number; color?: string; className?: string }) {
  return (
    <motion.div
      className={className}
      style={color ? { background: color } : undefined}
      initial={{ width: '0%' }}
      whileInView={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      viewport={{ once: true, margin: '-10% 0px' }}
      transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
    />
  );
}
