'use client';

import { useState } from 'react';

export function FinancialControls({ refundWindowDays, minMarginPct, vat, kiosk }: { refundWindowDays: number; minMarginPct: number; vat: { registered: boolean; inclusive: boolean; defaultRatePct: number }; kiosk: { pct: number; enabled: boolean } }) {
  const [days, setDays] = useState(String(refundWindowDays));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function save() {
    setBusy(true); setMsg('');
    const r = await fetch('/api/admin/finance/controls', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'refundWindow', days: Number(days) }) }).then((x) => x.json()).catch(() => ({ ok: false }));
    setBusy(false);
    setMsg(r.ok ? 'Saved ✓' : (r.error || 'Could not save.'));
  }

  // Profit rules
  const [margin, setMargin] = useState(String(minMarginPct));
  const [marginBusy, setMarginBusy] = useState(false);
  const [marginMsg, setMarginMsg] = useState('');
  async function saveMargin() {
    setMarginBusy(true); setMarginMsg('');
    const r = await fetch('/api/admin/finance/controls', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'margin', minMarginPct: Number(margin) }) }).then((x) => x.json()).catch(() => ({ ok: false }));
    setMarginBusy(false);
    setMarginMsg(r.ok ? 'Saved ✓' : (r.error || 'Could not save.'));
  }

  // Kiosk share reward
  const [kEnabled, setKEnabled] = useState(kiosk.enabled);
  const [kPct, setKPct] = useState(String(kiosk.pct));
  const [kBusy, setKBusy] = useState(false);
  const [kMsg, setKMsg] = useState('');
  async function saveKiosk() {
    setKBusy(true); setKMsg('');
    const r = await fetch('/api/admin/finance/controls', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'kiosk', enabled: kEnabled, discountPct: Number(kPct) }) }).then((x) => x.json()).catch(() => ({ ok: false }));
    setKBusy(false);
    setKMsg(r.ok ? 'Saved ✓' : (r.error || 'Could not save.'));
  }

  // VAT
  const [registered, setRegistered] = useState(vat.registered);
  const [inclusive, setInclusive] = useState(vat.inclusive);
  const [rate, setRate] = useState(String(vat.defaultRatePct));
  const [vatBusy, setVatBusy] = useState(false);
  const [vatMsg, setVatMsg] = useState('');
  async function saveVat() {
    setVatBusy(true); setVatMsg('');
    const r = await fetch('/api/admin/finance/controls', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'vat', registered, inclusive, defaultRatePct: Number(rate) }) }).then((x) => x.json()).catch(() => ({ ok: false }));
    setVatBusy(false);
    setVatMsg(r.ok ? 'Saved ✓' : (r.error || 'Could not save.'));
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

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
        <h2 className="font-[family-name:var(--font-display)] text-lg">Profit rules</h2>
        <p className="mt-1 text-sm text-[var(--color-stone)]">A minimum margin target. Services below it are flagged in Reports → Profitability by service. Set 0 to turn off.</p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-xs text-[var(--color-stone)]">Minimum margin (%)<br />
            <input value={margin} onChange={(e) => { setMargin(e.target.value.replace(/\D/g, '').slice(0, 3)); setMarginMsg(''); }} inputMode="numeric" className="mt-1 w-24 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" />
          </label>
          <button onClick={saveMargin} disabled={marginBusy} className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{marginBusy ? 'Saving…' : 'Save'}</button>
          {marginMsg && <span className="text-sm text-[var(--color-stone)]">{marginMsg}</span>}
        </div>
      </section>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
        <h2 className="font-[family-name:var(--font-display)] text-lg">Storefront kiosk — share reward</h2>
        <p className="mt-1 text-sm text-[var(--color-stone)]">The discount a “Skin &amp; Smile” kiosk visitor gets for sharing and creating an account (single-use, off their first treatment). Turn off to pause the offer.</p>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={kEnabled} onChange={(e) => { setKEnabled(e.target.checked); setKMsg(''); }} className="h-4 w-4 accent-[var(--color-gold)]" />
          Offer the share-to-claim reward
        </label>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-xs text-[var(--color-stone)]">Discount (%)<br />
            <input value={kPct} onChange={(e) => { setKPct(e.target.value.replace(/\D/g, '').slice(0, 3)); setKMsg(''); }} inputMode="numeric" className="mt-1 w-24 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" />
          </label>
          <button onClick={saveKiosk} disabled={kBusy || !(Number(kPct) >= 1)} className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{kBusy ? 'Saving…' : 'Save'}</button>
          {kMsg && <span className="text-sm text-[var(--color-stone)]">{kMsg}</span>}
        </div>
      </section>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
        <h2 className="font-[family-name:var(--font-display)] text-lg">VAT</h2>
        <p className="mt-1 text-sm text-[var(--color-stone)]">Off until you’re registered — everything shows “No VAT”. When on, VAT is derived per service (set each service’s class under Services & pricing; dentistry defaults to exempt) and shown on prices, receipts and reports.</p>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={registered} onChange={(e) => { setRegistered(e.target.checked); setVatMsg(''); }} className="h-4 w-4 accent-[var(--color-gold)]" />
          The clinic is VAT-registered
        </label>
        {/* PRJ-939.1 (owner decision): prices are always VAT-inclusive — the
            displayed price is what the client pays and the VAT portion is
            extracted from it for the books. The old inclusive/exclusive toggle
            is gone; the state stays so saves keep sending a value. */}
        <p className="mt-2 text-sm text-[var(--color-stone)]">Prices always include VAT — the displayed price is what the client pays; reports extract the VAT portion from it.</p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-xs text-[var(--color-stone)]">Standard rate (%)<br />
            <input value={rate} onChange={(e) => { setRate(e.target.value.replace(/\D/g, '').slice(0, 3)); setVatMsg(''); }} inputMode="numeric" className="mt-1 w-24 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" />
          </label>
          <button onClick={saveVat} disabled={vatBusy} className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{vatBusy ? 'Saving…' : 'Save VAT settings'}</button>
          {vatMsg && <span className="text-sm text-[var(--color-stone)]">{vatMsg}</span>}
        </div>
      </section>

      <section className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)] bg-[var(--color-porcelain)] p-5 text-sm text-[var(--color-stone)]">
        <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--color-ink)]">Coming next</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Bookkeeping + MTD through Xero (payroll, suppliers, bills, receipts).</li>
        </ul>
      </section>
    </div>
  );
}
