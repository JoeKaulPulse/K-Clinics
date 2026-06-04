'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const money = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0 })}`;

// Pull ad spend from connected platforms into campaign ROI. Shown when at least
// one ad platform is connected.
export function AdSpendSync() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function sync() {
    setBusy(true); setMsg('');
    const res = await fetch('/api/admin/marketing/ad-spend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ days: 30 }) });
    const j = await res.json().catch(() => ({ ok: false }));
    setBusy(false);
    if (!j.ok) { setMsg(j.error || 'Sync failed.'); return; }
    setMsg(j.fetched === 0
      ? 'No spend returned yet — check the platform is connected with ad-report access.'
      : `Updated ${j.updated} campaign${j.updated === 1 ? '' : 's'} with ${money(j.totalPence)} of spend (last 30 days).`);
    router.refresh();
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg">Ad spend</h2>
          <p className="mt-0.5 text-sm text-[var(--color-stone)]">Pull the last 30 days of spend from your connected ad platforms into each campaign’s ROI. Match by naming your ad-platform campaign the same as the campaign here (or its UTM). Runs automatically every day too.</p>
        </div>
        <button onClick={sync} disabled={busy} className="shrink-0 rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Syncing…' : 'Sync ad spend now'}</button>
      </div>
      {msg && <p className="mt-3 text-sm text-[var(--color-stone)]">{msg}</p>}
    </div>
  );
}
