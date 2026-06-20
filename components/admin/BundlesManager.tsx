'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// BLD-532: staff authoring for course bundles / pathways.
export type BundleItem = { id: string; courseId: string; courseTitle: string };
export type AdminBundle = { id: string; title: string; slug: string; summary: string | null; description: string | null; heroImage: string | null; pricePence: number | null; active: boolean; items: BundleItem[] };

const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-sm';
const label = 'block text-xs font-medium text-[var(--color-stone)]';
const btnDark = 'rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-xs font-medium text-[var(--color-porcelain)] disabled:opacity-50';
const btnGhost = 'text-xs text-[var(--color-stone)] hover:text-[var(--color-ink)] disabled:opacity-40';

async function post(payload: object) { return fetch('/api/admin/bundles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); }

export function BundlesManager({ bundles, courses }: { bundles: AdminBundle[]; courses: { id: string; title: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function act(payload: object) { setBusy(true); await post(payload); setBusy(false); router.refresh(); }

  return (
    <div className="space-y-5">
      <button onClick={() => act({ op: 'createBundle', title: 'New bundle' })} disabled={busy} className={btnDark}>+ New bundle</button>
      {bundles.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)] p-6 text-center text-sm text-[var(--color-stone)]">No bundles yet. Create one, add courses, and it appears on the public catalogue as a pathway.</p>
      ) : bundles.map((b) => <BundleRow key={b.id} bundle={b} courses={courses} busy={busy} act={act} />)}
    </div>
  );
}

function BundleRow({ bundle, courses, busy, act }: { bundle: AdminBundle; courses: { id: string; title: string }[]; busy: boolean; act: (p: object) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(bundle.title);
  const [slug, setSlug] = useState(bundle.slug);
  const [summary, setSummary] = useState(bundle.summary ?? '');
  const [description, setDescription] = useState(bundle.description ?? '');
  const [heroImage, setHeroImage] = useState(bundle.heroImage ?? '');
  const [pricePounds, setPricePounds] = useState(bundle.pricePence != null ? String(bundle.pricePence / 100) : '');
  const [active, setActive] = useState(bundle.active);
  const inBundle = new Set(bundle.items.map((i) => i.courseId));
  const addable = courses.filter((c) => !inBundle.has(c.id));

  function save() {
    act({ op: 'updateBundle', id: bundle.id, title, slug, summary, description, heroImage, active, pricePence: pricePounds === '' ? '' : Math.round(Number(pricePounds) * 100) });
  }
  const move = (i: number, d: number) => { const a = bundle.items.map((x) => x.id); const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; act({ op: 'reorderItems', ids: a }); };

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
      <div className="flex items-center gap-2 p-3">
        <button onClick={() => setOpen((v) => !v)} className="text-[var(--color-stone)]">{open ? '▾' : '▸'}</button>
        <span className="flex-1 text-sm font-medium">{bundle.title} <span className="text-[var(--color-stone)]">· {bundle.items.length} course{bundle.items.length === 1 ? '' : 's'}{active ? '' : ' · hidden'}</span></span>
        <button onClick={() => { if (confirm('Delete this bundle? (courses are not affected)')) act({ op: 'deleteBundle', id: bundle.id }); }} disabled={busy} className="text-xs text-[var(--color-blush)] hover:underline">Delete</button>
      </div>
      {open && (
        <div className="space-y-3 border-t border-[var(--color-line)] p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>Title<input className={`${field} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
            <label className={label}>URL slug<input className={`${field} mt-1`} value={slug} onChange={(e) => setSlug(e.target.value)} /></label>
            <label className={label}>Summary (one line)<input className={`${field} mt-1`} value={summary} onChange={(e) => setSummary(e.target.value)} /></label>
            <label className={label}>Combined price £ (optional)<input className={`${field} mt-1`} value={pricePounds} onChange={(e) => setPricePounds(e.target.value)} placeholder="e.g. 1995" /></label>
            <label className={`${label} sm:col-span-2`}>Description<textarea rows={3} className={`${field} mt-1`} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
            <label className={label}>Hero image URL (optional)<input className={`${field} mt-1`} value={heroImage} onChange={(e) => setHeroImage(e.target.value)} /></label>
            <label className="flex items-center gap-2 self-end text-xs text-[var(--color-stone)]"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Show on the public catalogue</label>
          </div>
          <button onClick={save} disabled={busy} className={btnDark}>Save bundle</button>

          <div>
            <p className={`${label} mb-1.5`}>Courses in this bundle</p>
            {bundle.items.length === 0 ? <p className="text-xs text-[var(--color-stone)]">None yet — add some below.</p> : (
              <ul className="space-y-1.5">
                {bundle.items.map((it, i) => (
                  <li key={it.id} className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm">
                    <span className="flex-1">{it.courseTitle}</span>
                    <button onClick={() => move(i, -1)} disabled={busy || i === 0} className={btnGhost}>↑</button>
                    <button onClick={() => move(i, 1)} disabled={busy || i === bundle.items.length - 1} className={btnGhost}>↓</button>
                    <button onClick={() => act({ op: 'removeItem', id: it.id })} disabled={busy} className="text-xs text-[var(--color-blush)] hover:underline">Remove</button>
                  </li>
                ))}
              </ul>
            )}
            {addable.length > 0 && (
              <select className={`${field} mt-2 w-auto`} value="" onChange={(e) => { if (e.target.value) act({ op: 'addCourse', bundleId: bundle.id, courseId: e.target.value }); }}>
                <option value="">+ Add a course…</option>
                {addable.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
