'use client';

import { useState } from 'react';

// BLD-399 (BLD-409 course context). Staff action on a *course* booking: take a
// Buy-Now-Pay-Later payment (Klarna/Clearpay). The client can't save a BNPL
// method off-session, so they pay the full course price upfront via a hosted
// Stripe Checkout link. This creates that link for staff to send to the client;
// the webhook marks the booking PRE-PAID once paid. No payment is taken here.
export function BnplPaymentButton({ bookingId }: { bookingId: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);

  async function create() {
    setBusy(true); setMsg(''); setCopied(false);
    const r = await fetch('/api/admin/bookings/bnpl-link', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId }),
    }).then((x) => x.json()).catch(() => ({ ok: false }));
    setBusy(false);
    if (r.ok && r.url) {
      setLink(r.url);
      setMsg(`Payment link ready${typeof r.amountPence === 'number' ? ` — £${(r.amountPence / 100).toFixed(2)} for the full course` : ''}. Send it to the client to pay with Klarna or Clearpay.`);
    } else {
      setMsg(r.error || 'Could not create the payment link.');
    }
  }

  async function copy() {
    try { await navigator.clipboard?.writeText(link); setCopied(true); } catch { /* clipboard blocked */ }
  }

  return (
    <div className="mt-3 border-t border-[var(--color-line)] pt-3">
      <p className="text-xs text-[var(--color-stone)]">Take a Buy-Now-Pay-Later payment — the client pays the full course price upfront via Klarna or Clearpay. No card-on-file charge is taken once paid.</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button onClick={create} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs text-[var(--color-porcelain)] disabled:opacity-50">
          {busy ? 'Creating link…' : link ? 'Create a new link' : 'Take BNPL payment (Klarna/Clearpay)'}
        </button>
        {link && (
          <a href={link} target="_blank" rel="noreferrer" className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs hover:border-[var(--color-gold)]">Open link</a>
        )}
      </div>
      {msg && <p className="mt-2 text-xs text-[var(--color-stone)]">{msg}</p>}
      {link && (
        <p className="mt-1 break-all text-[0.7rem] text-[var(--color-stone-soft)]">
          {link} · <button onClick={copy} className="text-[var(--color-gold-deep)] underline">{copied ? 'copied ✓' : 'copy link'}</button>
        </p>
      )}
    </div>
  );
}
