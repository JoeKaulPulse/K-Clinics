'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export type CampaignRow = {
  id: string; name: string; slug: string; status: string; goal: string | null;
  startAt: string | null; endAt: string | null; channels: string[];
  bookings: number; revenuePence: number; roi: number | null;
};

const money = (p: number) => `£${(p / 100).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-[var(--color-bone)] text-[var(--color-stone)]',
  SCHEDULED: 'bg-blue-100 text-blue-800',
  ACTIVE: 'bg-green-100 text-green-800',
  PAUSED: 'bg-amber-100 text-amber-800',
  ENDED: 'bg-[var(--color-bone)] text-[var(--color-stone)]',
};

export function CampaignsList({ rows, canManage }: { rows: CampaignRow[]; canManage: boolean }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('bookings');
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    const res = await fetch('/api/admin/marketing/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'create', name, goal }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (j.ok && j.id) router.push(`/admin/marketing/campaigns/${j.id}`);
    else router.refresh();
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
          <h2 className="mb-1 font-[family-name:var(--font-display)] text-lg">New campaign</h2>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-[var(--color-stone)]">Name<br /><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Valentine’s Day 2026" className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm w-64" /></label>
            <label className="text-xs text-[var(--color-stone)]">Goal<br />
              <select value={goal} onChange={(e) => setGoal(e.target.value)} className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm">
                <option value="bookings">Bookings</option>
                <option value="revenue">Revenue</option>
                <option value="leads">Leads</option>
                <option value="awareness">Awareness</option>
              </select>
            </label>
            <button onClick={create} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Creating…' : 'Create & set up'}</button>
          </div>
        </section>
      )}

      {rows.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)] bg-[var(--color-porcelain)] p-6 text-sm text-[var(--color-stone)]">No campaigns yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
          <table className="w-full text-sm">
            <thead><tr className="bg-[var(--color-bone)] text-left text-xs uppercase tracking-wide text-[var(--color-stone)]">
              <th scope="col" className="p-3">Campaign</th><th scope="col" className="p-3">Status</th><th scope="col" className="p-3">Bookings</th><th scope="col" className="p-3">Revenue</th><th scope="col" className="p-3">ROI</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--color-line)] hover:bg-[var(--color-bone)]/50">
                  <td className="p-3">
                    <Link href={`/admin/marketing/campaigns/${r.id}`} className="font-medium hover:text-[var(--color-gold)]">{r.name}</Link>
                    <span className="block text-xs text-[var(--color-stone)]">{r.goal} · {r.channels.length} channel{r.channels.length === 1 ? '' : 's'}</span>
                  </td>
                  <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${STATUS_STYLE[r.status] ?? ''}`}>{r.status}</span></td>
                  <td className="p-3 tabular-nums">{r.bookings}</td>
                  <td className="p-3 tabular-nums">{money(r.revenuePence)}</td>
                  <td className="p-3 tabular-nums">{r.roi == null ? '—' : `${r.roi}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
