'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BlockEditor } from '@/components/admin/BlockEditor';
import { MediaField } from '@/components/admin/MediaPicker';
import { type Block, blocksToText, readMinutesOf, starterBlocks } from '@/lib/blocks';

type Initial = {
  id: string; title: string; slug: string; excerpt: string; metaDescription: string;
  blocks: Block[]; category: string; coverImage: string; readMinutes: number;
  keywords: string; related: string; status: 'DRAFT' | 'PUBLISHED';
} | null;

const CATEGORIES = ['Skin', 'Laser', 'Injectables', 'Dentistry', 'Wellbeing'];
const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]';
const label = 'block text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-stone)] mb-1.5';

export function PostEditor({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<Block[]>(initial?.blocks?.length ? initial.blocks : starterBlocks());
  const [f, setF] = useState({
    title: initial?.title ?? '', slug: initial?.slug ?? '', category: initial?.category ?? 'Skin',
    excerpt: initial?.excerpt ?? '', metaDescription: initial?.metaDescription ?? '',
    coverImage: initial?.coverImage ?? '', readMinutes: initial?.readMinutes ?? 0,
    keywords: initial?.keywords ?? '', related: initial?.related ?? '', status: initial?.status ?? 'DRAFT',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string, v: unknown) => setF((s) => ({ ...s, [k]: v }));

  const estRead = useMemo(() => readMinutesOf(blocks), [blocks]);
  const words = useMemo(() => blocksToText(blocks).split(' ').filter(Boolean).length, [blocks]);

  async function save(status: 'DRAFT' | 'PUBLISHED') {
    if (!f.title.trim()) { setErr('Give the post a title first.'); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    setBusy(true); setErr('');
    const res = await fetch('/api/admin/posts', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ op: 'save', id: initial?.id, ...f, blocks, readMinutes: f.readMinutes || estRead, status }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !data.ok) { setErr(data.error || 'Could not save.'); return; }
    router.push('/admin/journal'); router.refresh();
  }
  async function remove() {
    if (!initial?.id || !confirm('Delete this post permanently?')) return;
    setBusy(true);
    await fetch('/api/admin/posts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'delete', id: initial.id }) });
    setBusy(false); router.push('/admin/journal'); router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/journal" className="text-sm text-[var(--color-gold)] hover:underline">← Journal</Link>
        <span className="text-xs text-[var(--color-stone)]">{words.toLocaleString('en-GB')} words · ~{f.readMinutes || estRead} min read</span>
      </div>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl">{initial ? 'Edit post' : 'New post'}</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        {/* Main column */}
        <div className="space-y-4">
          <div>
            <label className={label}>Title</label>
            <input className={`${field} font-[family-name:var(--font-display)] text-xl`} value={f.title}
              onChange={(e) => set('title', e.target.value)} placeholder="Article title" />
          </div>
          <div>
            <label className={label}>Content</label>
            <BlockEditor blocks={blocks} onChange={setBlocks} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
            <label className={label}>Status</label>
            <select className={field} value={f.status} onChange={(e) => set('status', e.target.value)}>
              <option value="DRAFT">Draft (hidden)</option>
              <option value="PUBLISHED">Published (live)</option>
            </select>
            {err && <p className="mt-3 text-sm text-[#c0392b]">{err}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <button disabled={busy} onClick={() => save(f.status)} className="rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
              {f.status !== 'PUBLISHED' && <button disabled={busy} onClick={() => save('PUBLISHED')} className="rounded-full border border-[var(--color-gold)] px-5 py-2.5 text-sm text-[var(--color-ink)] disabled:opacity-50">Save &amp; publish</button>}
              {initial && <button disabled={busy} onClick={remove} className="ml-auto rounded-full px-3 py-2.5 text-sm text-[#c0392b] hover:underline">Delete</button>}
            </div>
          </div>

          <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4 space-y-4">
            <div><label className={label}>URL slug <span className="normal-case text-[var(--color-stone)]">(blank = auto)</span></label><input className={field} value={f.slug} onChange={(e) => set('slug', e.target.value)} placeholder="my-article" /></div>
            <div><label className={label}>Category</label><select className={field} value={f.category} onChange={(e) => set('category', e.target.value)}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
            <div>
              <label className={label}>Excerpt <span className="normal-case text-[var(--color-stone)]">(card + intro)</span></label>
              <textarea className={`${field} min-h-[70px]`} value={f.excerpt} onChange={(e) => set('excerpt', e.target.value)} placeholder="Short summary — blank to auto-generate from the first paragraph." />
            </div>
            <div>
              <label className={label}>Read time <span className="normal-case text-[var(--color-stone)]">(0 = auto: {estRead} min)</span></label>
              <input type="number" min={0} max={90} className={field} value={f.readMinutes} onChange={(e) => set('readMinutes', Number(e.target.value))} />
            </div>
          </div>

          <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4 space-y-4">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-stone)]">SEO &amp; links</p>
            <MediaField label="Cover image" value={f.coverImage} onChange={(v) => set('coverImage', v)} />
            <div><label className={label}>Meta description</label><textarea className={`${field} min-h-[60px]`} value={f.metaDescription} onChange={(e) => set('metaDescription', e.target.value)} /></div>
            <div><label className={label}>Keywords <span className="normal-case text-[var(--color-stone)]">(comma-separated)</span></label><input className={field} value={f.keywords} onChange={(e) => set('keywords', e.target.value)} /></div>
            <div><label className={label}>Related treatment slugs <span className="normal-case text-[var(--color-stone)]">(comma-separated)</span></label><input className={field} value={f.related} onChange={(e) => set('related', e.target.value)} placeholder="laser-hair-removal, hydraglow-facial" /></div>
          </div>

          {initial && <Link href={`/journal/${f.slug}`} target="_blank" className="block text-center text-sm text-[var(--color-gold)] hover:underline">View on site ↗</Link>}
        </div>
      </div>
    </div>
  );
}
