'use client';

import { useId, useRef } from 'react';
import type { Field } from '@/lib/sections';
import type { Block } from '@/lib/blocks';
import { BlockEditor } from '@/components/admin/BlockEditor';
import { MediaField } from '@/components/admin/MediaPicker';

const fld = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]';
const lbl = 'block text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-stone)] mb-1.5';

type Data = Record<string, unknown>;
const move = <T,>(a: T[], i: number, d: number): T[] => { const j = i + d; if (j < 0 || j >= a.length) return a; const n = [...a]; [n[i], n[j]] = [n[j], n[i]]; return n; };

// PRJ-1032.30 (WCAG 2.1.1): arrow-key control for the focal-point picker, so the
// point is settable without a mouse. There is a single point, so arrows move it
// live (2% steps, Shift = 10%) rather than the place-a-marker model the exercise
// editor uses; a debounced aria-live line announces the position.
const FOCAL_DIRS: Record<string, [number, number] | undefined> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

/** Render a section's fields from its schema, editing a flat data object. */
export function SectionFields({ fields, data, onChange }: { fields: Field[]; data: Data; onChange: (data: Data) => void }) {
  const set = (key: string, value: unknown) => onChange({ ...data, [key]: value });
  return (
    <div className="space-y-4">
      {fields.map((f) => <FieldInput key={f.key} field={f} value={data[f.key]} data={data} onChange={(v) => set(f.key, v)} />)}
    </div>
  );
}

function FocalField({ label, help, src, pos, onChange }: { label: string; help?: string; src: string; pos: string; onChange: (v: string) => void }) {
  const [x, y] = pos.split(' ');
  const liveRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintId = useId();
  const setFocal = (px: number, py: number) => {
    onChange(`${px}% ${py}%`);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { if (liveRef.current) liveRef.current.textContent = `Focal point at ${px}% across, ${py}% down`; }, 150);
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const d = FOCAL_DIRS[e.key];
    if (!d) return;
    e.preventDefault();
    const step = e.shiftKey ? 10 : 2;
    const cx = parseInt(x, 10) || 50;
    const cy = parseInt(y, 10) || 50;
    setFocal(Math.min(100, Math.max(0, cx + d[0] * step)), Math.min(100, Math.max(0, cy + d[1] * step)));
  };
  return (
    <div>
      <label className={lbl}>{label}</label>
      {src ? (
        <div
          role="application"
          aria-label={`${label}. Focal point.`}
          aria-describedby={hintId}
          tabIndex={0}
          onKeyDown={onKeyDown}
          className="relative cursor-crosshair overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-line)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold-deep)] focus-visible:ring-offset-2"
          onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); const px = Math.round(((e.clientX - r.left) / r.width) * 100); const py = Math.round(((e.clientY - r.top) / r.height) * 100); setFocal(px, py); }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="block max-h-52 w-full object-cover" style={{ objectPosition: pos }} />
          <span className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[var(--color-gold)] shadow" style={{ left: x, top: y }} />
          <span ref={liveRef} aria-live="polite" className="sr-only" />
          <span id={hintId} className="sr-only">Click the image to set the focal point, or focus it and use the arrow keys (2% per press, hold Shift for 10%).</span>
        </div>
      ) : <p className="text-xs text-[var(--color-stone)]">Add an image above, then click it to set the focal point.</p>}
      {help && <p className="mt-1 text-xs text-[var(--color-stone)]">{help}</p>}
    </div>
  );
}

function FieldInput({ field: f, value, data, onChange }: { field: Field; value: unknown; data?: Data; onChange: (v: unknown) => void }) {
  if (f.type === 'focal') {
    const src = String((data?.[f.imageKey || 'image'] as string) || '');
    const pos = String(value || '50% 50%');
    return <FocalField label={f.label} help={f.help} src={src} pos={pos} onChange={onChange} />;
  }
  if (f.type === 'blocks') {
    return (
      <div>
        <label className={lbl}>{f.label}</label>
        <BlockEditor blocks={(Array.isArray(value) ? value : []) as Block[]} onChange={(b) => onChange(b)} />
      </div>
    );
  }

  if (f.type === 'image') {
    return <MediaField label={f.label} value={String(value || '')} onChange={onChange} />;
  }

  if (f.type === 'toggle') {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /> {f.label}
      </label>
    );
  }

  if (f.type === 'select') {
    return (
      <div>
        <label className={lbl}>{f.label}</label>
        <select className={fld} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
          {(f.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    );
  }

  if (f.type === 'textarea') {
    return (
      <div>
        <label className={lbl}>{f.label}</label>
        <textarea className={`${fld} min-h-[80px]`} value={String(value ?? '')} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />
        {f.help && <p className="mt-1 text-xs text-[var(--color-stone)]">{f.help}</p>}
      </div>
    );
  }

  if (f.type === 'list') {
    const items = (Array.isArray(value) ? value : []) as Data[];
    const setItem = (i: number, v: Data) => onChange(items.map((it, j) => (j === i ? v : it)));
    const blank = () => Object.fromEntries((f.itemFields || []).map((x) => [x.key, x.type === 'toggle' ? false : '']));
    return (
      <div>
        <label className={lbl}>{f.label}</label>
        <div className="space-y-3">
          {items.map((it, i) => (
            <div key={i} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bone)] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-[var(--color-stone)]">{(f.itemLabel || 'item')} {i + 1}</span>
                <span className="flex items-center gap-1">
                  <button onClick={() => onChange(move(items, i, -1))} aria-label="Up" className="text-[var(--color-stone)] hover:text-[var(--color-ink)]">▲</button>
                  <button onClick={() => onChange(move(items, i, 1))} aria-label="Down" className="text-[var(--color-stone)] hover:text-[var(--color-ink)]">▼</button>
                  <button onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Remove" className="ml-1 text-[var(--color-stone)] hover:text-[#c0392b]">✕</button>
                </span>
              </div>
              <div className="space-y-3">
                {(f.itemFields || []).map((sub) => (
                  <FieldInput key={sub.key} field={sub} value={it[sub.key]} onChange={(v) => setItem(i, { ...it, [sub.key]: v })} />
                ))}
              </div>
            </div>
          ))}
          <button onClick={() => onChange([...items, blank()])} className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-sm hover:border-[var(--color-gold)] hover:text-[var(--color-gold-deep)]">+ Add {f.itemLabel || 'item'}</button>
        </div>
      </div>
    );
  }

  // text | link
  return (
    <div>
      <label className={lbl}>{f.label}</label>
      <input className={fld} value={String(value ?? '')} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />
      {f.help && <p className="mt-1 text-xs text-[var(--color-stone)]">{f.help}</p>}
    </div>
  );
}
