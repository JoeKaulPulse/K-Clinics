'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

/**
 * Clip-path mask reveal — the content is unveiled with a directional wipe as it
 * scrolls into view, with a subtle inner scale for a cinematic feel.
 */
export function MaskReveal({
  children,
  className = '',
  direction = 'up',
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  direction?: 'up' | 'left';
  delay?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;

  const hidden =
    direction === 'up'
      ? 'inset(100% 0% 0% 0%)'
      : 'inset(0% 100% 0% 0%)';

  return (
    <motion.div
      className={`overflow-hidden ${className}`}
      initial={{ clipPath: hidden }}
      whileInView={{ clipPath: 'inset(0% 0% 0% 0%)' }}
      viewport={{ once: true, margin: '-12%' }}
      transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay }}
    >
      <motion.div
        initial={{ scale: 1.14 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true, margin: '-12%' }}
        transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1], delay }}
        className="h-full w-full"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
