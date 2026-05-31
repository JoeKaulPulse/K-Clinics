'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Item = { slug: string; treatmentTitle: string; title: string; content: string; source: 'db' | 'default' };

export function SopManager({ items }: { items: Item[] }) {
  const [activeSlug, setActiveSlug] = useState(items[0]?.slug ?? '');
  const active = items.find((i) => i.slug === activeSlug);

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <aside className="space-y-1">
        {items.map((i) => (
          <button
            key={i.slug}
            onClick={() => setActiveSlug(i.slug)}
            className={`flex w-full items-center justify-between gap-2 rounded-[var(--radius-sm)] px-4 py-2.5 text-left text-sm transition-colors ${activeSlug === i.slug ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'hover:bg-[var(--color-bone)]'}`}
          >
            <span className="truncate">{i.treatmentTitle}</span>
            {i.source === 'db' ? (
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] ${activeSlug === i.slug ? 'bg-white/20' : 'bg-[var(--color-gold)]/20'}`}>custom</span>
            ) : (
              <span className={`shrink-0 text-[0.6rem] ${activeSlug === i.slug ? 'text-white/60' : 'text-[var(--color-stone-soft)]'}`}>default</span>
            )}
          </button>
        ))}
      </aside>
      {active && <Editor key={active.slug} item={active} />}
    </div>
  );
}

function Editor({ item }: { item: Item }) {
  const router = useRouter();
  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(item.content);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  async function call(payload: object) {
    setSaving(true); setMsg('');
    const res = await fetch('/api/admin/sop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setSaving(false);
    if (res.ok) { setMsg('Saved ✓'); router.refresh(); } else { const j = await res.json().catch(() => ({})); setMsg(j.error || 'Could not save'); }
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-display)] text-xl">{item.treatmentTitle} — SOP</h2>
        <span className="text-xs text-[var(--color-stone)]">{item.source === 'db' ? 'Custom version' : 'Showing default (not yet customised)'}</span>
      </div>
      <label className="mb-1 block text-xs uppercase tracking-[0.14em] text-[var(--color-stone)]">Title</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} className="mb-4 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" />
      <label className="mb-1 block text-xs uppercase tracking-[0.14em] text-[var(--color-stone)]">Procedure steps</label>
      <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={14} className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 font-[family-name:var(--font-mono)] text-sm leading-relaxed outline-none focus:border-[var(--color-gold)]" />
      <div className="mt-4 flex items-center gap-3">
        <button disabled={saving} onClick={() => call({ treatmentSlug: item.slug, title, content })} className="rounded-full bg-[var(--color-gold)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--color-ink)] disabled:opacity-60">{saving ? 'Saving…' : 'Save SOP'}</button>
        {item.source === 'db' && <button disabled={saving} onClick={() => call({ op: 'reset', treatmentSlug: item.slug })} className="text-sm text-[var(--color-stone)] hover:text-[var(--color-blush)]">Reset to default</button>}
        {msg && <span className="text-sm text-[var(--color-stone)]">{msg}</span>}
      </div>
    </div>
  );
}
