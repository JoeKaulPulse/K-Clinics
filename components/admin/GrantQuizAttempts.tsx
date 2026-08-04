'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

// BLD-1139 — a trainee who exhausts a quiz's attempt limit without passing can
// never finish the course (certificates require every quiz passed). This grants
// extra attempts with a reason; attempt history is untouched and the grant is
// audit-logged server-side.
type Blocked = { id: string; title: string; used: number; allowed: number };

export function GrantQuizAttempts({ studentId, blocked }: { studentId: string; blocked: Blocked[] }) {
  const router = useRouter();
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (blocked.length === 0) return null;

  function grant(quizId: string) {
    if (pending) return;
    setError(null);
    start(async () => {
      const res = await fetch('/api/admin/academy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'grantQuizAttempts', studentId, quizId, extra: 1, reason: reason.trim() || undefined }),
      });
      const j = await res.json().catch(() => ({ ok: false }));
      if (j.ok) { setReasonFor(null); setReason(''); router.refresh(); }
      else setError(j.error || 'Could not grant the attempt.');
    });
  }

  return (
    <div className="mt-3 rounded-[var(--radius-sm)] border border-[var(--color-gold)]/40 bg-[var(--color-bone)]/50 p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-stone)]">Blocked — out of attempts</p>
      <ul className="space-y-2 text-sm">
        {blocked.map((q) => (
          <li key={q.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0">{q.title} <span className="text-xs text-[var(--color-stone)]">({q.used} of {q.allowed} attempts used, not passed)</span></span>
              {reasonFor === q.id ? null : (
                <button type="button" onClick={() => setReasonFor(q.id)} className="shrink-0 rounded-full border border-[var(--color-gold)] px-3 py-1 text-xs text-[var(--color-gold-deep)] hover:bg-[var(--color-gold)]/10">
                  Grant 1 extra attempt
                </button>
              )}
            </div>
            {reasonFor === q.id && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  autoFocus value={reason} onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason (e.g. tutor approved a resit)" aria-label="Reason for the extra attempt"
                  className="min-w-[12rem] flex-1 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2 py-1.5 text-xs"
                />
                <button type="button" disabled={pending} onClick={() => grant(q.id)} className="rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs font-medium text-[var(--color-porcelain)] disabled:opacity-40">
                  {pending ? 'Granting…' : 'Confirm'}
                </button>
                <button type="button" disabled={pending} onClick={() => { setReasonFor(null); setReason(''); }} className="rounded-full px-2 py-1.5 text-xs text-[var(--color-stone)] hover:text-[var(--color-ink)]">Cancel</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {error && <p role="alert" aria-live="assertive" className="mt-2 text-xs text-[var(--color-blush-deep)]">{error}</p>}
    </div>
  );
}
