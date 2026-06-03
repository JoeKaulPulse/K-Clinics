'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SECTION_DEFS, sectionDef, newSection, type Section } from '@/lib/sections';
import { SectionFields } from '@/components/admin/SectionFields';

type Revision = { id: string; label: string | null; createdAt: string; createdBy: string | null };
type Initial = { id: string; path: string; title: string; status: 'DRAFT' | 'PUBLISHED'; draft: Section[]; hasPublished: boolean };

const card = 'rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]';

export function PageBuilder({ initial, revisions, seed }: { initial: Initial; revisions: Revision[]; seed?: Section[] | null }) {
  const router = useRouter();
  const [sections, setSections] = useState<Section[]>(initial.draft);
  const [title, setTitle] = useState(initial.title);
  const [openId, setOpenId] = useState<string | null>(initial.draft[0]?.id ?? null);
  const [adderAt, setAdderAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [status, setStatus] = useState(initial.status);
  const [hasPublished, setHasPublished] = useState(initial.hasPublished);

  const update = (id: string, data: Record<string, unknown>) => setSections((s) => s.map((x) => (x.id === id ? { ...x, data } : x)));
  const remove = (id: string) => setSections((s) => s.filter((x) => x.id !== id));
  const moveSec = (i: number, d: -1 | 1) => setSections((s) => { const j = i + d; if (j < 0 || j >= s.length) return s; const n = [...s]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const insert = (at: number, type: string) => { const sec = newSection(type); setSections((s) => { const n = [...s]; n.splice(at, 0, sec); return n; }); setOpenId(sec.id); setAdderAt(null); };

  async function call(op: string, extra: Record<string, unknown> = {}) {
    setBusy(true); setMsg(null);
    const res = await fetch('/api/admin/pages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op, id: initial.id, sections, title, ...extra }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !data.ok) { setMsg({ kind: 'err', text: data.error || 'Failed.' }); return false; }
    return true;
  }
  const saveDraft = async () => { if (await call('saveDraft')) { setMsg({ kind: 'ok', text: 'Draft saved.' }); router.refresh(); } };
  const publish = async () => { if (await call('publish')) { setStatus('PUBLISHED'); setHasPublished(true); setMsg({ kind: 'ok', text: 'Published — live now.' }); router.refresh(); } };
  const unpublish = async () => { if (confirm('Unpublish? The route will fall back to its built-in version.') && await call('unpublish')) { setStatus('DRAFT'); setHasPublished(false); setMsg({ kind: 'ok', text: 'Unpublished.' }); router.refresh(); } };
  const rollback = async (revisionId: string) => { if (confirm('Restore this version and publish it?') && await call('rollback', { revisionId })) { setStatus('PUBLISHED'); router.refresh(); } };
  const del = async () => { if (confirm('Delete this page entirely?') && await call('delete')) router.push('/admin/pages'); };
  const preview = async () => { await call('saveDraft'); window.open(`/preview/${initial.id}`, '_blank'); };

  return (
    <div className="pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <a href="/admin/pages" className="text-sm text-[var(--color-gold)] hover:underline">← Pages</a>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">{initial.path}</h1>
          <p className="mt-1 text-sm text-[var(--color-stone)]">{status === 'PUBLISHED' ? 'Published — live on the site' : hasPublished ? 'Draft changes (a published version exists)' : 'Draft — not live yet'}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_19rem]">
        {/* Canvas */}
        <div className="space-y-3">
          <Adder open={adderAt === 0} onToggle={() => setAdderAt(adderAt === 0 ? null : 0)} onPick={(t) => insert(0, t)} />
          {sections.map((sec, i) => {
            const def = sectionDef(sec.type);
            const open = openId === sec.id;
            return (
              <div key={sec.id}>
                <div className={card}>
                  <div className="flex items-center gap-2 px-4 py-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-[var(--color-bone)] text-sm text-[var(--color-stone)]">{def?.glyph ?? '▢'}</span>
                    <button onClick={() => setOpenId(open ? null : sec.id)} className="flex-1 text-left">
                      <span className="font-medium">{def?.label ?? sec.type}</span>
                      <span className="ml-2 text-sm text-[var(--color-stone-soft)]">{sectionSummary(sec)}</span>
                    </button>
                    <span className="flex items-center gap-1 text-[var(--color-stone-soft)]">
                      <button onClick={() => moveSec(i, -1)} aria-label="Up" className="hover:text-[var(--color-ink)]">▲</button>
                      <button onClick={() => moveSec(i, 1)} aria-label="Down" className="hover:text-[var(--color-ink)]">▼</button>
                      <button onClick={() => remove(sec.id)} aria-label="Delete" className="ml-1 hover:text-[#c0392b]">✕</button>
                      <button onClick={() => setOpenId(open ? null : sec.id)} aria-label="Edit" className="ml-1 hover:text-[var(--color-ink)]">{open ? '▾' : '▸'}</button>
                    </span>
                  </div>
                  {open && def && (
                    <div className="border-t border-[var(--color-line)] p-4">
                      <SectionFields fields={def.fields} data={sec.data} onChange={(d) => update(sec.id, d)} />
                    </div>
                  )}
                </div>
                <Adder open={adderAt === i + 1} onToggle={() => setAdderAt(adderAt === i + 1 ? null : i + 1)} onPick={(t) => insert(i + 1, t)} />
              </div>
            );
          })}
          {sections.length === 0 && (
            <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)] p-10 text-center">
              <p className="text-sm text-[var(--color-stone)]">This page is empty.</p>
              {seed && seed.length > 0 && (
                <button onClick={() => { setSections(seed); setOpenId(seed[0]?.id ?? null); }} className="mt-4 rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm text-[var(--color-porcelain)]">
                  Start from the current page content
                </button>
              )}
              <p className="mt-3 text-xs text-[var(--color-stone-soft)]">{seed && seed.length > 0 ? 'Loads this page’s existing content as editable sections, or use “＋ Section” above.' : 'Use “＋ Section” above to add your first section.'}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className={`${card} p-4`}>
            <label className="block text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-stone)] mb-1.5">Admin label</label>
            <input className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" value={title} placeholder={initial.path} onChange={(e) => setTitle(e.target.value)} />
            <div className="mt-4 grid gap-2">
              <button disabled={busy} onClick={saveDraft} className="rounded-full border border-[var(--color-line)] px-4 py-2.5 text-sm hover:border-[var(--color-gold)] disabled:opacity-50">Save draft</button>
              <button disabled={busy} onClick={preview} className="rounded-full border border-[var(--color-line)] px-4 py-2.5 text-sm hover:border-[var(--color-gold)] disabled:opacity-50">Preview ↗</button>
              <button disabled={busy} onClick={publish} className="rounded-full bg-[var(--color-ink)] px-4 py-2.5 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Working…' : 'Publish'}</button>
              {hasPublished && <button disabled={busy} onClick={unpublish} className="text-sm text-[var(--color-stone)] hover:text-[#c0392b] disabled:opacity-50">Unpublish</button>}
            </div>
            {msg && <p className={`mt-3 text-sm ${msg.kind === 'ok' ? 'text-[var(--color-jade)]' : 'text-[#c0392b]'}`}>{msg.text}</p>}
          </div>

          <div className={`${card} p-4`}>
            <h3 className="mb-3 text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-stone)]">Version history</h3>
            {revisions.length === 0 ? <p className="text-sm text-[var(--color-stone-soft)]">Publishing creates restore points.</p> : (
              <ul className="space-y-2">
                {revisions.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 border-b border-[var(--color-line)] pb-2 text-sm last:border-0">
                    <span className="text-xs">{new Date(r.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    <button disabled={busy} onClick={() => rollback(r.id)} className="shrink-0 rounded-full border border-[var(--color-line)] px-3 py-1 text-xs hover:border-[var(--color-gold)] disabled:opacity-50">Restore</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button onClick={del} className="text-sm text-[var(--color-stone-soft)] hover:text-[#c0392b]">Delete page</button>
        </aside>
      </div>
    </div>
  );
}

function Adder({ open, onToggle, onPick }: { open: boolean; onToggle: () => void; onPick: (type: string) => void }) {
  return (
    <div className="relative flex justify-center">
      <button onClick={onToggle} className="z-[1] -my-1 inline-flex items-center gap-1 rounded-full border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-1 text-xs text-[var(--color-stone)] hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]">＋ Section</button>
      {open && (
        <div className="absolute top-7 z-20 grid w-[22rem] max-w-[90vw] grid-cols-2 gap-1 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-2 shadow-[var(--shadow-lift)]">
          {SECTION_DEFS.map((d) => (
            <button key={d.type} onClick={() => onPick(d.type)} className="flex items-start gap-2 rounded-[var(--radius-sm)] p-2 text-left hover:bg-[var(--color-bone)]">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-[var(--color-bone)] text-sm text-[var(--color-stone)]">{d.glyph}</span>
              <span><span className="block text-sm font-medium">{d.label}</span><span className="block text-xs text-[var(--color-stone-soft)]">{d.description}</span></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function sectionSummary(sec: Section): string {
  const d = sec.data as Record<string, unknown>;
  const first = (d.title || d.heading || d.quote || d.eyebrow || '') as string;
  if (first) return first.length > 40 ? first.slice(0, 40) + '…' : first;
  if (Array.isArray(d.items)) return `${d.items.length} item${d.items.length === 1 ? '' : 's'}`;
  return '';
}
