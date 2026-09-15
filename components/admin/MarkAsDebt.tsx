'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui/Dialog';

// BLD-1572 — "Mark as Debt": staff manually record an outstanding balance on a
// client — the card couldn't be charged, the payment failed, or the client
// left without paying. Saved permanently to the client's profile (ClientDebt)
// and shown there as an "Outstanding balance" indicator until resolved.

const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)] focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]';

export function MarkAsDebt({ clientId, bookingId, clientName }: { clientId: string; bookingId?: string; clientName?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  function close() {
    if (busy) return;
    setOpen(false);
    setError('');
    setAmount('');
    setReason('');
  }

  async function save() {
    const pence = Math.round(parseFloat(amount) * 100);
    if (!(pence > 0)) { setError('Enter the amount owed.'); return; }
    if (!reason.trim()) { setError('Add a reason explaining why the payment is outstanding.'); return; }
    setBusy(true); setError('');
    const r = await fetch(`/api/admin/clients/${clientId}/debt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountPence: pence, reason: reason.trim(), bookingId }),
    }).then((x) => x.json()).catch(() => ({ ok: false }));
    setBusy(false);
    if (r.ok) {
      close();
      router.refresh();
    } else {
      setError(r.error || 'Could not save.');
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-full border border-[var(--color-blush-deep)] px-4 py-2 text-sm font-medium text-[var(--color-blush-deep)] hover:bg-[var(--color-blush)]/15"
      >
        Mark as Debt…
      </button>

      <Dialog open={open} onClose={close} labelledby="mark-as-debt-title">
        <div className="w-full max-w-md rounded-t-[var(--radius-xl)] bg-[var(--color-porcelain)] p-6 shadow-[var(--shadow-lift)] sm:rounded-[var(--radius-xl)]">
          <div className="mb-1 flex items-center justify-between">
            <h2 id="mark-as-debt-title" className="font-[family-name:var(--font-display)] text-xl">Mark as Debt</h2>
            <button onClick={close} aria-label="Close" className="text-[var(--color-stone)] hover:text-[var(--color-ink)]"><span aria-hidden="true">✕</span></button>
          </div>
          <p className="mb-4 text-xs text-[var(--color-stone)]">
            Record an outstanding payment{clientName ? ` for ${clientName}` : ''} — e.g. the card couldn’t be charged, the
            payment failed, or they left without paying. This is saved permanently to their profile and shows as an
            Outstanding balance until cleared.
          </p>

          <div className="space-y-3">
            <label className="block text-xs text-[var(--color-stone)]">Amount owed (£) *<br />
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" autoFocus
                className={`${field} mt-1`} />
            </label>
            <label className="block text-xs text-[var(--color-stone)]">Reason *<br />
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Why is this payment outstanding?"
                className={`${field} mt-1`} />
            </label>
            {error && <p role="alert" aria-live="assertive" className="rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-3 py-2 text-sm">{error}</p>}
          </div>

          <div className="mt-4 flex justify-end gap-3">
            <button onClick={close} disabled={busy} className="px-4 py-2 text-sm text-[var(--color-stone)] disabled:opacity-50">Cancel</button>
            <button onClick={save} disabled={busy} className="rounded-full bg-[var(--color-blush-deep)] px-5 py-2 text-sm font-medium text-white disabled:opacity-60">
              {busy ? 'Saving…' : 'Mark as Debt'}
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
