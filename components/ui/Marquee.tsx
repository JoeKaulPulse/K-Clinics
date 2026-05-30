'use client';

import { useRef } from 'react';
import {
  motion,
  useScroll,
  useVelocity,
  useTransform,
  useSpring,
  useMotionValue,
  useAnimationFrame,
  useReducedMotion,
} from 'motion/react';

/**
 * Velocity-reactive marquee — the editorial word ribbon scrolls continuously,
 * leans (skews) with scroll velocity and nudges its base speed with scroll
 * direction. A signature award-site flourish. Falls back to a CSS marquee for
 * reduced-motion.
 */
export function Marquee({ items, className = '', baseSpeed = 40 }: { items: string[]; className?: string; baseSpeed?: number }) {
  const reduce = useReducedMotion();
  const row = [...items, ...items, ...items];

  if (reduce) {
    return (
      <div className={`relative flex overflow-hidden ${className}`} aria-hidden>
        <div className="flex shrink-0 items-center whitespace-nowrap">
          {row.map((it, i) => (
            <Item key={i} text={it} />
          ))}
        </div>
      </div>
    );
  }

  return <MarqueeInner items={row} className={className} baseSpeed={baseSpeed} />;
}

function MarqueeInner({ items, className, baseSpeed }: { items: string[]; className: string; baseSpeed: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const baseX = useMotionValue(0);
  const { scrollY } = useScroll();
  const scrollVelocity = useVelocity(scrollY);
  const smooth = useSpring(scrollVelocity, { damping: 50, stiffness: 400 });
  const velFactor = useTransform(smooth, [0, 1000], [0, 5], { clamp: false });
  const skew = useTransform(smooth, [-1000, 0, 1000], [-6, 0, 6], { clamp: true });

  const directionRef = useRef(-1);

  // The base track is one-third (we tripled the items); wrap within [-33.33, 0]%.
  const x = useTransform(baseX, (v) => `${wrap(-33.333, 0, v)}%`);

  useAnimationFrame((_, delta) => {
    // Base drift in %/second, scaled by frame delta.
    let moveBy = directionRef.current * (baseSpeed / 100) * (delta / 1000);
    const v = velFactor.get();
    if (v < 0) directionRef.current = -1;
    else if (v > 0) directionRef.current = 1;
    // Scroll velocity accelerates the drift.
    moveBy += moveBy * Math.abs(v);
    baseX.set(baseX.get() + moveBy);
  });

  return (
    <div ref={ref} className={`relative flex overflow-hidden ${className}`} aria-hidden>
      <motion.div style={{ x, skewX: skew }} className="flex shrink-0 items-center whitespace-nowrap">
        {items.map((it, i) => (
          <Item key={i} text={it} />
        ))}
      </motion.div>
    </div>
  );
}

function Item({ text }: { text: string }) {
  return (
    <span className="flex items-center">
      <span className="font-[family-name:var(--font-display)] text-[clamp(1.25rem,1rem+3vw,2.75rem)] tracking-tight">{text}</span>
      <span className="mx-5 text-[var(--color-gold)] md:mx-8">✦</span>
    </span>
  );
}

// Wrap a value into the [min, max) range (for seamless looping).
function wrap(min: number, max: number, v: number) {
  const range = max - min;
  return ((((v - min) % range) + range) % range) + min;
}
