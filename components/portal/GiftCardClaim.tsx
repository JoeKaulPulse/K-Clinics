'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const money = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0 })}`;
const field = 'mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm';

export function GiftCardClaim({ initialCode, needsAge, claimed }: { initialCode: string; needsAge: boolean; claimed: { code: string; balancePence: number; status: string }[] }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [showAge, setShowAge] = useState(needsAge);
  const [dob, setDob] = useState('');
  const [ageDeclare, setAgeDeclare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState('');

  async function claim() {
    setMsg(''); setOk(''); setBusy(true);
    const res = await fetch('/api/account/gift-card/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, dob: dob || undefined, ageDeclare }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (j.ok) { setOk(`Gift card added — ${money(j.amountPence)} is ready to use against your treatments.`); setCode(''); router.refresh(); }
    else { setMsg(j.error || 'Could not claim that gift card.'); if (j.needAge) setShowAge(true); }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
        <label className="block text-xs font-medium uppercase tracking-wide text-[var(--color-stone-soft)]">Gift card code
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="KC-XXXX-XXXX" className={`${field} font-mono`} />
        </label>

        {showAge && (
          <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-4">
            <p className="text-sm text-[var(--color-stone)]">Gift cards are for treatments, so we need to confirm you’re 18 or over.</p>
            <label className="mt-2 block text-xs text-[var(--color-stone)]">Date of birth<input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={field} /></label>
            <label className="mt-3 flex items-start gap-2 text-sm text-[var(--color-stone)]">
              <input type="checkbox" checked={ageDeclare} onChange={(e) => setAgeDeclare(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-gold)]" />
              I confirm I am 18 years of age or over.
            </label>
          </div>
        )}

        {msg && <p className="mt-3 text-sm text-[var(--color-blush)]">{msg}</p>}
        {ok && <p className="mt-3 rounded-[var(--radius-sm)] bg-[var(--color-jade)]/12 px-3 py-2 text-sm text-[var(--color-jade)]">{ok}</p>}
        <button onClick={claim} disabled={busy || !code} className="mt-4 rounded-full bg-[var(--color-ink)] px-6 py-2.5 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Adding…' : 'Add gift card'}</button>
      </section>

      {claimed.length > 0 && (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">Your gift cards</h2>
          <ul className="space-y-2 text-sm">
            {claimed.map((c) => (
              <li key={c.code} className="flex items-center justify-between border-t border-[var(--color-line)] pt-2 first:border-0 first:pt-0">
                <span className="font-mono text-xs">{c.code}</span>
                <span>{c.status === 'REDEEMED' ? 'Used' : `${money(c.balancePence)} balance`}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
