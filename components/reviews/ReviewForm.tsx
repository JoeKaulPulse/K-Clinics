'use client';

import { useState } from 'react';
import { motion } from 'motion/react';

export function ReviewForm({ token, googleUrl }: { token: string; googleUrl: string | null }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (rating < 1) { setError('Please choose a rating.'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/review/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, rating, title, body }),
      });
      const json = await res.json().catch(() => ({ ok: false }));
      if (json.ok) setDone(true);
      else setError(json.error || 'Could not submit your review.');
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Happy path → nudge to Google. Lower ratings stay private with us.
  if (done) {
    const happy = rating >= 4;
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 text-center">
        <h2 className="font-[family-name:var(--font-display)] text-2xl">Thank you.</h2>
        <p className="mt-3 text-[var(--color-stone)]">
          {happy ? 'We’re so glad you had a great experience.' : 'Thank you for your honesty — we’ll use it to do better.'}
        </p>
        {happy && googleUrl && (
          <a href={googleUrl} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--color-gold)] px-6 py-3 text-sm font-medium text-white hover:bg-[var(--color-ink)]">
            Share it on Google
          </a>
        )}
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stars */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setRating(n)} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} aria-label={`${n} star${n > 1 ? 's' : ''}`}>
            <svg viewBox="0 0 24 24" className={`h-10 w-10 transition-colors ${(hover || rating) >= n ? 'text-[var(--color-gold)]' : 'text-[var(--color-sand)]'}`} fill="currentColor">
              <path d="M12 3l2.6 6 6.4.5-4.9 4.2 1.5 6.3L12 16.9 6.4 20l1.5-6.3L3 9.5 9.4 9 12 3z" />
            </svg>
          </button>
        ))}
      </div>

      <div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A headline for your review (optional)" className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-4 py-3 outline-none focus:border-[var(--color-gold)]" />
      </div>
      <div>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="Tell us about your visit…" className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-4 py-3 outline-none focus:border-[var(--color-gold)]" />
      </div>
      {error && <p className="rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-4 py-2.5 text-sm">{error}</p>}
      <button onClick={submit} disabled={loading} className="w-full rounded-full bg-[var(--color-gold)] px-6 py-3.5 font-medium text-white shadow-[var(--shadow-gold)] transition-colors hover:bg-[var(--color-ink)] disabled:opacity-60">
        {loading ? 'Submitting…' : 'Submit review'}
      </button>
    </div>
  );
}
