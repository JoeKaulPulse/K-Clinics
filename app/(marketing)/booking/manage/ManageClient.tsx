'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

type B = { treatmentTitle: string; startISO: string; status: string; pricePence: number; within24h: boolean; cancelled: boolean };

const money = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0 })}`;

export function ManageClient({ token, booking }: { token: string; booking: B }) {
  const [status, setStatus] = useState(booking.status);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [confirming, setConfirming] = useState(false);

  const when = new Date(booking.startISO).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const cancelled = status === 'CANCELLED';

  async function cancel() {
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/booking/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
      const j = await res.json();
      if (j.ok) {
        setStatus('CANCELLED');
        setMsg(j.charged ? `Your booking is cancelled. As this was within 24 hours, a fee of ${money(j.charged)} was charged.` : 'Your booking is cancelled. No charge was taken.');
      } else setMsg(j.error || 'Could not cancel. Please call us.');
    } catch { setMsg('Network error. Please call us.'); }
    finally { setBusy(false); setConfirming(false); }
  }

  return (
    <div className="rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 md:p-10">
      <span className={`inline-block rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] ${cancelled ? 'bg-[var(--color-sand)] text-[var(--color-stone)]' : 'bg-[var(--color-gold)]/20 text-[var(--color-ink)]'}`}>{status}</span>
      <h2 className="mt-4 font-[family-name:var(--font-display)] text-3xl">{booking.treatmentTitle}</h2>
      <p className="mt-2 text-[var(--color-stone)]">{when}</p>
      <p className="mt-1 text-[var(--color-stone)]">{booking.pricePence > 0 ? money(booking.pricePence) : 'Assessed at your visit'}</p>

      {msg && <p className="mt-6 rounded-[var(--radius-sm)] bg-[var(--color-porcelain)] px-4 py-3 text-sm">{msg}</p>}

      {!cancelled && (
        <div className="mt-8 border-t border-[var(--color-line)] pt-6">
          {booking.within24h ? (
            <p className="mb-4 text-sm text-[var(--color-stone)]">
              This appointment is within 24 hours. Cancelling now will incur the full fee of {money(booking.pricePence)}.
            </p>
          ) : (
            <p className="mb-4 text-sm text-[var(--color-stone)]">You can cancel free of charge until 24 hours before your appointment.</p>
          )}
          {!confirming ? (
            <Button onClick={() => setConfirming(true)} variant="outline">Cancel booking</Button>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm">Are you sure?</span>
              <Button onClick={cancel} variant="gold">{busy ? 'Cancelling…' : 'Yes, cancel'}</Button>
              <button onClick={() => setConfirming(false)} className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">Keep booking</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
