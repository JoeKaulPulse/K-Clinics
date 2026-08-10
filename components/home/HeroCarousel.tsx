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
 * Auto-rotation stops while the pointer is over the hero, while keyboard focus
 * is inside it, whenever the visitor presses Pause, and always under
 * `prefers-reduced-motion` (dots still work, and the CSS crossfade collapses to
 * an instant swap via the site-wide reduced-motion rule in app/globals.css).
 * The explicit Pause control is what satisfies WCAG 2.2.2 (Level A) — hover and
 * focus alone leave touch users with no way to stop the rotation.
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
  // Three independent reasons to stop rotating, kept apart on purpose: sharing
  // one flag meant moving the mouse away resumed rotation even though keyboard
  // focus was still inside the hero.
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const reduce = useReducedMotionSafe();
  const count = slides.length;
  const rotating = !reduce && !hovered && !focused && !userPaused && count > 1;

  useEffect(() => {
    if (!rotating) return;
    // `index` is a dependency so pressing a dot restarts the dwell instead of
    // letting the slide advance a fraction of a second later.
    const id = setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => clearInterval(id);
  }, [rotating, count, index]);

  return (
    <section
      className="relative isolate min-h-[100svh] overflow-hidden bg-[var(--color-ink)] text-[var(--color-porcelain)]"
      aria-roledescription={count > 1 ? 'carousel' : undefined}
      aria-label={count > 1 ? 'Homepage highlights' : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        // Only resume once focus has actually left the hero, not when it
        // simply moves between two elements inside it.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      {/* Announce slide changes only when the carousel is not moving on its own
          (APG carousel pattern) — an auto-rotating live region talks over
          everything else a screen-reader user is doing. */}
      <div className="grid min-h-[100svh]" aria-live={rotating ? 'off' : 'polite'}>
        {slides.map((node, i) => (
          <div
            key={i}
            role={count > 1 ? 'group' : undefined}
            aria-roledescription={count > 1 ? 'slide' : undefined}
            aria-label={count > 1 ? `${i + 1} of ${count}: ${labels[i] ?? ''}` : undefined}
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
          <div className="pointer-events-auto flex items-center gap-0 rounded-full bg-black/25 px-2 py-1 backdrop-blur-sm">
            {!reduce && (
              <button
                type="button"
                onClick={() => setUserPaused((p) => !p)}
                aria-label={userPaused ? 'Resume the rotating highlights' : 'Pause the rotating highlights'}
                className="mr-1 grid h-6 w-6 place-items-center rounded-full text-[var(--color-porcelain)]/70 transition-colors hover:text-[var(--color-porcelain)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gold-soft)]"
              >
                <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3" fill="currentColor">
                  {userPaused ? <path d="M3 1.5l7 4.5-7 4.5z" /> : <path d="M3 1.5h2.2v9H3zm3.8 0H9v9H6.8z" />}
                </svg>
              </button>
            )}
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show slide ${i + 1} of ${count}: ${labels[i] ?? ''}`}
                aria-current={i === index}
                // 24x24 hit area (WCAG 2.2 SC 2.5.8) around a small visual dot.
                className="group flex h-6 min-w-6 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gold-soft)]"
              >
                <span
                  className={`h-2 rounded-full transition-all duration-500 ${
                    i === index ? 'w-6 bg-[var(--color-gold-soft)]' : 'w-2 bg-white/40 group-hover:bg-white/70'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
