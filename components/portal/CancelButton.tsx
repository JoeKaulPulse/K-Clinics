'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui/Dialog';

/** Inline cancel button for an upcoming booking on the portal appointments page.
 *  POSTs to /api/booking/cancel using the booking's manageToken so clients
 *  don't need to find the original confirmation email.
 *
 *  BLD-1878: confirms via the branded <Dialog>, not window.confirm() — a
 *  native dialog can't show the actual fee amount, and it silently no-ops
 *  (returns null immediately, cancelling nothing but confirming nothing
 *  either) inside an in-app/webview browser such as an email or SMS app's
 *  built-in viewer. `feePence` is computed server-side (same 24h-window
 *  formula as lib/booking-actions.ts's cancelBooking) so the dialog states
 *  the real amount, not a vague "a fee may apply". */
export function CancelButton({ token, treatmentTitle, feePence, labels }: {
  token: string;
  treatmentTitle: string;
  feePence: number;
  labels: {
    cancel: string; cancelled: string; confirm: string; lateFee: string; error: string;
    title: string; confirmFee: string; confirmFree: string; keep: string; confirmNow: string;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [err, setErr] = useState('');

  async function handleCancel() {
    setOpen(false);
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/booking/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json() as { ok: boolean; error?: string; charged?: number; requiresAction?: boolean };
      if (!data.ok) { setErr(data.error || labels.error); return; }
      if (data.requiresAction) {
        // SCA required for the late fee — fall back to the manage page.
        window.location.href = `/booking/manage?t=${encodeURIComponent(token)}`;
        return;
      }
      const fee = data.charged ?? 0;
      setDone(fee > 0 ? `${labels.lateFee} £${(fee / 100).toFixed(2)}.` : labels.cancelled);
      router.refresh();
    } catch {
      setErr(labels.error);
    } finally {
      setBusy(false);
    }
  }

  if (done) return <span className="rounded-full bg-[var(--color-bone)] px-4 py-2 text-sm text-[var(--color-stone)]">{done}</span>;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => setOpen(true)}
        disabled={busy}
        className="rounded-full border border-[var(--color-blush-deep)]/40 px-4 py-2 text-sm font-medium text-[var(--color-blush-deep)] transition-colors hover:border-[var(--color-blush-deep)] hover:bg-[var(--color-blush-deep)]/10 disabled:opacity-50"
      >
        {busy ? '…' : labels.cancel}
      </button>
      {err && <p role="alert" aria-live="assertive" className="text-xs text-[var(--color-blush-deep)]">{err}</p>}

      <Dialog open={open} onClose={() => setOpen(false)} labelledby="cancel-appt-title">
        <div className="w-full max-w-sm rounded-t-[var(--radius-xl)] bg-[var(--color-porcelain)] p-6 shadow-[var(--shadow-lift)] sm:rounded-[var(--radius-xl)]">
          <div className="mb-1 flex items-center justify-between">
            <h2 id="cancel-appt-title" className="font-[family-name:var(--font-display)] text-xl">{labels.title}</h2>
            <button onClick={() => setOpen(false)} aria-label="Close" className="text-[var(--color-stone)] hover:text-[var(--color-ink)]"><span aria-hidden="true">✕</span></button>
          </div>
          <p className="mb-1 text-sm text-[var(--color-stone)]">{treatmentTitle}</p>
          <p className="mb-4 text-sm text-[var(--color-ink)]">
            {feePence > 0 ? labels.confirmFee.replace('{fee}', `£${(feePence / 100).toFixed(2)}`) : labels.confirmFree}
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-[var(--color-stone)]">{labels.keep}</button>
            <button onClick={handleCancel} className="rounded-full bg-[var(--color-blush-deep)] px-5 py-2 text-sm font-medium text-white">{labels.confirmNow}</button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
