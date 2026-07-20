'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { consentMdToHtml } from '@/lib/consent-md';

export type TemplateRow = {
  key: string; title: string; category: string; version: number;
  bodyMd: string; acknowledgements: string[]; active: boolean;
  serviceSlugs: string[]; serviceGroups: string[];
};
type Service = { slug: string; title: string; group: string };
const CATEGORIES = ['general', 'laser', 'injectables', 'facials', 'dental', 'photo_opt_out'];

export function ConsentTemplatesManager({ rows, services, groups }: { rows: TemplateRow[]; services: Service[]; groups: string[] }) {
  const [creating, setCreating] = useState(false);
  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button onClick={() => setCreating((v) => !v)} className="inline-flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-[var(--color-porcelain)] transition-colors hover:bg-[var(--color-espresso)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M8 3v10M3 8h10" /></svg>
          New consent form
        </button>
      </div>
      {creating && <CreateForm services={services} groups={groups} onDone={() => setCreating(false)} />}
      {rows.map((r) => <Card key={r.key} r={r} services={services} groups={groups} />)}
    </div>
  );
}

// Assign which treatments a form covers: whole groups (broad) and/or specific
// services (precise overrides). A service match wins over a group match.
function AssignmentPicker({
  groups, services, selGroups, selSlugs, setGroups, setSlugs,
}: {
  groups: string[]; services: Service[];
  selGroups: string[]; selSlugs: string[];
  setGroups: (v: string[]) => void; setSlugs: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const byGroup = useMemo(() => {
    const m = new Map<string, Service[]>();
    for (const s of services) { const a = m.get(s.group) ?? []; a.push(s); m.set(s.group, a); }
    return m;
  }, [services]);
  const toggle = (arr: string[], v: string, set: (x: string[]) => void) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bone)]/40 p-3">
      <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-stone)]">Applies to</p>
      <div className="flex flex-wrap gap-1.5">
        {groups.map((g) => {
          const on = selGroups.includes(g);
          return (
            <button key={g} type="button" onClick={() => toggle(selGroups, g, setGroups)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${on ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/15 text-[var(--color-ink)]' : 'border-[var(--color-line)] text-[var(--color-stone)] hover:border-[var(--color-gold)]/50'}`}>
              {g}
            </button>
          );
        })}
      </div>
      <button type="button" onClick={() => setOpen((v) => !v)} className="mt-2.5 text-xs text-[var(--color-gold-deep)] hover:underline">
        {open ? 'Hide' : 'Specific services'}{selSlugs.length ? ` · ${selSlugs.length} selected` : ''}
      </button>
      {open && (
        <div className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white p-2.5">
          {groups.map((g) => (
            <div key={g}>
              <p className="px-1 text-[0.6rem] font-semibold uppercase tracking-wide text-[var(--color-stone)]">{g}</p>
              {(byGroup.get(g) ?? []).map((s) => {
                const on = selSlugs.includes(s.slug);
                return (
                  <label key={s.slug} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-[var(--color-bone)]">
                    <input type="checkbox" checked={on} onChange={() => toggle(selSlugs, s.slug, setSlugs)} className="h-3.5 w-3.5 shrink-0 accent-[var(--color-gold)]" />
                    <span className="min-w-0 truncate text-[var(--color-ink-soft)]">{s.title}</span>
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 text-[0.7rem] leading-relaxed text-[var(--color-stone)]">A treatment that matches nothing falls back to the built-in form for its category.</p>
    </div>
  );
}

const fieldCls = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-gold)]';

function CreateForm({ services, groups, onDone }: { services: Service[]; groups: string[]; onDone: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('general');
  const [bodyMd, setBody] = useState('## \n\nPlease read the following carefully before your treatment:\n\n- ');
  const [acks, setAcks] = useState('');
  const [selGroups, setGroups] = useState<string[]>([]);
  const [selSlugs, setSlugs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function create() {
    if (!title.trim()) { setMsg('Give the form a title.'); return; }
    setBusy(true); setMsg('');
    const res = await fetch('/api/admin/consent', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'createTemplate', title, category, bodyMd, acknowledgements: acks.split('\n').map((s) => s.trim()).filter(Boolean), serviceGroups: selGroups, serviceSlugs: selSlugs }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (j.ok) { router.refresh(); onDone(); } else setMsg(j.error || 'Could not create the form.');
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-gold)]/40 bg-[var(--color-porcelain)] p-5">
      <p className="mb-3 font-[family-name:var(--font-display)] text-lg">New consent form</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block text-xs text-[var(--color-stone)]">Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Chemical peel consent" className={`mt-1 ${fieldCls}`} />
        </label>
        <label className="block text-xs text-[var(--color-stone)]">Category
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={`mt-1 ${fieldCls}`}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        </label>
      </div>
      <label className="mt-3 block text-xs text-[var(--color-stone)]">Wording (markdown)
        <textarea value={bodyMd} onChange={(e) => setBody(e.target.value)} rows={6} className={`mt-1 ${fieldCls} font-mono text-xs`} />
      </label>
      <label className="mt-3 block text-xs text-[var(--color-stone)]">Required confirmations (one per line)
        <textarea value={acks} onChange={(e) => setAcks(e.target.value)} rows={3} className={`mt-1 ${fieldCls}`} />
      </label>
      <div className="mt-3"><AssignmentPicker groups={groups} services={services} selGroups={selGroups} selSlugs={selSlugs} setGroups={setGroups} setSlugs={setSlugs} /></div>
      <div className="mt-4 flex items-center gap-3">
        <button onClick={create} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm font-medium text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Creating…' : 'Create form'}</button>
        <button onClick={onDone} className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">Cancel</button>
        {msg && <span className="text-sm text-[#b23b3b]">{msg}</span>}
      </div>
    </section>
  );
}

function Card({ r, services, groups }: { r: TemplateRow; services: Service[]; groups: string[] }) {
  const router = useRouter();
  const [title, setTitle] = useState(r.title);
  const [category, setCategory] = useState(r.category);
  const [bodyMd, setBody] = useState(r.bodyMd);
  const [acks, setAcks] = useState(r.acknowledgements.join('\n'));
  const [selGroups, setGroups] = useState<string[]>(r.serviceGroups ?? []);
  const [selSlugs, setSlugs] = useState<string[]>(r.serviceSlugs ?? []);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const norm = (a: string[] = []) => [...(a ?? [])].sort().join('|');
  const dirty = title !== r.title || category !== r.category || bodyMd !== r.bodyMd
    || acks !== (r.acknowledgements ?? []).join('\n') || norm(selGroups) !== norm(r.serviceGroups) || norm(selSlugs) !== norm(r.serviceSlugs);

  async function save() {
    setBusy(true); setMsg('');
    const res = await fetch('/api/admin/consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'updateTemplate', key: r.key, title, category, bodyMd, acknowledgements: acks.split('\n').map((s) => s.trim()).filter(Boolean), serviceGroups: selGroups, serviceSlugs: selSlugs }) });
    setBusy(false);
    if (res.ok) { setMsg('Saved ✓'); router.refresh(); } else setMsg('Save failed');
  }
  async function toggle() {
    setBusy(true); setMsg('');
    const res = await fetch('/api/admin/consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'updateTemplate', key: r.key, active: !r.active }) });
    setBusy(false);
    if (res.ok) router.refresh(); else setMsg('Could not update');
  }

  return (
    <section className={`rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5 ${r.active ? '' : 'opacity-70'}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border-0 bg-transparent p-0 font-[family-name:var(--font-display)] text-lg outline-none focus:underline" />
          <p className="text-xs text-[var(--color-stone)]">v{r.version} · code <span className="font-mono">{r.key}</span>{r.active ? '' : ' · disabled'}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <label className="text-xs text-[var(--color-stone)]">Category
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="ml-1.5 rounded-[var(--radius-xs)] border border-[var(--color-line)] bg-white px-2 py-1 text-xs outline-none focus:border-[var(--color-gold)]">{Array.from(new Set([...CATEGORIES, category])).map((c) => <option key={c} value={c}>{c}</option>)}</select>
          </label>
          <button onClick={() => setPreview((v) => !v)} className="text-xs text-[var(--color-gold-deep)] hover:underline">{preview ? 'Edit' : 'Preview'}</button>
          <button onClick={toggle} className="text-xs text-[var(--color-stone)] hover:underline">{r.active ? 'Disable' : 'Enable'}</button>
        </div>
      </div>

      {preview ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-4 text-sm leading-relaxed [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--color-gold)] [&_blockquote]:pl-3 [&_blockquote]:text-[var(--color-stone)] [&_h2]:font-[family-name:var(--font-display)] [&_h2]:text-lg [&_h3]:mt-3 [&_h3]:font-medium [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-2" dangerouslySetInnerHTML={{ __html: consentMdToHtml(bodyMd) }} />
      ) : (
        <textarea value={bodyMd} onChange={(e) => setBody(e.target.value)} rows={8} className={`${fieldCls} font-mono text-xs`} />
      )}

      <label className="mt-3 block text-xs text-[var(--color-stone)]">Required confirmations (one per line)
        <textarea value={acks} onChange={(e) => setAcks(e.target.value)} rows={3} className={`mt-1 ${fieldCls}`} />
      </label>

      <div className="mt-3"><AssignmentPicker groups={groups} services={services} selGroups={selGroups} selSlugs={selSlugs} setGroups={setGroups} setSlugs={setSlugs} /></div>

      <div className="mt-3 flex items-center gap-3">
        <button onClick={save} disabled={busy || !dirty} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Saving…' : 'Save changes'}</button>
        {msg && <span className="text-sm text-[var(--color-stone)]">{msg}</span>}
      </div>
    </section>
  );
}
