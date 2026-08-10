'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useReducedMotionSafe } from '@/components/motion/use-reduced-motion-safe';

// BLD-1197: how long each slide is shown before auto-advancing.
const ROTATE_MS = 7500;

/**
 * Client-side rotation shell for the homepage hero (BLD-1197).
 *
 * `slides` are pre-rendered — mostly server-rendered — content, one per
 * `HERO_SLIDES` entry, so slide 1 (the original hero) paints on the server
 * without waiting on this component's hydration. This component only owns
 * the interactive bits: the interval timer, the visible/hidden state and the
 * dot controls.
 *
 * Auto-rotation pauses on hover or focus anywhere in the hero, and is fully
 * disabled under `prefers-reduced-motion` (dots still work, and the CSS
 * crossfade collapses to an instant swap via the site-wide reduced-motion
 * rule in app/globals.css).
 */
export function HeroCarousel({
  slides,
  labels,
}: {
  /** Pre-rendered slide content, same order/length as `labels`. */
  slides: ReactNode[];
  /** Human-readable name per slide, used only to build each dot's aria-label. */
  labels: string[];
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotionSafe();
  const count = slides.length;

  useEffect(() => {
    if (reduce || paused || count <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => clearInterval(id);
  }, [reduce, paused, count]);

  return (
    <section
      className="relative isolate min-h-[100svh] overflow-hidden bg-[var(--color-ink)] text-[var(--color-porcelain)]"
      aria-roledescription={count > 1 ? 'carousel' : undefined}
      aria-label={count > 1 ? 'Homepage highlights' : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        // Only resume once focus has actually left the hero, not when it
        // simply moves between two elements inside it.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      <div className="grid min-h-[100svh]">
        {slides.map((node, i) => (
          <div
            key={i}
            className={`relative isolate col-start-1 row-start-1 min-h-[100svh] w-full transition-opacity duration-700 ease-out ${
              i === index ? 'z-10 opacity-100' : 'pointer-events-none z-0 opacity-0'
            }`}
            aria-hidden={i !== index}
            inert={i !== index}
          >
            {node}
          </div>
        ))}
      </div>

      {count > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-full bg-black/25 px-3.5 py-2.5 backdrop-blur-sm">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show slide ${i + 1} of ${count}: ${labels[i] ?? ''}`}
                aria-current={i === index}
                className={`h-2 rounded-full transition-all duration-500 focus-visible:outline-2 focus-visible:outline-[var(--color-gold-soft)] ${
                  i === index ? 'w-6 bg-[var(--color-gold-soft)]' : 'w-2 bg-white/40 hover:bg-white/70'
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
