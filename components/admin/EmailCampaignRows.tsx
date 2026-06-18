'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type DraftRow = { id: string; name: string; subject: string; status: string; scheduledAt: string | null; audience: string };

async function post(payload: object) {
  const r = await fetch('/api/admin/marketing/email/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return r.json().catch(() => ({ ok: false }));
}
const fmt = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function EmailCampaignRows({ rows }: { rows: DraftRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  async function sendNow(r: DraftRow) {
    if (!confirm(`Send “${r.name}” to its audience now?`)) return;
    setBusy(r.id); setErr('');
    const j = await post({ op: 'sendNow', id: r.id });
    setBusy('');
    if (j.ok) router.refresh(); else setErr(j.error || 'Could not send.');
  }
  async function remove(r: DraftRow) {
    if (!confirm(r.status === 'SCHEDULED' ? 'Cancel this scheduled send?' : 'Delete this draft?')) return;
    setBusy(r.id); setErr('');
    const j = await post({ op: 'delete', id: r.id });
    setBusy('');
    if (j.ok) router.refresh(); else setErr(j.error || 'Could not remove.');
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)]">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-[var(--color-line)] last:border-0">
              <td className="p-3">
                <span className="font-medium">{r.name}</span>
                <span className="block text-xs text-[var(--color-stone)]">{r.subject || 'No subject yet'} · {r.audience}</span>
              </td>
              <td className="p-3 text-xs text-[var(--color-stone)]">
                {r.status === 'AB_TESTING'
                  ? <span className="rounded-full bg-violet-100 px-2 py-0.5 font-medium text-violet-800">A/B testing{r.scheduledAt ? ` · winner ${fmt(r.scheduledAt)}` : ''}</span>
                  : r.status === 'SCHEDULED'
                    ? <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">Scheduled {r.scheduledAt ? fmt(r.scheduledAt) : ''}</span>
                    : <span className="rounded-full bg-[var(--color-bone)] px-2 py-0.5 font-medium text-[var(--color-stone)]">Draft</span>}
              </td>
              <td className="p-3 text-right">
                {r.status === 'AB_TESTING' ? (
                  <span className="text-xs text-[var(--color-stone)]">Testing in progress…</span>
                ) : (
                  <div className="flex flex-wrap justify-end gap-3 text-xs">
                    <Link href={`/admin/marketing/email/new?id=${r.id}`} className="text-[var(--color-gold)] hover:underline">Edit</Link>
                    <button disabled={busy === r.id} onClick={() => sendNow(r)} className="text-[var(--color-ink)] hover:underline disabled:opacity-50">{busy === r.id ? '…' : 'Send now'}</button>
                    <button disabled={busy === r.id} onClick={() => remove(r)} className="text-[var(--color-blush)] hover:underline disabled:opacity-50">{r.status === 'SCHEDULED' ? 'Cancel' : 'Delete'}</button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {err && <p className="border-t border-[var(--color-line)] bg-[var(--color-blush)]/10 p-2 text-center text-xs text-[var(--color-blush)]">{err}</p>}
    </div>
  );
}
