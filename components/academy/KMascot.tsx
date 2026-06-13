'use client';

import { useEffect } from 'react';
import { motion, type TargetAndTransition, type Transition } from 'motion/react';
import { KMark } from '@/components/brand/marks';

// The academy mascot — the brand K monogram, animated as a graceful character.
// We never redraw the glyph; we move the supplied mark and surround it with
// abstract motion (haloes, radiating particles) in the brand palette.

export type CelebrationVariant = 'idle' | 'cheer' | 'pass' | 'perfect' | 'badge' | 'complete';

const DOTS: Record<Exclude<CelebrationVariant, 'idle'>, number> = { cheer: 8, pass: 12, perfect: 18, badge: 10, complete: 22 };

const K_ANIM: Record<CelebrationVariant, { animate: TargetAndTransition; transition: Transition }> = {
  idle: { animate: { y: [0, -6, 0], rotate: [-2.5, 2.5, -2.5] }, transition: { duration: 4.5, repeat: Infinity, ease: 'easeInOut' } },
  cheer: { animate: { scale: [0.6, 1.15, 1], y: [14, -6, 0] }, transition: { duration: 0.7, ease: [0.34, 1.56, 0.64, 1] } },
  pass: { animate: { scale: [0.6, 1, 1], rotate: [0, 360] }, transition: { duration: 0.95, ease: 'easeInOut' } },
  perfect: { animate: { scale: [0.4, 1.22, 1], rotate: [0, 14, -10, 0] }, transition: { duration: 1.05, ease: 'easeOut' } },
  badge: { animate: { scale: [0.6, 1.12, 1], y: [8, -4, 0] }, transition: { duration: 0.85, ease: [0.34, 1.56, 0.64, 1] } },
  complete: { animate: { scale: [0.5, 1.12, 1], y: [12, 0, 0], rotate: [-6, 0, 0] }, transition: { duration: 1.15, ease: 'easeOut' } },
};

/** The animated K. `size` is the glyph width in px (the mark is ~1.8× tall). */
export function KMascot({ variant = 'idle', size = 88, className = '' }: { variant?: CelebrationVariant; size?: number; className?: string }) {
  const a = K_ANIM[variant];
  const drawn = variant === 'perfect' || variant === 'badge';
  return (
    <motion.div style={{ width: size, height: size * (234 / 130) }} className={`text-[var(--color-gold)] ${className}`} animate={a.animate} transition={a.transition}>
      <KMark animated={drawn} />
    </motion.div>
  );
}

/** A brief full-screen celebration: the K plus an abstract particle burst + halo
 *  and a short message. Auto-dismisses; tap to skip. */
export function KCelebration({ variant, title, subtitle, badgeIcon, onDone, holdMs = 2000 }: { variant: Exclude<CelebrationVariant, 'idle'>; title: string; subtitle?: string; badgeIcon?: string; onDone: () => void; holdMs?: number }) {
  useEffect(() => {
    const t = setTimeout(onDone, holdMs);
    return () => clearTimeout(t);
  }, [onDone, holdMs]);

  const dots = DOTS[variant];
  const radius = variant === 'complete' ? 160 : variant === 'perfect' ? 145 : 120;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
      onClick={onDone}
      className="fixed inset-0 z-[300] flex cursor-pointer flex-col items-center justify-center bg-[var(--color-ink)]/85 backdrop-blur-sm"
      role="status" aria-live="polite"
    >
      <div className="relative grid place-items-center">
        {/* Expanding halo ring */}
        <motion.span className="absolute rounded-full border border-[var(--color-gold)]/40" initial={{ width: 64, height: 64, opacity: 0.6 }} animate={{ width: radius * 2.2, height: radius * 2.2, opacity: 0 }} transition={{ duration: 1.2, ease: 'easeOut' }} />
        {variant === 'complete' && (
          <motion.span className="absolute rounded-full border border-[var(--color-gold)]/25" initial={{ width: 64, height: 64, opacity: 0.5 }} animate={{ width: radius * 3, height: radius * 3, opacity: 0 }} transition={{ duration: 1.6, ease: 'easeOut', delay: 0.2 }} />
        )}

        {/* Radiating particles (abstract confetti) */}
        {Array.from({ length: dots }).map((_, i) => {
          const angle = (i / dots) * Math.PI * 2;
          const r = radius + (i % 3) * 14;
          const tone = i % 3 === 0 ? 'bg-[var(--color-porcelain)]' : 'bg-[var(--color-gold)]';
          return (
            <motion.span
              key={i}
              className={`absolute h-2 w-2 rounded-full ${tone}`}
              initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
              animate={{ x: Math.cos(angle) * r, y: Math.sin(angle) * r, opacity: [0, 1, 0], scale: [0.4, 1, 0.3] }}
              transition={{ duration: 1.25, delay: i * 0.02, ease: 'easeOut' }}
            />
          );
        })}

        {/* The mascot, with an orbiting badge for badge unlocks */}
        <div className="relative">
          <KMascot variant={variant} size={variant === 'complete' ? 104 : 90} />
          {variant === 'badge' && badgeIcon && (
            <motion.span className="absolute -right-4 -top-2 text-3xl drop-shadow" initial={{ scale: 0 }} animate={{ scale: 1, rotate: [0, 360] }} transition={{ scale: { duration: 0.4, delay: 0.3 }, rotate: { duration: 6, repeat: Infinity, ease: 'linear' } }}>
              {badgeIcon}
            </motion.span>
          )}
        </div>
      </div>

      <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="mt-9 font-[family-name:var(--font-display)] text-2xl text-[var(--color-porcelain)]">{title}</motion.p>
      {subtitle && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.32 }} className="mt-1.5 text-sm text-white/70">{subtitle}</motion.p>}
    </motion.div>
  );
}
