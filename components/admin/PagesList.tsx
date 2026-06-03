'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type PageRow = { id: string; path: string; title: string | null; status: string; updatedAt: string };
// Editorial routes that can be taken over by the builder (catalogues excluded).
const SUGGESTED = ['/about', '/contact', '/careers', '/finance', '/membership', '/clinics', '/gift-vouchers', '/refer-a-friend'];

export function PagesList({ pages }: { pages: PageRow[] }) {
  const router = useRouter();
  const [path, setPath] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const taken = new Set(pages.map((p) => p.path));

  async function create(p: string) {
    const clean = '/' + p.trim().toLowerCase().replace(/[^a-z0-9/_-]/g, '').replace(/^\/+|\/+$/g, '');
    if (!clean || clean === '/') { setErr('Enter a path like /about.'); return; }
    setBusy(true); setErr('');
    const res = await fetch('/api/admin/pages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'create', path: clean, sections: [] }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (data.id) { router.push(`/admin/pages/${data.id}`); return; }
    setErr(data.error || 'Could not create.');
  }

  const row = 'grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-[var(--color-line)] px-5 py-3 last:border-0';

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">Pages</h1>
          <p className="mt-1 text-sm text-[var(--color-stone)]">Build pages from modular sections. A published page overrides that route; unpublished routes show their built-in design.</p>
        </div>
      </div>

      {/* Create */}
      <div className="mt-6 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
        <p className="text-sm font-medium">Create a page</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[var(--color-stone)]">kclinics.co.uk</span>
          <input className="w-56 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" value={path} placeholder="/new-page" onChange={(e) => setPath(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create(path)} />
          <button disabled={busy} onClick={() => create(path)} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-50">Create</button>
        </div>
        {err && <p className="mt-2 text-sm text-[#c0392b]">{err}</p>}
        <div className="mt-4">
          <p className="mb-2 text-xs uppercase tracking-[0.12em] text-[var(--color-stone)]">Or take over an existing page</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED.filter((p) => !taken.has(p)).map((p) => (
              <button key={p} disabled={busy} onClick={() => create(p)} className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-sm hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] disabled:opacity-50">{p}</button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="mt-6 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
        {pages.length === 0 ? <p className="p-6 text-sm text-[var(--color-stone)]">No pages yet.</p> : pages.map((p) => (
          <Link key={p.id} href={`/admin/pages/${p.id}`} className={`${row} hover:bg-[var(--color-bone)]`}>
            <span><span className="font-medium">{p.path}</span>{p.title && <span className="ml-2 text-sm text-[var(--color-stone)]">{p.title}</span>}</span>
            <span className="text-xs text-[var(--color-stone-soft)]">{new Date(p.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
            <span className={`rounded-full px-3 py-1 text-xs ${p.status === 'PUBLISHED' ? 'bg-[color-mix(in_oklab,var(--color-jade)_22%,transparent)]' : 'bg-[var(--color-bone)] text-[var(--color-stone)]'}`}>{p.status === 'PUBLISHED' ? 'Published' : 'Draft'}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
