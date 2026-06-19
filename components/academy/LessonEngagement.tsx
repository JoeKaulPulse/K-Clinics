'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CommentView } from '@/lib/lms';

// BLD-529: per-lesson engagement — private notes (autosaved) + a discussion / Q&A
// thread. Loaded lazily when the lesson opens so the course view stays light.

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function StaffBadge() {
  return <span className="rounded-full bg-[var(--color-gold)]/15 px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-[var(--color-gold)]">K Academy</span>;
}

function CommentCard({ c, onReply, onDelete }: { c: CommentView; onReply: (parentId: string, body: string) => Promise<void>; onDelete: (id: string) => void }) {
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    await onReply(c.id, text.trim());
    setBusy(false); setText(''); setReplying(false);
  }
  return (
    <li className={`rounded-[var(--radius-md)] border p-4 ${c.pinned ? 'border-[var(--color-gold)]/40 bg-[var(--color-gold)]/5' : 'border-[var(--color-line)] bg-white'}`}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-[var(--color-ink)]">{c.authorName}</span>
        {c.isStaff && <StaffBadge />}
        {c.pinned && <span className="text-[0.65rem] uppercase tracking-wide text-[var(--color-gold)]">📌 Pinned</span>}
        {c.resolved && <span className="rounded-full bg-[var(--color-line)] px-2 py-0.5 text-[0.65rem] text-[var(--color-stone)]">Answered</span>}
        <span className="ml-auto text-xs text-[var(--color-stone)]">{fmt(c.createdAt)}</span>
      </div>
      <p className="mt-1.5 whitespace-pre-line text-sm text-[var(--color-ink-soft)]">{c.body}</p>
      <div className="mt-2 flex items-center gap-3 text-xs">
        <button onClick={() => setReplying((v) => !v)} className="text-[var(--color-gold)] hover:underline">Reply</button>
        {c.mine && <button onClick={() => onDelete(c.id)} className="text-[var(--color-stone)] hover:text-[var(--color-blush)] hover:underline">Delete</button>}
      </div>

      {c.replies.length > 0 && (
        <ul className="mt-3 space-y-2 border-l-2 border-[var(--color-line)] pl-3">
          {c.replies.map((r) => (
            <li key={r.id}>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-[var(--color-ink)]">{r.authorName}</span>
                {r.isStaff && <StaffBadge />}
                <span className="ml-auto text-xs text-[var(--color-stone)]">{fmt(r.createdAt)}</span>
              </div>
              <p className="mt-1 whitespace-pre-line text-sm text-[var(--color-ink-soft)]">{r.body}</p>
              {r.mine && <button onClick={() => onDelete(r.id)} className="mt-1 text-xs text-[var(--color-stone)] hover:text-[var(--color-blush)] hover:underline">Delete</button>}
            </li>
          ))}
        </ul>
      )}

      {replying && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Write a reply…" className="flex-1 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm" />
          <button onClick={send} disabled={busy || !text.trim()} className="shrink-0 self-end rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy ? '…' : 'Reply'}</button>
        </div>
      )}
    </li>
  );
}

export function LessonEngagement({ lessonId }: { lessonId: string }) {
  const [note, setNote] = useState('');
  const [comments, setComments] = useState<CommentView[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<'' | 'saving' | 'saved'>('');
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lazy-load note + thread when the lesson changes.
  useEffect(() => {
    let active = true;
    setLoaded(false); setNote(''); setComments([]); setSaveState('');
    fetch(`/api/academy/discussion?lessonId=${encodeURIComponent(lessonId)}`)
      .then((r) => r.json())
      .then((j) => { if (active && j.ok) { setNote(j.note || ''); setComments(j.comments || []); } })
      .catch(() => {})
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; if (timer.current) clearTimeout(timer.current); };
  }, [lessonId]);

  const onNoteChange = useCallback((v: string) => {
    setNote(v); setSaveState('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await fetch('/api/academy/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonId, body: v }) }).catch(() => {});
      setSaveState('saved');
    }, 800);
  }, [lessonId]);

  async function postComment(body: string, parentId?: string) {
    const res = await fetch('/api/academy/discussion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonId, body, parentId: parentId ?? null }) }).then((r) => r.json()).catch(() => null);
    if (!res?.ok || !res.comment) return;
    const c: CommentView = res.comment;
    if (parentId) setComments((list) => list.map((t) => (t.id === parentId ? { ...t, replies: [...t.replies, c] } : t)));
    else setComments((list) => [...list, c]);
  }

  async function addTopLevel() {
    if (!newComment.trim()) return;
    setPosting(true);
    await postComment(newComment.trim());
    setPosting(false); setNewComment('');
  }

  async function deleteComment(id: string) {
    const res = await fetch('/api/academy/discussion', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commentId: id }) }).then((r) => r.json()).catch(() => null);
    if (!res?.ok) return; // leave the UI as-is if the server rejected it (keeps the view in sync)
    setComments((list) => list.filter((t) => t.id !== id).map((t) => ({ ...t, replies: t.replies.filter((r) => r.id !== id) })));
  }

  return (
    <div className="mt-8 grid gap-5 border-t border-[var(--color-line)] pt-7 lg:grid-cols-2">
      {/* My notes */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="eyebrow">My notes</p>
          <span className="text-xs text-[var(--color-stone)]">{saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? '✓ Saved' : 'Private to you'}</span>
        </div>
        <textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          rows={6}
          placeholder="Jot down anything you want to remember from this lesson. Only you can see this."
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3.5 py-3 text-sm leading-relaxed focus:border-[var(--color-gold)] focus:outline-none"
        />
      </section>

      {/* Discussion / Q&A */}
      <section>
        <p className="eyebrow mb-2">Discussion &amp; questions</p>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
          <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} rows={2} placeholder="Ask a question or share a thought with your trainer and cohort…" className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-sm" />
          <button onClick={addTopLevel} disabled={posting || !newComment.trim()} className="shrink-0 self-end rounded-full bg-[var(--color-gold)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-ink)] disabled:opacity-50">{posting ? 'Posting…' : 'Post'}</button>
        </div>
        {!loaded ? (
          <p className="text-sm text-[var(--color-stone)]">Loading…</p>
        ) : comments.length === 0 ? (
          <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-line)] p-4 text-sm text-[var(--color-stone)]">No questions yet. Ask away — your trainer will see your question and reply here.</p>
        ) : (
          <ul className="space-y-2.5">
            {comments.map((c) => <CommentCard key={c.id} c={c} onReply={(pid, b) => postComment(b, pid)} onDelete={deleteComment} />)}
          </ul>
        )}
      </section>
    </div>
  );
}
