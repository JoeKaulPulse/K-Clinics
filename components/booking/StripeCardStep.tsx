'use client';

// PRJ-1200.12: split out of BookingFlow.tsx so the Stripe Elements JS payload
// (@stripe/react-stripe-js + @stripe/stripe-js, loaded via getStripe()) is its
// own chunk, next/dynamic-imported from BookingFlow only once a visitor
// actually reaches the card step — not bundled into every /book page load.
// Pure client-side Stripe API usage (Elements/PaymentElement/useStripe all
// touch the browser), so the dynamic import in BookingFlow uses ssr: false.
import { useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { getStripe } from '@/lib/stripe-client';
import { Button, ArrowIcon } from '@/components/ui/Button';

export default function StripeCardStep({ clientSecret, bookingId, onDone, onError }: { clientSecret: string; bookingId: string; onDone: () => void; onError: (e: string) => void }) {
  return (
    <Elements stripe={getStripe()} options={{ clientSecret, appearance: { theme: 'flat', variables: { colorPrimary: '#816748', fontFamily: 'system-ui, sans-serif', borderRadius: '10px', colorBackground: '#f6ece3' } } }}>
      <CardStep bookingId={bookingId} clientSecret={clientSecret} onDone={onDone} onError={onError} />
    </Elements>
  );
}

function CardStep({ bookingId, clientSecret, onDone, onError }: { bookingId: string; clientSecret: string; onDone: () => void; onError: (e: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  async function submit() {
    if (!stripe || !elements) return;
    setSubmitting(true); onError('');
    const { error } = await stripe.confirmSetup({ elements, redirect: 'if_required' });
    if (error) { onError(error.message || 'Card could not be saved.'); setSubmitting(false); return; }
    // The card is saved now. Confirming is idempotent server-side (a repeat call
    // returns the same success), so a transient failure here is safe to surface
    // for retry without double-booking — and must not leave the button hung.
    try {
      // BLD-700: the client secret proves this browser ran the Elements flow.
      const res = await fetch('/api/booking/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId, clientSecret }) });
      const j = await res.json().catch(() => null);
      if (j?.ok) { onDone(); return; }
      onError(j?.error || 'Your card was saved, but we couldn’t finish confirming. Please tap Confirm again — you won’t be booked or charged twice.');
      setSubmitting(false);
    } catch {
      onError('Your card was saved. If you don’t receive a confirmation email shortly, check “My appointments”, then tap Confirm again.');
      setSubmitting(false);
    }
  }
  return (
    <div>
      <PaymentElement />
      <div className="mt-6 flex justify-end"><Button onClick={submit} disabled={submitting} variant="gold" size="lg">{submitting ? 'Confirming…' : 'Confirm booking'} <ArrowIcon /></Button></div>
    </div>
  );
}
