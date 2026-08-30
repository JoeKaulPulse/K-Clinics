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
  ACTIVE: 'bg-[var(--color-jade)]/15 text-[var(--color-ink)]', REDEEMED: 'bg-stone-200 text-stone-700',
  PENDING: 'bg-[var(--color-gold)]/20 text-[var(--color-ink)]', CANCELLED: 'bg-[var(--color-blush)]/20 text-[var(--color-blush-deep)]',
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
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code, name or email…" aria-label="Search gift vouchers" className="ml-auto w-full max-w-xs rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm outline-none focus:border-[var(--color-gold)] focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]" />
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
  const [redeeming, setRedeeming] = useState(false);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  async function act(payload: object) { setBusy(true); const r = await post(payload); setBusy(false); if (r.ok) router.refresh(); else alert(r.error || 'Failed.'); }
  const redeemable = v.status === 'ACTIVE' && v.balancePence > 0;

  function openRedeem() { setRedeeming(true); setAmount(''); setError(null); }
  function cancelRedeem() { setRedeeming(false); setAmount(''); setError(null); }
  // BLD-1523: was `prompt()` — cancelling or typing a non-numeric value did
  // nothing, with no explanation, for a real money-handling action. This now
  // validates inline (empty/non-numeric/zero/negative, and amount above the
  // outstanding balance) with a visible message before ever calling act().
  function confirmRedeem() {
    const n = Number(amount);
    if (!amount.trim() || !Number.isFinite(n) || n <= 0) {
      setError('Enter a valid amount greater than £0.');
      return;
    }
    const p = Math.round(n * 100);
    if (p > v.balancePence) {
      setError(`Amount exceeds the outstanding balance of ${money(v.balancePence)}.`);
      return;
    }
    setError(null);
    setRedeeming(false);
    act({ op: 'redeem', id: v.id, amountPence: p });
  }

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
          redeeming ? (
            <div className="min-w-[180px] text-right">
              <div className="flex flex-wrap items-center justify-end gap-1.5 text-xs">
                <label htmlFor={`redeem-${v.id}`} className="sr-only">Redeem amount in pounds for {v.code}</label>
                <input
                  id={`redeem-${v.id}`}
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  autoFocus
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); setError(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') confirmRedeem(); if (e.key === 'Escape') cancelRedeem(); }}
                  placeholder={`£ up to ${money(v.balancePence)}`}
                  className="w-28 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2 py-1 text-xs outline-none focus:border-[var(--color-gold)] focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]"
                />
                <button disabled={busy} onClick={confirmRedeem} className="text-[var(--color-gold-deep)] hover:underline disabled:opacity-50">Confirm</button>
                <button disabled={busy} onClick={cancelRedeem} className="text-[var(--color-stone)] hover:underline disabled:opacity-50">Cancel</button>
              </div>
              {error && <p role="alert" className="mt-1 text-right text-xs text-[var(--color-blush-deep)]">{error}</p>}
            </div>
          ) : (
            <div className="flex flex-wrap justify-end gap-2 text-xs">
              {redeemable && <button disabled={busy} onClick={openRedeem} className="text-[var(--color-gold-deep)] hover:underline disabled:opacity-50">Redeem</button>}
              {(v.status === 'ACTIVE' || v.status === 'REDEEMED') && <button disabled={busy} onClick={() => act({ op: 'resend', id: v.id })} className="text-[var(--color-stone)] hover:underline disabled:opacity-50">Resend</button>}
              {v.status !== 'CANCELLED' && <button disabled={busy} onClick={() => { if (confirm('Cancel this voucher? The balance will no longer be redeemable.')) act({ op: 'cancel', id: v.id }); }} className="text-[var(--color-blush-deep)] hover:underline disabled:opacity-50">Cancel</button>}
            </div>
          )
        ) : <span className="text-xs text-[var(--color-stone)]">—</span>}
      </td>
    </tr>
  );
}
