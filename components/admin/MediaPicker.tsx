'use client';

import { useEffect, useRef, useState } from 'react';

export type Asset = { id: string; url: string; filename: string; alt: string | null; mime: string | null; size: number | null; width?: number | null; height?: number | null; folder: string | null; createdAt: string };

const fmtSize = (n: number | null) => (n ? (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`) : '');
/** Read an image's natural dimensions client-side before upload. */
function readDims(file: File): Promise<{ w: number; h: number }> {
  return new Promise((res) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => { res({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { res({ w: 0, h: 0 }); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

// Shared grid: upload + browse + (optionally) pick or delete. Powers both the
// /admin/media library page and the in-context picker modal.
export function MediaGrid({ onPick, compact }: { onPick?: (asset: Asset) => void; compact?: boolean }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [needsStore, setNeedsStore] = useState(false);
  const [query, setQuery] = useState('');
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/media');
    const data = await res.json().catch(() => ({}));
    setAssets(data.assets || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  async function upload(files: FileList | File[] | null) {
    if (!files || !('length' in files) || !files.length) return;
    setBusy(true); setErr(''); setNeedsStore(false);
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      const fd = new FormData(); fd.append('file', file);
      const { w, h } = await readDims(file);
      if (w) { fd.append('width', String(w)); fd.append('height', String(h)); }
      const res = await fetch('/api/admin/media', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) { setErr(data.error || 'Upload failed.'); if (/Blob store|not connected/i.test(data.error || '')) setNeedsStore(true); break; }
      setAssets((a) => [data.asset, ...a]);
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  }
  async function remove(id: string) {
    if (!confirm('Delete this image? It will be removed everywhere it’s used.')) return;
    await fetch('/api/admin/media', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
    setAssets((a) => a.filter((x) => x.id !== id));
  }
  async function saveAlt(id: string, alt: string) {
    setAssets((a) => a.map((x) => (x.id === id ? { ...x, alt } : x)));
    await fetch('/api/admin/media', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, alt }) });
  }

  const shown = query.trim() ? assets.filter((a) => (a.filename + ' ' + (a.alt || '')).toLowerCase().includes(query.toLowerCase())) : assets;

  return (
    <div>
      {/* Drag-and-drop upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
        className={`cursor-pointer rounded-[var(--radius-lg)] border-2 border-dashed p-6 text-center transition-colors ${drag ? 'border-[var(--color-gold)] bg-[var(--color-bone)]' : 'border-[var(--color-line)] hover:border-[var(--color-gold)]'}`}
      >
        <p className="text-sm font-medium">{busy ? 'Uploading…' : 'Drop images here, or click to upload'}</p>
        <p className="mt-1 text-xs text-[var(--color-stone)]">PNG, JPG, WebP, SVG · up to 8 MB each</p>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
      </div>
      {err && <p role="alert" aria-live="assertive" className="mt-3 text-sm text-[#c0392b]">{err}</p>}
      {needsStore && (
        <p className="mt-2 rounded-[var(--radius-md)] border border-[color-mix(in_oklab,#d9a441_45%,transparent)] bg-[var(--color-bone)] p-3 text-sm">
          To enable uploads: in Vercel open <strong>Storage → Create Database → Blob</strong>, connect it to this project (adds <code>BLOB_READ_WRITE_TOKEN</code>), then redeploy.
        </p>
      )}

      {assets.length > 0 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search images…" className="w-56 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-gold)]" />
          <span className="text-xs text-[var(--color-stone)]">{shown.length} of {assets.length}</span>
        </div>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-[var(--color-stone)]">Loading…</p>
      ) : assets.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--color-stone)]">No images yet.</p>
      ) : (
        <div className={`mt-4 grid gap-3 ${compact ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'}`}>
          {shown.map((a) => (
            <div key={a.id} className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
              <div className="group relative bg-[var(--color-bone)]">
                <button type="button" onClick={() => onPick?.(a)} className={`block aspect-square w-full ${onPick ? 'cursor-pointer' : 'cursor-default'}`} title={onPick ? 'Use this image' : a.filename}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.url} alt={a.alt || a.filename} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                </button>
                <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-end gap-1 p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button type="button" onClick={() => navigator.clipboard?.writeText(a.url)} title="Copy URL" className="pointer-events-auto rounded bg-black/45 px-1.5 py-0.5 text-[0.65rem] text-white hover:bg-black/70">Copy</button>
                  <button type="button" onClick={() => remove(a.id)} title="Delete" className="pointer-events-auto rounded bg-black/45 px-1.5 py-0.5 text-[0.65rem] text-white hover:bg-[#c0392b]">✕</button>
                </div>
              </div>
              {!compact && (
                <div className="p-2">
                  <input
                    defaultValue={a.alt || ''} placeholder="Alt text…" aria-label="Alt text"
                    onBlur={(e) => { if (e.target.value !== (a.alt || '')) saveAlt(a.id, e.target.value); }}
                    className="w-full rounded-[var(--radius-sm)] border border-transparent bg-[var(--color-bone)] px-2 py-1 text-xs outline-none focus:border-[var(--color-gold)]"
                  />
                  <p className="mt-1 truncate text-[0.65rem] text-[var(--color-stone)]">{fmtSize(a.size)}{a.width ? ` · ${a.width}×${a.height}` : ''}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// A form field: shows the current image with a "Choose" button opening a modal.
export function MediaField({ value, onChange, label }: { value: string; onChange: (url: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      {label && <label className="block text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-stone)] mb-1.5">{label}</label>}
      <div className="flex items-center gap-3">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bone)]">
          {value
            ? // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
            : <span className="text-[0.6rem] text-[var(--color-stone)]">None</span>}
        </div>
        <div className="flex-1">
          <input className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" value={value} placeholder="https://… or choose from library" onChange={(e) => onChange(e.target.value)} />
        </div>
        <button type="button" onClick={() => setOpen(true)} className="shrink-0 rounded-full border border-[var(--color-line)] px-4 py-2 text-sm hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]">Library</button>
        {value && <button type="button" onClick={() => onChange('')} className="shrink-0 text-sm text-[var(--color-stone)] hover:text-[#c0392b]">Clear</button>}
      </div>

      {open && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-[var(--radius-xl)] bg-[var(--color-porcelain)] p-6 shadow-[var(--shadow-lift)]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-[family-name:var(--font-display)] text-xl">Media library</h3>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-[var(--color-stone)] hover:text-[var(--color-ink)]"><span aria-hidden="true">✕</span></button>
            </div>
            <MediaGrid compact onPick={(a) => { onChange(a.url); setOpen(false); }} />
          </div>
        </div>
      )}
    </div>
  );
}
