'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Pill, AButton } from '@/components/academy/ui';

// BLD-533: a single community thread — opening post, replies, and a reply box.
export type ForumPostView = { id: string; authorName: string; isStaff: boolean; body: string; createdAt: string; mine: boolean };
export type ForumThreadView = {
  id: string; category: string; categoryLabel: string; title: string; body: string; authorName: string; isStaff: boolean;
  pinned: boolean; locked: boolean; createdAt: string; mine: boolean; posts: ForumPostView[];
};

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function Author({ name, isStaff, mine }: { name: string; isStaff: boolean; mine: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-ink)]">
      {name}
      {isStaff && <span className="rounded bg-[var(--color-ink)] px-1.5 py-0.5 text-[0.6rem] font-medium uppercase tracking-wide text-[var(--color-porcelain)]">Tutor</span>}
      {mine && !isStaff && <span className="rounded bg-[var(--color-gold)]/20 px-1.5 py-0.5 text-[0.6rem] font-medium uppercase tracking-wide text-[var(--color-gold-deep)]">You</span>}
    </span>
  );
}

export function ForumThreadView({ thread }: { thread: ForumThreadView }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reply() {
    setBusy(true); setError(null);
    try {
      const r = await fetch('/api/academy/forum', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'reply', threadId: thread.id, body }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) { setError(j.error || 'Could not reply. Try again.'); setBusy(false); return; }
      setBody(''); setBusy(false); router.refresh();
    } catch { setError('Network error. Try again.'); setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {thread.pinned && <Pill tone="gold">📌 Pinned</Pill>}
        <Pill tone={thread.category === 'announcements' ? 'info' : 'neutral'}>{thread.categoryLabel}</Pill>
        {thread.locked && <Pill tone="neutral">🔒 Locked</Pill>}
      </div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl md:text-3xl">{thread.title}</h1>

      <Card tone="white">
        <div className="flex items-center justify-between gap-2">
          <Author name={thread.authorName} isStaff={thread.isStaff} mine={thread.mine} />
          <span className="text-xs text-[var(--color-stone)]">{when(thread.createdAt)}</span>
        </div>
        <p className="mt-2.5 whitespace-pre-line text-[var(--color-ink-soft)]">{thread.body}</p>
      </Card>

      <div>
        <p className="mb-2.5 text-sm font-medium text-[var(--color-stone)]">{thread.posts.length} repl{thread.posts.length === 1 ? 'y' : 'ies'}</p>
        {thread.posts.length > 0 && (
          <ul className="space-y-2.5">
            {thread.posts.map((p) => (
              <li key={p.id}>
                <Card tone={p.isStaff ? 'porcelain' : 'bone'} accent={p.isStaff}>
                  <div className="flex items-center justify-between gap-2">
                    <Author name={p.authorName} isStaff={p.isStaff} mine={p.mine} />
                    <span className="text-xs text-[var(--color-stone)]">{when(p.createdAt)}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm text-[var(--color-ink-soft)]">{p.body}</p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>

      {thread.locked ? (
        <Card tone="bone"><p className="text-center text-sm text-[var(--color-stone)]">🔒 This thread is locked. No new replies can be added.</p></Card>
      ) : (
        <Card tone="white">
          <label className="block text-xs font-medium text-[var(--color-stone)]">Your reply
            <textarea className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm" rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add to the conversation…" maxLength={8000} />
          </label>
          {error && <p className="mt-2 text-sm text-[var(--color-blush)]">{error}</p>}
          <div className="mt-3"><AButton onClick={reply} disabled={busy || body.trim().length === 0} size="sm">{busy ? 'Posting…' : 'Post reply'}</AButton></div>
        </Card>
      )}
    </div>
  );
}
