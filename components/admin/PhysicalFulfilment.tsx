'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Card = { id: string; code: string; recipientName: string | null; shipName: string | null; shipLine1: string | null; shipLine2: string | null; shipCity: string | null; shipPostcode: string | null; design: string | null; amountPence: number; createdAt: string };

const money = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0 })}`;

export function PhysicalFulfilment({ items, canManage }: { items: Card[]; canManage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function markPosted(id: string) {
    setBusy(id);
    await fetch('/api/admin/gift-vouchers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'markPosted', id }) }).catch(() => {});
    setBusy(null);
    router.refresh();
  }

  return (
    <section className="mb-8 rounded-[var(--radius-lg)] border border-amber-300 bg-amber-50 p-5">
      <h2 className="font-[family-name:var(--font-display)] text-lg text-amber-900">📮 Physical cards to post ({items.length})</h2>
      <p className="mt-1 text-sm text-amber-800">Printed-card upgrades that have been paid for and are waiting to be posted to the recipient.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((c) => (
          <div key={c.id} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-4 text-sm">
            <p className="font-medium">{c.shipName || c.recipientName || '—'}</p>
            <p className="mt-0.5 text-[var(--color-stone)]">
              {[c.shipLine1, c.shipLine2, c.shipCity, c.shipPostcode].filter(Boolean).join(', ')}
            </p>
            <p className="mt-2 text-xs tabular-nums text-[var(--color-stone)]">{money(c.amountPence)} · {c.design || 'champagne'} · <span className="font-mono">{c.code}</span></p>
            {canManage && (
              <button onClick={() => markPosted(c.id)} disabled={busy === c.id} className="mt-3 rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-xs font-medium text-[var(--color-porcelain)] disabled:opacity-50">
                {busy === c.id ? 'Saving…' : 'Mark posted ✓'}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
