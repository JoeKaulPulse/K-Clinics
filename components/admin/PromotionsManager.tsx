'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Universal = { id: string; code: string; label: string | null; discountType: string; percent: number | null; amountPence: number | null; redeemedCount: number; maxRedemptions: number | null; active: boolean; startsAt: string | null; expiresAt: string | null; treatmentSlugs: string[] };
type Batch = { campaignId: string; name: string; count: number; redeemed: number };

const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]';
const label = 'block text-xs font-medium text-[var(--color-stone)]';
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null);
const value = (p: Universal) => (p.discountType === 'FIXED' ? `£${((p.amountPence ?? 0) / 100).toLocaleString('en-GB')} off` : `${p.percent}% off`);

async function post(payload: object) {
  const r = await fetch('/api/admin/promotions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return r.json().catch(() => ({ ok: false }));
}

export function PromotionsManager({ universal, campaignBatches }: { universal: Universal[]; campaignBatches: Batch[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ label: '', code: '', discountType: 'PERCENT', percent: '10', amountPence: '', minSpendPence: '', maxRedemptions: '', oncePerClient: true, startsAt: '', expiresAt: '' });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  async function create() {
    setBusy(true);
    const r = await post({
      op: 'create', label: f.label, code: f.code, discountType: f.discountType,
      percent: f.discountType === 'PERCENT' ? Number(f.percent) : undefined,
      amountPence: f.discountType === 'FIXED' ? Math.round(Number(f.amountPence) * 100) : undefined,
      minSpendPence: f.minSpendPence ? Math.round(Number(f.minSpendPence) * 100) : undefined,
      maxRedemptions: f.maxRedemptions ? Number(f.maxRedemptions) : undefined,
      oncePerClient: f.oncePerClient,
      startsAt: f.startsAt || undefined, expiresAt: f.expiresAt || undefined,
    });
    setBusy(false);
    if (r.ok) { setF({ ...f, label: '', code: '', percent: '10', amountPence: '' }); router.refresh(); }
    else alert(r.error || 'Could not create.');
  }
  async function act(payload: object) { setBusy(true); const r = await post(payload); setBusy(false); if (r.ok) router.refresh(); else alert(r.error || 'Failed.'); }

  return (
    <div className="space-y-8">
      {/* Create universal code */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
        <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl">New universal code</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className={label}>Promo name (internal)<input className={`${field} mt-1`} value={f.label} onChange={(e) => set('label', e.target.value)} placeholder="June 10% off" /></label>
          <label className={label}>Code (blank = auto)<input className={`${field} mt-1 uppercase`} value={f.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="K10SUMMERREADY" /></label>
          <label className={label}>Discount<div className="mt-1 flex gap-2">
            <select className={field} value={f.discountType} onChange={(e) => set('discountType', e.target.value)}><option value="PERCENT">% off</option><option value="FIXED">£ off</option></select>
            {f.discountType === 'PERCENT'
              ? <input className={field} type="number" min={1} max={100} value={f.percent} onChange={(e) => set('percent', e.target.value)} placeholder="10" />
              : <input className={field} type="number" min={1} value={f.amountPence} onChange={(e) => set('amountPence', e.target.value)} placeholder="£25" />}
          </div></label>
          <label className={label}>Min spend £ (optional)<input className={`${field} mt-1`} type="number" value={f.minSpendPence} onChange={(e) => set('minSpendPence', e.target.value)} /></label>
          <label className={label}>Max total redemptions (blank = unlimited)<input className={`${field} mt-1`} type="number" value={f.maxRedemptions} onChange={(e) => set('maxRedemptions', e.target.value)} /></label>
          <label className={label}>Starts (optional)<input className={`${field} mt-1`} type="date" value={f.startsAt} onChange={(e) => set('startsAt', e.target.value)} /></label>
          <label className={label}>Expires (optional)<input className={`${field} mt-1`} type="date" value={f.expiresAt} onChange={(e) => set('expiresAt', e.target.value)} /></label>
          <label className="flex items-center gap-2 self-end text-sm text-[var(--color-ink-soft)]"><input type="checkbox" checked={f.oncePerClient} onChange={(e) => set('oncePerClient', e.target.checked)} className="h-4 w-4 accent-[var(--color-gold)]" /> One use per client</label>
        </div>
        <button onClick={create} disabled={busy} className="mt-4 rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-50">Create code</button>
        <p className="mt-2 text-xs text-[var(--color-stone-soft)]">Leave “treatments” unset and it applies to everything. For per-recipient codes, use the discount fields on the Campaigns page.</p>
      </section>

      {/* Universal codes list */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
        <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl">Universal codes</h2>
        {universal.length === 0 ? <p className="text-sm text-[var(--color-stone-soft)]">No codes yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-[var(--color-stone-soft)]"><th scope="col" className="py-2">Code</th><th scope="col">Discount</th><th scope="col">Used</th><th scope="col">Window</th><th scope="col">Status</th><th scope="col"></th></tr></thead>
              <tbody>
                {universal.map((p) => (
                  <tr key={p.id} className="border-t border-[var(--color-line)]">
                    <td className="py-2"><span className="font-[family-name:var(--font-mono,monospace)] font-medium">{p.code}</span>{p.label && <span className="block text-xs text-[var(--color-stone-soft)]">{p.label}</span>}</td>
                    <td>{value(p)}{p.treatmentSlugs.length ? <span className="block text-xs text-[var(--color-stone-soft)]">{p.treatmentSlugs.length} treatment(s)</span> : ''}</td>
                    <td>{p.redeemedCount}{p.maxRedemptions ? ` / ${p.maxRedemptions}` : ''}</td>
                    <td className="text-xs text-[var(--color-stone)]">{fmtDate(p.startsAt) || '—'} → {fmtDate(p.expiresAt) || 'no end'}</td>
                    <td><span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-medium uppercase ${p.active ? 'bg-emerald-100 text-emerald-800' : 'bg-[var(--color-bone)] text-[var(--color-stone)]'}`}>{p.active ? 'active' : 'off'}</span></td>
                    <td className="text-right">
                      <button onClick={() => act({ op: 'toggle', id: p.id, active: !p.active })} disabled={busy} className="text-xs text-[var(--color-gold)] hover:underline">{p.active ? 'Disable' : 'Enable'}</button>
                      <button onClick={() => { if (confirm('Delete this code?')) act({ op: 'remove', id: p.id }); }} disabled={busy} className="ml-3 text-xs text-[var(--color-blush)] hover:underline">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Campaign batches */}
      {campaignBatches.length > 0 && (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
          <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl">Per-recipient campaign codes</h2>
          <ul className="divide-y divide-[var(--color-line)] text-sm">
            {campaignBatches.map((b) => (
              <li key={b.campaignId} className="flex items-center justify-between py-2">
                <span>{b.name}</span>
                <span className="text-[var(--color-stone)]">{b.count} codes · {b.redeemed} redeemed</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
