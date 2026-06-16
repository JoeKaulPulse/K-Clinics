'use client';

import { motion, type Variants } from 'motion/react';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  as?: 'div' | 'section' | 'li' | 'span';
  once?: boolean;
};

/** Premium scroll-reveal: a soft rise + fade, honouring reduced-motion. */
export function Reveal({ children, className, delay = 0, y = 28, as = 'div', once = true }: Props) {
  const MotionTag = motion[as];

  const variants: Variants = {
    hidden: { opacity: 0, y },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] },
    },
  };

  return (
    <MotionTag
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="show"
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
  gap = 0.09,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  gap?: number;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
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
