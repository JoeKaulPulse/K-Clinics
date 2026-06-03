'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { getStripe } from '@/lib/stripe-client';
import { useCart } from '@/lib/cart';
import { Button, ArrowIcon } from '@/components/ui/Button';

const money = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0 })}`;
const field = 'mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm';

export function CheckoutForm() {
  const { items, subtotalPence, clear } = useCart();
  const hasAge = items.some((i) => i.ageRestricted);
  const [f, setF] = useState({ name: '', email: '', phone: '', method: 'ship', shipLine1: '', shipLine2: '', shipCity: '', shipPostcode: '', giftCardCode: '', dob: '', ageDeclare: false });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const [stage, setStage] = useState<'details' | 'pay' | 'done'>('details');
  const [clientSecret, setClientSecret] = useState('');
  const [orderId, setOrderId] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const shipping = f.method === 'collect' || subtotalPence >= 5000 ? 0 : 495;
  const estTotal = subtotalPence + shipping;

  async function startCheckout() {
    setError(''); setBusy(true);
    const res = await fetch('/api/shop/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: items.map((i) => ({ productId: i.productId, qty: i.qty })), name: f.name, email: f.email, phone: f.phone, method: f.method, shipName: f.name, shipLine1: f.shipLine1, shipLine2: f.shipLine2, shipCity: f.shipCity, shipPostcode: f.shipPostcode, giftCardCode: f.giftCardCode || undefined, dob: f.dob || undefined, ageDeclare: f.ageDeclare }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!j.ok) { setError(j.error || 'Could not start checkout.'); return; }
    if (j.paid) { clear(); setOrderNo(j.number); setStage('done'); return; }
    setClientSecret(j.clientSecret); setOrderId(j.orderId); setStage('pay');
  }

  if (items.length === 0 && stage !== 'done') {
    return <p className="text-[var(--color-stone)]">Your bag is empty. <Link href="/shop" className="text-[var(--color-gold)] underline">Browse the shop →</Link></p>;
  }

  if (stage === 'done') {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-8 text-center">
        <p className="font-[family-name:var(--font-display)] text-2xl">Thank you — order {orderNo} confirmed ✓</p>
        <p className="mt-2 text-[var(--color-stone)]">A confirmation email is on its way. {f.method === 'collect' ? 'We’ll let you know when it’s ready to collect.' : 'We’ll dispatch it shortly.'}</p>
        <Link href="/shop" className="mt-5 inline-flex items-center gap-1 text-[var(--color-gold)] hover:underline">Continue shopping <ArrowIcon /></Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-5">
        {stage === 'details' ? (
          <>
            <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
              <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">Your details</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-[var(--color-stone)]">Full name<input value={f.name} onChange={(e) => set('name', e.target.value)} className={field} /></label>
                <label className="text-xs text-[var(--color-stone)]">Email<input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} className={field} /></label>
                <label className="text-xs text-[var(--color-stone)]">Phone<input value={f.phone} onChange={(e) => set('phone', e.target.value)} className={field} /></label>
              </div>
            </section>

            <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
              <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">Delivery</h2>
              <div className="flex gap-2">
                {(['ship', 'collect'] as const).map((m) => (
                  <button key={m} onClick={() => set('method', m)} className={`rounded-full border px-4 py-1.5 text-sm ${f.method === m ? 'border-[var(--color-gold)] bg-[var(--color-gold)] text-white' : 'border-[var(--color-line)]'}`}>{m === 'ship' ? 'Ship to me' : 'Collect in clinic'}</button>
                ))}
              </div>
              {f.method === 'ship' && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs text-[var(--color-stone)] sm:col-span-2">Address line 1<input value={f.shipLine1} onChange={(e) => set('shipLine1', e.target.value)} className={field} /></label>
                  <label className="text-xs text-[var(--color-stone)] sm:col-span-2">Address line 2<input value={f.shipLine2} onChange={(e) => set('shipLine2', e.target.value)} className={field} /></label>
                  <label className="text-xs text-[var(--color-stone)]">Town/City<input value={f.shipCity} onChange={(e) => set('shipCity', e.target.value)} className={field} /></label>
                  <label className="text-xs text-[var(--color-stone)]">Postcode<input value={f.shipPostcode} onChange={(e) => set('shipPostcode', e.target.value)} className={field} /></label>
                </div>
              )}
            </section>

            {hasAge && (
              <section className="rounded-[var(--radius-lg)] border border-[var(--color-gold)]/40 bg-[var(--color-gold)]/8 p-5">
                <h2 className="mb-1 font-[family-name:var(--font-display)] text-lg">Age verification</h2>
                <p className="text-sm text-[var(--color-stone)]">Your bag contains age-restricted item(s). Please confirm you’re 18 or over.</p>
                <label className="mt-3 block text-xs text-[var(--color-stone)]">Date of birth<input type="date" value={f.dob} onChange={(e) => set('dob', e.target.value)} className={field} /></label>
                <label className="mt-3 flex items-start gap-2 text-sm text-[var(--color-stone)]"><input type="checkbox" checked={f.ageDeclare} onChange={(e) => set('ageDeclare', e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-gold)]" /> I confirm I am 18 years of age or over.</label>
              </section>
            )}

            <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
              <label className="text-xs text-[var(--color-stone)]">Gift card code (optional)<input value={f.giftCardCode} onChange={(e) => set('giftCardCode', e.target.value)} placeholder="KC-XXXX-XXXX" className={`${field} font-mono`} /></label>
            </section>

            {error && <p className="text-sm text-[var(--color-blush)]">{error}</p>}
            <Button onClick={() => !busy && f.name && f.email && startCheckout()} variant="gold" size="lg">{busy ? 'Please wait…' : 'Continue to payment'} <ArrowIcon /></Button>
          </>
        ) : (
          <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
            <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">Payment</h2>
            <Elements stripe={getStripe()} options={{ clientSecret, appearance: { theme: 'flat', variables: { colorPrimary: '#a98a6d', fontFamily: 'system-ui, sans-serif', borderRadius: '10px', colorBackground: '#f6ece3' } } }}>
              <PayStep orderId={orderId} onDone={(no) => { clear(); setOrderNo(no); setStage('done'); }} />
            </Elements>
          </section>
        )}
      </div>

      <Summary items={items} subtotalPence={subtotalPence} shipping={shipping} estTotal={estTotal} />
    </div>
  );
}

function PayStep({ orderId, onDone }: { orderId: string; onDone: (no: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function pay() {
    if (!stripe || !elements) return;
    setBusy(true); setErr('');
    const { error } = await stripe.confirmPayment({ elements, redirect: 'if_required' });
    if (error) { setErr(error.message || 'Payment failed.'); setBusy(false); return; }
    const res = await fetch('/api/shop/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (j.ok) onDone(j.number); else setErr(j.error || 'Could not confirm your order.');
  }
  return (
    <div>
      <PaymentElement />
      {err && <p className="mt-3 text-sm text-[var(--color-blush)]">{err}</p>}
      <Button onClick={() => !busy && pay()} variant="gold" size="lg" className="mt-4 w-full">{busy ? 'Processing…' : 'Pay now'}</Button>
    </div>
  );
}

function Summary({ items, subtotalPence, shipping, estTotal }: { items: { productId: string; name: string; qty: number; pricePence: number }[]; subtotalPence: number; shipping: number; estTotal: number }) {
  const list = useMemo(() => items, [items]);
  return (
    <div className="lg:sticky lg:top-4 lg:self-start rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
      <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">Summary</h2>
      <ul className="space-y-2 text-sm">
        {list.map((i) => <li key={i.productId} className="flex justify-between"><span className="text-[var(--color-stone)]">{i.name} × {i.qty}</span><span>{money(i.pricePence * i.qty)}</span></li>)}
      </ul>
      <div className="mt-3 space-y-1 border-t border-[var(--color-line)] pt-3 text-sm">
        <div className="flex justify-between"><span className="text-[var(--color-stone)]">Subtotal</span><span>{money(subtotalPence)}</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-stone)]">Shipping</span><span>{shipping === 0 ? 'Free' : money(shipping)}</span></div>
        <div className="flex justify-between font-medium"><span>Total</span><span>{money(estTotal)}</span></div>
      </div>
      <p className="mt-2 text-xs text-[var(--color-stone-soft)]">Any gift card is applied on the next step.</p>
    </div>
  );
}
