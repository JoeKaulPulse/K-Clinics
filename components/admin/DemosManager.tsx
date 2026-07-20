'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// BLD-539: staff authoring for "spot the mistake" demo videos.
export type DemoMistake = { id: string; atSec: number; windowSec: number; label: string };
export type AdminDemo = { id: string; courseId: string | null; title: string; description: string | null; videoUrl: string; durationSec: number | null; order: number; active: boolean; mistakes: DemoMistake[] };

const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-sm';
const label = 'block text-xs font-medium text-[var(--color-stone)]';
const btnDark = 'rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-xs font-medium text-[var(--color-porcelain)] disabled:opacity-50';
const btnGhost = 'rounded-full border border-[var(--color-line)] px-3 py-1 text-xs hover:border-[var(--color-gold)] disabled:opacity-40';
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

async function post(p: object) { return fetch('/api/admin/demos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) }); }

export function DemosManager({ courseId, demos }: { courseId: string; demos: AdminDemo[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pct, setPct] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  async function act(p: object) { setBusy(true); await post(p); setBusy(false); router.refresh(); }

  async function addDemo(file: File) {
    setUploading(true); setPct(0);
    try {
      const { upload } = await import('@vercel/blob/client');
      const safe = (file.name || 'demo').replace(/[^A-Za-z0-9._-]+/g, '-').slice(-100);
      const blob = await upload(`academy/demos/${Date.now()}-${safe}`, file, { access: 'public', handleUploadUrl: '/api/admin/academy/blob-token', onUploadProgress: (p) => setPct(Math.round(p.percentage)) });
      await post({ op: 'createDemo', courseId, title: file.name.replace(/\.[^.]+$/, '') || 'New demo', videoUrl: blob.url });
      router.refresh();
    } catch (e) { alert((e as Error)?.message || 'Upload failed.'); }
    setUploading(false);
  }

  return (
    <div className="space-y-4">
      <div>
        <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) addDemo(f); e.currentTarget.value = ''; }} />
        <button onClick={() => fileRef.current?.click()} disabled={uploading} className={btnDark}>{uploading ? `Uploading ${pct}%` : '+ Upload demo video'}</button>
      </div>
      {demos.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)] p-6 text-center text-sm text-[var(--color-stone)]">No demos yet. Upload a walkthrough video, then scrub to each mistake and mark it. Trainees play it in the portal’s <strong>Exercises</strong> tab and press space to spot mistakes.</p>
      ) : demos.map((d, i) => <DemoRow key={d.id} demo={d} busy={busy} act={act} canUp={i > 0} canDown={i < demos.length - 1} onMove={(dir) => { const ids = demos.map((x) => x.id); const j = i + dir; if (j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; act({ op: 'reorderDemos', ids }); }} />)}
    </div>
  );
}

function DemoRow({ demo, busy, act, canUp, canDown, onMove }: { demo: AdminDemo; busy: boolean; act: (p: object) => Promise<void>; canUp: boolean; canDown: boolean; onMove: (d: number) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(demo.title);
  const [description, setDescription] = useState(demo.description ?? '');
  const [active, setActive] = useState(demo.active);
  const videoRef = useRef<HTMLVideoElement>(null);

  async function markHere() {
    const v = videoRef.current; if (!v) return;
    const lbl = prompt('What is wrong at this moment? (shown to the trainee after they score)');
    if (!lbl?.trim()) return;
    await act({ op: 'addMistake', videoId: demo.id, atSec: Math.round(v.currentTime * 100) / 100, label: lbl.trim(), windowSec: 3 });
  }

  return (
    <div className={`rounded-[var(--radius-md)] border bg-[var(--color-porcelain)] ${demo.active ? 'border-[var(--color-line)]' : 'border-dashed border-[var(--color-line)] opacity-70'}`}>
      <div className="flex items-center gap-2 p-3">
        <button onClick={() => setOpen((v) => !v)} className="text-[var(--color-stone)]">{open ? '▾' : '▸'}</button>
        <span className="flex-1 text-sm font-medium">{demo.title} <span className="font-normal text-[var(--color-stone)]">· {demo.mistakes.length} mistake{demo.mistakes.length === 1 ? '' : 's'}{demo.active ? '' : ' · hidden'}</span></span>
        <button onClick={() => onMove(-1)} disabled={busy || !canUp} className={btnGhost}>↑</button>
        <button onClick={() => onMove(1)} disabled={busy || !canDown} className={btnGhost}>↓</button>
        <button onClick={() => { if (confirm('Delete this demo and its mistakes? (the video file is not removed)')) act({ op: 'deleteDemo', id: demo.id }); }} disabled={busy} className="text-xs text-[var(--color-blush-deep)] hover:underline">Delete</button>
      </div>
      {open && (
        <div className="space-y-3 border-t border-[var(--color-line)] p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>Title<input className={`${field} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
            <label className="flex items-center gap-2 self-end text-xs text-[var(--color-stone)]"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Visible to trainees</label>
            <label className={`${label} sm:col-span-2`}>Description (optional)<input className={`${field} mt-1`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What should they watch for?" /></label>
          </div>
          <button onClick={() => act({ op: 'updateDemo', id: demo.id, title, description, active })} disabled={busy} className={btnDark}>Save details</button>

          <div>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} src={demo.videoUrl} controls className="w-full max-w-xl rounded-[var(--radius-sm)] border border-[var(--color-line)]" />
            <div className="mt-2"><button onClick={markHere} disabled={busy} className={btnDark}>＋ Mark mistake at current time</button></div>
            <p className="mt-1 text-xs text-[var(--color-stone)]">Scrub the video to the moment a mistake happens, then mark it. Trainees must press space within the window around that time.</p>
          </div>

          {demo.mistakes.length > 0 && (
            <ul className="space-y-1.5">
              {demo.mistakes.map((m) => <MistakeRow key={m.id} m={m} busy={busy} act={act} seek={(t) => { const v = videoRef.current; if (v) { v.currentTime = t; } }} />)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function MistakeRow({ m, busy, act, seek }: { m: DemoMistake; busy: boolean; act: (p: object) => Promise<void>; seek: (t: number) => void }) {
  const [labelText, setLabelText] = useState(m.label);
  const [windowSec, setWindowSec] = useState(String(m.windowSec));
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-sm">
      <button onClick={() => seek(m.atSec)} className="font-mono text-xs text-[var(--color-gold)] hover:underline">{mmss(m.atSec)}</button>
      <input className="flex-1 rounded border border-[var(--color-line)] px-2 py-1 text-xs" value={labelText} onChange={(e) => setLabelText(e.target.value)} />
      <label className="flex items-center gap-1 text-xs text-[var(--color-stone)]">±s<input className="w-14 rounded border border-[var(--color-line)] px-1.5 py-1 text-xs" value={windowSec} onChange={(e) => setWindowSec(e.target.value)} /></label>
      <button onClick={() => act({ op: 'updateMistake', id: m.id, atSec: m.atSec, windowSec: Number(windowSec) || 3, label: labelText })} disabled={busy} className={btnGhost}>Save</button>
      <button onClick={() => act({ op: 'deleteMistake', id: m.id })} disabled={busy} className="text-xs text-[var(--color-blush-deep)] hover:underline">×</button>
    </li>
  );
}
