'use client';

import { useState } from 'react';

// BLD-242 — staff control to run the double opt-in re-permission send to legacy
// marketing opt-ins (those with no consent evidence, now excluded from sends).
// Sends in bounded batches; shows live progress and how many remain.
export function RepermissionCard({ initialPending, initialTotal }: { initialPending: number; initialTotal: number }) {
  const [pending, setPending] = useState(initialPending);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function send() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/admin/marketing/re-permission', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ limit: 200 }),
      });
      const j = await res.json();
      if (!j.ok) { setMsg(j.error || 'Could not send.'); }
      else { setPending(j.remaining); setMsg(`Sent ${j.sent}${j.failed ? `, ${j.failed} failed` : ''}. ${j.remaining} remaining.`); }
    } catch { setMsg('Network error — try again.'); }
    finally { setBusy(false); setConfirming(false); }
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow text-[var(--color-stone)]">Re-permission (GDPR)</p>
          <h3 className="mt-1 font-[family-name:var(--font-display)] text-lg">Win back legacy opt-ins</h3>
        </div>
        <span className="rounded-full bg-[var(--color-bone)] px-3 py-1 text-sm tabular-nums text-[var(--color-ink)]">{pending} pending</span>
      </div>
      <p className="mt-2 text-sm text-[var(--color-stone)]">
        {initialTotal} client{initialTotal === 1 ? '' : 's'} opted in before we recorded consent evidence, so they’re excluded from marketing.
        Send them a one-tap double opt-in email to bring those who still want to hear from you back in, lawfully.
      </p>

      {pending > 0 ? (
        !confirming ? (
          <button type="button" onClick={() => setConfirming(true)} disabled={busy}
            className="mt-4 rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm font-medium text-[var(--color-porcelain)] transition-opacity hover:opacity-90 disabled:opacity-50">
            Send re-permission emails
          </button>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-[var(--color-ink)]">Email up to 200 clients now?</span>
            <button type="button" onClick={send} disabled={busy}
              className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-[var(--color-porcelain)] disabled:opacity-50">
              {busy ? 'Sending…' : 'Yes, send'}
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={busy}
              className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm hover:bg-[var(--color-bone)]">
              Cancel
            </button>
          </div>
        )
      ) : (
        <p className="mt-4 text-sm text-[var(--color-jade)]">All legacy opt-ins have been emailed. ✓</p>
      )}

      {msg && <p className="mt-3 text-sm text-[var(--color-stone)]">{msg}</p>}
    </div>
  );
}
