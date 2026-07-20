'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// BLD-535: staff authoring for interactive exercises (hotspots / match / order).
export type Spot = { label: string; x: number; y: number; r: number };
export type Pair = { left: string; right: string };
export type LabelPoint = { label: string; x: number; y: number };
export type TypeinTarget = { accepted: string[]; x: number; y: number };
export type ExConfig = { spots?: Spot[]; pairs?: Pair[]; items?: string[]; points?: LabelPoint[]; targets?: TypeinTarget[] };
export type AdminExercise = { id: string; courseId: string; title: string; type: string; instructions: string | null; imageUrl: string | null; config: ExConfig; order: number; active: boolean };

const TYPES = [{ key: 'HOTSPOT', label: 'Image hotspots' }, { key: 'MATCH', label: 'Match pairs' }, { key: 'ORDER', label: 'Order the steps' }, { key: 'LABEL', label: 'Label the diagram' }, { key: 'TYPEIN', label: 'Name on image (type)' }];
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
  const [points, setPoints] = useState<LabelPoint[]>(ex.config.points ?? []);
  const [targets, setTargets] = useState<TypeinTarget[]>(ex.config.targets ?? []);
  const [uploading, setUploading] = useState(false);

  function save() {
    const config: ExConfig = type === 'HOTSPOT' ? { spots } : type === 'MATCH' ? { pairs } : type === 'ORDER' ? { items } : type === 'LABEL' ? { points } : { targets };
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
        <button onClick={() => { if (confirm('Delete this exercise? Trainee attempts on it are also removed.')) act({ op: 'delete', id: ex.id }); }} disabled={busy} className="text-xs text-[var(--color-blush-deep)] hover:underline">Delete</button>
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
          {type === 'LABEL' && <PointEditor imageUrl={imageUrl} uploading={uploading} onUpload={uploadImage} onClearImage={() => setImageUrl('')} count={points.length} addAt={(x, y) => setPoints([...points, { label: `Point ${points.length + 1}`, x, y }])} markers={points.map((p) => ({ x: p.x, y: p.y }))}>
            {points.map((p, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-sm">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--color-ink)] text-[0.6rem] text-[var(--color-porcelain)]">{i + 1}</span>
                <input className="flex-1 rounded border border-[var(--color-line)] px-2 py-1 text-xs" value={p.label} onChange={(e) => setPoints(points.map((q, j) => (j === i ? { ...q, label: e.target.value } : q)))} placeholder="Correct label for this point" />
                <button onClick={() => setPoints(points.filter((_, j) => j !== i))} className="text-xs text-[var(--color-blush-deep)] hover:underline">remove</button>
              </li>
            ))}
          </PointEditor>}
          {type === 'TYPEIN' && <PointEditor imageUrl={imageUrl} uploading={uploading} onUpload={uploadImage} onClearImage={() => setImageUrl('')} count={targets.length} addAt={(x, y) => setTargets([...targets, { accepted: [''], x, y }])} markers={targets.map((t) => ({ x: t.x, y: t.y }))}>
            {targets.map((t, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-sm">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--color-ink)] text-[0.6rem] text-[var(--color-porcelain)]">{i + 1}</span>
                <input className="flex-1 rounded border border-[var(--color-line)] px-2 py-1 text-xs" value={t.accepted.join(', ')} onChange={(e) => setTargets(targets.map((q, j) => (j === i ? { ...q, accepted: e.target.value.split(',').map((s) => s.trim()) } : q)))} placeholder="Accepted answers, comma-separated" />
                <button onClick={() => setTargets(targets.filter((_, j) => j !== i))} className="text-xs text-[var(--color-blush-deep)] hover:underline">remove</button>
              </li>
            ))}
          </PointEditor>}

          <div className="flex items-center gap-3">
            <button onClick={save} disabled={busy || uploading} className={btnDark}>Save exercise</button>
            <label className="flex items-center gap-2 text-xs text-[var(--color-stone)]"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Visible to trainees</label>
          </div>
        </div>
      )}
    </div>
  );
}

const DIRS: Record<string, [number, number] | undefined> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

// ── Keyboard pin placement (BLD-905, WCAG 2.1.1) — mirrors the learner-side
// hook in components/academy/ExercisePlayer.tsx (duplicated: a shared module
// would touch files outside this pair). Arrow keys move a crosshair (2% steps,
// Shift = 10%) in the same %-of-image coordinate space the mouse path uses;
// Enter/Space places at the crosshair. role="application" so screen readers
// hand the arrow keys to us; a debounced aria-live region announces position.
// The crosshair (two-tone: white + ink, readable on any image) only renders on
// keyboard focus/use — mouse users see no change.
function useCrosshair({ disabled, label, hint, onPlace }: { disabled: boolean; label: string; hint: string; onPlace: (x: number, y: number) => string | void }) {
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const [showCross, setShowCross] = useState(false);
  const liveRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintId = useId();
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const say = (msg: string, now = false) => {
    if (timer.current) clearTimeout(timer.current);
    if (now) { if (liveRef.current) liveRef.current.textContent = msg; }
    else timer.current = setTimeout(() => { if (liveRef.current) liveRef.current.textContent = msg; }, 150);
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const d = DIRS[e.key];
    if (d) {
      e.preventDefault();
      setShowCross(true);
      const step = e.shiftKey ? 10 : 2;
      const next = { x: Math.min(100, Math.max(0, pos.x + d[0] * step)), y: Math.min(100, Math.max(0, pos.y + d[1] * step)) };
      setPos(next);
      say(`Crosshair at ${Math.round(next.x)}% across, ${Math.round(next.y)}% down`);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setShowCross(true);
      say(onPlace(pos.x, pos.y) || `Placed at ${Math.round(pos.x)}% across, ${Math.round(pos.y)}% down.`, true);
    }
  };
  const surfaceProps = {
    tabIndex: disabled ? -1 : 0,
    role: 'application' as const,
    'aria-label': label,
    'aria-describedby': hintId,
    onKeyDown,
    // :focus-visible = keyboard-derived focus; a plain mouse click focuses without showing the crosshair.
    onFocus: (e: React.FocusEvent<HTMLDivElement>) => setShowCross(e.currentTarget.matches(':focus-visible')),
    onBlur: () => setShowCross(false),
  };
  const overlay = (
    <>
      {showCross && !disabled && (
        <span aria-hidden style={{ left: `${pos.x}%`, top: `${pos.y}%` }} className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white ring-2 ring-[#2a2420]">
          <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-1 ring-[#2a2420]" />
        </span>
      )}
      <span ref={liveRef} aria-live="polite" className="sr-only" />
      <span id={hintId} className="sr-only">{hint}</span>
    </>
  );
  return { surfaceProps, overlay };
}

const surfaceFocus = 'outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold-deep)] focus-visible:ring-offset-2';

function HotspotEditor({ imageUrl, spots, setSpots, uploading, onUpload, onClearImage }: { imageUrl: string; spots: Spot[]; setSpots: (s: Spot[]) => void; uploading: boolean; onUpload: (f: File) => void; onClearImage: () => void }) {
  const imgRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  function addAt(x: number, y: number) {
    setSpots([...spots, { label: `Spot ${spots.length + 1}`, x, y, r: 8 }]);
    return `Target ${spots.length + 1} added at ${x}% across, ${y}% down.`;
  }
  function addSpot(e: React.MouseEvent) {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    addAt(Math.round(((e.clientX - rect.left) / rect.width) * 100), Math.round(((e.clientY - rect.top) / rect.height) * 100));
  }
  const kb = useCrosshair({ disabled: false, label: 'Exercise image. Add a target at the crosshair.', hint: 'Arrow keys move the crosshair 2% per press, hold Shift for 10%. Press Enter or Space to add a target at the crosshair.', onPlace: (x, y) => addAt(Math.round(x), Math.round(y)) });
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
          <div ref={imgRef} onClick={addSpot} {...kb.surfaceProps} className={`relative w-full max-w-xl cursor-crosshair overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-line)] ${surfaceFocus}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" className="block w-full select-none" draggable={false} />
            {spots.map((s, i) => (
              <span key={i} style={{ left: `${s.x}%`, top: `${s.y}%`, width: `${s.r * 2}%`, paddingBottom: `${s.r * 2}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--color-gold-deep)] bg-[var(--color-gold)]/20" />
            ))}
            {kb.overlay}
          </div>
          <p className="text-xs text-[var(--color-stone)]">Click the image to add a target (keyboard: focus the image, arrow keys move the crosshair, Enter adds). Trainees must click within each target’s circle.</p>
          <button onClick={onClearImage} className="text-xs text-[var(--color-blush-deep)] hover:underline">Change image</button>
          {spots.length > 0 && (
            <ul className="space-y-1.5">
              {spots.map((s, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-sm">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--color-ink)] text-[0.6rem] text-[var(--color-porcelain)]">{i + 1}</span>
                  <input className="flex-1 rounded border border-[var(--color-line)] px-2 py-1 text-xs" value={s.label} onChange={(e) => setSpot(i, { label: e.target.value })} placeholder="Label (what to find)" />
                  <label className="flex items-center gap-1 text-xs text-[var(--color-stone)]">size <input type="range" min={3} max={25} value={s.r} onChange={(e) => setSpot(i, { r: Number(e.target.value) })} /></label>
                  <button onClick={() => setSpots(spots.filter((_, j) => j !== i))} className="text-xs text-[var(--color-blush-deep)] hover:underline">remove</button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

// Generic image + click-to-add-marker editor, shared by LABEL and TYPEIN.
function PointEditor({ imageUrl, uploading, onUpload, onClearImage, count, addAt, markers, children }: { imageUrl: string; uploading: boolean; onUpload: (f: File) => void; onClearImage: () => void; count: number; addAt: (x: number, y: number) => void; markers: { x: number; y: number }[]; children: React.ReactNode }) {
  const imgRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  function add(e: React.MouseEvent) {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    addAt(Math.round(((e.clientX - rect.left) / rect.width) * 100), Math.round(((e.clientY - rect.top) / rect.height) * 100));
  }
  const kb = useCrosshair({ disabled: false, label: 'Diagram image. Add a marker at the crosshair.', hint: 'Arrow keys move the crosshair 2% per press, hold Shift for 10%. Press Enter or Space to add a marker at the crosshair.', onPlace: (x, y) => { addAt(Math.round(x), Math.round(y)); return `Marker ${count + 1} added at ${Math.round(x)}% across, ${Math.round(y)}% down.`; } });
  return (
    <div className="space-y-2">
      <p className={label}>Diagram image</p>
      {!imageUrl ? (
        <div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.currentTarget.value = ''; }} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className={btnGhost}>{uploading ? 'Uploading…' : '+ Upload image'}</button>
        </div>
      ) : (
        <>
          <div ref={imgRef} onClick={add} {...kb.surfaceProps} className={`relative w-full max-w-xl cursor-crosshair overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-line)] ${surfaceFocus}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" className="block w-full select-none" draggable={false} />
            {markers.map((m, i) => (
              <span key={i} style={{ left: `${m.x}%`, top: `${m.y}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 grid h-6 w-6 place-items-center rounded-full bg-[var(--color-ink)] text-[0.6rem] font-bold text-[var(--color-porcelain)]">{i + 1}</span>
            ))}
            {kb.overlay}
          </div>
          <p className="text-xs text-[var(--color-stone)]">Click the image to add a marker ({count} so far; keyboard: arrow keys move the crosshair, Enter adds). Number each marker’s answer below.</p>
          <button onClick={onClearImage} className="text-xs text-[var(--color-blush-deep)] hover:underline">Change image</button>
          {count > 0 && <ul className="space-y-1.5">{children}</ul>}
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
            <button onClick={() => setPairs(pairs.filter((_, j) => j !== i))} className="shrink-0 text-xs text-[var(--color-blush-deep)] hover:underline">×</button>
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
            <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="shrink-0 text-xs text-[var(--color-blush-deep)] hover:underline">×</button>
          </li>
        ))}
      </ul>
      <button onClick={() => setItems([...items, ''])} className={btnGhost}>+ Add step</button>
    </div>
  );
}
