'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type TierRow = {
  id: string; key: string; name: string; minSpendPence: number; pointsMultiplierBps: number;
  birthdayBonusPoints: number; earlyAccessHours: number; retailDiscountPct: number;
  perks: string[]; color: string | null; active: boolean; members: number;
};

const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[var(--color-gold)]';

export function MembershipManager({ rows }: { rows: TierRow[] }) {
  const router = useRouter();
  const [tiers, setTiers] = useState(rows);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const set = (id: string, patch: Partial<TierRow>) => setTiers((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  async function save(t: TierRow) {
    setBusy(t.id); setMsg('');
    const res = await fetch('/api/admin/membership', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: t.id, name: t.name, minSpendPence: t.minSpendPence, pointsMultiplierBps: t.pointsMultiplierBps,
        birthdayBonusPoints: t.birthdayBonusPoints, earlyAccessHours: t.earlyAccessHours, retailDiscountPct: t.retailDiscountPct,
        perks: t.perks, active: t.active, color: t.color,
      }),
    });
    const j = await res.json().catch(() => ({ ok: false }));
    setBusy('');
    setMsg(j.ok ? `${t.name} saved ✓` : (j.error || 'Could not save.'));
    if (j.ok) router.refresh();
  }

  async function recompute() {
    setBusy('all'); setMsg('');
    const res = await fetch('/api/admin/membership', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'recomputeAll' }) });
    const j = await res.json().catch(() => ({ ok: false }));
    setBusy('');
    setMsg(j.ok ? `Recomputed ${j.recomputed} members ✓` : 'Recompute failed.');
    if (j.ok) router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl">Tiers</h2>
        <button onClick={recompute} disabled={busy === 'all'} className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm hover:border-[var(--color-gold)] disabled:opacity-50">{busy === 'all' ? 'Recomputing…' : 'Recompute now'}</button>
      </div>
      {msg && <p className="text-sm text-[var(--color-stone)]">{msg}</p>}

      <div className="space-y-3">
        {tiers.map((t) => (
          <div key={t.id} className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="h-4 w-4 rounded-full" style={{ background: t.color || 'var(--color-gold)' }} />
              <input value={t.name} onChange={(e) => set(t.id, { name: e.target.value })} className={`${field} max-w-[12rem]`} />
              <span className="rounded-full bg-[var(--color-bone)] px-2 py-0.5 text-xs text-[var(--color-stone)]">{t.members} members</span>
              <label className="ml-auto flex items-center gap-1.5 text-xs text-[var(--color-stone)]">
                <input type="checkbox" checked={t.active} onChange={(e) => set(t.id, { active: e.target.checked })} className="h-3.5 w-3.5 accent-[var(--color-gold)]" /> Active
              </label>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs text-[var(--color-stone)]">Threshold (£, 12-mo spend){t.key === 'member' && <span className="text-[var(--color-stone)]"> · base</span>}
                <input type="number" min={0} value={Math.round(t.minSpendPence / 100)} onChange={(e) => set(t.id, { minSpendPence: Math.round(Number(e.target.value) * 100) })} className={`${field} mt-1`} disabled={t.key === 'member'} />
              </label>
              <label className="text-xs text-[var(--color-stone)]">Points multiplier (×)
                <input type="number" min={1} max={10} step={0.05} value={(t.pointsMultiplierBps / 100).toString()} onChange={(e) => set(t.id, { pointsMultiplierBps: Math.round(Number(e.target.value) * 100) })} className={`${field} mt-1`} />
              </label>
              <label className="text-xs text-[var(--color-stone)]">Birthday bonus (pts)
                <input type="number" min={0} value={t.birthdayBonusPoints} onChange={(e) => set(t.id, { birthdayBonusPoints: Number(e.target.value) })} className={`${field} mt-1`} />
              </label>
              <label className="text-xs text-[var(--color-stone)]">Early access (hours)
                <input type="number" min={0} max={336} value={t.earlyAccessHours} onChange={(e) => set(t.id, { earlyAccessHours: Number(e.target.value) })} className={`${field} mt-1`} />
              </label>
            </div>
            <label className="mt-3 block text-xs text-[var(--color-stone)]">Perks (one per line)
              <textarea value={t.perks.join('\n')} onChange={(e) => set(t.id, { perks: e.target.value.split('\n') })} rows={3} className={`${field} mt-1`} />
            </label>
            <div className="mt-3">
              <button onClick={() => save(t)} disabled={busy === t.id} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy === t.id ? 'Saving…' : 'Save tier'}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
