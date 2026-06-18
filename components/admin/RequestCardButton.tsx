'use client';

import { useState } from 'react';

// Staff action: send the client a secure link to save a card to an offline
// booking (no charge), giving it the same no-show protection as an online one.
export function RequestCardButton({ bookingId, hasEmail, hasPhone }: { bookingId: string; hasEmail: boolean; hasPhone: boolean }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [link, setLink] = useState('');

  async function send(channel: 'email' | 'sms' | 'both') {
    setBusy(true); setMsg('');
    const r = await fetch('/api/admin/bookings/request-card', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId, channel }),
    }).then((x) => x.json()).catch(() => ({ ok: false }));
    setBusy(false);
    if (r.ok) { setMsg(`Sent by ${r.sent.join(' & ')} ✓`); setLink(r.url || ''); }
    else { setMsg(r.error || 'Could not send.'); if (r.url) setLink(r.url); }
  }

  return (
    <div className="mt-3 border-t border-[var(--color-line)] pt-3">
      <p className="text-xs text-[var(--color-stone)]">No card on file — send a secure link to save one (no payment taken), for no-show protection.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button onClick={() => send('email')} disabled={busy || !hasEmail} className="rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Sending…' : 'Email link'}</button>
        {hasPhone && <button onClick={() => send('sms')} disabled={busy} className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs hover:border-[var(--color-gold)] disabled:opacity-50">Text link</button>}
        {hasPhone && hasEmail && <button onClick={() => send('both')} disabled={busy} className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs hover:border-[var(--color-gold)] disabled:opacity-50">Both</button>}
      </div>
      {msg && <p className="mt-2 text-xs text-[var(--color-stone)]">{msg}</p>}
      {link && (
        <p className="mt-1 break-all text-[0.7rem] text-[var(--color-stone)]">Or copy: <button onClick={() => navigator.clipboard?.writeText(link)} className="text-[var(--color-gold-deep)] underline">copy link</button></p>
      )}
    </div>
  );
}
