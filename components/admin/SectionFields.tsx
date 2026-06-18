'use client';

import type { Field } from '@/lib/sections';
import type { Block } from '@/lib/blocks';
import { BlockEditor } from '@/components/admin/BlockEditor';
import { MediaField } from '@/components/admin/MediaPicker';

const fld = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]';
const lbl = 'block text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-stone)] mb-1.5';

type Data = Record<string, unknown>;
const move = <T,>(a: T[], i: number, d: number): T[] => { const j = i + d; if (j < 0 || j >= a.length) return a; const n = [...a]; [n[i], n[j]] = [n[j], n[i]]; return n; };

/** Render a section's fields from its schema, editing a flat data object. */
export function SectionFields({ fields, data, onChange }: { fields: Field[]; data: Data; onChange: (data: Data) => void }) {
  const set = (key: string, value: unknown) => onChange({ ...data, [key]: value });
  return (
    <div className="space-y-4">
      {fields.map((f) => <FieldInput key={f.key} field={f} value={data[f.key]} data={data} onChange={(v) => set(f.key, v)} />)}
    </div>
  );
}

function FieldInput({ field: f, value, data, onChange }: { field: Field; value: unknown; data?: Data; onChange: (v: unknown) => void }) {
  if (f.type === 'focal') {
    const src = String((data?.[f.imageKey || 'image'] as string) || '');
    const pos = String(value || '50% 50%');
    const [x, y] = pos.split(' ');
    return (
      <div>
        <label className={lbl}>{f.label}</label>
        {src ? (
          <div
            className="relative cursor-crosshair overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-line)]"
            onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); const px = Math.round(((e.clientX - r.left) / r.width) * 100); const py = Math.round(((e.clientY - r.top) / r.height) * 100); onChange(`${px}% ${py}%`); }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="block max-h-52 w-full object-cover" style={{ objectPosition: pos }} />
            <span className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[var(--color-gold)] shadow" style={{ left: x, top: y }} />
          </div>
        ) : <p className="text-xs text-[var(--color-stone)]">Add an image above, then click it to set the focal point.</p>}
        {f.help && <p className="mt-1 text-xs text-[var(--color-stone)]">{f.help}</p>}
      </div>
    );
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
          <button onClick={() => onChange([...items, blank()])} className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-sm hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]">+ Add {f.itemLabel || 'item'}</button>
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
