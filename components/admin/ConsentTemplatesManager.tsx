'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { consentMdToHtml } from '@/lib/consent-md';

export type TemplateRow = { key: string; title: string; category: string; version: number; bodyMd: string; acknowledgements: string[]; active: boolean };

export function ConsentTemplatesManager({ rows }: { rows: TemplateRow[] }) {
  return (
    <div className="space-y-5">
      {rows.map((r) => <Card key={r.key} r={r} />)}
    </div>
  );
}

function Card({ r }: { r: TemplateRow }) {
  const router = useRouter();
  const [title, setTitle] = useState(r.title);
  const [bodyMd, setBody] = useState(r.bodyMd);
  const [acks, setAcks] = useState(r.acknowledgements.join('\n'));
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const dirty = title !== r.title || bodyMd !== r.bodyMd || acks !== r.acknowledgements.join('\n');

  async function save() {
    setBusy(true); setMsg('');
    const res = await fetch('/api/admin/consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'updateTemplate', key: r.key, title, bodyMd, acknowledgements: acks.split('\n').map((s) => s.trim()).filter(Boolean) }) });
    setBusy(false);
    if (res.ok) { setMsg('Saved ✓ — new version'); router.refresh(); } else setMsg('Save failed');
  }
  async function toggle() { await fetch('/api/admin/consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'updateTemplate', key: r.key, active: !r.active }) }); router.refresh(); }

  return (
    <section className={`rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5 ${r.active ? '' : 'opacity-70'}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="border-0 bg-transparent p-0 font-[family-name:var(--font-display)] text-lg outline-none focus:underline" />
          <p className="text-xs text-[var(--color-stone-soft)]">{r.category} · v{r.version} · code <span className="font-mono">{r.key}</span></p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setPreview((v) => !v)} className="text-xs text-[var(--color-gold)] hover:underline">{preview ? 'Edit' : 'Preview'}</button>
          <button onClick={toggle} className="text-xs text-[var(--color-stone)] hover:underline">{r.active ? 'Disable' : 'Enable'}</button>
        </div>
      </div>

      {preview ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-4 text-sm leading-relaxed [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--color-gold)] [&_blockquote]:pl-3 [&_blockquote]:text-[var(--color-stone)] [&_h2]:font-[family-name:var(--font-display)] [&_h2]:text-lg [&_h3]:mt-3 [&_h3]:font-medium [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-2" dangerouslySetInnerHTML={{ __html: consentMdToHtml(bodyMd) }} />
      ) : (
        <textarea value={bodyMd} onChange={(e) => setBody(e.target.value)} rows={8} className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white p-3 font-mono text-xs" />
      )}

      <label className="mt-3 block text-xs text-[var(--color-stone)]">Required confirmations (one per line)
        <textarea value={acks} onChange={(e) => setAcks(e.target.value)} rows={3} className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white p-2 text-sm" />
      </label>

      <div className="mt-3 flex items-center gap-3">
        <button onClick={save} disabled={busy || !dirty} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Saving…' : 'Save new version'}</button>
        {msg && <span className="text-sm text-[var(--color-stone)]">{msg}</span>}
      </div>
    </section>
  );
}
