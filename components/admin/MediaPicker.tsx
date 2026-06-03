'use client';

import { useEffect, useRef, useState } from 'react';

export type Asset = { id: string; url: string; filename: string; alt: string | null; mime: string | null; size: number | null; folder: string | null; createdAt: string };

const fmtSize = (n: number | null) => (n ? (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`) : '');

// Shared grid: upload + browse + (optionally) pick or delete. Powers both the
// /admin/media library page and the in-context picker modal.
export function MediaGrid({ onPick, compact }: { onPick?: (asset: Asset) => void; compact?: boolean }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [needsStore, setNeedsStore] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/media');
    const data = await res.json().catch(() => ({}));
    setAssets(data.assets || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setErr(''); setNeedsStore(false);
    for (const file of Array.from(files)) {
      const fd = new FormData(); fd.append('file', file);
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

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => fileRef.current?.click()} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Uploading…' : 'Upload image'}</button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
        <span className="text-xs text-[var(--color-stone)]">PNG, JPG, WebP, SVG · up to 8 MB</span>
      </div>
      {err && <p className="mt-3 text-sm text-[#c0392b]">{err}</p>}
      {needsStore && (
        <p className="mt-2 rounded-[var(--radius-md)] border border-[color-mix(in_oklab,#d9a441_45%,transparent)] bg-[var(--color-bone)] p-3 text-sm">
          To enable uploads: in Vercel open <strong>Storage → Create Database → Blob</strong>, connect it to this project (adds <code>BLOB_READ_WRITE_TOKEN</code>), then redeploy.
        </p>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-[var(--color-stone)]">Loading…</p>
      ) : assets.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--color-stone)]">No images yet. Upload your first above.</p>
      ) : (
        <div className={`mt-5 grid gap-3 ${compact ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'}`}>
          {assets.map((a) => (
            <div key={a.id} className="group relative overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bone)]">
              <button
                type="button"
                onClick={() => onPick?.(a)}
                className={`block aspect-square w-full ${onPick ? 'cursor-pointer' : 'cursor-default'}`}
                title={onPick ? 'Use this image' : a.filename}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt={a.alt || a.filename} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
              </button>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-[linear-gradient(to_top,rgba(42,36,32,0.85),transparent)] p-2 opacity-0 transition-opacity group-hover:opacity-100">
                <span className="truncate text-[0.65rem] text-[var(--color-porcelain)]">{fmtSize(a.size)}</span>
                <span className="pointer-events-auto flex gap-1">
                  <button type="button" onClick={() => navigator.clipboard?.writeText(a.url)} title="Copy URL" className="rounded bg-white/15 px-1.5 py-0.5 text-[0.65rem] text-white hover:bg-white/30">Copy</button>
                  <button type="button" onClick={() => remove(a.id)} title="Delete" className="rounded bg-white/15 px-1.5 py-0.5 text-[0.65rem] text-white hover:bg-[#c0392b]">✕</button>
                </span>
              </div>
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
            : <span className="text-[0.6rem] text-[var(--color-stone-soft)]">None</span>}
        </div>
        <div className="flex-1">
          <input className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" value={value} placeholder="https://… or choose from library" onChange={(e) => onChange(e.target.value)} />
        </div>
        <button type="button" onClick={() => setOpen(true)} className="shrink-0 rounded-full border border-[var(--color-line)] px-4 py-2 text-sm hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]">Library</button>
        {value && <button type="button" onClick={() => onChange('')} className="shrink-0 text-sm text-[var(--color-stone-soft)] hover:text-[#c0392b]">Clear</button>}
      </div>

      {open && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-[var(--radius-xl)] bg-[var(--color-porcelain)] p-6 shadow-[var(--shadow-lift)]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-[family-name:var(--font-display)] text-xl">Media library</h3>
              <button onClick={() => setOpen(false)} className="text-[var(--color-stone)] hover:text-[var(--color-ink)]">✕</button>
            </div>
            <MediaGrid compact onPick={(a) => { onChange(a.url); setOpen(false); }} />
          </div>
        </div>
      )}
    </div>
  );
}
