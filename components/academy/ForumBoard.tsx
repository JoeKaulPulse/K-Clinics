'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, Pill, AButton, EmptyState } from '@/components/academy/ui';

// BLD-533: trainee community board — category filter, thread list, new-post composer.
export type ForumCategoryDef = { key: string; label: string };
export type ForumThreadSummary = {
  id: string; category: string; title: string; authorName: string; isStaff: boolean;
  pinned: boolean; locked: boolean; replyCount: number; lastPostAt: string; createdAt: string; excerpt: string;
};

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = s / 60; if (m < 60) return `${Math.floor(m)}m ago`;
  const h = m / 60; if (h < 24) return `${Math.floor(h)}h ago`;
  const d = h / 24; if (d < 7) return `${Math.floor(d)}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function ForumBoard({ threads, categories }: { threads: ForumThreadSummary[]; categories: ForumCategoryDef[] }) {
  const router = useRouter();
  const [active, setActive] = useState<string>('all');
  const [composing, setComposing] = useState(false);
  const label = (key: string) => categories.find((c) => c.key === key)?.label ?? 'General';

  const shown = active === 'all' ? threads : threads.filter((t) => t.category === active);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setActive('all')} className={chip(active === 'all')}>All</button>
        {categories.map((c) => <button key={c.key} onClick={() => setActive(c.key)} className={chip(active === c.key)}>{c.label}</button>)}
        <div className="ml-auto"><AButton onClick={() => setComposing((v) => !v)} variant={composing ? 'secondary' : 'primary'} size="sm">{composing ? 'Cancel' : '+ New post'}</AButton></div>
      </div>

      {composing && <Composer categories={categories.filter((c) => c.key !== 'announcements')} onDone={(id) => { setComposing(false); if (id) router.push(`/academy/community/${id}`); else router.refresh(); }} />}

      {shown.length === 0 ? (
        <EmptyState title="No posts here yet">Be the first to start a conversation — ask a question, share a win, or say hello.</EmptyState>
      ) : (
        <ul className="space-y-2.5">
          {shown.map((t) => (
            <li key={t.id}>
              <Link href={`/academy/community/${t.id}`} className="block">
                <Card tone="white" className="transition-colors hover:border-[var(--color-gold)]">
                  <div className="flex flex-wrap items-center gap-2">
                    {t.pinned && <Pill tone="gold">📌 Pinned</Pill>}
                    <Pill tone={t.category === 'announcements' ? 'info' : 'neutral'}>{label(t.category)}</Pill>
                    {t.locked && <Pill tone="neutral">🔒 Locked</Pill>}
                  </div>
                  <h3 className="mt-2 font-[family-name:var(--font-display)] text-lg leading-snug text-[var(--color-ink)]">{t.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-[var(--color-ink-soft)]">{t.excerpt}</p>
                  <p className="mt-2.5 text-xs text-[var(--color-stone)]">
                    {t.authorName}{t.isStaff && <span className="ml-1 rounded bg-[var(--color-ink)] px-1.5 py-0.5 text-[0.6rem] font-medium uppercase tracking-wide text-[var(--color-porcelain)]">Tutor</span>}
                    {' · '}{t.replyCount} repl{t.replyCount === 1 ? 'y' : 'ies'}{' · '}active {timeAgo(t.lastPostAt)}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const chip = (on: boolean) => `rounded-full border px-3 py-1 text-xs font-medium transition-colors ${on ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'border-[var(--color-line)] text-[var(--color-stone)] hover:border-[var(--color-gold)]'}`;

function Composer({ categories, onDone }: { categories: ForumCategoryDef[]; onDone: (id?: string) => void }) {
  const [category, setCategory] = useState(categories[0]?.key ?? 'general');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true); setError(null);
    try {
      const r = await fetch('/api/academy/forum', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'createThread', category, title, body }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) { setError(j.error || 'Could not post. Try again.'); setBusy(false); return; }
      onDone(j.id);
    } catch { setError('Network error. Try again.'); setBusy(false); }
  }

  const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm';
  return (
    <Card tone="porcelain" accent>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3">
          <label className="text-xs font-medium text-[var(--color-stone)]">Category
            <select className={`${field} mt-1`} value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </label>
          <label className="flex-1 text-xs font-medium text-[var(--color-stone)]">Title
            <input className={`${field} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What's your post about?" maxLength={160} />
          </label>
        </div>
        <label className="block text-xs font-medium text-[var(--color-stone)]">Message
          <textarea className={`${field} mt-1`} rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Share your question, tip or update. Be kind — this is a space for the whole cohort." maxLength={8000} />
        </label>
        {error && <p role="alert" aria-live="assertive" className="text-sm text-[var(--color-blush)]">{error}</p>}
        <div className="flex items-center gap-3">
          <AButton onClick={submit} disabled={busy || title.trim().length < 4 || body.trim().length < 2} size="sm">{busy ? 'Posting…' : 'Post to community'}</AButton>
          <AButton onClick={() => onDone()} variant="secondary" size="sm">Cancel</AButton>
        </div>
      </div>
    </Card>
  );
}
