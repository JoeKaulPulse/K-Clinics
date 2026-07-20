'use client';

import { useState } from 'react';
import type { ReviewView } from '@/lib/lms';

// BLD-529: trainee leaves / edits a star review for the course. Submissions are
// held for staff moderation before appearing on the public course page.

function Stars({ value, onChange, size = 28 }: { value: number; onChange?: (n: number) => void; size?: number }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1" role={onChange ? 'radiogroup' : undefined} aria-label="Star rating">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = (hover || value) >= n;
        return (
          <button
            key={n}
            type="button"
            disabled={!onChange}
            onClick={() => onChange?.(n)}
            onMouseEnter={() => onChange && setHover(n)}
            onMouseLeave={() => onChange && setHover(0)}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            aria-checked={value === n}
            role={onChange ? 'radio' : undefined}
            className={`${onChange ? 'cursor-pointer' : 'cursor-default'} leading-none transition-transform ${onChange ? 'hover:scale-110' : ''}`}
            style={{ fontSize: size, color: filled ? 'var(--color-gold)' : 'var(--color-line)' }}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}

export function CourseReviewPrompt({ courseId, courseTitle, myReview }: { courseId: string; courseTitle: string; myReview: ReviewView }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(myReview?.rating ?? 0);
  const [title, setTitle] = useState(myReview?.title ?? '');
  const [body, setBody] = useState(myReview?.body ?? '');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    if (!rating) { setErr('Please choose a star rating.'); return; }
    setBusy(true); setErr('');
    const res = await fetch('/api/academy/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseId, rating, title, body }) }).then((r) => r.json()).catch(() => null);
    setBusy(false);
    if (res?.ok) setDone(true);
    else setErr(res?.error || 'Could not save your review.');
  }

  const label = myReview ? 'Edit your review' : 'Leave a review';

  return (
    <>
      <button onClick={() => { setOpen(true); setDone(false); }} className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-medium hover:border-[var(--color-gold)] hover:text-[var(--color-gold-deep)]">
        <span className="text-[var(--color-gold)]">★</span> {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {done ? (
              <div className="text-center">
                <p className="font-[family-name:var(--font-display)] text-2xl">Thank you</p>
                <p className="mt-2 text-sm text-[var(--color-stone)]">Your review has been sent for a quick check and will appear on the course page once approved.</p>
                <button onClick={() => setOpen(false)} className="mt-5 rounded-full bg-[var(--color-ink)] px-6 py-2.5 text-sm font-medium text-[var(--color-porcelain)]">Close</button>
              </div>
            ) : (
              <>
                <h3 className="font-[family-name:var(--font-display)] text-xl">Review {courseTitle}</h3>
                <p className="mt-1 text-sm text-[var(--color-stone)]">How was your experience? Your name shows as your first name and last initial.</p>
                <div className="mt-4"><Stars value={rating} onChange={setRating} /></div>
                <label className="mt-4 block text-xs text-[var(--color-stone)]">Headline (optional)
                  <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="e.g. Brilliant trainer, learned so much" className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm" />
                </label>
                <label className="mt-3 block text-xs text-[var(--color-stone)]">Your review (optional)
                  <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={4000} placeholder="What stood out? What would you tell someone thinking about this course?" className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm" />
                </label>
                {err && <p role="alert" aria-live="assertive" className="mt-3 text-sm text-[var(--color-blush-deep)]">{err}</p>}
                <div className="mt-5 flex items-center justify-end gap-3">
                  <button onClick={() => setOpen(false)} className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">Cancel</button>
                  <button onClick={submit} disabled={busy} className="rounded-full bg-[var(--color-gold)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-ink)] disabled:opacity-60">{busy ? 'Saving…' : 'Submit review'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
