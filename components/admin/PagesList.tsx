'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SITE_PAGE_GROUPS } from '@/lib/site-pages';

type PageRow = { id: string; path: string; title: string | null; status: string; updatedAt: string };

export function PagesList({ pages }: { pages: PageRow[] }) {
  const router = useRouter();
  const [path, setPath] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const byPath = new Map(pages.map((p) => [p.path, p]));
  const knownPaths = new Set(SITE_PAGE_GROUPS.flatMap((g) => g.items.map((i) => i.path)));
  const customPages = pages.filter((p) => !knownPaths.has(p.path));

  async function create(p: string) {
    const clean = '/' + p.trim().toLowerCase().replace(/[^a-z0-9/_-]/g, '').replace(/^\/+|\/+$/g, '');
    if (!clean || clean === '/') { setErr('Enter a path like /about.'); return; }
    setBusy(clean); setErr('');
    const res = await fetch('/api/admin/pages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'create', path: clean, sections: [] }) });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (data.id) { router.push(`/admin/pages/${data.id}`); return; }
    setErr(data.error || 'Could not create.');
  }

  const StatusBadge = ({ status }: { status: string }) => (
    <span className={`rounded-full px-2.5 py-0.5 text-xs ${status === 'PUBLISHED' ? 'bg-[color-mix(in_oklab,var(--color-jade)_22%,transparent)]' : 'bg-[var(--color-bone)] text-[var(--color-stone)]'}`}>{status === 'PUBLISHED' ? 'Published' : 'Draft'}</span>
  );
  const rowCls = 'flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] px-5 py-3.5 last:border-0';

  return (
    <div className="pb-16">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Pages</h1>
        <p className="mt-1 text-sm text-[var(--color-stone)]">Every page on the site. Edit content in the page builder, jump to a page’s dedicated editor, or create a brand-new page.</p>
      </div>

      {/* Your custom pages (created, not part of the standard site map) */}
      {customPages.length > 0 && (
        <Section title="Your pages" hint="Custom pages you’ve created.">
          {customPages.map((p) => (
            <Link key={p.id} href={`/admin/pages/${p.id}`} className={`${rowCls} hover:bg-[var(--color-bone)]`}>
              <span className="font-medium">{p.path}{p.title && <span className="ml-2 font-normal text-[var(--color-stone)]">{p.title}</span>}</span>
              <StatusBadge status={p.status} />
            </Link>
          ))}
        </Section>
      )}

      {/* The full site directory */}
      {SITE_PAGE_GROUPS.map((g) => (
        <Section key={g.group} title={g.group} hint={g.hint}>
          {g.items.map((item) => {
            const existing = byPath.get(item.path);
            return (
              <div key={item.path} className={rowCls}>
                <span>
                  <span className="font-medium">{item.label}</span>
                  <span className="ml-2 text-sm text-[var(--color-stone-soft)]">{item.path}</span>
                </span>
                <span className="flex items-center gap-3">
                  {item.manage === 'builder' && existing && <StatusBadge status={existing.status} />}
                  {item.manage === 'builder' && !existing && <span className="text-xs text-[var(--color-stone-soft)]">Built-in</span>}
                  {item.manage === 'builder' ? (
                    existing
                      ? <Link href={`/admin/pages/${existing.id}`} className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-sm hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]">Edit</Link>
                      : <button disabled={!!busy} onClick={() => create(item.path)} className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy === item.path ? 'Opening…' : 'Customise'}</button>
                  ) : item.manage === 'catalogue' ? (
                    <Link href={item.adminHref!} className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-sm hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]">Open editor →</Link>
                  ) : (
                    <span className="text-xs text-[var(--color-stone-soft)]">Built-in</span>
                  )}
                </span>
              </div>
            );
          })}
        </Section>
      ))}

      {/* Create a brand-new page */}
      <Section title="New page" hint="Create a page at a new path, built from sections.">
        <div className="px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[var(--color-stone)]">kclinics.co.uk</span>
            <input className="w-56 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" value={path} placeholder="/new-page" onChange={(e) => setPath(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create(path)} />
            <button disabled={!!busy} onClick={() => create(path)} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-50">Create</button>
          </div>
          {err && <p className="mt-2 text-sm text-[#c0392b]">{err}</p>}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-[family-name:var(--font-display)] text-lg">{title}</h2>
      {hint && <p className="mb-3 mt-0.5 text-sm text-[var(--color-stone)]">{hint}</p>}
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">{children}</div>
    </section>
  );
}
