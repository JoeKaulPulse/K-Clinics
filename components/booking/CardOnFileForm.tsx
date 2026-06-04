'use client';

import { useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { getStripe } from '@/lib/stripe-client';
import { Button } from '@/components/ui/Button';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });

export function CardOnFileForm({ token, treatment, startISO, clientSecret }: { token: string; treatment: string; startISO: string; clientSecret: string }) {
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-10 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[var(--color-ink)] text-[var(--color-gold-soft)]">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <h2 className="text-title">Your card is saved</h2>
        <p className="mx-auto mt-3 max-w-md text-[var(--color-stone)]">Thank you — your appointment is secured. <strong>No payment has been taken.</strong> Your card will only be charged when your treatment is delivered, or for a late cancellation within 24 hours.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-6 md:p-8">
      <h2 className="text-title">Save a card for your {treatment}</h2>
      <p className="mt-1 text-sm text-[var(--color-stone)]">{when(startISO)}</p>
      <p className="mt-4 rounded-[var(--radius-md)] bg-[var(--color-porcelain)] px-4 py-3 text-sm text-[var(--color-ink)]">
        <strong>No payment is taken now.</strong> Your card is stored securely with Stripe and is only charged when your treatment is delivered, or for a late cancellation within 24 hours of your appointment.
      </p>
      <div className="mt-6">
        <Elements stripe={getStripe()} options={{ clientSecret, appearance: { theme: 'flat', variables: { colorPrimary: '#a98a6d', fontFamily: 'system-ui, sans-serif', borderRadius: '10px', colorBackground: '#f6ece3' } } }}>
          <Inner token={token} onDone={() => setDone(true)} />
        </Elements>
      </div>
    </div>
  );
}

function Inner({ token, onDone }: { token: string; onDone: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!stripe || !elements) return;
    setBusy(true); setError('');
    const { error: confirmErr } = await stripe.confirmSetup({ elements, redirect: 'if_required' });
    if (confirmErr) { setError(confirmErr.message || 'Your card could not be saved.'); setBusy(false); return; }
    const res = await fetch('/api/booking/card-saved', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
    const j = await res.json().catch(() => ({ ok: false }));
    if (j.ok) onDone();
    else { setError(j.error || 'Saved with the bank, but we couldn’t confirm it. Please call us.'); setBusy(false); }
  }

  return (
    <div>
      <PaymentElement />
      {error && <p className="mt-3 rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-4 py-3 text-sm text-[var(--color-ink)]">{error}</p>}
      <div className="mt-6 flex justify-end">
        <Button onClick={submit} variant="gold" size="lg" disabled={busy}>{busy ? 'Saving…' : 'Save my card securely'}</Button>
      </div>
    </div>
  );
}
