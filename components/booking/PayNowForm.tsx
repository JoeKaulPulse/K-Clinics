'use client';

import { useState } from 'react';
import { getStripe } from '@/lib/stripe-client';
import { Button } from '@/components/ui/Button';

const money = (p: number) => `£${(p / 100).toFixed(2)}`;

// Completes an off-session charge that the bank asked the card-holder to
// authenticate. The card is already on file — `confirmCardPayment(clientSecret)`
// triggers the 3-D Secure step on the existing payment method (no re-entry).
export function PayNowForm({ treatment, pricePence, clientSecret }: { treatment: string; pricePence: number; clientSecret: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function pay() {
    setBusy(true); setError('');
    const stripe = await getStripe();
    if (!stripe) { setError('Payments are unavailable right now. Please call us.'); setBusy(false); return; }
    const { error: err, paymentIntent } = await stripe.confirmCardPayment(clientSecret);
    if (err) { setError(err.message || 'We couldn’t complete the payment. Please try again, or call us.'); setBusy(false); return; }
    if (paymentIntent?.status === 'succeeded') {
      // Tell the server so the receipt + loyalty fire immediately; the Stripe
      // webhook is the backstop if this request doesn't land.
      await fetch('/api/booking/pay-confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pi: clientSecret }) }).catch(() => {});
      setDone(true); return;
    }
    setError('That didn’t go through. Please try again, or call us and we’ll help.'); setBusy(false);
  }

  if (done) {
    return (
      <div className="rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-10 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[var(--color-ink)] text-[var(--color-gold-soft)]">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <h2 className="text-title">Payment complete</h2>
        <p className="mx-auto mt-3 max-w-md text-[var(--color-stone)]">Thank you — we’ve taken payment for your <strong>{treatment}</strong> and emailed your receipt.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-6 md:p-8">
      <h2 className="text-title">Complete payment for your {treatment}</h2>
      <p className="mt-4 rounded-[var(--radius-md)] bg-[var(--color-porcelain)] px-4 py-3 text-sm text-[var(--color-ink)]">
        Your bank needs you to confirm this payment of <strong>{money(pricePence)}</strong>. Tap below and approve it with your bank when prompted — your card is already on file, so there’s nothing to re-enter.
      </p>
      {error && <p className="mt-3 rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-4 py-3 text-sm text-[var(--color-ink)]">{error}</p>}
      <div className="mt-6 flex justify-end">
        <Button onClick={pay} variant="gold" size="lg" disabled={busy}>{busy ? 'Confirming…' : `Confirm & pay ${money(pricePence)}`}</Button>
      </div>
    </div>
  );
}
