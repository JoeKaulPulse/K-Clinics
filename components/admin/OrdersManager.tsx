'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { EmptyState } from '@/components/admin/EmptyState';

export type OrderRow = {
  id: string; number: string; createdAt: string; name: string; email: string; method: string; totalPence: number;
  status: string; fulfillment: string; trackingNote: string; address: string; items: { name: string; qty: number; ageRestricted: boolean }[];
};

const money = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0 })}`;
const STATUS: Record<string, string> = { PENDING: 'bg-amber-100 text-amber-800', PAID: 'bg-blue-100 text-blue-800', FULFILLED: 'bg-green-100 text-green-800', REFUNDED: 'bg-[var(--color-bone)] text-[var(--color-stone)]', CANCELLED: 'bg-[var(--color-blush)]/30 text-[var(--color-ink)]' };

export function OrdersManager({ rows, canManage }: { rows: OrderRow[]; canManage: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  if (rows.length === 0) return (
    <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)] bg-[var(--color-porcelain)]">
      <EmptyState
        title="No orders yet"
        hint="Retail orders placed in the online shop appear here to fulfil, add tracking and manage."
        icon={<><path d="M5 8h14l-1 11a2 2 0 0 1-2 1.8H8a2 2 0 0 1-2-1.8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>}
      />
    </div>
  );
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)]">
      <table className="w-full text-sm tabular-nums">
        <thead><tr className="bg-[var(--color-bone)] text-left text-xs uppercase tracking-wide text-[var(--color-stone-soft)]"><th className="p-3">Order</th><th className="p-3">Customer</th><th className="p-3">Total</th><th className="p-3">Status</th><th className="p-3">Fulfilment</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <Row key={r.id} r={r} open={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} canManage={canManage} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ r, open, onToggle, canManage }: { r: OrderRow; open: boolean; onToggle: () => void; canManage: boolean }) {
  const router = useRouter();
  const [tracking, setTracking] = useState(r.trackingNote);
  const [busy, setBusy] = useState(false);
  async function update(payload: object) {
    setBusy(true);
    const res = await fetch('/api/admin/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, ...payload }) });
    setBusy(false);
    if (res.ok) router.refresh();
    else { const j = await res.json().catch(() => ({})); alert(j.error || 'Could not update this order.'); }
  }
  // A closed order (refunded/cancelled) shouldn't be silently flipped back to
  // FULFILLED just because its shipping note changes — only promote PAID orders.
  const closed = r.status === 'REFUNDED' || r.status === 'CANCELLED';
  return (
    <>
      <tr className="cursor-pointer border-t border-[var(--color-line)] hover:bg-[var(--color-bone)]/50" onClick={onToggle}>
        <td className="p-3 font-medium">{r.number}<span className="block text-xs text-[var(--color-stone-soft)]">{new Date(r.createdAt).toLocaleDateString('en-GB')}</span></td>
        <td className="p-3">{r.name}<span className="block text-xs text-[var(--color-stone-soft)]">{r.email}</span></td>
        <td className="p-3">{money(r.totalPence)}</td>
        <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${STATUS[r.status] ?? ''}`}>{r.status}</span></td>
        <td className="p-3 capitalize">{r.fulfillment}</td>
      </tr>
      {open && (
        <tr className="border-t border-[var(--color-line)] bg-[var(--color-porcelain)]"><td colSpan={5} className="p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase text-[var(--color-stone-soft)]">Items</p>
              <ul className="mt-1 text-sm">{r.items.map((i, n) => <li key={n}>{i.name} × {i.qty}{i.ageRestricted && <span className="ml-1 rounded-full bg-[var(--color-ink)] px-1.5 py-0.5 text-[0.55rem] text-[var(--color-porcelain)]">18+</span>}</li>)}</ul>
              <p className="mt-2 text-xs font-semibold uppercase text-[var(--color-stone-soft)]">{r.method === 'ship' ? 'Ship to' : 'Fulfilment'}</p>
              <p className="text-sm text-[var(--color-stone)]">{r.address}</p>
            </div>
            {canManage && (
              <div className="space-y-2">
                <label className="block text-xs text-[var(--color-stone)]">Fulfilment
                  <select disabled={busy} defaultValue={r.fulfillment} onChange={(e) => update({ fulfillment: e.target.value, status: e.target.value !== 'unfulfilled' && r.status === 'PAID' ? 'FULFILLED' : undefined })} className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm disabled:opacity-50">
                    <option value="unfulfilled">Unfulfilled</option><option value="shipped">Shipped</option><option value="collected">Collected</option>
                  </select>
                </label>
                <label className="block text-xs text-[var(--color-stone)]">Tracking / note
                  <input disabled={busy} value={tracking} onChange={(e) => setTracking(e.target.value)} onBlur={() => tracking !== r.trackingNote && update({ trackingNote: tracking })} className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm disabled:opacity-50" />
                </label>
                {!closed && (
                  <div className="flex gap-3 text-xs">
                    <button disabled={busy} onClick={() => { if (confirm(`Mark order ${r.number} as refunded? Refund the payment in Stripe separately.`)) update({ status: 'REFUNDED' }); }} className="text-[var(--color-stone)] hover:underline disabled:opacity-50">Mark refunded</button>
                    <button disabled={busy} onClick={() => { if (confirm(`Cancel order ${r.number}? This can't be undone here.`)) update({ status: 'CANCELLED' }); }} className="text-[var(--color-blush)] hover:underline disabled:opacity-50">Cancel</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </td></tr>
      )}
    </>
  );
}
