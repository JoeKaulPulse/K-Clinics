'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Inline cancel button for an upcoming booking on the portal appointments page.
 *  POSTs to /api/booking/cancel using the booking's manageToken so clients
 *  don't need to find the original confirmation email. */
export function CancelButton({ token, treatmentTitle, labels }: {
  token: string;
  treatmentTitle: string;
  labels: { cancel: string; cancelled: string; confirm: string; lateFee: string; error: string };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [err, setErr] = useState('');

  async function handleCancel() {
    if (!window.confirm(labels.confirm)) return;
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
        onClick={handleCancel}
        disabled={busy}
        className="rounded-full border border-[var(--color-blush-deep)]/40 px-4 py-2 text-sm font-medium text-[var(--color-blush-deep)] transition-colors hover:border-[var(--color-blush-deep)] hover:bg-[var(--color-blush-deep)]/10 disabled:opacity-50"
      >
        {busy ? '…' : labels.cancel}
      </button>
      {err && <p className="text-xs text-[var(--color-blush-deep)]">{err}</p>}
    </div>
  );
}
