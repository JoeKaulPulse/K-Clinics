'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { emailBlocksToHtml, blankBlock, type EmailBlock } from '@/lib/email-builder';

const field = 'rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm';
const TYPES: EmailBlock['type'][] = ['heading', 'paragraph', 'image', 'button', 'divider'];

export function EmailComposer({ segments, tags }: { segments: { id: string; name: string }[]; tags: string[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [blocks, setBlocks] = useState<EmailBlock[]>([blankBlock('heading'), blankBlock('paragraph'), blankBlock('button')]);
  const [audType, setAudType] = useState<'all' | 'segment' | 'tag'>('all');
  const [audValue, setAudValue] = useState('');
  const [test, setTest] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const update = (i: number, patch: Partial<EmailBlock>) => setBlocks((b) => b.map((bl, j) => (j === i ? { ...bl, ...patch } as EmailBlock : bl)));
  const add = (t: EmailBlock['type']) => setBlocks((b) => [...b, blankBlock(t)]);
  const remove = (i: number) => setBlocks((b) => b.filter((_, j) => j !== i));
  const move = (i: number, d: -1 | 1) => setBlocks((b) => { const n = [...b]; const j = i + d; if (j < 0 || j >= n.length) return b; [n[i], n[j]] = [n[j], n[i]]; return n; });

  async function send(testMode: boolean) {
    setMsg(''); setBusy(true);
    const res = await fetch('/api/admin/marketing/email/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, subject, blocks, audience: { type: audType, value: audValue }, test: testMode ? test : undefined }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!j.ok) return setMsg(j.error || 'Failed');
    if (testMode) return setMsg('Test sent ✓');
    setMsg(`Sent to ${j.sent} recipient(s)${j.failed ? `, ${j.failed} failed` : ''} ✓`);
    setTimeout(() => router.push('/admin/marketing/email'), 1200);
  }

  const previewHtml = `<div style="font-family:Helvetica,Arial,sans-serif;background:#f6ece3;padding:20px;"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;">${emailBlocksToHtml(blocks)}</div></div>`;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      {/* Builder */}
      <div className="space-y-4">
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-[var(--color-stone)]">Internal name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="February newsletter" className={`${field} mt-1 w-full`} /></label>
            <label className="text-xs text-[var(--color-stone)]">Subject line<input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="A little glow for February ✨" className={`${field} mt-1 w-full`} /></label>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-[var(--color-stone)]">Audience
              <select value={audType} onChange={(e) => { setAudType(e.target.value as 'all' | 'segment' | 'tag'); setAudValue(''); }} className={`${field} mt-1 w-full`}>
                <option value="all">All opted-in subscribers</option>
                <option value="segment">A saved segment</option>
                <option value="tag">A client tag</option>
              </select>
            </label>
            {audType === 'segment' && <label className="text-xs text-[var(--color-stone)]">Segment<select value={audValue} onChange={(e) => setAudValue(e.target.value)} className={`${field} mt-1 w-full`}><option value="">Choose…</option>{segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
            {audType === 'tag' && <label className="text-xs text-[var(--color-stone)]">Tag<select value={audValue} onChange={(e) => setAudValue(e.target.value)} className={`${field} mt-1 w-full`}><option value="">Choose…</option>{tags.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>}
          </div>
        </section>

        <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">Content</h2>
          <div className="space-y-3">
            {blocks.map((b, i) => (
              <div key={i} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[0.65rem] uppercase tracking-wide text-[var(--color-stone-soft)]">{b.type}</span>
                  <span className="flex gap-2 text-xs text-[var(--color-stone)]">
                    <button onClick={() => move(i, -1)} className="hover:text-[var(--color-ink)]">↑</button>
                    <button onClick={() => move(i, 1)} className="hover:text-[var(--color-ink)]">↓</button>
                    <button onClick={() => remove(i)} className="text-[var(--color-blush)]">✕</button>
                  </span>
                </div>
                {b.type === 'heading' && <input value={b.text} onChange={(e) => update(i, { text: e.target.value })} className={`${field} w-full`} />}
                {b.type === 'paragraph' && <textarea value={b.text} onChange={(e) => update(i, { text: e.target.value })} rows={3} className={`${field} w-full`} />}
                {b.type === 'image' && <input value={b.url} onChange={(e) => update(i, { url: e.target.value })} placeholder="Image URL" className={`${field} w-full`} />}
                {b.type === 'button' && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input value={b.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="Label" className={field} />
                    <input value={b.href} onChange={(e) => update(i, { href: e.target.value })} placeholder="Link URL" className={field} />
                  </div>
                )}
                {b.type === 'divider' && <p className="text-xs text-[var(--color-stone-soft)]">A horizontal divider.</p>}
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {TYPES.map((t) => <button key={t} onClick={() => add(t)} className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs capitalize hover:border-[var(--color-gold)]">+ {t}</button>)}
          </div>
        </section>

        <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-[var(--color-stone)]">Send a test to<input value={test} onChange={(e) => setTest(e.target.value)} placeholder="you@kclinics.co.uk" className={`${field} mt-1 w-56`} /></label>
            <button onClick={() => send(true)} disabled={busy || !test} className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm hover:border-[var(--color-gold)] disabled:opacity-50">Send test</button>
            <button onClick={() => { if (confirm('Send this email to the selected audience now?')) send(false); }} disabled={busy || !subject} className="ml-auto rounded-full bg-[var(--color-ink)] px-6 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Sending…' : 'Send'}</button>
          </div>
          {msg && <p className="mt-2 text-sm text-[var(--color-stone)]">{msg}</p>}
        </section>
      </div>

      {/* Live preview */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <p className="mb-2 text-xs uppercase tracking-wide text-[var(--color-stone-soft)]">Live preview</p>
        <iframe title="Email preview" srcDoc={previewHtml} className="h-[640px] w-full rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white" />
      </div>
    </div>
  );
}
