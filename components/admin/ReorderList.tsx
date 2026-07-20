'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Line = {
  id: string; name: string; brand: string | null; size: string | null; unit: string;
  supplier: string; moq: number; currentQty: number; suggestQty: number;
  costPence: number | null; lineCostPence: number | null;
};
type Group = { supplier: string; lines: Line[]; totalPence: number };

const gbp = (p: number | null) => (p == null ? '—' : `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

async function move(itemId: string, qty: number) {
  const res = await fetch('/api/admin/inventory', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'move', itemId, qty, reason: 'RECEIVED', note: 'Received via reorder' }),
  });
  return res.ok;
}

export function ReorderList({ groups, canManage, uk }: { groups: Group[]; canManage: boolean; uk: boolean }) {
  const L = (en: string, ukt: string) => (uk ? ukt : en);
  return (
    <div className="space-y-8">
      {groups.map((g) => <SupplierGroup key={g.supplier} group={g} canManage={canManage} uk={uk} L={L} />)}
    </div>
  );
}

function SupplierGroup({ group, canManage, uk, L }: { group: Group; canManage: boolean; uk: boolean; L: (en: string, uk: string) => string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  function poText() {
    const lines = group.lines.map((l) => `${l.suggestQty} x ${l.name}${l.size ? ` (${l.size})` : ''}${l.brand ? ` — ${l.brand}` : ''}`);
    return `Purchase order — ${group.supplier}\n\n${lines.join('\n')}\n\nEstimated total (ex VAT): ${gbp(group.totalPence)}`;
  }

  async function copyPO() {
    try { await navigator.clipboard.writeText(poText()); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  }

  async function receiveAll() {
    if (!confirm(L(`Receive all ${group.lines.length} suggested quantities into stock?`, `Прийняти всі ${group.lines.length} запропонованих кількостей на склад?`))) return;
    setBusy(true);
    for (const l of group.lines) await move(l.id, l.suggestQty);
    setBusy(false); setDone(true);
    router.refresh();
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl">{group.supplier}</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--color-stone)]">{gbp(group.totalPence)}</span>
          <button onClick={copyPO} className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs hover:bg-[var(--color-bone)]">
            {copied ? L('Copied ✓', 'Скопійовано ✓') : L('Copy PO', 'Копіювати замовлення')}
          </button>
          {canManage && (
            <button onClick={receiveAll} disabled={busy || done} className="rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs text-[var(--color-porcelain)] disabled:opacity-50">
              {busy ? L('Receiving…', 'Прийом…') : done ? L('Received ✓', 'Прийнято ✓') : L('Receive all', 'Прийняти все')}
            </button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-line)]">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-[var(--color-bone)] text-xs uppercase tracking-wide text-[var(--color-stone)]">
            <tr>
              {[L('Product', 'Товар'), L('In stock', 'В наявності'), L('MOQ', 'МОЗ'), L('Order', 'Замовити'), L('Line cost', 'Сума')].map((h) => (
                <th key={h} scope="col" className="px-4 py-2.5 text-right first:text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {group.lines.map((l) => (
              <tr key={l.id} className="border-t border-[var(--color-line)] bg-[var(--color-porcelain)]">
                <td className="px-4 py-2.5">
                  <span className="font-medium">{l.name}</span>
                  {(l.size || l.brand) && <span className="ml-2 text-xs text-[var(--color-stone)]">{[l.brand, l.size].filter(Boolean).join(' · ')}</span>}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-[var(--color-blush-deep)]">{l.currentQty} {l.unit}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-[var(--color-stone)]">{l.moq}</td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums">{l.suggestQty}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{gbp(l.lineCostPence)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
