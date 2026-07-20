'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Stars } from '@/components/ui/Stars';

// BLD-529: staff moderation for course reviews + lesson discussion / Q&A.
export type ReviewItem = { id: string; rating: number; title: string | null; body: string | null; authorName: string; status: string; createdAt: string; courseTitle: string };
export type QAReply = { id: string; authorName: string; body: string; isStaff: boolean; createdAt: string };
export type QuestionItem = { id: string; authorName: string; body: string; resolved: boolean; pinned: boolean; hidden: boolean; createdAt: string; courseTitle: string; moduleTitle: string; lessonTitle: string; replies: QAReply[] };

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

async function post(payload: object) {
  return fetch('/api/admin/lms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-[var(--color-gold)]/15 text-[var(--color-gold-deep)]',
  PUBLISHED: 'bg-green-100 text-green-800',
  HIDDEN: 'bg-[var(--color-line)] text-[var(--color-stone)]',
};

export function ReviewsBoard({ reviews, questions }: { reviews: ReviewItem[]; questions: QuestionItem[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<'reviews' | 'qa'>(reviews.some((r) => r.status === 'PENDING') ? 'reviews' : 'qa');
  const [busy, setBusy] = useState(false);
  async function act(payload: object) { setBusy(true); await post(payload); setBusy(false); router.refresh(); }

  const pendingReviews = reviews.filter((r) => r.status === 'PENDING').length;
  const openQs = questions.filter((q) => !q.resolved && !q.hidden).length;

  return (
    <div>
      <div className="mb-5 flex gap-2">
        <button onClick={() => setTab('reviews')} className={`rounded-full px-4 py-1.5 text-sm ${tab === 'reviews' ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'border border-[var(--color-line)] hover:border-[var(--color-gold)]'}`}>Reviews{pendingReviews ? ` · ${pendingReviews} pending` : ''}</button>
        <button onClick={() => setTab('qa')} className={`rounded-full px-4 py-1.5 text-sm ${tab === 'qa' ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'border border-[var(--color-line)] hover:border-[var(--color-gold)]'}`}>Discussion &amp; Q&amp;A{openQs ? ` · ${openQs} open` : ''}</button>
      </div>

      {tab === 'reviews' ? (
        reviews.length === 0 ? <Empty>No reviews yet.</Empty> : (
          <ul className="space-y-3">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Stars rating={r.rating} />
                  <span className="text-sm font-medium">{r.courseTitle}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide ${STATUS_BADGE[r.status] ?? ''}`}>{r.status}</span>
                  <span className="ml-auto text-xs text-[var(--color-stone)]">{r.authorName} · {fmt(r.createdAt)}</span>
                </div>
                {r.title && <p className="mt-2 font-medium">{r.title}</p>}
                {r.body && <p className="mt-1 whitespace-pre-line text-sm text-[var(--color-ink-soft)]">{r.body}</p>}
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {r.status !== 'PUBLISHED' && <button disabled={busy} onClick={() => act({ op: 'setReviewStatus', id: r.id, status: 'PUBLISHED' })} className="rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-[var(--color-porcelain)] disabled:opacity-50">Publish</button>}
                  {r.status !== 'HIDDEN' && <button disabled={busy} onClick={() => act({ op: 'setReviewStatus', id: r.id, status: 'HIDDEN' })} className="rounded-full border border-[var(--color-line)] px-3 py-1.5 hover:border-[var(--color-gold)] disabled:opacity-50">Hide</button>}
                  {r.status === 'PUBLISHED' && <button disabled={busy} onClick={() => act({ op: 'setReviewStatus', id: r.id, status: 'PENDING' })} className="rounded-full border border-[var(--color-line)] px-3 py-1.5 hover:border-[var(--color-gold)] disabled:opacity-50">Unpublish</button>}
                  <button disabled={busy} onClick={() => { if (confirm('Delete this review permanently?')) act({ op: 'deleteReview', id: r.id }); }} className="rounded-full px-3 py-1.5 text-[var(--color-blush-deep)] hover:underline disabled:opacity-50">Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : (
        questions.length === 0 ? <Empty>No questions yet.</Empty> : (
          <ul className="space-y-3">
            {questions.map((q) => <QuestionRow key={q.id} q={q} busy={busy} act={act} />)}
          </ul>
        )
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)] p-8 text-center text-sm text-[var(--color-stone)]">{children}</p>;
}

function QuestionRow({ q, busy, act }: { q: QuestionItem; busy: boolean; act: (p: object) => Promise<void> }) {
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  async function sendReply() {
    if (!reply.trim()) return;
    setSending(true);
    await act({ op: 'staffReply', parentId: q.id, body: reply.trim() });
    setSending(false); setReply('');
  }
  return (
    <li className={`rounded-[var(--radius-lg)] border p-4 ${q.hidden ? 'border-dashed border-[var(--color-line)] opacity-60' : q.resolved ? 'border-[var(--color-line)]' : 'border-[var(--color-gold)]/40 bg-[var(--color-gold)]/5'} bg-white`}>
      <p className="text-xs text-[var(--color-stone)]">{q.courseTitle} · {q.moduleTitle} · <span className="font-medium text-[var(--color-ink-soft)]">{q.lessonTitle}</span></p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{q.authorName}</span>
        {q.pinned && <span className="text-[0.65rem] uppercase tracking-wide text-[var(--color-gold-deep)]">📌 Pinned</span>}
        {q.resolved && <span className="rounded-full bg-[var(--color-line)] px-2 py-0.5 text-[0.65rem] text-[var(--color-stone)]">Answered</span>}
        {q.hidden && <span className="rounded-full bg-[var(--color-line)] px-2 py-0.5 text-[0.65rem] text-[var(--color-stone)]">Hidden</span>}
        <span className="ml-auto text-xs text-[var(--color-stone)]">{fmt(q.createdAt)}</span>
      </div>
      <p className="mt-1.5 whitespace-pre-line text-sm text-[var(--color-ink-soft)]">{q.body}</p>

      {q.replies.length > 0 && (
        <ul className="mt-3 space-y-2 border-l-2 border-[var(--color-line)] pl-3">
          {q.replies.map((r) => (
            <li key={r.id} className="text-sm">
              <span className="font-medium">{r.authorName}</span>{r.isStaff && <span className="ml-2 rounded-full bg-[var(--color-gold)]/15 px-2 py-0.5 text-[0.6rem] uppercase tracking-wide text-[var(--color-gold-deep)]">Staff</span>}
              <span className="ml-2 text-xs text-[var(--color-stone)]">{fmt(r.createdAt)}</span>
              <p className="mt-0.5 whitespace-pre-line text-[var(--color-ink-soft)]">{r.body}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} placeholder="Reply as K Academy (also marks the question answered and emails the trainee)…" className="flex-1 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm" />
        <button onClick={sendReply} disabled={sending || !reply.trim()} className="shrink-0 self-end rounded-full bg-[var(--color-gold)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-ink)] disabled:opacity-50">{sending ? 'Sending…' : 'Reply'}</button>
      </div>

      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <button disabled={busy} onClick={() => act({ op: 'pinComment', id: q.id, pinned: !q.pinned })} className="rounded-full border border-[var(--color-line)] px-3 py-1.5 hover:border-[var(--color-gold)] disabled:opacity-50">{q.pinned ? 'Unpin' : 'Pin'}</button>
        <button disabled={busy} onClick={() => act({ op: 'resolveComment', id: q.id, resolved: !q.resolved })} className="rounded-full border border-[var(--color-line)] px-3 py-1.5 hover:border-[var(--color-gold)] disabled:opacity-50">{q.resolved ? 'Reopen' : 'Mark answered'}</button>
        <button disabled={busy} onClick={() => act({ op: 'hideComment', id: q.id, hidden: !q.hidden })} className="rounded-full border border-[var(--color-line)] px-3 py-1.5 hover:border-[var(--color-gold)] disabled:opacity-50">{q.hidden ? 'Unhide' : 'Hide'}</button>
        <button disabled={busy} onClick={() => { if (confirm('Delete this question and its replies?')) act({ op: 'deleteComment', id: q.id }); }} className="rounded-full px-3 py-1.5 text-[var(--color-blush-deep)] hover:underline disabled:opacity-50">Delete</button>
      </div>
    </li>
  );
}
