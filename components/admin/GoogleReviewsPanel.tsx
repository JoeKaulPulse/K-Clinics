'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type GReview = {
  id: string;
  googleName: string;
  reviewerName: string | null;
  starRating: number;
  comment: string | null;
  createTime: string | null;
  replyComment: string | null;
};

const Stars = ({ n }: { n: number }) => (
  <span className="text-[var(--color-gold-deep)]" aria-label={`${n} star${n === 1 ? '' : 's'}`}>{'★'.repeat(n)}{'☆'.repeat(Math.max(0, 5 - n))}</span>
);

async function post(payload: object) {
  const r = await fetch('/api/admin/reviews/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return r.json().catch(() => ({ ok: false }));
}

export function GoogleReviewsPanel({ connected, configured, reviews }: { connected: boolean; configured: boolean; reviews: GReview[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  async function sync() {
    setBusy('sync'); setMsg('Importing from Google…');
    const r = await post({ op: 'sync' });
    setBusy('');
    setMsg(r.ok ? `Imported ${r.imported} review${r.imported === 1 ? '' : 's'}.` : (r.detail || r.error || 'Sync failed.'));
    if (r.ok) router.refresh();
  }
  async function disconnect() {
    if (!confirm('Disconnect Google Business Profile? Imported reviews stay, but no new ones sync until you reconnect.')) return;
    setBusy('disc'); await post({ op: 'disconnect' }); setBusy(''); router.refresh();
  }

  return (
    <section className="mt-10 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl">Google reviews</h2>
          <p className="mt-0.5 text-sm text-[var(--color-stone)]">Every review from your Google Business Profile — read them here and reply directly.</p>
        </div>
        <div className="flex items-center gap-2">
          {connected ? (
            <>
              <button onClick={sync} disabled={!!busy} className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy === 'sync' ? 'Importing…' : 'Sync now'}</button>
              <button onClick={disconnect} disabled={!!busy} className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm text-[var(--color-stone)] hover:border-[var(--color-blush)]">Disconnect</button>
            </>
          ) : configured ? (
            <a href="/api/admin/integrations/google-business/connect" className="rounded-full bg-[var(--color-gold-deep)] px-4 py-2 text-sm font-medium text-white">Connect Google Business</a>
          ) : (
            <span className="rounded-full bg-[var(--color-bone)] px-4 py-2 text-xs text-[var(--color-stone)]">Set the Google Business env vars to enable</span>
          )}
        </div>
      </div>

      {msg && <p className="mt-3 text-sm text-[var(--color-stone)]">{msg}</p>}

      {connected && (
        <div className="mt-5 space-y-3">
          {reviews.length === 0 && <p className="text-sm text-[var(--color-stone)]">No reviews imported yet — click “Sync now”.</p>}
          {reviews.map((r) => <GoogleReviewCard key={r.id} review={r} onChange={() => router.refresh()} />)}
        </div>
      )}
    </section>
  );
}

function GoogleReviewCard({ review, onChange }: { review: GReview; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(review.replyComment || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function send() {
    setBusy(true); setErr('');
    const r = await post({ op: 'reply', googleName: review.googleName, comment: text });
    setBusy(false);
    if (r.ok) { setOpen(false); onChange(); } else setErr(r.error || 'Could not post reply.');
  }
  async function remove() {
    if (!confirm('Delete your reply on Google?')) return;
    setBusy(true); const r = await post({ op: 'deleteReply', googleName: review.googleName }); setBusy(false);
    if (r.ok) { setText(''); setOpen(false); onChange(); } else setErr(r.error || 'Could not delete.');
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Stars n={review.starRating} />
        <span className="text-sm font-medium">{review.reviewerName || 'Google reviewer'}</span>
        {review.createTime && <span className="text-xs text-[var(--color-stone-soft)]">{new Date(review.createTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
      </div>
      {review.comment && <p className="mt-2 text-sm text-[var(--color-ink-soft)]">{review.comment}</p>}

      {review.replyComment && !open && (
        <div className="mt-3 rounded-[var(--radius-sm)] border-l-2 border-[var(--color-gold)] bg-[var(--color-bone)] px-3 py-2 text-sm">
          <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--color-gold-deep)]">Your reply</p>
          <p className="mt-0.5 text-[var(--color-ink-soft)]">{review.replyComment}</p>
        </div>
      )}

      {open ? (
        <div className="mt-3">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Write a public reply…" className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" />
          {err && <p className="mt-1 text-xs text-[var(--color-blush)]">{err}</p>}
          <div className="mt-2 flex gap-2">
            <button onClick={send} disabled={busy || !text.trim()} className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-xs text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Posting…' : 'Post reply to Google'}</button>
            <button onClick={() => setOpen(false)} className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-xs text-[var(--color-stone)]">Cancel</button>
            {review.replyComment && <button onClick={remove} disabled={busy} className="ml-auto text-xs text-[var(--color-blush)] hover:underline">Delete reply</button>}
          </div>
        </div>
      ) : (
        <button onClick={() => { setText(review.replyComment || ''); setOpen(true); }} className="mt-3 text-xs font-medium text-[var(--color-gold-deep)] hover:underline">
          {review.replyComment ? 'Edit reply' : 'Reply'}
        </button>
      )}
    </div>
  );
}
