'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Staff = { id: string; name: string };
const CATS = [
  { v: 'PERFORMANCE', l: 'Performance' },
  { v: 'FRIENDLINESS', l: 'Friendliness' },
  { v: 'TEAMWORK', l: 'Teamwork' },
  { v: 'MANUAL', l: 'Other / adjustment' },
];

export function AwardPoints({ staff }: { staff: Staff[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [staffId, setStaffId] = useState('');
  const [points, setPoints] = useState('');
  const [category, setCategory] = useState('PERFORMANCE');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function submit() {
    if (!staffId || !points || !reason.trim()) { setMsg('Fill in all fields.'); return; }
    setBusy(true); setMsg('');
    const res = await fetch('/api/admin/rewards', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId, points: Number(points), category, reason }),
    });
    setBusy(false);
    if (res.ok) { setPoints(''); setReason(''); setOpen(false); router.refresh(); }
    else { const j = await res.json().catch(() => ({})); setMsg(j.error || 'Could not award.'); }
  }

  const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]';

  if (!open) return <button onClick={() => setOpen(true)} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)]">+ Award points</button>;

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
      <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl">Award points</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-[var(--color-stone)]">Staff member
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className={field}>
            <option value="">Select…</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-[var(--color-stone)]">Points (negative to deduct)
          <input type="number" value={points} onChange={(e) => setPoints(e.target.value)} className={field} />
        </label>
        <label className="text-xs text-[var(--color-stone)]">Category
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
            {CATS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
          </select>
        </label>
        <label className="text-xs text-[var(--color-stone)]">Reason
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Outstanding client feedback" className={field} />
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button onClick={submit} disabled={busy} className="rounded-full bg-[var(--color-gold)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--color-ink)] disabled:opacity-60">{busy ? 'Saving…' : 'Award'}</button>
        <button onClick={() => setOpen(false)} className="text-sm text-[var(--color-stone)]">Cancel</button>
        {msg && <span className="text-sm text-[var(--color-stone)]">{msg}</span>}
      </div>
    </section>
  );
}
