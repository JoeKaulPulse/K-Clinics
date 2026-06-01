'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Item = { id: string; category: string; treatmentSlug: string | null; caption: string | null; published: boolean; consent: boolean; v: number };

const CATEGORIES = ['Veneers', 'Composite Bonding', 'Teeth Whitening', 'Clear Aligners', 'Braces', 'Dentures', 'Botox', 'Dermal Fillers', 'Lip Fillers', 'HydraGlow Facial', 'Carbon Laser Peel', 'Chemical Peel', 'Microneedling', 'PRP Therapy', 'Laser Hair Removal', 'IPL Phototherapy', 'Body Contouring', 'SMAS HIFU Lifting', 'RF Lifting', 'Anti-Cellulite'];
const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]';

// Downscale an image file to a JPEG data URL (max 1400px, quality ~0.82).
function downscale(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1400;
        let { width, height } = img;
        if (width > max || height > max) {
          const s = max / Math.max(width, height);
          width = Math.round(width * s); height = Math.round(height * s);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('no canvas'));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function post(payload: object) {
  const r = await fetch('/api/admin/gallery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return r.json().catch(() => ({ ok: false }));
}

export function GalleryManager({ items }: { items: Item[] }) {
  return (
    <div className="space-y-8">
      <UploadForm />
      <Cases items={items} />
    </div>
  );
}

function ImagePick({ label, value, onPick }: { label: string; value: string; onPick: (dataUrl: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <p className="mb-1.5 text-xs uppercase tracking-[0.14em] text-[var(--color-stone)]">{label}</p>
      <button type="button" onClick={() => ref.current?.click()} className="relative grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-[var(--radius-md)] border border-dashed border-[var(--color-line)] bg-[var(--color-bone)] text-sm text-[var(--color-stone)] hover:border-[var(--color-gold)]">
        {value
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={value} alt={label} className="h-full w-full object-cover" />
          : <span>{busy ? 'Processing…' : `+ Add ${label.toLowerCase()}`}</span>}
      </button>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={async (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        setBusy(true); try { onPick(await downscale(f)); } catch { alert('Could not read that image.'); } finally { setBusy(false); e.target.value = ''; }
      }} />
    </div>
  );
}

function UploadForm() {
  const router = useRouter();
  const [f, setF] = useState({ category: '', treatmentSlug: '', caption: '', before: '', after: '', consent: false });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  async function save() {
    if (!f.category.trim()) return alert('Choose a treatment category.');
    if (!f.before || !f.after) return alert('Add both a before and an after image.');
    setBusy(true);
    const r = await post({ op: 'create', category: f.category, treatmentSlug: f.treatmentSlug, caption: f.caption, consent: f.consent, beforeImage: f.before, afterImage: f.after });
    setBusy(false);
    if (r.ok) { setF({ category: '', treatmentSlug: '', caption: '', before: '', after: '', consent: false }); router.refresh(); }
    else alert(r.error || 'Could not save.');
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl">Add a case</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <ImagePick label="Before" value={f.before} onPick={(v) => set('before', v)} />
        <ImagePick label="After" value={f.after} onPick={(v) => set('after', v)} />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-xs text-[var(--color-stone)]">Treatment category *<br />
          <input list="gallery-cats" value={f.category} onChange={(e) => set('category', e.target.value)} className={`${field} mt-1`} placeholder="e.g. Veneers" />
          <datalist id="gallery-cats">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
        <label className="text-xs text-[var(--color-stone)]">Links to treatment (slug, optional)<br />
          <input value={f.treatmentSlug} onChange={(e) => set('treatmentSlug', e.target.value)} className={`${field} mt-1`} placeholder="e.g. veneers" />
        </label>
        <label className="text-xs text-[var(--color-stone)] sm:col-span-2">Caption (optional)<br />
          <input value={f.caption} onChange={(e) => set('caption', e.target.value)} className={`${field} mt-1`} placeholder="e.g. 6 sessions over 12 weeks" />
        </label>
      </div>
      <label className="mt-4 flex items-start gap-2.5 text-sm text-[var(--color-ink-soft)]">
        <input type="checkbox" checked={f.consent} onChange={(e) => set('consent', e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-gold)]" />
        <span>I confirm this is K Clinics’ own client and we hold their <strong>written consent</strong> to publish these photos. (Required before a case can go live.)</span>
      </label>
      <div className="mt-4">
        <button onClick={save} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm text-[var(--color-porcelain)] disabled:opacity-60">{busy ? 'Saving…' : 'Save case (hidden until published)'}</button>
      </div>
    </section>
  );
}

function Cases({ items }: { items: Item[] }) {
  if (items.length === 0) return <p className="text-sm text-[var(--color-stone-soft)]">No cases yet. Add your first above.</p>;
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl">Cases</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => <Case key={it.id} it={it} />)}
      </div>
    </section>
  );
}

function Case({ it }: { it: Item }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function act(payload: object) { setBusy(true); const r = await post(payload); setBusy(false); if (r.ok) router.refresh(); else alert(r.error || 'Failed.'); }
  return (
    <div className={`overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white ${it.published ? '' : 'opacity-95'}`}>
      <div className="grid grid-cols-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/gallery/${it.id}/before?v=${it.v}`} alt="Before" className="aspect-square w-full object-cover" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/gallery/${it.id}/after?v=${it.v}`} alt="After" className="aspect-square w-full object-cover" />
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">{it.category}</span>
          <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-wide ${it.published ? 'bg-emerald-100 text-emerald-800' : 'bg-[var(--color-bone)] text-[var(--color-stone)]'}`}>{it.published ? 'Live' : 'Hidden'}</span>
        </div>
        {it.caption && <p className="mt-1 text-xs text-[var(--color-stone)]">{it.caption}</p>}
        <p className="mt-1 text-[0.65rem] uppercase tracking-wide text-[var(--color-stone-soft)]">{it.consent ? '✓ Consent confirmed' : '⚠ No consent on file'}</p>
        <div className="mt-3 flex items-center justify-between gap-2 text-xs">
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={it.published} disabled={busy || !it.consent} onChange={(e) => act({ op: 'toggle', id: it.id, published: e.target.checked })} className="h-4 w-4 accent-[var(--color-gold)]" />
            Show on website
          </label>
          <button disabled={busy} onClick={() => { if (confirm('Delete this case?')) act({ op: 'remove', id: it.id }); }} className="text-[var(--color-blush)] hover:underline disabled:opacity-50">Delete</button>
        </div>
        {!it.consent && (
          <button disabled={busy} onClick={() => { if (confirm('Confirm you hold this client’s written consent to publish these photos?')) act({ op: 'update', id: it.id, consent: true }); }} className="mt-2 text-[0.65rem] font-medium text-[var(--color-gold)] hover:underline disabled:opacity-50">
            Confirm client consent →
          </button>
        )}
      </div>
    </div>
  );
}
