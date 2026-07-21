'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Issue = { category: string; severity: string; message: string };
type PageScore = { path: string; title: string; description: string; focusKeyword: string | null; type: string; overridden: boolean; onpage: number; technical: number; generative: number; local: number; overall: number; grade: string; issues: Issue[] };
type Audit = { pages: PageScore[]; health: number; byCategory: Record<string, number>; counts: Record<string, number> };

const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-sm';
const tone = (s: number) => (s >= 80 ? 'text-green-700' : s >= 70 ? 'text-amber-600' : 'text-[var(--color-blush-deep)]');
const bg = (s: number) => (s >= 80 ? 'bg-green-600' : s >= 70 ? 'bg-amber-500' : 'bg-[var(--color-blush)]');
const gradeTone = (g: string) => (g === 'A' ? 'bg-green-600' : g === 'B' ? 'bg-green-500' : g === 'C' ? 'bg-amber-500' : g === 'D' ? 'bg-orange-500' : 'bg-[var(--color-blush)]');

const CATS = [['onpage', 'On-page'], ['technical', 'Technical'], ['generative', 'AI / GEO'], ['local', 'Local']] as const;

export function SeoDashboard({ audit }: { audit: Audit }) {
  return (
    <div className="space-y-8">
      <section className="grid gap-5 md:grid-cols-[260px_1fr]">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6 text-center">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]">Site health</p>
          <p className={`mt-2 font-[family-name:var(--font-display)] text-6xl tabular-nums ${tone(audit.health)}`}>{audit.health}</p>
          <p className="text-sm text-[var(--color-stone)]">out of 100</p>
          <div className="mt-4 flex justify-center gap-4 text-xs text-[var(--color-stone)]">
            <span><strong className="text-[var(--color-ink)]">{audit.counts.total}</strong> pages</span>
            <span><strong className="text-green-700">{audit.counts.a}</strong> A-grade</span>
            <span><strong className="text-[var(--color-blush-deep)]">{audit.counts.needsWork}</strong> need work</span>
          </div>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
          <p className="mb-4 text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]">By category</p>
          <div className="space-y-3">
            {CATS.map(([k, label]) => (
              <div key={k}>
                <div className="mb-1 flex justify-between text-sm"><span>{label}</span><span className={`${tone(audit.byCategory[k])} tabular-nums`}>{audit.byCategory[k]}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--color-sand)]"><div className={`h-full ${bg(audit.byCategory[k])}`} style={{ width: `${audit.byCategory[k]}%` }} /></div>
              </div>
            ))}
          </div>
          {audit.counts.highIssues > 0 && <p className="mt-4 text-sm text-[var(--color-blush-deep)]">{audit.counts.highIssues} high-severity issue(s) across the site.</p>}
        </div>
      </section>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">Pages — lowest scoring first</h2>
        <div className="divide-y divide-[var(--color-line)] border-t border-[var(--color-line)]">
          {audit.pages.map((p) => <PageRow key={p.path} p={p} />)}
        </div>
      </section>
    </div>
  );
}

function PageRow({ p }: { p: PageScore }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 py-2.5 text-left">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${gradeTone(p.grade)}`}>{p.grade}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-[var(--color-ink)]">{p.path}{p.overridden && <span className="ml-2 rounded-full bg-[var(--color-gold)]/15 px-1.5 py-0.5 text-[0.6rem] text-[var(--color-gold-deep)]">custom</span>}</span>
          <span className="block truncate text-xs text-[var(--color-stone)]">{p.title}</span>
        </span>
        <span className="hidden shrink-0 gap-3 text-xs text-[var(--color-stone)] sm:flex">
          {CATS.map(([k, label]) => <span key={k} className={tone(p[k as keyof PageScore] as number)}>{label.split(' ')[0]} {p[k as keyof PageScore] as number}</span>)}
        </span>
        <span className={`shrink-0 text-sm font-semibold tabular-nums ${tone(p.overall)}`}>{p.overall}</span>
      </button>
      {open && <PageEditor p={p} />}
    </div>
  );
}

function PageEditor({ p }: { p: PageScore }) {
  const router = useRouter();
  const [f, setF] = useState({ title: p.title, description: p.description, focusKeyword: p.focusKeyword ?? '', canonical: '', ogImage: '', noindex: false });
  const [recs, setRecs] = useState<string[]>([]);
  const [busy, setBusy] = useState(''); // 'ai' | 'save' | ''
  const [msg, setMsg] = useState('');
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  async function post(payload: object) {
    return fetch('/api/admin/seo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  }
  async function aiSuggest() {
    setBusy('ai'); setMsg('');
    const res = await post({ op: 'aiSuggest', path: p.path, title: f.title, description: f.description, focusKeyword: f.focusKeyword, issues: p.issues.map((i) => i.message) });
    const j = await res.json();
    if (j.ok) {
      if (j.title) set('title', j.title);
      if (j.description) set('description', j.description);
      if (j.focusKeyword) set('focusKeyword', j.focusKeyword);
      setRecs(j.recommendations ?? []);
      setMsg(j.ai ? 'AI suggestions applied — review and save.' : 'Rules-based draft applied (no AI key set).');
    } else setMsg(j.error || 'Could not generate suggestions.');
    setBusy('');
  }
  async function save() {
    setBusy('save'); setMsg('');
    const res = await post({ op: 'save', path: p.path, ...f });
    setMsg(res.ok ? 'Saved ✓ — overrides apply on the next page render.' : 'Could not save.');
    setBusy(''); router.refresh();
  }
  async function clear() {
    if (!confirm('Remove the custom SEO override for this page?')) return;
    await post({ op: 'clear', path: p.path }); router.refresh();
  }

  return (
    <div className="mb-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-4">
      {p.issues.length > 0 && (
        <ul className="mb-4 space-y-1">
          {p.issues.map((i, idx) => (
            <li key={idx} className="flex items-start gap-2 text-xs">
              <span className={`mt-0.5 rounded px-1.5 py-0.5 text-[0.6rem] font-medium text-white ${i.severity === 'high' ? 'bg-[var(--color-blush)]' : i.severity === 'med' ? 'bg-amber-500' : 'bg-[var(--color-stone-soft)]'}`}>{i.severity}</span>
              <span className="text-[var(--color-stone)]">{i.message}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-3">
        <label className="text-xs text-[var(--color-stone)]">Title <span className="text-[var(--color-stone)]">({f.title.length} chars)</span><input className={field} value={f.title} onChange={(e) => set('title', e.target.value)} /></label>
        <label className="text-xs text-[var(--color-stone)]">Meta description <span className="text-[var(--color-stone)]">({f.description.length} chars)</span><textarea rows={2} className={field} value={f.description} onChange={(e) => set('description', e.target.value)} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-[var(--color-stone)]">Focus keyword<input className={field} value={f.focusKeyword} onChange={(e) => set('focusKeyword', e.target.value)} /></label>
          <label className="text-xs text-[var(--color-stone)]">Canonical URL (optional)<input className={field} value={f.canonical} onChange={(e) => set('canonical', e.target.value)} placeholder="leave blank for default" /></label>
          <label className="text-xs text-[var(--color-stone)]">OG image URL (optional)<input className={field} value={f.ogImage} onChange={(e) => set('ogImage', e.target.value)} /></label>
          <label className="mt-5 flex items-center gap-2 text-sm text-[var(--color-stone)]"><input type="checkbox" checked={f.noindex} onChange={(e) => set('noindex', e.target.checked)} className="h-4 w-4 accent-[var(--color-gold)]" />Noindex this page</label>
        </div>
      </div>
      <div className="mt-4">
        <p className="mb-1.5 text-xs text-[var(--color-stone)]">Social share preview (Open Graph)</p>
        <img
          key={f.ogImage || `${f.title}|${f.description}`}
          src={f.ogImage?.trim()
            ? (/^https?:\/\//.test(f.ogImage) ? f.ogImage : f.ogImage)
            : `/og?title=${encodeURIComponent((f.title || '').split(' | ')[0])}&tag=${encodeURIComponent(f.description || '')}`}
          alt="Open Graph card preview"
          width={400}
          height={210}
          loading="lazy"
          className="w-full max-w-[400px] rounded-[var(--radius-sm)] border border-[var(--color-line)]"
        />
        <p className="mt-1 text-[0.7rem] text-[var(--color-stone)]">How this page looks when shared on WhatsApp, iMessage, LinkedIn, X & Slack. Leave OG image blank to auto-generate from the title + description.</p>
      </div>
      {recs.length > 0 && (
        <div className="mt-3 rounded-[var(--radius-sm)] bg-[var(--color-bone)] p-3">
          <p className="text-xs font-medium text-[var(--color-ink)]">Recommendations</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-[var(--color-stone)]">{recs.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button onClick={aiSuggest} disabled={!!busy} className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-sm hover:border-[var(--color-gold)] disabled:opacity-50">{busy === 'ai' ? 'Thinking…' : '✦ AI suggest'}</button>
        <button onClick={save} disabled={!!busy} className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy === 'save' ? 'Saving…' : 'Save overrides'}</button>
        {p.overridden && <button onClick={clear} className="text-xs text-[var(--color-blush-deep)] hover:underline">Remove override</button>}
        {msg && <span className="text-sm text-[var(--color-stone)]">{msg}</span>}
      </div>
      <p className="mt-2 text-[0.7rem] text-[var(--color-stone)]">A live preview crawl reads the rendered page; scores update on save and reload.</p>
    </div>
  );
}
