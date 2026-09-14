'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// BLD-533: community forum moderation.
export type ModPost = { id: string; authorName: string; isStaff: boolean; body: string; hidden: boolean; createdAt: string };
export type ModThread = {
  id: string; category: string; title: string; body: string; authorName: string; isStaff: boolean;
  pinned: boolean; locked: boolean; hidden: boolean; replyCount: number; lastPostAt: string; createdAt: string;
};
export type CategoryDef = { key: string; label: string };

const btn = 'rounded-full border border-[var(--color-line)] px-3 py-1 text-xs hover:border-[var(--color-gold)] disabled:opacity-40';
const btnDark = 'rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-xs font-medium text-[var(--color-porcelain)] disabled:opacity-50';
const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-2.5 py-1.5 text-sm';
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

async function post(payload: object) { return fetch('/api/admin/forum', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); }

export function ForumModeration({ threads, categories }: { threads: ModThread[]; categories: CategoryDef[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [composing, setComposing] = useState(false);
  const label = (key: string) => categories.find((c) => c.key === key)?.label ?? key;
  async function act(payload: object) { setBusy(true); await post(payload); setBusy(false); router.refresh(); }

  return (
    <div className="space-y-5">
      <button onClick={() => setComposing((v) => !v)} disabled={busy} className={btnDark}>{composing ? 'Cancel' : '+ Post announcement / thread'}</button>
      {composing && <NewThread categories={categories} busy={busy} onDone={() => { setComposing(false); router.refresh(); }} setBusy={setBusy} />}

      {threads.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)] p-6 text-center text-sm text-[var(--color-stone)]">No community threads yet. Trainees can post from the portal’s Community tab; you can start one here.</p>
      ) : threads.map((t) => <ThreadRow key={t.id} thread={t} label={label} busy={busy} act={act} />)}
    </div>
  );
}

function NewThread({ categories, busy, setBusy, onDone }: { categories: CategoryDef[]; busy: boolean; setBusy: (b: boolean) => void; onDone: () => void }) {
  const [category, setCategory] = useState('announcements');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  async function submit() { setBusy(true); await post({ op: 'staffCreateThread', category, title, body }); setBusy(false); onDone(); }
  return (
    <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--color-gold)]/40 bg-[var(--color-porcelain)] p-4">
      <div className="flex flex-wrap gap-3">
        <label className="text-xs font-medium text-[var(--color-stone)]">Category
          <select className={`${field} mt-1`} value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </label>
        <label className="flex-1 text-xs font-medium text-[var(--color-stone)]">Title
          <input className={`${field} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />
        </label>
      </div>
      <label className="block text-xs font-medium text-[var(--color-stone)]">Message
        <textarea className={`${field} mt-1`} rows={4} value={body} onChange={(e) => setBody(e.target.value)} maxLength={8000} />
      </label>
      <button onClick={submit} disabled={busy || title.trim().length < 4 || !body.trim()} className={btnDark}>Post as K Academy</button>
    </div>
  );
}

function ThreadRow({ thread: t, label, busy, act }: { thread: ModThread; label: (k: string) => string; busy: boolean; act: (p: object) => Promise<void> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState('');
  const [replying, setReplying] = useState(false);
  // BLD-1724: posts load only when the thread is expanded, instead of every
  // thread's full post history shipping on every page load.
  const [posts, setPosts] = useState<ModPost[] | null>(null);
  const [loadingPosts, setLoadingPosts] = useState(false);
  async function loadPosts() {
    setLoadingPosts(true);
    const res = await post({ op: 'threadPosts', threadId: t.id });
    const j = await res.json().catch(() => ({}));
    setPosts(Array.isArray(j.posts) ? j.posts : []);
    setLoadingPosts(false);
  }
  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && posts === null) await loadPosts();
  }
  // Thread-level actions (pin/lock/hide/delete) go through the parent's `act`
  // as before; post-level actions also need the freshly-loaded posts to
  // reflect the change, since they're no longer part of the server-rendered
  // `threads` prop that router.refresh() updates.
  async function actAndReloadPosts(payload: object) { await act(payload); await loadPosts(); }
  async function sendReply() { if (!reply.trim()) return; setReplying(true); await post({ op: 'staffReply', threadId: t.id, body: reply.trim() }); setReply(''); setReplying(false); await loadPosts(); router.refresh(); }

  return (
    <div className={`rounded-[var(--radius-md)] border bg-[var(--color-porcelain)] ${t.hidden ? 'border-dashed border-[var(--color-line)] opacity-70' : 'border-[var(--color-line)]'}`}>
      <div className="flex flex-wrap items-center gap-2 p-3">
        <button onClick={toggleOpen} className="text-[var(--color-stone)]">{open ? '▾' : '▸'}</button>
        <span className="flex-1 text-sm">
          <span className="font-medium text-[var(--color-ink)]">{t.title}</span>
          <span className="text-[var(--color-stone)]"> · {label(t.category)} · {t.authorName}{t.isStaff ? ' (tutor)' : ''} · {t.replyCount} repl{t.replyCount === 1 ? 'y' : 'ies'}</span>
          {t.pinned && <span className="ml-1 text-[var(--color-gold)]">📌</span>}
          {t.locked && <span className="ml-1">🔒</span>}
          {t.hidden && <span className="ml-1 rounded bg-[var(--color-line)] px-1.5 py-0.5 text-[0.6rem] uppercase text-[var(--color-stone)]">Hidden</span>}
        </span>
      </div>
      {open && (
        <div className="space-y-3 border-t border-[var(--color-line)] p-3">
          <p className="whitespace-pre-line rounded-[var(--radius-sm)] bg-[var(--color-bone)] p-3 text-sm text-[var(--color-ink-soft)]">{t.body}</p>

          <div className="flex flex-wrap gap-2">
            <button onClick={() => act({ op: 'pinThread', id: t.id, value: !t.pinned })} disabled={busy} className={btn}>{t.pinned ? 'Unpin' : 'Pin'}</button>
            <button onClick={() => act({ op: 'lockThread', id: t.id, value: !t.locked })} disabled={busy} className={btn}>{t.locked ? 'Unlock' : 'Lock'}</button>
            <button onClick={() => act({ op: 'hideThread', id: t.id, value: !t.hidden })} disabled={busy} className={btn}>{t.hidden ? 'Unhide' : 'Hide'}</button>
            <button onClick={() => { if (confirm('Delete this thread and all its replies permanently?')) act({ op: 'deleteThread', id: t.id }); }} disabled={busy} className="rounded-full px-3 py-1 text-xs text-[var(--color-blush-deep)] hover:underline disabled:opacity-40">Delete thread</button>
          </div>

          {loadingPosts && <p className="text-sm text-[var(--color-stone)]">Loading replies…</p>}
          {posts && posts.length > 0 && (
            <ul className="space-y-1.5">
              {posts.map((p) => (
                <li key={p.id} className={`rounded-[var(--radius-sm)] border border-[var(--color-line)] p-2.5 text-sm ${p.hidden ? 'opacity-60' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-[var(--color-ink)]">{p.authorName}{p.isStaff ? ' (tutor)' : ''} <span className="text-[var(--color-stone)]">· {when(p.createdAt)}</span></span>
                    <span className="flex gap-2">
                      <button onClick={() => actAndReloadPosts({ op: 'hidePost', id: p.id, value: !p.hidden })} disabled={busy} className={btn}>{p.hidden ? 'Unhide' : 'Hide'}</button>
                      <button onClick={() => { if (confirm('Delete this reply permanently?')) actAndReloadPosts({ op: 'deletePost', id: p.id }); }} disabled={busy} className="text-xs text-[var(--color-blush-deep)] hover:underline disabled:opacity-40">Delete</button>
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-[var(--color-ink-soft)]">{p.body}</p>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2">
            <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} placeholder="Reply as K Academy…" aria-label="Reply to question" className="flex-1 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 text-sm" />
            <button onClick={sendReply} disabled={replying || !reply.trim()} className="shrink-0 self-end rounded-full bg-[var(--color-gold-deep)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-ink)] disabled:opacity-50">{replying ? 'Sending…' : 'Reply'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
