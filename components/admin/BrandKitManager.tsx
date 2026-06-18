'use client';

import { useState } from 'react';
import type { BrandKit, BrandColor } from '@/lib/brand';

const field = 'mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm';
const linesToArr = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean);

export function BrandKitManager({ initial }: { initial: BrandKit }) {
  const [b, setB] = useState<BrandKit>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const set = <K extends keyof BrandKit>(k: K, v: BrandKit[K]) => setB((p) => ({ ...p, [k]: v }));
  const setColor = (i: number, patch: Partial<BrandColor>) => set('palette', b.palette.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const addColor = () => set('palette', [...b.palette, { name: 'New', hex: '#a98a6d', role: '' }]);
  const removeColor = (i: number) => set('palette', b.palette.filter((_, j) => j !== i));

  async function save() {
    setBusy(true); setMsg('');
    const res = await fetch('/api/admin/brand', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
    setBusy(false);
    setMsg(res.ok ? 'Saved ✓' : 'Save failed');
  }

  return (
    <div className="space-y-6">
      {/* Identity */}
      <Card title="Identity">
        <label className="block text-xs text-[var(--color-stone)]">Tagline
          <input value={b.tagline} onChange={(e) => set('tagline', e.target.value)} className={field} />
        </label>
        <label className="mt-3 block text-xs text-[var(--color-stone)]">About (used for AI context too)
          <textarea value={b.about} onChange={(e) => set('about', e.target.value)} rows={3} className={field} />
        </label>
      </Card>

      {/* Palette */}
      <Card title="Colour palette" action={<button onClick={addColor} className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs hover:border-[var(--color-gold)]">+ Add colour</button>}>
        <div className="grid gap-3 sm:grid-cols-2">
          {b.palette.map((c, i) => (
            <div key={i} className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-3">
              <input type="color" value={c.hex} onChange={(e) => setColor(i, { hex: e.target.value })} className="h-10 w-10 shrink-0 cursor-pointer rounded border border-[var(--color-line)]" aria-label="Colour" />
              <div className="min-w-0 flex-1">
                <input value={c.name} onChange={(e) => setColor(i, { name: e.target.value })} placeholder="Name" className="w-full bg-transparent text-sm font-medium outline-none" />
                <input value={c.role} onChange={(e) => setColor(i, { role: e.target.value })} placeholder="Where it's used" className="w-full bg-transparent text-xs text-[var(--color-stone)] outline-none" />
                <span className="font-mono text-[0.65rem] uppercase text-[var(--color-stone)]">{c.hex}</span>
              </div>
              <button onClick={() => removeColor(i)} className="shrink-0 text-xs text-[var(--color-blush)] hover:underline">✕</button>
            </div>
          ))}
        </div>
      </Card>

      {/* Typography */}
      <Card title="Typography">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs text-[var(--color-stone)]">Display / heading font<input value={b.fonts.display} onChange={(e) => set('fonts', { ...b.fonts, display: e.target.value })} className={field} /></label>
          <label className="text-xs text-[var(--color-stone)]">Body font<input value={b.fonts.body} onChange={(e) => set('fonts', { ...b.fonts, body: e.target.value })} className={field} /></label>
        </div>
        <label className="mt-3 block text-xs text-[var(--color-stone)]">Notes / usage<input value={b.fonts.notes} onChange={(e) => set('fonts', { ...b.fonts, notes: e.target.value })} className={field} /></label>
      </Card>

      {/* Logos */}
      <Card title="Logos & marks">
        <p className="mb-3 text-xs text-[var(--color-stone)]">Paste image URLs (upload in Media library first). Used in emails &amp; landing pages.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {(['primary', 'mark', 'light', 'favicon'] as const).map((k) => (
            <div key={k}>
              <label className="text-xs capitalize text-[var(--color-stone)]">{k} logo
                <input value={b.logos[k]} onChange={(e) => set('logos', { ...b.logos, [k]: e.target.value })} placeholder="https://…" className={field} />
              </label>
              {b.logos[k] && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={b.logos[k]} alt={`${k} logo`} className={`mt-2 h-12 w-auto rounded border border-[var(--color-line)] object-contain p-1 ${k === 'light' ? 'bg-[var(--color-ink)]' : 'bg-white'}`} />
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Voice */}
      <Card title="Tone of voice">
        <label className="block text-xs text-[var(--color-stone)]">Overall tone
          <textarea value={b.voice.tone} onChange={(e) => set('voice', { ...b.voice, tone: e.target.value })} rows={2} className={field} />
        </label>
        <label className="mt-3 block text-xs text-[var(--color-stone)]">Brand descriptors (comma separated)
          <input value={b.voice.descriptors.join(', ')} onChange={(e) => set('voice', { ...b.voice, descriptors: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} className={field} />
        </label>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="text-xs text-[var(--color-stone)]">Do (one per line)<textarea value={b.voice.doList.join('\n')} onChange={(e) => set('voice', { ...b.voice, doList: linesToArr(e.target.value) })} rows={4} className={field} /></label>
          <label className="text-xs text-[var(--color-stone)]">Don’t (one per line)<textarea value={b.voice.dontList.join('\n')} onChange={(e) => set('voice', { ...b.voice, dontList: linesToArr(e.target.value) })} rows={4} className={field} /></label>
        </div>
      </Card>

      {/* Social */}
      <Card title="Social profiles">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-xs text-[var(--color-stone)]">Instagram<input value={b.social.instagram} onChange={(e) => set('social', { ...b.social, instagram: e.target.value })} className={field} /></label>
          <label className="text-xs text-[var(--color-stone)]">Facebook<input value={b.social.facebook} onChange={(e) => set('social', { ...b.social, facebook: e.target.value })} className={field} /></label>
          <label className="text-xs text-[var(--color-stone)]">TikTok<input value={b.social.tiktok} onChange={(e) => set('social', { ...b.social, tiktok: e.target.value })} className={field} /></label>
        </div>
      </Card>

      <div className="sticky bottom-4 flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]/95 p-3 backdrop-blur">
        <button onClick={save} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-6 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Saving…' : 'Save brand kit'}</button>
        {msg && <span className="text-sm text-[var(--color-stone)]">{msg}</span>}
      </div>
    </div>
  );
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-display)] text-lg">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
