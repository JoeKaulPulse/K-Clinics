'use client';

import { useRef, useState } from 'react';
import { GenerativeArt } from '@/components/ui/GenerativeArt';

/**
 * Draggable before/after reveal slider — a hallmark clinic-results interaction.
 * Uses generative art placeholders today; swap `before`/`after` for real
 * <img> elements (same dimensions) when photography is available.
 */
export function BeforeAfter({
  beforeGrad = ['#8a7a6e', '#5a4f47'],
  afterGrad = ['#dcc4a8', '#a98a6d'],
  labelBefore = 'Before',
  labelAfter = 'After',
  className = '',
}: {
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

  return (
    <div
      ref={ref}
      className={`relative select-none overflow-hidden rounded-[var(--radius-2xl)] ${className}`}
      onPointerDown={(e) => { dragging.current = true; setFromClientX(e.clientX); }}
      onPointerMove={(e) => dragging.current && setFromClientX(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerLeave={() => (dragging.current = false)}
    >
      {/* After (full) */}
      <GenerativeArt from={afterGrad[0]} to={afterGrad[1]} className="h-full w-full" />
      <span className="absolute right-4 top-4 rounded-full bg-black/30 px-3 py-1 text-xs uppercase tracking-[0.16em] text-white/90 backdrop-blur-sm">{labelAfter}</span>

      {/* Before (clipped to the left of the handle) */}
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <GenerativeArt from={beforeGrad[0]} to={beforeGrad[1]} seed={3} className="h-full w-full" />
        <span className="absolute left-4 top-4 rounded-full bg-black/30 px-3 py-1 text-xs uppercase tracking-[0.16em] text-white/90 backdrop-blur-sm">{labelBefore}</span>
      </div>

      {/* Handle */}
      <div className="absolute inset-y-0 z-10 w-0.5 bg-white/80" style={{ left: `${pos}%` }}>
        <div className="absolute top-1/2 left-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded-full bg-white text-[var(--color-ink)] shadow-[var(--shadow-soft)]">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
            <path d="M9 7l-4 5 4 5M15 7l4 5-4 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      <input
        type="range"
        min={2}
        max={98}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Before and after slider"
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}
