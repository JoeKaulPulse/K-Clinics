'use client';

import { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';

/** A refined trailing cursor ring (desktop, fine-pointer only). Grows and
 *  fills softly over interactive elements. Hidden for touch / reduced-motion. */
export function Cursor() {
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState(false);
  const [hidden, setHidden] = useState(true);

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const sx = useSpring(x, { stiffness: 380, damping: 30, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 380, damping: 30, mass: 0.4 });

  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)').matches;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduce) return;
    setEnabled(true);

    const move = (e: MouseEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      setHidden(false);
      const el = e.target as HTMLElement;
      setActive(Boolean(el.closest('a, button, [role="button"], input, select, textarea, label')));
    };
    const leave = () => setHidden(true);

    window.addEventListener('mousemove', move);
    document.addEventListener('mouseleave', leave);
    return () => {
      window.removeEventListener('mousemove', move);
      document.removeEventListener('mouseleave', leave);
    };
  }, [x, y]);

  if (!enabled) return null;

  return (
    <motion.div
      aria-hidden
      style={{ x: sx, y: sy }}
      className="pointer-events-none fixed left-0 top-0 z-[70] -ml-4 -mt-4 hidden lg:block"
      animate={{ opacity: hidden ? 0 : 1 }}
      transition={{ duration: 0.2 }}
    >
      <motion.span
        className="block rounded-full border border-[var(--color-gold)]"
        animate={{
          width: active ? 46 : 30,
          height: active ? 46 : 30,
          marginLeft: active ? -8 : 0,
          marginTop: active ? -8 : 0,
          backgroundColor: active ? 'color-mix(in oklab, var(--color-gold) 16%, transparent)' : 'transparent',
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      />
    </motion.div>
  );
}
