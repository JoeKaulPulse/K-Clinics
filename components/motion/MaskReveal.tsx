'use client';

import { useRef, type ReactNode } from 'react';
import { motion, useInView } from 'motion/react';
import { useReducedMotionSafe } from '@/components/motion/use-reduced-motion-safe';

/**
 * Clip-path mask reveal — content is unveiled with a directional wipe as it
 * scrolls into view, with a subtle inner scale for a cinematic feel.
 * Uses useInView for reliable triggering even when already partly on-screen.
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
  const reduce = useReducedMotionSafe();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' });

  if (reduce) return <div className={className}>{children}</div>;

  const hidden = direction === 'up' ? 'inset(100% 0% 0% 0%)' : 'inset(0% 100% 0% 0%)';
  const shown = 'inset(0% 0% 0% 0%)';

  return (
    <motion.div
      ref={ref}
      className={`overflow-hidden ${className}`}
      initial={{ clipPath: hidden }}
      animate={{ clipPath: inView ? shown : hidden }}
      transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay }}
    >
      <motion.div
        initial={{ scale: 1.14 }}
        animate={{ scale: inView ? 1 : 1.14 }}
        transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1], delay }}
        className="h-full w-full"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
