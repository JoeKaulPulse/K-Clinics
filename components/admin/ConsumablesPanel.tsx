'use client';

import { useState, useTransition } from 'react';
import { recordConsumable, removeConsumable } from '@/app/admin/bookings/clinical-actions';

type Item = { id: string; name: string; unit: string; currentQty: number };
type Used = { id: string; itemName: string; unit: string; qty: number; batchNo: string | null; by: string | null; at: string };

export function ConsumablesPanel({ bookingId, items, used }: { bookingId: string; items: Item[]; used: Used[] }) {
  const [pending, start] = useTransition();
  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [err, setErr] = useState('');

  const field = 'rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm outline-none focus:border-[var(--color-gold)]';

  function add() {
    if (!itemId || !qty || Number(qty) <= 0) { setErr('Pick an item and quantity.'); return; }
    start(async () => {
      setErr('');
      const r = await recordConsumable(bookingId, itemId, Number(qty), batchNo);
      if (r.ok) { setItemId(''); setQty(''); setBatchNo(''); } else setErr(r.error || 'Could not record.');
    });
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
      <h2 className="mb-1 font-[family-name:var(--font-display)] text-xl">Consumables used</h2>
      <p className="mb-4 text-sm text-[var(--color-stone)]">Deducts from stock and records batch traceability against this treatment.</p>

      {used.length > 0 && (
        <ul className="mb-4 divide-y divide-[var(--color-line)]">
          {used.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>
                <span className="font-medium">{u.qty} {u.unit}</span> · {u.itemName}
                {u.batchNo ? <span className="text-[var(--color-stone)]"> · batch {u.batchNo}</span> : ''}
                {u.by ? <span className="text-xs text-[var(--color-stone)]"> · {u.by}</span> : ''}
              </span>
              <button onClick={() => start(async () => { await removeConsumable(u.id, bookingId); })} disabled={pending} className="shrink-0 text-xs text-[var(--color-stone)] hover:text-[var(--color-blush)] disabled:opacity-50">Remove</button>
            </li>
          ))}
        </ul>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-[var(--color-stone)]">No stock items yet — add them in Inventory.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} className={field}>
            <option value="">Select item…</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.currentQty} {i.unit})</option>)}
          </select>
          <input type="number" step="any" placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} className={`${field} w-20`} />
          <input placeholder="Batch (optional)" value={batchNo} onChange={(e) => setBatchNo(e.target.value)} className={`${field} w-32`} />
          <button onClick={add} disabled={pending} className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-60">{pending ? '…' : 'Add'}</button>
        </div>
      )}
      {err && <p role="alert" aria-live="assertive" className="mt-2 text-sm text-[var(--color-blush)]">{err}</p>}
    </section>
  );
}
