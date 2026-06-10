'use client';

import { useEffect, useRef, useState } from 'react';
import { poseTitle } from './types';

// Live mirror for posing / countdown / captured stages.
// - Frames arrive as data-URL JPEGs (~400ms cadence). Two stacked <img>
//   buffers alternate: the incoming frame loads off-screen, then fades in
//   over 200ms ON TOP of the previous one (which is dropped only after the
//   cross-fade) — no decode flicker, no dark gaps.
// - Half-body guide frame: SVG rounded rect + corner ticks, gently breathing.
// - Pose banner from poseIdx; giant 3-2-1 numerals run on a LOCAL 1s cadence
//   the moment stage flips to 'countdown' (the server only flips the stage).
// - White flash overlay when stage hits 'captured', keyed per pose.

type Slot = { src: string | null; front: boolean };

export function MirrorScene({
  stage,
  poseIdx,
  frame,
}: {
  stage: 'posing' | 'countdown' | 'captured';
  poseIdx: number;
  frame: string | null;
}) {
  // ── Double-buffered mirror ────────────────────────────────────────────────
  const [slots, setSlots] = useState<[Slot, Slot]>([
    { src: null, front: true },
    { src: null, front: false },
  ]);

  useEffect(() => {
    if (!frame) return;
    setSlots((prev) => {
      const frontI = prev[0].front ? 0 : 1;
      if (prev[frontI].src === frame || prev[1 - frontI].src === frame) return prev;
      const next: [Slot, Slot] = [{ ...prev[0] }, { ...prev[1] }];
      next[1 - frontI].src = frame; // load into the back buffer
      return next;
    });
  }, [frame]);

  const promote = (i: number) => {
    setSlots((prev) => {
      if (prev[i].front || !prev[i].src) return prev;
      const next: [Slot, Slot] = [{ ...prev[0] }, { ...prev[1] }];
      next[i].front = true;
      next[1 - i].front = false;
      return next;
    });
  };

  const hasFrame = slots.some((s) => s.src && s.front);

  // ── Local countdown cadence ───────────────────────────────────────────────
  const [count, setCount] = useState<number | null>(null);
  const countTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (stage === 'countdown') {
      setCount(3);
      countTimer.current = setInterval(() => {
        setCount((c) => (c && c > 1 ? c - 1 : c));
      }, 1000);
    } else {
      setCount(null);
    }
    return () => {
      if (countTimer.current) clearInterval(countTimer.current);
      countTimer.current = null;
    };
  }, [stage, poseIdx]);

  return (
    <div className="kd-mirror-layout">
      {/* Pose banner (re-animates per pose) */}
      <div key={`banner-${poseIdx}`} className="kd-pose-banner text-center landscape:order-2 landscape:max-w-[34vw] landscape:text-left">
        <p className="font-[family-name:var(--font-display)] text-[clamp(0.85rem,1.7vmin,1.3rem)] uppercase tracking-[0.4em] text-[var(--color-gold-soft)]">
          Pose {Math.min(poseIdx + 1, 3)} of 3
        </p>
        <h1 className="mt-[1.2vmin] font-[family-name:var(--font-display)] text-[clamp(2.2rem,6.5vmin,5.5rem)] leading-[1.05] text-[var(--color-porcelain)]">
          {poseTitle(poseIdx)}
        </h1>
        <p className="mt-[1.2vmin] text-[clamp(0.95rem,2vmin,1.5rem)] text-[var(--color-blush)]">
          {stage === 'countdown' ? 'Hold it — gorgeous.' : 'Find your light. Your phone does the rest.'}
        </p>
      </div>

      {/* Mirror */}
      <div className="kd-mirror-frame landscape:order-1">
        {slots.map((s, i) =>
          s.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={s.src}
              alt=""
              aria-hidden
              draggable={false}
              className={`kd-mirror-img${s.front ? ' kd-front' : ''}`}
              onLoad={() => promote(i)}
            />
          ) : null,
        )}

        {/* Waiting shimmer until the first frame lands */}
        {!hasFrame && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="kd-mirror-waiting font-[family-name:var(--font-display)] text-[clamp(1.1rem,2.4vmin,1.8rem)] text-[var(--color-gold-soft)]">
              Warming up the mirror…
            </p>
          </div>
        )}

        {/* Half-body guide frame: rounded rect + corner ticks */}
        <svg className="kd-guide absolute inset-0 z-10 h-full w-full" viewBox="0 0 100 134" preserveAspectRatio="none" aria-hidden>
          <rect x="15" y="10" width="70" height="114" rx="10" fill="none" stroke="rgba(220,196,168,0.28)" strokeWidth="0.6" />
          {/* Corner ticks */}
          <path d="M15 24 V20 a10 10 0 0 1 10 -10 h4" fill="none" stroke="var(--color-gold-bright)" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M85 24 V20 a10 10 0 0 0 -10 -10 h-4" fill="none" stroke="var(--color-gold-bright)" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M15 110 v4 a10 10 0 0 0 10 10 h4" fill="none" stroke="var(--color-gold-bright)" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M85 110 v4 a10 10 0 0 1 -10 10 h-4" fill="none" stroke="var(--color-gold-bright)" strokeWidth="1.4" strokeLinecap="round" />
        </svg>

        {/* Giant countdown numeral — keyed per second so the pop re-runs */}
        {stage === 'countdown' && count !== null && (
          <div className="absolute inset-0 z-20 flex items-center justify-center">
            <span
              key={count}
              className="kd-count font-[family-name:var(--font-display)] text-[clamp(8rem,30vmin,22rem)] leading-none text-white [text-shadow:0_0_60px_rgba(220,196,168,0.65)]"
            >
              {count}
            </span>
          </div>
        )}

        {/* Capture flash — once per pose */}
        {stage === 'captured' && <div key={`flash-${poseIdx}`} className="kd-flash" />}
      </div>
    </div>
  );
}
