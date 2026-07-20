'use client';

import { useEffect, useState } from 'react';

// Public NPS capture: pick 0–10 (pre-filled from the email's one-click link),
// then add an optional comment. Posts to /api/nps (token-gated).
export function NpsWidget({ token, initialScore }: { token: string; initialScore: number | null }) {
  const [score, setScore] = useState<number | null>(initialScore);
  const [comment, setComment] = useState('');
  const [stage, setStage] = useState<'pick' | 'comment' | 'done'>(initialScore != null ? 'comment' : 'pick');
  const [busy, setBusy] = useState(false);

  async function record(s: number) {
    setScore(s); setStage('comment'); setBusy(true);
    await fetch('/api/nps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, score: s }) }).catch(() => {});
    setBusy(false);
  }
  // Record the score that arrived via the email link, once.
  useEffect(() => { if (initialScore != null) fetch('/api/nps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, score: initialScore }) }).catch(() => {}); }, [initialScore, token]);

  async function submitComment() {
    setBusy(true);
    await fetch('/api/nps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, comment }) }).catch(() => {});
    setBusy(false); setStage('done');
  }

  return (
    <div className="mx-auto max-w-lg rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-8 text-center shadow-[var(--shadow-soft)]">
      {stage === 'done' ? (
        <>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">Thank you.</h1>
          <p className="mt-3 text-[var(--color-stone)]">We're grateful for your feedback — it genuinely helps us look after you better.</p>
        </>
      ) : (
        <>
          <h1 className="font-[family-name:var(--font-display)] text-2xl">How likely are you to recommend KClinics?</h1>
          <p className="mt-2 text-sm text-[var(--color-stone)]">0 = not likely · 10 = very likely</p>
          <div className="mt-5 flex flex-wrap justify-center gap-1.5">
            {Array.from({ length: 11 }, (_, n) => (
              <button key={n} onClick={() => record(n)} aria-pressed={score === n}
                className={`grid h-10 w-10 place-items-center rounded-[var(--radius-sm)] border text-sm transition-colors ${score === n ? 'border-[var(--color-gold)] bg-[var(--color-gold-deep)] text-white' : 'border-[var(--color-line)] hover:border-[var(--color-gold)]'}`}>
                {n}
              </button>
            ))}
          </div>
          {stage === 'comment' && (
            <div className="mt-6 text-left">
              <p className="text-sm text-[var(--color-stone)]">Thank you{score != null ? ` for the ${score}` : ''}! Anything you'd like to add? (optional)</p>
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="What did we do well, or how could we improve?" className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--color-gold)]" />
              <button onClick={submitComment} disabled={busy} className="mt-3 rounded-full bg-[var(--color-gold-deep)] px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Sending…' : comment.trim() ? 'Send feedback' : 'Done'}</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
