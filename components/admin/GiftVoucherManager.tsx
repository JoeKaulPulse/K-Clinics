'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Voucher = {
  id: string; code: string; status: string;
  amountPence: number; balancePence: number;
  purchaserName: string; purchaserEmail: string;
  recipientName: string | null; recipientEmail: string | null;
  message: string | null; delivered: boolean;
  deliverAt: string | null; expiresAt: string | null; createdAt: string;
};

const money = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0 })}`;
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800', REDEEMED: 'bg-stone-200 text-stone-700',
  PENDING: 'bg-amber-100 text-amber-800', CANCELLED: 'bg-rose-100 text-rose-800',
};

async function post(payload: object) {
  const r = await fetch('/api/admin/gift-vouchers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return r.json().catch(() => ({ ok: false }));
}

export function GiftVoucherManager({ vouchers, canManage = false }: { vouchers: Voucher[]; canManage?: boolean }) {
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'REDEEMED' | 'PENDING' | 'CANCELLED'>('ALL');
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return vouchers.filter((v) => {
      if (filter !== 'ALL' && v.status !== filter) return false;
      if (!needle) return true;
      return [v.code, v.purchaserName, v.purchaserEmail, v.recipientName, v.recipientEmail].some((s) => s?.toLowerCase().includes(needle));
    });
  }, [vouchers, filter, q]);

  const active = vouchers.filter((v) => v.status === 'ACTIVE');
  const outstanding = active.reduce((s, v) => s + v.balancePence, 0);
  const sold = vouchers.filter((v) => v.status !== 'PENDING' && v.status !== 'CANCELLED').reduce((s, v) => s + v.amountPence, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total sold" value={money(sold)} />
        <Stat label="Outstanding balance" value={money(outstanding)} />
        <Stat label="Active vouchers" value={String(active.length)} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {(['ALL', 'ACTIVE', 'PENDING', 'REDEEMED', 'CANCELLED'] as const).map((s) => (
            <button key={s} onClick={() => setFilter(s)} className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${filter === s ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'border-[var(--color-line)] hover:border-[var(--color-stone-soft)]'}`}>{s[0] + s.slice(1).toLowerCase()}</button>
          ))}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code, name or email…" className="ml-auto w-full max-w-xs rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm outline-none focus:border-[var(--color-gold)]" />
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
        <table className="w-full min-w-[820px] text-sm">
          <thead><tr className="bg-[var(--color-porcelain)] text-left text-xs uppercase tracking-wide text-[var(--color-stone)]"><th scope="col" className="px-3 py-2">Code</th><th scope="col" className="px-3 py-2">From / To</th><th scope="col" className="px-3 py-2">Value</th><th scope="col" className="px-3 py-2">Balance</th><th scope="col" className="px-3 py-2">Status</th><th scope="col" className="px-3 py-2">Expires</th><th scope="col" className="px-3 py-2"></th></tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-[var(--color-stone)]">No vouchers found.</td></tr>
            ) : filtered.map((v) => <Row key={v.id} v={v} canManage={canManage} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--color-stone)]">{label}</p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-2xl tabular-nums">{value}</p>
    </div>
  );
}

function Row({ v, canManage }: { v: Voucher; canManage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function act(payload: object) { setBusy(true); const r = await post(payload); setBusy(false); if (r.ok) router.refresh(); else alert(r.error || 'Failed.'); }
  const redeemable = v.status === 'ACTIVE' && v.balancePence > 0;
  return (
    <tr className="border-t border-[var(--color-line)] align-top">
      <td className="px-3 py-2 font-[family-name:var(--font-mono,monospace)] text-xs">{v.code}</td>
      <td className="px-3 py-2">
        <span className="block">{v.purchaserName}</span>
        <span className="block text-xs text-[var(--color-stone)]">→ {v.recipientName || v.recipientEmail || 'self'}{v.deliverAt && !v.delivered ? ` · scheduled ${fmt(v.deliverAt)}` : ''}</span>
      </td>
      <td className="px-3 py-2 tabular-nums">{money(v.amountPence)}</td>
      <td className="px-3 py-2 font-medium tabular-nums">{money(v.balancePence)}</td>
      <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[v.status] || ''}`}>{v.status}</span></td>
      <td className="px-3 py-2 text-xs text-[var(--color-stone)]">{fmt(v.expiresAt)}</td>
      <td className="px-3 py-2 text-right">
        {canManage ? (
          <div className="flex flex-wrap justify-end gap-2 text-xs">
            {redeemable && <button disabled={busy} onClick={() => { const a = prompt(`Redeem amount (£), balance ${money(v.balancePence)}:`); const p = Math.round(Number(a) * 100); if (p > 0) act({ op: 'redeem', id: v.id, amountPence: p }); }} className="text-[var(--color-gold-deep)] hover:underline disabled:opacity-50">Redeem</button>}
            {(v.status === 'ACTIVE' || v.status === 'REDEEMED') && <button disabled={busy} onClick={() => act({ op: 'resend', id: v.id })} className="text-[var(--color-stone)] hover:underline disabled:opacity-50">Resend</button>}
            {v.status !== 'CANCELLED' && <button disabled={busy} onClick={() => { if (confirm('Cancel this voucher? The balance will no longer be redeemable.')) act({ op: 'cancel', id: v.id }); }} className="text-[var(--color-blush-deep)] hover:underline disabled:opacity-50">Cancel</button>}
          </div>
        ) : <span className="text-xs text-[var(--color-stone)]">—</span>}
      </td>
    </tr>
  );
}
