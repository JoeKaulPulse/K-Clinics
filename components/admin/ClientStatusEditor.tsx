'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type Status = 'GREEN' | 'YELLOW' | 'RED';

const OPTIONS: { value: Status; label: string; dot: string; active: string }[] = [
  { value: 'GREEN', label: 'Green — good client', dot: 'bg-[var(--color-jade)]', active: 'border-[var(--color-jade)] bg-[var(--color-jade)]/12 text-[var(--color-jade)]' },
  { value: 'YELLOW', label: 'Yellow — caution', dot: 'bg-amber-500', active: 'border-amber-500 bg-amber-100 text-amber-800' },
  { value: 'RED', label: 'Red — blocked', dot: 'bg-[var(--color-blush-deep)]', active: 'border-[var(--color-blush-deep)] bg-[var(--color-blush)]/20 text-[var(--color-blush-deep)]' },
];

/** BLD-1532: set a client's traffic-light status. Mirrors MedicalFlagEditor /
 *  PatchTestEditor in shape and weight; surfaced from Close Booking and the
 *  client profile. Green needs no explanation and saves immediately; yellow
 *  and red pause for an optional note so the "why" travels with the flag. */
export function ClientStatusEditor({
  clientId,
  status,
  setBy,
  setAt,
  reason,
}: {
  clientId: string;
  status: Status | null;
  setBy: string | null;
  setAt: string | null;
  reason: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  // The pill clicked but not yet confirmed (yellow/red pause here for a note).
  const [pendingChoice, setPendingChoice] = useState<Status | null>(null);
  const [note, setNote] = useState(reason ?? '');

  function save(value: Status | null, withNote: string) {
    setErr('');
    start(async () => {
      const res = await fetch('/api/admin/client-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, status: value, reason: value ? withNote : '' }),
      });
      if (res.ok) { setPendingChoice(null); router.refresh(); }
      else { const j = await res.json().catch(() => ({})); setErr(j.error || 'Could not save'); }
    });
  }

  function pick(value: Status) {
    if (value === status) return;
    setErr('');
    if (value === 'GREEN') { setNote(''); save('GREEN', ''); return; }
    setNote(status === value ? (reason ?? '') : '');
    setPendingChoice(value);
  }

  function clear() {
    if (!window.confirm('Clear this client’s status? It will show as unmarked (green) again.')) return;
    setPendingChoice(null);
    setNote('');
    save(null, '');
  }

  const current = OPTIONS.find((o) => o.value === status) ?? null;

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-[family-name:var(--font-display)] text-xl">Client status</h2>
        {current && <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${current.dot}`} />}
      </div>
      <div className={`rounded-[var(--radius-md)] border p-4 ${status === 'RED' ? 'border-[var(--color-blush-deep)] bg-[var(--color-blush)]/12' : status === 'YELLOW' ? 'border-amber-400 bg-amber-50' : 'border-[var(--color-line)] bg-[var(--color-porcelain)]'}`}>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Client status">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              disabled={pending}
              aria-pressed={status === o.value}
              onClick={() => pick(o.value)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium disabled:opacity-60 ${status === o.value ? o.active : 'border-[var(--color-line)] hover:border-[var(--color-stone-soft)]'}`}
            >
              <span aria-hidden className={`mr-1.5 inline-block h-2 w-2 rounded-full ${o.dot}`} />
              {o.label}
            </button>
          ))}
        </div>

        {status && !pendingChoice && (
          <p className="mt-3 text-xs text-[var(--color-stone)]">
            {setBy ? `Set by ${setBy}` : ''}{setAt ? ` · ${new Date(setAt).toLocaleDateString('en-GB')}` : ''}
          </p>
        )}
        {status && status !== 'GREEN' && reason && !pendingChoice && (
          <p className="mt-2 text-sm text-[var(--color-ink)]">{reason}</p>
        )}

        {pendingChoice && (
          <div className="mt-3">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Optional note for staff (e.g. reason for the flag)"
              aria-label="Client status note"
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)] focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]"
            />
            <div className="mt-2 flex items-center gap-2">
              <button disabled={pending} onClick={() => save(pendingChoice, note)} className="rounded-full bg-[var(--color-gold-deep)] px-4 py-1.5 text-xs font-medium text-white disabled:opacity-60">
                {pending ? 'Saving…' : `Save ${pendingChoice === 'YELLOW' ? 'yellow' : 'red'}`}
              </button>
              <button onClick={() => { setPendingChoice(null); setNote(reason ?? ''); }} className="text-xs text-[var(--color-stone)]">Cancel</button>
            </div>
          </div>
        )}

        {err && <p role="alert" aria-live="assertive" className="mt-2 text-xs text-[var(--color-blush-deep)]">{err}</p>}

        {status && !pendingChoice && (
          <div className="mt-3 flex items-center gap-2">
            {status !== 'GREEN' && (
              <button disabled={pending} onClick={() => { setNote(reason ?? ''); setPendingChoice(status); }} className="text-xs font-medium text-[var(--color-gold-deep)]">Edit note</button>
            )}
            <button disabled={pending} onClick={clear} className="text-xs text-[var(--color-stone)] hover:text-[var(--color-blush-deep)]">Clear status</button>
          </div>
        )}
      </div>
    </section>
  );
}
