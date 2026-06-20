'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// BLD-535: staff authoring for interactive exercises (hotspots / match / order).
export type Spot = { label: string; x: number; y: number; r: number };
export type Pair = { left: string; right: string };
export type ExConfig = { spots?: Spot[]; pairs?: Pair[]; items?: string[] };
export type AdminExercise = { id: string; courseId: string; title: string; type: string; instructions: string | null; imageUrl: string | null; config: ExConfig; order: number; active: boolean };

const TYPES = [{ key: 'HOTSPOT', label: 'Image hotspots' }, { key: 'MATCH', label: 'Match pairs' }, { key: 'ORDER', label: 'Order the steps' }];
const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-sm';
const label = 'block text-xs font-medium text-[var(--color-stone)]';
const btnDark = 'rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-xs font-medium text-[var(--color-porcelain)] disabled:opacity-50';
const btnGhost = 'rounded-full border border-[var(--color-line)] px-3 py-1 text-xs hover:border-[var(--color-gold)] disabled:opacity-40';

async function post(payload: object) { return fetch('/api/admin/exercises', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); }

export function ExercisesManager({ courseId, exercises }: { courseId: string; exercises: AdminExercise[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function act(payload: object) { setBusy(true); await post(payload); setBusy(false); router.refresh(); }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TYPES.map((t) => <button key={t.key} onClick={() => act({ op: 'create', courseId, type: t.key, title: `New ${t.label.toLowerCase()}` })} disabled={busy} className={btnDark}>+ {t.label}</button>)}
      </div>
      {exercises.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)] p-6 text-center text-sm text-[var(--color-stone)]">No exercises yet. Add an image-hotspot, match-pairs or order-the-steps exercise — trainees practise these in the portal’s <strong>Exercises</strong> tab.</p>
      ) : exercises.map((ex, i) => <ExerciseRow key={ex.id} ex={ex} busy={busy} act={act} canUp={i > 0} canDown={i < exercises.length - 1} onMove={(d) => { const ids = exercises.map((e) => e.id); const j = i + d; if (j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; act({ op: 'reorder', ids }); }} />)}
    </div>
  );
}

function ExerciseRow({ ex, busy, act, canUp, canDown, onMove }: { ex: AdminExercise; busy: boolean; act: (p: object) => Promise<void>; canUp: boolean; canDown: boolean; onMove: (d: number) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(ex.title);
  const [type, setType] = useState(ex.type);
  const [instructions, setInstructions] = useState(ex.instructions ?? '');
  const [imageUrl, setImageUrl] = useState(ex.imageUrl ?? '');
  const [active, setActive] = useState(ex.active);
  const [spots, setSpots] = useState<Spot[]>(ex.config.spots ?? []);
  const [pairs, setPairs] = useState<Pair[]>(ex.config.pairs ?? []);
  const [items, setItems] = useState<string[]>(ex.config.items ?? []);
  const [uploading, setUploading] = useState(false);

  function save() {
    const config: ExConfig = type === 'HOTSPOT' ? { spots } : type === 'MATCH' ? { pairs } : { items };
    act({ op: 'update', id: ex.id, title, type, instructions, imageUrl, active, config });
  }

  async function uploadImage(file: File) {
    setUploading(true);
    try { const { uploadBlob } = await import('@/lib/upload-client'); const url = await uploadBlob(file, { folder: 'academy/exercises', clientUploadUrl: '/api/admin/academy/blob-token' }); setImageUrl(url); }
    catch (e) { alert((e as Error)?.message || 'Upload failed.'); }
    setUploading(false);
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
      <div className="flex items-center gap-2 p-3">
        <button onClick={() => setOpen((v) => !v)} className="text-[var(--color-stone)]">{open ? '▾' : '▸'}</button>
        <span className="flex-1 text-sm font-medium">{ex.title} <span className="font-normal text-[var(--color-stone)]">· {TYPES.find((t) => t.key === ex.type)?.label ?? ex.type}{ex.active ? '' : ' · hidden'}</span></span>
        <button onClick={() => onMove(-1)} disabled={busy || !canUp} className={btnGhost}>↑</button>
        <button onClick={() => onMove(1)} disabled={busy || !canDown} className={btnGhost}>↓</button>
        <button onClick={() => { if (confirm('Delete this exercise? Trainee attempts on it are also removed.')) act({ op: 'delete', id: ex.id }); }} disabled={busy} className="text-xs text-[var(--color-blush)] hover:underline">Delete</button>
      </div>
      {open && (
        <div className="space-y-3 border-t border-[var(--color-line)] p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>Title<input className={`${field} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
            <label className={label}>Type<select className={`${field} mt-1`} value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select></label>
            <label className={`${label} sm:col-span-2`}>Instructions (optional)<input className={`${field} mt-1`} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="e.g. Click each structure on the diagram." /></label>
          </div>

          {type === 'HOTSPOT' && <HotspotEditor imageUrl={imageUrl} spots={spots} setSpots={setSpots} uploading={uploading} onUpload={uploadImage} onClearImage={() => setImageUrl('')} />}
          {type === 'MATCH' && <MatchEditor pairs={pairs} setPairs={setPairs} />}
          {type === 'ORDER' && <OrderEditor items={items} setItems={setItems} />}

          <div className="flex items-center gap-3">
            <button onClick={save} disabled={busy || uploading} className={btnDark}>Save exercise</button>
            <label className="flex items-center gap-2 text-xs text-[var(--color-stone)]"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Visible to trainees</label>
          </div>
        </div>
      )}
    </div>
  );
}

function HotspotEditor({ imageUrl, spots, setSpots, uploading, onUpload, onClearImage }: { imageUrl: string; spots: Spot[]; setSpots: (s: Spot[]) => void; uploading: boolean; onUpload: (f: File) => void; onClearImage: () => void }) {
  const imgRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  function addSpot(e: React.MouseEvent) {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    setSpots([...spots, { label: `Spot ${spots.length + 1}`, x, y, r: 8 }]);
  }
  const setSpot = (i: number, patch: Partial<Spot>) => setSpots(spots.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  return (
    <div className="space-y-2">
      <p className={label}>Background image</p>
      {!imageUrl ? (
        <div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.currentTarget.value = ''; }} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className={btnGhost}>{uploading ? 'Uploading…' : '+ Upload image'}</button>
        </div>
      ) : (
        <>
          <div ref={imgRef} onClick={addSpot} className="relative w-full max-w-xl cursor-crosshair overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-line)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" className="block w-full select-none" draggable={false} />
            {spots.map((s, i) => (
              <span key={i} style={{ left: `${s.x}%`, top: `${s.y}%`, width: `${s.r * 2}%`, paddingBottom: `${s.r * 2}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--color-gold-deep)] bg-[var(--color-gold)]/20" />
            ))}
          </div>
          <p className="text-xs text-[var(--color-stone)]">Click the image to add a target. Trainees must click within each target’s circle.</p>
          <button onClick={onClearImage} className="text-xs text-[var(--color-blush)] hover:underline">Change image</button>
          {spots.length > 0 && (
            <ul className="space-y-1.5">
              {spots.map((s, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-sm">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--color-ink)] text-[0.6rem] text-[var(--color-porcelain)]">{i + 1}</span>
                  <input className="flex-1 rounded border border-[var(--color-line)] px-2 py-1 text-xs" value={s.label} onChange={(e) => setSpot(i, { label: e.target.value })} placeholder="Label (what to find)" />
                  <label className="flex items-center gap-1 text-xs text-[var(--color-stone)]">size <input type="range" min={3} max={25} value={s.r} onChange={(e) => setSpot(i, { r: Number(e.target.value) })} /></label>
                  <button onClick={() => setSpots(spots.filter((_, j) => j !== i))} className="text-xs text-[var(--color-blush)] hover:underline">remove</button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function MatchEditor({ pairs, setPairs }: { pairs: Pair[]; setPairs: (p: Pair[]) => void }) {
  const setPair = (i: number, patch: Partial<Pair>) => setPairs(pairs.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return (
    <div className="space-y-2">
      <p className={label}>Pairs (each left item matches its right item)</p>
      <ul className="space-y-1.5">
        {pairs.map((p, i) => (
          <li key={i} className="flex items-center gap-2">
            <input className={field} value={p.left} onChange={(e) => setPair(i, { left: e.target.value })} placeholder="Left (e.g. term)" />
            <span className="text-[var(--color-stone)]">↔</span>
            <input className={field} value={p.right} onChange={(e) => setPair(i, { right: e.target.value })} placeholder="Right (e.g. definition)" />
            <button onClick={() => setPairs(pairs.filter((_, j) => j !== i))} className="shrink-0 text-xs text-[var(--color-blush)] hover:underline">×</button>
          </li>
        ))}
      </ul>
      <button onClick={() => setPairs([...pairs, { left: '', right: '' }])} className={btnGhost}>+ Add pair</button>
    </div>
  );
}

function OrderEditor({ items, setItems }: { items: string[]; setItems: (i: string[]) => void }) {
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= items.length) return; const b = [...items]; [b[i], b[j]] = [b[j], b[i]]; setItems(b); };
  return (
    <div className="space-y-2">
      <p className={label}>Steps, in the correct order (trainees see them shuffled)</p>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--color-ink)] text-[0.6rem] text-[var(--color-porcelain)]">{i + 1}</span>
            <input className={field} value={it} onChange={(e) => setItems(items.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Step ${i + 1}`} />
            <button onClick={() => move(i, -1)} disabled={i === 0} className={btnGhost}>↑</button>
            <button onClick={() => move(i, 1)} disabled={i === items.length - 1} className={btnGhost}>↓</button>
            <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="shrink-0 text-xs text-[var(--color-blush)] hover:underline">×</button>
          </li>
        ))}
      </ul>
      <button onClick={() => setItems([...items, ''])} className={btnGhost}>+ Add step</button>
    </div>
  );
}
