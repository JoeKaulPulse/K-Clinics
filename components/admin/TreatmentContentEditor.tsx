'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Treatment } from '@/lib/treatments';

const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]';
const label = 'block text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-stone)] mb-1.5';
const card = 'rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5';
type Row = Record<string, string>;
const move = <T,>(a: T[], i: number, d: number): T[] => { const j = i + d; if (j < 0 || j >= a.length) return a; const n = [...a]; [n[i], n[j]] = [n[j], n[i]]; return n; };

export function TreatmentContentEditor({ slug, base, override }: { slug: string; base: Treatment; override: Record<string, unknown> | null }) {
  const router = useRouter();
  const o = override || {};
  const pick = <T,>(k: string, fb: T): T => { const v = (o as Record<string, unknown>)[k]; return (v === null || v === undefined || (typeof v === 'string' && !v) || (Array.isArray(v) && !v.length)) ? fb : (v as T); };
  const [f, setF] = useState({
    title: pick('title', base.title), tagline: pick('tagline', base.tagline), eyebrow: pick('eyebrow', base.eyebrow),
    intro: pick('intro', base.intro), priceFrom: pick('priceFrom', base.priceFrom ?? ''),
    metaTitle: pick('metaTitle', base.metaTitle), metaDescription: pick('metaDescription', base.metaDescription),
    keywords: pick<string[]>('keywords', base.keywords).join(', '), related: pick<string[]>('related', base.related).join(', '),
  });
  const [benefits, setBenefits] = useState<Row[]>(pick('benefits', base.benefits) as Row[]);
  const [process, setProcess] = useState<Row[]>(pick('process', base.process) as Row[]);
  const [faqs, setFaqs] = useState<Row[]>(pick('faqs', base.faqs) as Row[]);
  const [facts, setFacts] = useState<Row[]>(pick('facts', base.facts) as Row[]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ k: 'ok' | 'err'; t: string } | null>(null);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function save() {
    setBusy(true); setMsg(null);
    const res = await fetch('/api/admin/treatment-content', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ op: 'save', slug, ...f, benefits, process, faqs, facts }),
    });
    setBusy(false);
    if (res.ok) { setMsg({ k: 'ok', t: 'Saved — live on the page.' }); router.refresh(); }
    else setMsg({ k: 'err', t: 'Could not save.' });
  }
  async function reset() {
    if (!confirm('Reset this page to its built-in content? Your custom copy will be removed.')) return;
    setBusy(true);
    await fetch('/api/admin/treatment-content', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'reset', slug }) });
    setBusy(false); router.refresh();
  }

  return (
    <div className="pb-24">
      <Link href="/admin/services" className="text-sm text-[var(--color-gold)] hover:underline">← Services</Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">{base.title}</h1>
          <p className="mt-1 text-sm text-[var(--color-stone)]">Marketing content for <Link href={`/${slug}`} target="_blank" className="text-[var(--color-gold)] hover:underline">/{slug} ↗</Link>. Pricing is edited on the Services page.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_16rem]">
        <div className="space-y-5">
          <section className={card}>
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl">Hero</h2>
            <div className="space-y-4">
              <div><label className={label}>Eyebrow</label><input className={field} value={f.eyebrow} onChange={(e) => set('eyebrow', e.target.value)} /></div>
              <div><label className={label}>Title</label><input className={field} value={f.title} onChange={(e) => set('title', e.target.value)} /></div>
              <div><label className={label}>Tagline</label><input className={field} value={f.tagline} onChange={(e) => set('tagline', e.target.value)} /></div>
              <div><label className={label}>Intro</label><textarea className={`${field} min-h-[90px]`} value={f.intro} onChange={(e) => set('intro', e.target.value)} /></div>
              <div><label className={label}>Price from <span className="normal-case text-[var(--color-stone-soft)]">(display only)</span></label><input className={field} value={f.priceFrom} onChange={(e) => set('priceFrom', e.target.value)} placeholder="£11" /></div>
            </div>
          </section>

          <Repeater title="Key facts" items={facts} setItems={setFacts} cols={['label', 'value']} blank={{ label: '', value: '' }} />
          <Repeater title="Benefits" items={benefits} setItems={setBenefits} cols={['title', 'text']} blank={{ title: '', text: '' }} textarea="text" />
          <Repeater title="The journey (process)" items={process} setItems={setProcess} cols={['title', 'text']} blank={{ title: '', text: '' }} textarea="text" />
          <Repeater title="FAQs" items={faqs} setItems={setFaqs} cols={['q', 'a']} blank={{ q: '', a: '' }} textarea="a" labels={{ q: 'Question', a: 'Answer' }} />

          <section className={card}>
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl">SEO &amp; links</h2>
            <div className="space-y-4">
              <div><label className={label}>Meta title</label><input className={field} value={f.metaTitle} onChange={(e) => set('metaTitle', e.target.value)} /></div>
              <div><label className={label}>Meta description</label><textarea className={`${field} min-h-[60px]`} value={f.metaDescription} onChange={(e) => set('metaDescription', e.target.value)} /></div>
              <div><label className={label}>Keywords <span className="normal-case text-[var(--color-stone-soft)]">(comma-separated)</span></label><input className={field} value={f.keywords} onChange={(e) => set('keywords', e.target.value)} /></div>
              <div><label className={label}>Related treatment slugs</label><input className={field} value={f.related} onChange={(e) => set('related', e.target.value)} placeholder="ipl-phototherapy, hydraglow-facial" /></div>
            </div>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className={card}>
            <button disabled={busy} onClick={save} className="w-full rounded-full bg-[var(--color-ink)] px-5 py-3 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Saving…' : 'Save changes'}</button>
            {msg && <p className={`mt-3 text-sm ${msg.k === 'ok' ? 'text-[var(--color-jade)]' : 'text-[#c0392b]'}`}>{msg.t}</p>}
            <p className="mt-3 text-xs text-[var(--color-stone-soft)]">Saved changes publish to the live page within a minute.</p>
            {override && <button disabled={busy} onClick={reset} className="mt-4 w-full text-sm text-[var(--color-stone)] hover:text-[#c0392b]">Reset to built-in content</button>}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Repeater({ title, items, setItems, cols, blank, textarea, labels }: {
  title: string; items: Row[]; setItems: (r: Row[]) => void; cols: string[]; blank: Row; textarea?: string; labels?: Record<string, string>;
}) {
  const setAt = (i: number, k: string, v: string) => setItems(items.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  return (
    <section className={card}>
      <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl">{title}</h2>
      <div className="space-y-3">
        {items.map((it, i) => (
          <div key={i} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bone)] p-3">
            <div className="mb-2 flex items-center justify-end gap-1 text-[var(--color-stone-soft)]">
              <button onClick={() => setItems(move(items, i, -1))} aria-label="Up" className="hover:text-[var(--color-ink)]">▲</button>
              <button onClick={() => setItems(move(items, i, 1))} aria-label="Down" className="hover:text-[var(--color-ink)]">▼</button>
              <button onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="Remove" className="ml-1 hover:text-[#c0392b]">✕</button>
            </div>
            <div className="space-y-2">
              {cols.map((c) => (
                <div key={c}>
                  <label className={label}>{labels?.[c] ?? c}</label>
                  {textarea === c
                    ? <textarea className={`${field} min-h-[70px]`} value={it[c] ?? ''} onChange={(e) => setAt(i, c, e.target.value)} />
                    : <input className={field} value={it[c] ?? ''} onChange={(e) => setAt(i, c, e.target.value)} />}
                </div>
              ))}
            </div>
          </div>
        ))}
        <button onClick={() => setItems([...items, { ...blank }])} className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-sm hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]">+ Add</button>
      </div>
    </section>
  );
}
