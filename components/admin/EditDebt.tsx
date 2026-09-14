'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui/Dialog';

// BLD-1763 — edit or clear an existing staff-recorded outstanding balance
// ("Mark as Debt", BLD-1572). Sits next to each unresolved debt row on the
// client profile so a mistaken or since-settled amount no longer needs a
// database edit to correct.

const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)] focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]';

export function EditDebt({ clientId, debtId, amountPence, reason }: { clientId: string; debtId: string; amountPence: number; reason: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [amount, setAmount] = useState((amountPence / 100).toFixed(2));
  const [reasonText, setReasonText] = useState(reason);

  function close() {
    if (busy) return;
    setOpen(false);
    setError('');
    setAmount((amountPence / 100).toFixed(2));
    setReasonText(reason);
  }

  async function save() {
    const pence = Math.round(parseFloat(amount) * 100);
    if (!(pence > 0)) { setError('Enter the amount owed.'); return; }
    if (!reasonText.trim()) { setError('Add a reason explaining why the payment is outstanding.'); return; }
    setBusy(true); setError('');
    const r = await fetch(`/api/admin/clients/${clientId}/debt/${debtId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountPence: pence, reason: reasonText.trim() }),
    }).then((x) => x.json()).catch(() => ({ ok: false }));
    setBusy(false);
    if (r.ok) {
      setOpen(false);
      router.refresh();
    } else {
      setError(r.error || 'Could not save.');
    }
  }

  async function clear() {
    if (!confirm('Clear this outstanding balance? This can’t be undone from here.')) return;
    setBusy(true); setError('');
    const r = await fetch(`/api/admin/clients/${clientId}/debt/${debtId}`, { method: 'DELETE' })
      .then((x) => x.json()).catch(() => ({ ok: false }));
    setBusy(false);
    if (r.ok) router.refresh();
    else setError(r.error || 'Could not clear.');
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-xs">
      <button onClick={() => { setError(''); setOpen(true); }} disabled={busy} className="text-[var(--color-gold-deep)] hover:underline disabled:opacity-50">Edit</button>
      <button onClick={clear} disabled={busy} className="text-[var(--color-blush-deep)] hover:underline disabled:opacity-50">Clear</button>
      {/* "Clear" is pressed from this row with the dialog shut, so a failed
          DELETE has nowhere to surface inside the dialog — the row simply sat
          there unchanged and the refusal (403, 404, a dropped request) was
          invisible. Render it here whenever the dialog isn't open. */}
      {error && !open && <span role="alert" className="text-[var(--color-blush-deep)]">{error}</span>}

      <Dialog open={open} onClose={close} labelledby={`edit-debt-title-${debtId}`}>
        <div className="w-full max-w-md rounded-t-[var(--radius-xl)] bg-[var(--color-porcelain)] p-6 shadow-[var(--shadow-lift)] sm:rounded-[var(--radius-xl)]">
          <div className="mb-1 flex items-center justify-between">
            <h2 id={`edit-debt-title-${debtId}`} className="font-[family-name:var(--font-display)] text-xl">Edit outstanding balance</h2>
            <button onClick={close} aria-label="Close" className="text-[var(--color-stone)] hover:text-[var(--color-ink)]"><span aria-hidden="true">✕</span></button>
          </div>

          <div className="mt-3 space-y-3">
            <label className="block text-xs text-[var(--color-stone)]">Amount owed (£) *<br />
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" autoFocus
                className={`${field} mt-1`} />
            </label>
            <label className="block text-xs text-[var(--color-stone)]">Reason *<br />
              <textarea value={reasonText} onChange={(e) => setReasonText(e.target.value)} rows={3}
                className={`${field} mt-1`} />
            </label>
            {error && <p role="alert" aria-live="assertive" className="rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-3 py-2 text-sm">{error}</p>}
          </div>

          <div className="mt-4 flex justify-end gap-3">
            <button onClick={close} disabled={busy} className="px-4 py-2 text-sm text-[var(--color-stone)] disabled:opacity-50">Cancel</button>
            <button onClick={save} disabled={busy} className="rounded-full bg-[var(--color-gold-deep)] px-5 py-2 text-sm font-medium text-white disabled:opacity-60">
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </Dialog>
    </span>
  );
}
