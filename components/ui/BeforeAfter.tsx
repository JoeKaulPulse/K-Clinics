'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { GenerativeArt } from '@/components/ui/GenerativeArt';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/**
 * Draggable before/after reveal slider — a hallmark clinic-results interaction.
 * Pass `beforeSrc`/`afterSrc` (public paths) for real photography; falls back to
 * generative-art placeholders when omitted.
 *
 * Mobile: `touch-action: pan-y` lets a vertical swipe scroll the page normally;
 * only a deliberate horizontal drag on the handle moves the divider, so the
 * section no longer "traps" scrolling. Pointer capture keeps the drag smooth.
 */
export function BeforeAfter({
  beforeSrc,
  afterSrc,
  beforeGrad = ['#8a7a6e', '#5a4f47'],
  afterGrad = ['#dcc4a8', '#a98a6d'],
  labelBefore = 'Before',
  labelAfter = 'After',
  className = '',
}: {
  beforeSrc?: string;
  afterSrc?: string;
  beforeGrad?: [string, string];
  afterGrad?: [string, string];
  labelBefore?: string;
  labelAfter?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(50);
  const dragging = useRef(false);

  const setFromClientX = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pct = ((clientX - r.left) / r.width) * 100;
    setPos(Math.max(2, Math.min(98, pct)));
  };

  // Drag is initiated only from the handle, so swiping elsewhere scrolls.
  const startDrag = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (dragging.current) setFromClientX(e.clientX);
  };
  const endDrag = () => (dragging.current = false);

  const nudge = (delta: number) => setPos((p) => Math.max(2, Math.min(98, p + delta)));

  return (
    <div
      ref={ref}
      className={`relative select-none overflow-hidden rounded-[var(--radius-2xl)] ${className}`}
      style={{ touchAction: 'pan-y' }}
    >
      {/* After (full) */}
      {afterSrc ? (
        <Image
          src={`${BASE}${afterSrc}`}
          alt={`${labelAfter} treatment`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover"
          draggable={false}
        />
      ) : (
        <GenerativeArt from={afterGrad[0]} to={afterGrad[1]} className="h-full w-full" />
      )}
      <span className="pointer-events-none absolute right-4 top-4 rounded-full bg-black/30 px-3 py-1 text-xs uppercase tracking-[0.16em] text-white/90 backdrop-blur-sm">{labelAfter}</span>

      {/* Before (clipped to the left of the handle) */}
      <div className="pointer-events-none absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        {beforeSrc ? (
          <Image
            src={`${BASE}${beforeSrc}`}
            alt={`${labelBefore} treatment`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
            draggable={false}
          />
        ) : (
          <GenerativeArt from={beforeGrad[0]} to={beforeGrad[1]} seed={3} className="h-full w-full" />
        )}
        <span className="absolute left-4 top-4 rounded-full bg-black/30 px-3 py-1 text-xs uppercase tracking-[0.16em] text-white/90 backdrop-blur-sm">{labelBefore}</span>
      </div>

      {/* Handle — the only draggable target, so the rest of the area scrolls. */}
      <div className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-white/80" style={{ left: `${pos}%` }}>
        <button
          type="button"
          role="slider"
          aria-label="Reveal before and after"
          aria-valuemin={2}
          aria-valuemax={98}
          aria-valuenow={Math.round(pos)}
          onPointerDown={startDrag}
          onPointerMove={onMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') { e.preventDefault(); nudge(-4); }
            if (e.key === 'ArrowRight') { e.preventDefault(); nudge(4); }
          }}
          className="pointer-events-auto absolute top-1/2 left-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none place-items-center rounded-full bg-white text-[var(--color-ink)] shadow-[var(--shadow-soft)] outline-none ring-[var(--color-gold)] focus-visible:ring-2"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
            <path d="M9 7l-4 5 4 5M15 7l4 5-4 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
