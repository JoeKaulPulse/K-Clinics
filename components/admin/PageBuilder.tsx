'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SECTION_DEFS, sectionDef, newSection, cloneSection, uid, type Section } from '@/lib/sections';
import { SectionFields } from '@/components/admin/SectionFields';
import { MediaField } from '@/components/admin/MediaPicker';

type Revision = { id: string; label: string | null; createdAt: string; createdBy: string | null };
type Reusable = { id: string; name: string; type: string };
type Initial = { id: string; path: string; title: string; status: 'DRAFT' | 'PUBLISHED'; draft: Section[]; hasPublished: boolean; publishAt?: string | null; unpublishAt?: string | null };
type Seo = { title: string; description: string; ogImage: string; noindex: boolean };

const card = 'rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]';
const DEVICES = { desktop: '100%', tablet: '820px', mobile: '390px' } as const;
type Device = keyof typeof DEVICES;

export function PageBuilder({ initial, revisions, seed, seo: seoInit, reusables = [] }: { initial: Initial; revisions: Revision[]; seed?: Section[] | null; seo?: Seo; reusables?: Reusable[] }) {
  const router = useRouter();
  const reuseName = (id: string) => reusables.find((r) => r.id === id)?.name ?? 'Reusable block';
  const [seo, setSeo] = useState<Seo>(seoInit ?? { title: '', description: '', ogImage: '', noindex: false });
  const [seoMsg, setSeoMsg] = useState('');
  const saveSeo = async () => {
    const res = await fetch('/api/admin/seo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'save', path: initial.path, ...seo }) });
    setSeoMsg(res.ok ? 'SEO saved.' : 'Could not save SEO.');
  };
  const [sections, setSectionsRaw] = useState<Section[]>(initial.draft);
  const [title, setTitleRaw] = useState(initial.title);
  const [openId, setOpenId] = useState<string | null>(initial.draft[0]?.id ?? null);
  const [adderAt, setAdderAt] = useState<number | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [status, setStatus] = useState(initial.status);
  const [hasPublished, setHasPublished] = useState(initial.hasPublished);
  const [dirty, setDirty] = useState(false);
  const [savedTick, setSavedTick] = useState(0);
  const [previewOn, setPreviewOn] = useState(false);
  const [device, setDevice] = useState<Device>('desktop');
  const [nonce, setNonce] = useState(0);
  const toLocal = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');
  const [publishAt, setPublishAt] = useState(toLocal(initial.publishAt));
  const [unpublishAt, setUnpublishAt] = useState(toLocal(initial.unpublishAt));
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Any content mutation marks the page dirty.
  const setSections = (u: Section[] | ((s: Section[]) => Section[])) => { setSectionsRaw(u as Section[]); setDirty(true); };
  const setTitle = (v: string) => { setTitleRaw(v); setDirty(true); };

  const update = (id: string, data: Record<string, unknown>) => setSections((s) => s.map((x) => (x.id === id ? { ...x, data } : x)));
  const remove = (id: string) => { setSections((s) => s.filter((x) => x.id !== id)); if (openId === id) setOpenId(null); };
  const duplicate = (i: number) => setSections((s) => { const n = [...s]; n.splice(i + 1, 0, cloneSection(s[i])); return n; });
  const toggleHide = (id: string) => setSections((s) => s.map((x) => (x.id === id ? { ...x, hidden: !x.hidden } : x)));
  const moveSec = (i: number, d: -1 | 1) => setSections((s) => { const j = i + d; if (j < 0 || j >= s.length) return s; const n = [...s]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const insert = (at: number, type: string) => { const sec = newSection(type); setSections((s) => { const n = [...s]; n.splice(at, 0, sec); return n; }); setOpenId(sec.id); setAdderAt(null); };
  const insertRef = (at: number, refId: string) => { const sec: Section = { id: uid(), type: 'ref', data: { refId } }; setSections((s) => { const n = [...s]; n.splice(at, 0, sec); return n; }); setAdderAt(null); };
  const reorder = (fromId: string, toId: string) => setSections((s) => {
    if (fromId === toId) return s;
    const from = s.findIndex((x) => x.id === fromId); const to = s.findIndex((x) => x.id === toId);
    if (from < 0 || to < 0) return s;
    const n = [...s]; const [m] = n.splice(from, 1); n.splice(to, 0, m); return n;
  });

  const call = useCallback(async (op: string, extra: Record<string, unknown> = {}) => {
    const res = await fetch('/api/admin/pages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op, id: initial.id, sections, title, ...extra }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) { setMsg({ kind: 'err', text: data.error || 'Failed.' }); return false; }
    return true;
  }, [initial.id, sections, title]);

  const saveDraftSilent = useCallback(async () => { setBusy(true); const ok = await call('saveDraft'); setBusy(false); if (ok) { setDirty(false); setSavedTick((t) => t + 1); } return ok; }, [call]);
  const saveDraft = async () => { if (await saveDraftSilent()) setMsg({ kind: 'ok', text: 'Draft saved.' }); router.refresh(); };
  const publish = async () => { setBusy(true); const ok = await call('publish', { publishAt: publishAt || null, unpublishAt: unpublishAt || null }); setBusy(false); if (ok) { setStatus('PUBLISHED'); setHasPublished(true); setDirty(false); const future = publishAt && new Date(publishAt) > new Date(); setMsg({ kind: 'ok', text: future ? `Scheduled for ${new Date(publishAt).toLocaleString('en-GB')}.` : 'Published — live now.' }); setNonce((n) => n + 1); router.refresh(); } };
  const unpublish = async () => { if (confirm('Unpublish? The route reverts to its built-in version.') && await call('unpublish')) { setStatus('DRAFT'); setHasPublished(false); setMsg({ kind: 'ok', text: 'Unpublished.' }); router.refresh(); } };
  const rollback = async (revisionId: string) => { if (confirm('Restore this version and publish it?') && await call('rollback', { revisionId })) { setStatus('PUBLISHED'); setDirty(false); router.refresh(); } };
  const del = async () => { if (confirm('Delete this page entirely?') && await call('delete')) router.push('/admin/pages'); };

  async function openPreview() { setPreviewOn(true); if (dirty) await saveDraftSilent(); setNonce((n) => n + 1); }

  // Live preview: debounced autosave + iframe reload while the pane is open.
  useEffect(() => {
    if (!previewOn || !dirty) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => { if (await saveDraftSilent()) setNonce((n) => n + 1); }, 1200);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [sections, title, previewOn, dirty, saveDraftSilent]);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  return (
    <div className="pb-10">
      {/* Toolbar */}
      <div className="sticky top-0 z-30 -mx-5 mb-5 flex flex-wrap items-center gap-3 border-b border-[var(--color-line)] bg-[color-mix(in_oklab,var(--color-bone)_92%,transparent)] px-5 py-3 backdrop-blur md:-mx-8 md:px-8">
        <a href="/admin/pages" className="text-sm text-[var(--color-gold)] hover:underline">← Pages</a>
        <div className="mr-auto">
          <p className="font-[family-name:var(--font-display)] text-lg leading-none">{initial.path}</p>
          <p className="mt-1 text-xs text-[var(--color-stone)]">
            <span className={`mr-2 rounded-full px-2 py-0.5 ${status === 'PUBLISHED' ? 'bg-[color-mix(in_oklab,var(--color-jade)_22%,transparent)]' : 'bg-[var(--color-bone)]'}`}>{status === 'PUBLISHED' ? 'Published' : 'Draft'}</span>
            {dirty ? <span className="text-[#b06a2c]">Unsaved changes</span> : savedTick > 0 ? <span className="text-[var(--color-jade)]">All changes saved</span> : null}
          </p>
        </div>
        <button onClick={() => (previewOn ? setPreviewOn(false) : openPreview())} className={`rounded-full border px-4 py-2 text-sm ${previewOn ? 'border-[var(--color-gold)] text-[var(--color-gold)]' : 'border-[var(--color-line)] hover:border-[var(--color-gold)]'}`}>{previewOn ? 'Hide preview' : 'Live preview'}</button>
        <button disabled={busy} onClick={saveDraft} className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm hover:border-[var(--color-gold)] disabled:opacity-50">Save draft</button>
        <button disabled={busy} onClick={publish} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Working…' : 'Publish'}</button>
      </div>
      {msg && <p className={`mb-3 text-sm ${msg.kind === 'ok' ? 'text-[var(--color-jade)]' : 'text-[#c0392b]'}`}>{msg.text}</p>}

      <div className={`grid gap-6 ${previewOn ? 'lg:grid-cols-[minmax(0,28rem)_1fr]' : 'lg:grid-cols-[1fr_18rem]'}`}>
        {/* Canvas */}
        <div className="min-w-0 space-y-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.12em] text-[var(--color-stone)]">{sections.length} section{sections.length === 1 ? '' : 's'}</span>
            {sections.length > 0 && <button onClick={() => setOpenId(null)} className="text-xs text-[var(--color-stone)] hover:text-[var(--color-ink)]">Collapse all</button>}
          </div>
          <Adder open={adderAt === 0} onToggle={() => setAdderAt(adderAt === 0 ? null : 0)} onPick={(t) => insert(0, t)} reusables={reusables} onPickRef={(r) => insertRef(0, r)} />
          {sections.map((sec, i) => {
            const def = sectionDef(sec.type);
            const open = openId === sec.id;
            const isRef = sec.type === 'ref';
            const refId = String((sec.data as { refId?: string }).refId || '');
            return (
              <div key={sec.id}>
                <div
                  className={`${card} ${sec.hidden ? 'opacity-55' : ''} ${overId === sec.id && dragId ? 'ring-2 ring-[var(--color-gold)]' : ''} ${dragId === sec.id ? 'opacity-40' : ''}`}
                  onDragOver={(e) => { if (dragId) { e.preventDefault(); setOverId(sec.id); } }}
                  onDrop={(e) => { e.preventDefault(); if (dragId) reorder(dragId, sec.id); setDragId(null); setOverId(null); }}
                >
                  <div className="flex items-center gap-2 px-3 py-3">
                    <button draggable onDragStart={() => setDragId(sec.id)} onDragEnd={() => { setDragId(null); setOverId(null); }} className="cursor-grab text-[var(--color-stone-soft)] hover:text-[var(--color-ink)] active:cursor-grabbing" title="Drag to reorder" aria-label="Drag to reorder">⠿</button>
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-[var(--color-bone)] text-sm text-[var(--color-stone)]">{isRef ? '⟐' : def?.glyph ?? '▢'}</span>
                    <button onClick={() => !isRef && setOpenId(open ? null : sec.id)} className="min-w-0 flex-1 text-left">
                      <span className="font-medium">{isRef ? 'Reusable block' : def?.label ?? sec.type}</span>
                      {sec.hidden && <span className="ml-2 rounded-full bg-[var(--color-bone)] px-2 py-0.5 text-[0.6rem] uppercase tracking-wide text-[var(--color-stone)]">Hidden</span>}
                      <span className="ml-2 truncate text-sm text-[var(--color-stone-soft)]">{isRef ? reuseName(refId) : sectionSummary(sec)}</span>
                    </button>
                    <span className="flex items-center gap-1.5 text-[var(--color-stone-soft)]">
                      <button onClick={() => toggleHide(sec.id)} title={sec.hidden ? 'Show' : 'Hide'} aria-label="Toggle visibility" className="hover:text-[var(--color-ink)]">{sec.hidden ? '◌' : '◉'}</button>
                      {!isRef && <button onClick={() => duplicate(i)} title="Duplicate" aria-label="Duplicate" className="hover:text-[var(--color-ink)]">⧉</button>}
                      <button onClick={() => moveSec(i, -1)} aria-label="Up" className="hover:text-[var(--color-ink)] disabled:opacity-30" disabled={i === 0}>▲</button>
                      <button onClick={() => moveSec(i, 1)} aria-label="Down" className="hover:text-[var(--color-ink)] disabled:opacity-30" disabled={i === sections.length - 1}>▼</button>
                      <button onClick={() => remove(sec.id)} aria-label="Delete" className="hover:text-[#c0392b]">✕</button>
                      {isRef
                        ? <Link href={`/admin/blocks/${refId}`} target="_blank" title="Edit reusable block" className="hover:text-[var(--color-gold)]">↗</Link>
                        : <button onClick={() => setOpenId(open ? null : sec.id)} aria-label="Edit" className="hover:text-[var(--color-ink)]">{open ? '▾' : '▸'}</button>}
                    </span>
                  </div>
                  {open && def && (
                    <div className="border-t border-[var(--color-line)] p-4">
                      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-bone)] p-2 text-xs">
                        <span className="uppercase tracking-[0.12em] text-[var(--color-stone)]">Layout</span>
                        <label className="flex items-center gap-1">Background
                          <select value={String(sec.data._bg ?? 'none')} onChange={(e) => update(sec.id, { ...sec.data, _bg: e.target.value })} className="rounded border border-[var(--color-line)] bg-[var(--color-porcelain)] px-1.5 py-1">
                            <option value="none">Default</option><option value="cream">Cream band</option><option value="sand">Sand band</option>
                          </select>
                        </label>
                        <label className="flex items-center gap-1">Spacing
                          <select value={String(sec.data._pad ?? 'none')} onChange={(e) => update(sec.id, { ...sec.data, _pad: e.target.value })} className="rounded border border-[var(--color-line)] bg-[var(--color-porcelain)] px-1.5 py-1">
                            <option value="none">Default</option><option value="sm">Compact</option><option value="md">Roomy</option><option value="lg">Spacious</option>
                          </select>
                        </label>
                      </div>
                      <SectionFields fields={def.fields} data={sec.data} onChange={(d) => update(sec.id, d)} />
                    </div>
                  )}
                </div>
                <Adder open={adderAt === i + 1} onToggle={() => setAdderAt(adderAt === i + 1 ? null : i + 1)} onPick={(t) => insert(i + 1, t)} reusables={reusables} onPickRef={(r) => insertRef(i + 1, r)} />
              </div>
            );
          })}
          {sections.length === 0 && (
            <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)] p-10 text-center">
              <p className="text-sm text-[var(--color-stone)]">This page is empty.</p>
              {seed && seed.length > 0 && <button onClick={() => { setSections(seed); setOpenId(seed[0]?.id ?? null); }} className="mt-4 rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm text-[var(--color-porcelain)]">Start from the current page content</button>}
              <p className="mt-3 text-xs text-[var(--color-stone-soft)]">{seed && seed.length > 0 ? 'Loads the existing content as editable sections, or use “＋ Section”.' : 'Use “＋ Section” above to add your first section.'}</p>
            </div>
          )}
        </div>

        {/* Right: live preview OR settings/history */}
        {previewOn ? (
          <div className="min-w-0">
            <div className="mb-2 flex items-center justify-between">
              <div className="inline-flex rounded-full border border-[var(--color-line)] bg-[var(--color-porcelain)] p-1 text-xs">
                {(Object.keys(DEVICES) as Device[]).map((d) => (
                  <button key={d} onClick={() => setDevice(d)} className={`rounded-full px-3 py-1 capitalize ${device === d ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'text-[var(--color-ink-soft)]'}`}>{d}</button>
                ))}
              </div>
              <a href={`/preview/${initial.id}`} target="_blank" className="text-xs text-[var(--color-gold)] hover:underline">Open in new tab ↗</a>
            </div>
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white">
              <div className="mx-auto transition-all" style={{ maxWidth: DEVICES[device] }}>
                <iframe key={nonce} src={`/preview/${initial.id}`} title="Live preview" className="h-[78vh] w-full" />
              </div>
            </div>
            <p className="mt-2 text-xs text-[var(--color-stone-soft)]">Edits autosave to the draft and refresh here. Click Publish to go live.</p>
          </div>
        ) : (
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className={`${card} p-4`}>
              <label className="block text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-stone)] mb-1.5">Admin label</label>
              <input className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" value={title} placeholder={initial.path} onChange={(e) => setTitle(e.target.value)} />
              {hasPublished && <button disabled={busy} onClick={unpublish} className="mt-4 text-sm text-[var(--color-stone)] hover:text-[#c0392b] disabled:opacity-50">Unpublish</button>}
            </div>
            <div className={`${card} p-4`}>
              <h3 className="mb-3 text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-stone)]">Schedule</h3>
              <div className="space-y-3">
                <div><label className="mb-1 block text-xs text-[var(--color-stone)]">Go live at <span className="text-[var(--color-stone-soft)]">(optional)</span></label><input type="datetime-local" className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} /></div>
                <div><label className="mb-1 block text-xs text-[var(--color-stone)]">Take down at <span className="text-[var(--color-stone-soft)]">(optional)</span></label><input type="datetime-local" className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" value={unpublishAt} onChange={(e) => setUnpublishAt(e.target.value)} /></div>
                <p className="text-xs text-[var(--color-stone-soft)]">Set a future go-live, then press Publish to schedule. Windows apply within a few minutes.</p>
              </div>
            </div>

            <div className={`${card} p-4`}>
              <h3 className="mb-3 text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-stone)]">SEO</h3>
              <div className="space-y-3">
                <div><label className="mb-1 block text-xs text-[var(--color-stone)]">Page title</label><input className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" value={seo.title} onChange={(e) => setSeo((s) => ({ ...s, title: e.target.value }))} placeholder="Defaults to the hero heading" /></div>
                <div><label className="mb-1 block text-xs text-[var(--color-stone)]">Meta description</label><textarea className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" value={seo.description} onChange={(e) => setSeo((s) => ({ ...s, description: e.target.value }))} /></div>
                <MediaField label="Social share image" value={seo.ogImage} onChange={(v) => setSeo((s) => ({ ...s, ogImage: v }))} />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={seo.noindex} onChange={(e) => setSeo((s) => ({ ...s, noindex: e.target.checked }))} /> Hide from search engines</label>
                <button onClick={saveSeo} className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm hover:border-[var(--color-gold)]">Save SEO</button>
                {seoMsg && <p className="text-xs text-[var(--color-jade)]">{seoMsg}</p>}
              </div>
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
        )}
      </div>
    </div>
  );
}

function Adder({ open, onToggle, onPick, reusables = [], onPickRef }: { open: boolean; onToggle: () => void; onPick: (type: string) => void; reusables?: Reusable[]; onPickRef?: (refId: string) => void }) {
  return (
    <div className="relative flex justify-center">
      <button onClick={onToggle} className="z-[1] -my-1 inline-flex items-center gap-1 rounded-full border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-1 text-xs text-[var(--color-stone)] hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]">＋ Section</button>
      {open && (
        <div className="absolute top-7 z-20 w-[22rem] max-w-[90vw] rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-2 shadow-[var(--shadow-lift)]">
          <div className="grid grid-cols-2 gap-1">
            {SECTION_DEFS.map((d) => (
              <button key={d.type} onClick={() => onPick(d.type)} className="flex items-start gap-2 rounded-[var(--radius-sm)] p-2 text-left hover:bg-[var(--color-bone)]">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-[var(--color-bone)] text-sm text-[var(--color-stone)]">{d.glyph}</span>
                <span><span className="block text-sm font-medium">{d.label}</span><span className="block text-xs text-[var(--color-stone-soft)]">{d.description}</span></span>
              </button>
            ))}
          </div>
          {reusables.length > 0 && (
            <div className="mt-2 border-t border-[var(--color-line)] pt-2">
              <p className="px-2 pb-1 text-[0.6rem] uppercase tracking-[0.12em] text-[var(--color-stone-soft)]">Reusable blocks</p>
              <div className="grid gap-1">
                {reusables.map((r) => (
                  <button key={r.id} onClick={() => onPickRef?.(r.id)} className="flex items-center gap-2 rounded-[var(--radius-sm)] p-2 text-left hover:bg-[var(--color-bone)]">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-[var(--color-bone)] text-sm text-[var(--color-stone)]">⟐</span>
                    <span className="text-sm font-medium">{r.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
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
