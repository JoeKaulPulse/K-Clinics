'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Manager control to credit/deduct a client's loyalty points. */
export function AdjustClientPoints({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function submit() {
    if (!points || !reason.trim()) { setMsg('Enter an amount and a reason.'); return; }
    setBusy(true); setMsg('');
    const res = await fetch('/api/admin/loyalty', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, points: Number(points), reason }),
    });
    setBusy(false);
    if (res.ok) { setPoints(''); setReason(''); setOpen(false); router.refresh(); }
    else { const j = await res.json().catch(() => ({})); setMsg(j.error || 'Could not apply.'); }
  }

  const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]';

  if (!open) return <button onClick={() => setOpen(true)} className="text-xs font-medium text-[var(--color-gold)] hover:underline">+ Adjust points</button>;

  return (
    <div className="mt-3 space-y-2 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white p-3">
      <input type="number" inputMode="numeric" placeholder="Points (− to deduct)" value={points} onChange={(e) => setPoints(e.target.value)} className={field} />
      <input placeholder="Reason (shown to client)" value={reason} onChange={(e) => setReason(e.target.value)} className={field} />
      {msg && <p className="text-xs text-[var(--color-blush-deep)]">{msg}</p>}
      <div className="flex gap-2">
        <button onClick={submit} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-xs text-[var(--color-porcelain)] disabled:opacity-60">{busy ? '…' : 'Apply'}</button>
        <button onClick={() => { setOpen(false); setMsg(''); }} className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-xs text-[var(--color-stone)]">Cancel</button>
      </div>
    </div>
  );
}
