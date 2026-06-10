'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { normalizeAnnotations, type KioskAnnotation, type KioskLiveResult } from './types';

// Reveal — the theatrical payoff.
// 1) Headline rises, score rings sweep + count up (~1.2s, SVG stroke-dashoffset).
// 2) The best photo fades in at its NATURAL aspect; each observation draws a
//    gold box on the feature, a leader line to a label card, staggered 600ms
//    apart. Coordinates are normalized 0–1 → percent space over the photo rect.
// 3) Treatments as gold pills.
// Degrades gracefully when the channel has no photo/annotations (poll
// fallback): centered rings + headline + insights instead.
// The parent auto-advances to the share scene after ~25s.

const RING_DELAY_MS = 350;
const ANNO_BASE_MS = 1800;
const ANNO_STAGGER_MS = 600;

// ── Score ring with count-up ──────────────────────────────────────────────────
function RingScore({ label, score, delayMs }: { label: string; score: number; delayMs: number }) {
  const max = 10;
  const r = 46;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, score / max));
  const [armed, setArmed] = useState(false);
  const [shown, setShown] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setArmed(true); // CSS transition sweeps the arc over 1.2s
      const start = performance.now();
      const dur = 1200;
      const tick = (now: number) => {
        const k = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - k, 3);
        setShown(Math.round(score * eased * 10) / 10);
        if (k < 1) raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    }, delayMs);
    return () => {
      clearTimeout(t);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [score, delayMs]);

  const display = Number.isInteger(score) ? Math.round(shown) : shown.toFixed(1);

  return (
    <div className="kd-rise flex flex-col items-center gap-[1.2vmin]" style={{ animationDelay: `${delayMs - 150}ms` }}>
      <div className="relative h-[clamp(7rem,17vmin,12rem)] w-[clamp(7rem,17vmin,12rem)]">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(194,165,137,0.18)" strokeWidth="7" />
          <circle
            cx="60" cy="60" r={r} fill="none"
            stroke="var(--color-gold-bright)" strokeWidth="7" strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={armed ? c * (1 - pct) : c}
            className="kd-ring-arc"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-[family-name:var(--font-display)] text-[clamp(2rem,5vmin,3.6rem)] leading-none text-[var(--color-porcelain)] tabular-nums">
            {display}
          </span>
          <span className="mt-[0.4vmin] text-[clamp(0.6rem,1.1vmin,0.85rem)] text-[rgba(246,236,227,0.5)]">/ {max}</span>
        </div>
      </div>
      <span className="text-[clamp(0.7rem,1.4vmin,1rem)] font-medium uppercase tracking-[0.28em] text-[var(--color-gold-soft)]">
        {label}
      </span>
    </div>
  );
}

// ── Annotation layout: alternate sides, distribute vertically ─────────────────
type Placed = {
  o: KioskAnnotation;
  box: { x: number; y: number; w: number; h: number }; // percent space
  side: 'left' | 'right';
  labelY: number; // percent
  delayMs: number;
};

function placeAnnotations(list: KioskAnnotation[]): Placed[] {
  const sorted = [...list].sort((a, b) => (a.box!.y + a.box!.h / 2) - (b.box!.y + b.box!.h / 2));
  const lastY: Record<'left' | 'right', number> = { left: -100, right: -100 };
  return sorted.map((o, i) => {
    const b = o.box!;
    const box = { x: b.x * 100, y: b.y * 100, w: b.w * 100, h: b.h * 100 };
    const cy = box.y + box.h / 2;
    const cx = box.x + box.w / 2;
    let side: 'left' | 'right' = cx > 50 ? 'left' : 'right';
    // If the preferred side is crowded and the other is freer, swap.
    const other: 'left' | 'right' = side === 'left' ? 'right' : 'left';
    if (cy - lastY[side] < 14 && cy - lastY[other] >= 14) side = other;
    const labelY = Math.max(8, Math.min(92, Math.max(cy, lastY[side] + 15)));
    lastY[side] = labelY;
    return { o, box, side, labelY, delayMs: ANNO_BASE_MS + i * ANNO_STAGGER_MS };
  });
}

// ── Annotated photo ───────────────────────────────────────────────────────────
function AnnotatedPhoto({ photo, annotations }: { photo: string; annotations: KioskAnnotation[] }) {
  const placed = useMemo(() => placeAnnotations(annotations), [annotations]);
  return (
    <div className="kd-reveal-photo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo} alt="" aria-hidden draggable={false} className="kd-photo" />
      <div className="absolute inset-0 bg-[rgba(20,16,13,0.18)]" aria-hidden />

      {/* Boxes + leader lines in percent space over the photo rect */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {placed.map(({ box, side, labelY, delayMs }, i) => {
          const x1 = side === 'left' ? box.x : box.x + box.w;
          const y1 = box.y + box.h / 2;
          const x2 = side === 'left' ? 30 : 70;
          return (
            <g key={i} className="kd-anno" style={{ animationDelay: `${delayMs}ms` }}>
              <rect
                x={box.x} y={box.y} width={box.w} height={box.h} rx="2.5"
                fill="none" stroke="var(--color-gold-bright)" strokeWidth="1.6"
                vectorEffect="non-scaling-stroke" className="kd-anno-box"
              />
              <line
                x1={x1} y1={y1} x2={x2} y2={labelY}
                stroke="var(--color-gold-bright)" strokeWidth="1.2"
                vectorEffect="non-scaling-stroke" pathLength={1} className="kd-anno-line"
                style={{ animationDelay: `${delayMs + 200}ms` }}
              />
              <circle cx={x1} cy={y1} r="0.9" fill="var(--color-gold-bright)" className="kd-anno-box" />
            </g>
          );
        })}
      </svg>

      {/* Label cards */}
      {placed.map(({ o, side, labelY, delayMs }, i) => (
        <div
          key={i}
          className="kd-anno absolute w-[30%]"
          style={{
            top: `${labelY}%`,
            [side === 'left' ? 'left' : 'right']: '1.5%',
            transform: 'translateY(-50%)',
            animationDelay: `${delayMs}ms`,
          }}
        >
          <div
            className={`kd-anno-card rounded-[var(--radius-sm)] border bg-[rgba(24,20,16,0.88)] px-[1.6vmin] py-[1.2vmin] ${
              side === 'left' ? 'border-r-2 text-right' : 'border-l-2 text-left'
            } border-[rgba(194,165,137,0.4)] ${side === 'left' ? 'border-r-[var(--color-gold)]' : 'border-l-[var(--color-gold)]'}`}
            style={{ animationDelay: `${delayMs + 250}ms` }}
          >
            <p className="font-[family-name:var(--font-display)] text-[clamp(0.85rem,1.9vmin,1.4rem)] leading-tight text-[var(--color-gold-bright)]">
              {o.label}
            </p>
            {o.detail && (
              <p className="mt-[0.5vmin] text-[clamp(0.65rem,1.3vmin,0.95rem)] leading-snug text-[rgba(246,236,227,0.82)]">
                {o.detail}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Scene ─────────────────────────────────────────────────────────────────────
export function RevealScene({ result, photoUrls }: { result: KioskLiveResult; photoUrls: string[] }) {
  const photo = result.bestPhotoUrl || null;
  const annotations = useMemo(() => {
    const all = normalizeAnnotations(result);
    if (!photo) return all;
    const bestIdx = photoUrls.indexOf(photo);
    if (bestIdx === -1) return all;
    const scoped = all.filter((o) => (o.photoIndex ?? bestIdx) === bestIdx);
    return scoped.length > 0 ? scoped : all;
  }, [result, photo, photoUrls]);

  const treatments = (result.treatments ?? []).slice(0, 2);
  const insights = (result.insights ?? []).slice(0, 3);
  const pillsDelay = ANNO_BASE_MS + annotations.length * ANNO_STAGGER_MS + 200;

  const header = (
    <>
      <p className="kd-rise font-[family-name:var(--font-display)] text-[clamp(0.85rem,1.7vmin,1.3rem)] uppercase tracking-[0.4em] text-[var(--color-gold-soft)]">
        Your reveal
      </p>
      {result.headline && (
        <h1 className="kd-rise max-w-[86vmin] text-center font-[family-name:var(--font-display)] text-[clamp(1.9rem,5.2vmin,4.2rem)] leading-[1.08] text-[var(--color-porcelain)] landscape:text-left" style={{ animationDelay: '120ms' }}>
          {result.headline}
        </h1>
      )}
    </>
  );

  const rings = (
    <div className="flex items-center justify-center gap-[5vmin]">
      {typeof result.skinScore === 'number' && <RingScore label="Skin" score={result.skinScore} delayMs={RING_DELAY_MS} />}
      {typeof result.smileScore === 'number' && <RingScore label="Smile" score={result.smileScore} delayMs={RING_DELAY_MS + 200} />}
    </div>
  );

  const pills = treatments.length > 0 && (
    <div className="flex flex-wrap items-center justify-center gap-[1.5vmin] landscape:justify-start">
      <span className="kd-pill text-[clamp(0.65rem,1.3vmin,0.95rem)] uppercase tracking-[0.26em] text-[rgba(246,236,227,0.55)]" style={{ animationDelay: `${pillsDelay}ms` }}>
        You could love
      </span>
      {treatments.map((t, i) => (
        <span
          key={t}
          className="kd-pill rounded-full border border-[rgba(194,165,137,0.55)] bg-[rgba(169,138,109,0.16)] px-[2.2vmin] py-[1vmin] font-[family-name:var(--font-display)] text-[clamp(0.85rem,1.8vmin,1.3rem)] text-[var(--color-gold-bright)]"
          style={{ animationDelay: `${pillsDelay + (i + 1) * 180}ms` }}
        >
          {t}
        </span>
      ))}
    </div>
  );

  if (photo) {
    return (
      <div className="kd-reveal">
        <div className="kd-reveal-side portrait:order-1 landscape:order-2 landscape:items-start">
          {header}
          {rings}
          <div className="portrait:hidden">{pills}</div>
        </div>
        <div className="portrait:order-2 landscape:order-1">
          <AnnotatedPhoto photo={photo} annotations={annotations} />
        </div>
        <div className="portrait:order-3 landscape:hidden">{pills}</div>
      </div>
    );
  }

  // Degraded reveal (polling fallback — no photo/annotations available).
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-[4vmin] px-[8vmin] text-center">
      {header}
      {rings}
      {insights.length > 0 && (
        <div className="flex max-w-[80vmin] flex-col gap-[1.6vmin]">
          {insights.map((line, i) => (
            <p
              key={i}
              className="kd-rise text-[clamp(1rem,2.4vmin,1.7rem)] leading-snug text-[var(--color-blush)]"
              style={{ animationDelay: `${ANNO_BASE_MS + i * ANNO_STAGGER_MS}ms` }}
            >
              {line}
            </p>
          ))}
        </div>
      )}
      {pills}
      <p className="kd-rise text-[clamp(0.85rem,1.7vmin,1.2rem)] text-[rgba(246,236,227,0.5)]" style={{ animationDelay: `${pillsDelay + 600}ms` }}>
        The full annotated photo is on your phone.
      </p>
    </div>
  );
}
