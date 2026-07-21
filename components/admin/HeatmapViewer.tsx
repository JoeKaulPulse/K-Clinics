'use client';

import { useState } from 'react';

type Point = { x: number; y: number; rage: boolean };

// Click heatmap overlaid on a live preview of the page. Coordinates are stored
// as tenths-of-a-percent of viewport width (x) and full page height (y), so dots
// map onto the iframe by percentage. Approximate but genuinely indicative.
export function HeatmapViewer({ path, baseUrl, points }: { path: string; baseUrl: string; points: Point[] }) {
  const [show, setShow] = useState(true);
  const [height, setHeight] = useState(1800);

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-lg">Click heatmap · <span className="font-mono text-sm">{path}</span></h2>
        <div className="flex items-center gap-3 text-xs text-[var(--color-stone)]">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="accent-[var(--color-gold)]" /> Overlay</label>
          <label className="flex items-center gap-1.5">Height
            <select value={height} onChange={(e) => setHeight(Number(e.target.value))} className="rounded border border-[var(--color-line)] bg-white px-1 py-0.5">
              <option value={1200}>Short</option><option value={1800}>Medium</option><option value={3000}>Tall</option>
            </select>
          </label>
          <span><span className="inline-block h-2 w-2 rounded-full bg-[var(--color-gold)]" /> click · <span className="inline-block h-2 w-2 rounded-full bg-red-500" /> rage</span>
        </div>
      </div>
      <div className="relative mx-auto w-full max-w-[1100px] overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white" style={{ height }}>
        {/* pointer-events-none so admin cannot accidentally navigate away via links inside the preview */}
        <iframe src={`${baseUrl}${path}`} title="Page preview" className="absolute inset-0 h-full w-full pointer-events-none" loading="lazy" />
        {show && (
          <div className="pointer-events-none absolute inset-0 mix-blend-multiply">
            {points.map((p, i) => (
              <span key={i} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${p.x / 10}%`, top: `${p.y / 10}%`, width: 22, height: 22, background: p.rage ? 'radial-gradient(circle, rgba(239,68,68,0.6), transparent 70%)' : 'radial-gradient(circle, rgba(169,138,109,0.55), transparent 70%)' }} />
            ))}
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-[var(--color-stone)]">Dot positions are approximate (mapped by % of page); use session replay for exact behaviour.</p>
    </section>
  );
}
