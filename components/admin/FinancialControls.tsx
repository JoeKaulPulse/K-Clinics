'use client';

import { useState } from 'react';

export function FinancialControls({ refundWindowDays }: { refundWindowDays: number }) {
  const [days, setDays] = useState(String(refundWindowDays));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function save() {
    setBusy(true); setMsg('');
    const r = await fetch('/api/admin/finance/controls', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'refundWindow', days: Number(days) }) }).then((x) => x.json()).catch(() => ({ ok: false }));
    setBusy(false);
    setMsg(r.ok ? 'Saved ✓' : (r.error || 'Could not save.'));
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
        <h2 className="font-[family-name:var(--font-display)] text-lg">Refunds</h2>
        <p className="mt-1 text-sm text-[var(--color-stone)]">How long after a payment staff can refund a booking from the platform (Stripe allows up to 180 days).</p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-xs text-[var(--color-stone)]">Refund window (days)<br />
            <input value={days} onChange={(e) => { setDays(e.target.value.replace(/\D/g, '').slice(0, 3)); setMsg(''); }} inputMode="numeric" className="mt-1 w-28 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" />
          </label>
          <button onClick={save} disabled={busy || !(Number(days) >= 1)} className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
          {msg && <span className="text-sm text-[var(--color-stone)]">{msg}</span>}
        </div>
      </section>

      <section className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)] bg-[var(--color-porcelain)] p-5 text-sm text-[var(--color-stone)]">
        <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--color-ink)]">Coming next</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Profit / margin rules and alerts.</li>
          <li>Profitability by service (revenue − consumables − time).</li>
          <li>VAT configuration (per-service rate, inclusive/exclusive) — tracked, owner sign-off pending.</li>
        </ul>
      </section>
    </div>
  );
}
