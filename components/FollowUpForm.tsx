'use client';

import { useState, type ReactNode } from 'react';

// Refined line-art sentiment marks in brand currentColor — no emoji, in keeping
// with the clinic's house style. Eyes + a mouth whose curve carries the meaning.
const face = (mouth: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="9" cy="10" r="0.9" fill="currentColor" />
    <circle cx="15" cy="10" r="0.9" fill="currentColor" />
    {mouth}
  </svg>
);

const OPTIONS = [
  { id: 'great', icon: face(<path d="M8 14c1.2 1.8 2.5 2.6 4 2.6s2.8-.8 4-2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />), label: 'Great — loving the results' },
  { id: 'ok', icon: face(<path d="M8.5 14.5h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />), label: 'OK — all as expected' },
  { id: 'concerned', icon: face(<path d="M8 15.6c1.2-1.8 2.5-2.6 4-2.6s2.8.8 4 2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />), label: 'I have a concern' },
] as const;

export function FollowUpForm({ token, treatment }: { token: string; treatment: string }) {
  const [sentiment, setSentiment] = useState<string>('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | { concern: boolean }>(null);
  const [error, setError] = useState('');

  async function submit() {
    if (!sentiment) { setError('Please choose how you’re getting on.'); return; }
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/follow-up', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, sentiment, comment }) });
      const j = await res.json();
      if (j.ok) setDone({ concern: !!j.concern }); else setError(j.error || 'Something went wrong.');
    } catch { setError('Network error. Please try again.'); }
    finally { setBusy(false); }
  }

  if (done) {
    return (
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[var(--color-ink)] text-[var(--color-gold-soft)]">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <h2 className="font-[family-name:var(--font-display)] text-2xl">Thank you</h2>
        <p className="mx-auto mt-3 max-w-md text-[var(--color-stone)]">
          {done.concern
            ? 'Thank you for letting us know. Our clinical team has been alerted and will be in touch shortly. If it’s urgent, please call us.'
            : 'We’re so glad to hear it. If anything changes, you can always reach us — and we’d love to welcome you back.'}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-6 md:p-8">
      <h2 className="font-[family-name:var(--font-display)] text-2xl">How is your skin today?</h2>
      <p className="mt-1 text-sm text-[var(--color-stone)]">A week on from your {treatment} — how are you getting on?</p>
      <div className="mt-6 grid gap-2">
        {OPTIONS.map((o) => (
          <button key={o.id} type="button" onClick={() => setSentiment(o.id)} aria-pressed={sentiment === o.id}
            className={`flex items-center gap-3 rounded-[var(--radius-md)] border p-4 text-left transition-all ${sentiment === o.id ? 'border-[var(--color-gold)] bg-[var(--color-porcelain)] text-[var(--color-gold-deep)]' : 'border-[var(--color-line)] text-[var(--color-stone)] hover:border-[var(--color-stone-soft)]'}`}>
            <span aria-hidden>{o.icon}</span><span className="text-sm font-medium text-[var(--color-ink)]">{o.label}</span>
          </button>
        ))}
      </div>
      <div className="mt-4">
        <label className="mb-1.5 block text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]" htmlFor="fc">Anything you’d like to tell us? (optional)</label>
        <textarea id="fc" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-4 py-3 outline-none focus:border-[var(--color-gold)]" />
      </div>
      {error && <p role="alert" aria-live="assertive" className="mt-3 rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-4 py-3 text-sm text-[var(--color-ink)]">{error}</p>}
      <button onClick={submit} disabled={busy} className="mt-5 rounded-full bg-[var(--color-gold-deep)] px-6 py-3 text-sm font-medium text-white hover:bg-[var(--color-ink)] disabled:opacity-60">{busy ? 'Sending…' : 'Send'}</button>
    </div>
  );
}
