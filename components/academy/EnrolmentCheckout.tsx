'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { getStripe } from '@/lib/stripe-client';

const money = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0 })}`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export type Instalment = { id: string; kind: string; state: string; amountPence: number; dueAt: string | null; paidAt: string | null };

export function EnrolmentCheckout(props: {
  enrolmentId: string;
  courseTitle: string;
  courseSlug: string;
  feePence: number;
  paidPence: number;
  outstandingPence: number;
  depositPence: number | null;
  hasPlan: boolean;
  instalments: Instalment[];
}) {
  const { enrolmentId, courseTitle, feePence, paidPence, outstandingPence, depositPence, hasPlan, instalments } = props;
  const router = useRouter();
  const [stage, setStage] = useState<'choose' | 'pay' | 'done'>('choose');
  const [clientSecret, setClientSecret] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [chargePence, setChargePence] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const canDeposit = !!depositPence && depositPence > 0 && paidPence === 0 && depositPence < outstandingPence;

  async function start(mode: 'full' | 'deposit') {
    setError(''); setBusy(true);
    const res = await fetch('/api/academy/pay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enrolmentId, mode }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!j.ok) { setError(j.error || 'Could not start the payment.'); return; }
    setClientSecret(j.clientSecret); setPaymentId(j.paymentId); setChargePence(j.amountPence); setStage('pay');
  }

  if (outstandingPence <= 0 || stage === 'done') {
    return (
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-6 text-center">
        <p className="font-[family-name:var(--font-display)] text-2xl">You’re all set ✓</p>
        <p className="mt-2 text-[var(--color-stone)]">{stage === 'done' ? 'Thank you — your payment is confirmed.' : 'This course is paid in full.'} Your online theory is unlocked.</p>
        <Link href={`/academy/learn/${props.courseSlug}`} className="mt-5 inline-block rounded-full bg-[var(--color-gold)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-ink)]">Start learning →</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-6">
        <h2 className="font-[family-name:var(--font-display)] text-xl">{courseTitle}</h2>
        <dl className="mt-4 space-y-1.5 text-sm">
          <div className="flex justify-between"><dt className="text-[var(--color-stone)]">Course fee</dt><dd>{money(feePence)}</dd></div>
          {paidPence > 0 && <div className="flex justify-between"><dt className="text-[var(--color-stone)]">Paid so far</dt><dd>{money(paidPence)}</dd></div>}
          <div className="flex justify-between border-t border-[var(--color-line)] pt-1.5 font-medium"><dt>Outstanding</dt><dd>{money(outstandingPence)}</dd></div>
        </dl>
      </div>

      {hasPlan && instalments.length > 0 && (
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
          <h3 className="font-medium">Your payment plan</h3>
          <ul className="mt-3 space-y-1.5 text-sm">
            {instalments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <span className="text-[var(--color-stone)]">{p.dueAt ? fmtDate(p.dueAt) : 'Due'} · {money(p.amountPence)}</span>
                <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide ${p.state === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-[var(--color-line)] text-[var(--color-stone)]'}`}>{p.state === 'PAID' ? 'Paid' : 'Scheduled'}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-[var(--color-stone)]">We’ll collect each instalment as it falls due. You can also pay your balance any time below.</p>
        </div>
      )}

      {stage === 'choose' ? (
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
          <h3 className="font-medium">Secure your place</h3>
          <p className="mt-1 text-sm text-[var(--color-stone)]">Pay by card, or spread the cost with Klarna or Clearpay at checkout.</p>
          {error && <p className="mt-3 text-sm text-[var(--color-blush)]">{error}</p>}
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={() => !busy && start('full')} disabled={busy} className="rounded-full bg-[var(--color-gold)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-ink)] disabled:opacity-60">
              {busy ? 'Please wait…' : `Pay ${money(outstandingPence)} now`}
            </button>
            {canDeposit && (
              <button onClick={() => !busy && start('deposit')} disabled={busy} className="rounded-full border border-[var(--color-line)] px-6 py-2.5 text-sm font-medium hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] disabled:opacity-60">
                Pay {money(depositPence!)} deposit to reserve
              </button>
            )}
          </div>
          <p className="mt-4 text-xs text-[var(--color-stone)]">
            Prefer a payment plan or want to check funding? <Link href="/academy/funding" className="link-underline font-medium text-[var(--color-ink)]">See funding options</Link> or reply to your offer email and we’ll set up a plan with you.
          </p>
        </div>
      ) : (
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-medium">Pay {money(chargePence)}</h3>
            <button onClick={() => { setStage('choose'); setError(''); }} className="text-xs text-[var(--color-stone)] hover:underline">← Change</button>
          </div>
          <Elements stripe={getStripe()} options={{ clientSecret, appearance: { theme: 'flat', variables: { colorPrimary: '#a98a6d', fontFamily: 'system-ui, sans-serif', borderRadius: '10px', colorBackground: '#f6ece3' } } }}>
            <PayStep paymentId={paymentId} onDone={() => { setStage('done'); router.refresh(); }} />
          </Elements>
        </div>
      )}
    </div>
  );
}

function PayStep({ paymentId, onDone }: { paymentId: string; onDone: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function pay() {
    if (!stripe || !elements) return;
    setBusy(true); setErr('');
    const { error } = await stripe.confirmPayment({ elements, redirect: 'if_required' });
    if (error) { setErr(error.message || 'Payment failed.'); setBusy(false); return; }
    const res = await fetch('/api/academy/pay/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentId }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (j.ok) onDone(); else setErr(j.error || 'Could not confirm your payment.');
  }
  return (
    <div>
      <PaymentElement />
      {err && <p className="mt-3 text-sm text-[var(--color-blush)]">{err}</p>}
      <button onClick={() => !busy && pay()} disabled={busy} className="mt-4 w-full rounded-full bg-[var(--color-gold)] px-6 py-3 text-sm font-medium text-white hover:bg-[var(--color-ink)] disabled:opacity-60">{busy ? 'Processing…' : 'Pay now'}</button>
      <p className="mt-3 text-center text-xs text-[var(--color-stone)]">Payments are processed securely by Stripe.</p>
    </div>
  );
}
