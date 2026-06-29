'use client';

import { useState } from 'react';
import { Button, ArrowIcon } from '@/components/ui/Button';

// Stripe-styled card entry for DEMO mode (no backend). Accepts Stripe test
// cards — success: 4242 4242 4242 4242; decline: 4000 0000 0000 0002.
// Nothing is charged; this simply mimics the real card step's UX & validation.
const SUCCESS = '4242424242424242';
const DECLINE = '4000000000000002';

export function DemoCard({ onDone, onError }: { onDone: () => void; onError: (e: string) => void }) {
  const [num, setNum] = useState('');
  const [exp, setExp] = useState('');
  const [cvc, setCvc] = useState('');
  const [busy, setBusy] = useState(false);

  const raw = num.replace(/\s/g, '');
  const fmtNum = raw.replace(/(.{4})/g, '$1 ').trim();

  function submit() {
    onError('');
    const digits = raw;
    if (digits.length < 13) return onError('Please enter a valid card number.');
    if (!/^\d{2}\s*\/\s*\d{2}$/.test(exp)) return onError('Enter expiry as MM / YY.');
    if (cvc.length < 3) return onError('Enter the 3-digit security code.');
    setBusy(true);
    // Simulate Stripe's confirmSetup latency + outcome.
    setTimeout(() => {
      if (digits === DECLINE) { setBusy(false); onError('Your card was declined. Try the success test card 4242 4242 4242 4242.'); return; }
      onDone();
    }, 900);
  }

  const field =
    'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-4 py-3 text-[var(--color-ink)] outline-none transition-colors placeholder:text-[var(--color-stone)] focus:border-[var(--color-gold)]';

  return (
    <div>
      <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]">Card details</span>
          <span className="flex gap-1" aria-hidden>
            <span className="h-4 w-6 rounded-sm bg-[linear-gradient(135deg,#1a1f71,#2557d6)]" />
            <span className="h-4 w-6 rounded-sm bg-[linear-gradient(135deg,#eb001b,#f79e1b)]" />
          </span>
        </div>
        <input value={fmtNum} onChange={(e) => setNum(e.target.value)} inputMode="numeric" placeholder="Card number" aria-label="Card number" maxLength={23} className={`${field} mb-3 font-[family-name:var(--font-mono)] tracking-wide`} />
        <div className="grid grid-cols-2 gap-3">
          <input value={exp} onChange={(e) => setExp(e.target.value)} placeholder="MM / YY" aria-label="Expiry date (MM / YY)" maxLength={7} className={`${field} font-[family-name:var(--font-mono)]`} />
          <input value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="CVC" aria-label="CVC security code" maxLength={4} className={`${field} font-[family-name:var(--font-mono)]`} />
        </div>
      </div>

      <p className="mt-3 text-xs text-[var(--color-stone)]">
        <span className="font-medium text-[var(--color-ink-soft)]">Demo mode.</span> Use Stripe test card{' '}
        <button type="button" onClick={() => { setNum('4242 4242 4242 4242'); setExp('12 / 34'); setCvc('123'); }} className="font-[family-name:var(--font-mono)] underline underline-offset-2 hover:text-[var(--color-gold)]">4242 4242 4242 4242</button>.
        No payment is taken.
      </p>

      <div className="mt-6 flex justify-end">
        <Button onClick={submit} variant="gold" size="lg">{busy ? 'Securing…' : 'Confirm booking'} <ArrowIcon /></Button>
      </div>
    </div>
  );
}
