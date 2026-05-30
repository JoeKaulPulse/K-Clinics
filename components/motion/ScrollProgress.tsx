'use client';

import { motion, useScroll, useSpring } from 'motion/react';

/** A whisper-thin champagne progress bar pinned to the top of the viewport. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });

  return (
    <motion.div
      aria-hidden
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-gradient-to-r from-[var(--color-gold)] via-[var(--color-gold-bright)] to-[var(--color-gold)]"
    />
  );
}
