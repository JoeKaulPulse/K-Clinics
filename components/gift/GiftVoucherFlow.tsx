'use client';

import { useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { getStripe } from '@/lib/stripe-client';
import { isDemo } from '@/lib/booking-mode';
import { Button, ArrowIcon } from '@/components/ui/Button';

const PRESETS = [2500, 5000, 7500, 10000, 15000, 25000];
const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-4 py-3 text-[var(--color-ink)] outline-none focus:border-[var(--color-gold)]';
const label = 'mb-1.5 block text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]';
const money = (p: number) => `£${(p / 100).toLocaleString('en-GB')}`;

export function GiftVoucherFlow() {
  const [f, setF] = useState({ amount: 5000, custom: '', recipientName: '', recipientEmail: '', message: '', deliverAt: '', purchaserName: '', purchaserEmail: '', company: '' });
  const [stage, setStage] = useState<'form' | 'pay' | 'done'>('form');
  const [clientSecret, setClientSecret] = useState('');
  const [voucherId, setVoucherId] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const amountPence = f.custom ? Math.round(Number(f.custom) * 100) : f.amount;

  async function start() {
    if (!(amountPence >= 1000 && amountPence <= 50000)) { setError('Choose an amount between £10 and £500.'); return; }
    if (!f.purchaserName.trim() || !/\S+@\S+\.\S+/.test(f.purchaserEmail)) { setError('Please enter your name and a valid email.'); return; }
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/gift-vouchers/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, amountPence, deliverAt: f.deliverAt || undefined }) });
      const j = await res.json();
      if (j.ok && j.clientSecret) { setClientSecret(j.clientSecret); setVoucherId(j.voucherId); setStage('pay'); }
      else setError(j.error || 'Could not start the purchase.');
    } catch { setError('Network error. Please try again.'); }
    finally { setBusy(false); }
  }

  if (stage === 'done') {
    return (
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[var(--color-ink)] text-[var(--color-gold-soft)]"><svg viewBox="0 0 24 24" className="h-6 w-6" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
        <h3 className="font-[family-name:var(--font-display)] text-2xl">Gift voucher purchased</h3>
        <p className="mx-auto mt-3 max-w-md text-[var(--color-stone)]">Thank you! We’ve emailed the voucher{f.recipientEmail ? ' to your recipient' : ''} and a receipt to you{f.deliverAt ? `. It will be delivered on ${new Date(f.deliverAt).toLocaleDateString('en-GB')}` : ''}.</p>
        {code && <p className="mt-4 font-[family-name:var(--font-mono,monospace)] text-lg tracking-wide text-[var(--color-ink)]">{code}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-6 md:p-8">
      {stage === 'form' ? (
        <>
          <h3 className="font-[family-name:var(--font-display)] text-2xl">Buy a gift voucher</h3>
          <div className="mt-6">
            <p className={label}>Amount</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button key={p} onClick={() => { set('amount', p); set('custom', ''); }} className={`rounded-full border px-4 py-2 text-sm transition-all ${!f.custom && f.amount === p ? 'border-[var(--color-gold)] bg-[var(--color-gold)] text-white' : 'border-[var(--color-line)] hover:border-[var(--color-stone-soft)]'}`}>{money(p)}</button>
              ))}
              <input value={f.custom} onChange={(e) => set('custom', e.target.value)} placeholder="Custom £" className={`${field} w-28`} />
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div><label className={label}>Recipient name</label><input className={field} value={f.recipientName} onChange={(e) => set('recipientName', e.target.value)} /></div>
            <div><label className={label}>Recipient email</label><input type="email" className={field} value={f.recipientEmail} onChange={(e) => set('recipientEmail', e.target.value)} placeholder="We’ll email it to them" /></div>
            <div className="sm:col-span-2"><label className={label}>Message (optional)</label><textarea rows={2} className={field} value={f.message} onChange={(e) => set('message', e.target.value)} /></div>
            <div><label className={label}>Deliver on (optional)</label><input type="date" className={field} value={f.deliverAt} min={new Date(Date.now() + 864e5).toISOString().slice(0, 10)} onChange={(e) => set('deliverAt', e.target.value)} /></div>
            <div />
            <div><label className={label}>Your name *</label><input className={field} value={f.purchaserName} onChange={(e) => set('purchaserName', e.target.value)} /></div>
            <div><label className={label}>Your email *</label><input type="email" className={field} value={f.purchaserEmail} onChange={(e) => set('purchaserEmail', e.target.value)} /></div>
            <input type="text" tabIndex={-1} value={f.company} onChange={(e) => set('company', e.target.value)} className="absolute -left-[9999px]" aria-hidden />
          </div>
          {error && <p className="mt-4 rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-4 py-3 text-sm text-[var(--color-ink)]">{error}</p>}
          <div className="mt-6 flex items-center justify-between gap-4">
            <span className="text-sm text-[var(--color-stone)]">Total <strong className="text-[var(--color-ink)]">{money(amountPence || 0)}</strong></span>
            <Button onClick={() => !busy && start()} variant="gold" size="lg">{busy ? 'Please wait…' : 'Continue to payment'} <ArrowIcon /></Button>
          </div>
          {isDemo && <p className="mt-3 text-xs text-[var(--color-stone-soft)]">Payments are in demo mode until Stripe is connected.</p>}
        </>
      ) : (
        <>
          <h3 className="font-[family-name:var(--font-display)] text-2xl">Pay {money(amountPence)}</h3>
          <p className="mt-1 text-sm text-[var(--color-stone)]">Your card is charged now for the voucher value.</p>
          <div className="mt-5">
            <Elements stripe={getStripe()} options={{ clientSecret, appearance: { theme: 'flat', variables: { colorPrimary: '#a98a6d', fontFamily: 'system-ui, sans-serif', borderRadius: '10px', colorBackground: '#f6ece3' } } }}>
              <PayStep voucherId={voucherId} onDone={(c) => { setCode(c); setStage('done'); }} onError={setError} />
            </Elements>
          </div>
          {error && <p className="mt-4 rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-4 py-3 text-sm text-[var(--color-ink)]">{error}</p>}
        </>
      )}
    </div>
  );
}

function PayStep({ voucherId, onDone, onError }: { voucherId: string; onDone: (code: string) => void; onError: (e: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  async function pay() {
    if (!stripe || !elements) return;
    setBusy(true); onError('');
    const { error } = await stripe.confirmPayment({ elements, redirect: 'if_required' });
    if (error) { onError(error.message || 'Payment failed.'); setBusy(false); return; }
    const res = await fetch('/api/gift-vouchers/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voucherId }) });
    const j = await res.json();
    if (j.ok) onDone(j.code || ''); else { onError(j.error || 'Could not confirm.'); setBusy(false); }
  }
  return (
    <div>
      <PaymentElement />
      <div className="mt-6 flex justify-end"><Button onClick={pay} variant="gold" size="lg">{busy ? 'Processing…' : 'Pay & send'} <ArrowIcon /></Button></div>
    </div>
  );
}
