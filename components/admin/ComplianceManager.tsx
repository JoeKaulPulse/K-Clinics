'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RENEWAL_CATEGORIES, type RenewalStatus } from '@/lib/renewals-shared';

type Row = {
  id: string; name: string; category: string; provider: string | null; reference: string | null;
  renewalAt: string; costPence: number | null; notes: string | null; reminderDays: number[];
  lastRenewedAt: string | null; status: RenewalStatus; days: number;
};

const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]';
const label = 'mb-1 block text-xs font-medium text-[var(--color-stone)]';
const money = (p: number | null) => (p == null ? '' : `£${(p / 100).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`);
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const BADGE: Record<RenewalStatus, string> = {
  EXPIRED: 'bg-red-100 text-red-800',
  DUE: 'bg-[var(--color-blush)]/20 text-[var(--color-ink)]',
  SOON: 'bg-[var(--color-gold)]/20 text-[var(--color-gold-deep)]',
  OK: 'bg-[var(--color-bone)] text-[var(--color-stone)]',
};
const statusText = (r: Row) =>
  r.status === 'EXPIRED' ? `Expired ${Math.abs(r.days)}d ago` : r.days === 0 ? 'Due today' : `In ${r.days}d`;

const post = (body: object) =>
  fetch('/api/admin/compliance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then((r) => r.json()).catch(() => ({ ok: false, error: 'Network error' }));

const blank = { name: '', category: 'Insurance', renewalAt: '', provider: '', reference: '', costPence: '', notes: '' };

export function ComplianceManager({ rows, canManage }: { rows: Row[]; canManage: boolean }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const counts = {
    expired: rows.filter((r) => r.status === 'EXPIRED').length,
    due: rows.filter((r) => r.status === 'DUE').length,
    soon: rows.filter((r) => r.status === 'SOON').length,
  };

  async function submit(op: 'create' | 'update', f: typeof blank, id?: string) {
    if (!f.name.trim() || !f.renewalAt) { alert('Enter a name and a renewal date.'); return; }
    setBusy(true);
    const r = await post({ op, id, name: f.name, category: f.category, renewalAt: f.renewalAt, provider: f.provider, reference: f.reference, costPence: f.costPence === '' ? null : Number(f.costPence) * 100, notes: f.notes });
    setBusy(false);
    if (r.ok) { setAdding(false); setEditing(null); router.refresh(); } else alert(r.error || 'Failed.');
  }
  async function renew(id: string, currentISO: string) {
    const next = prompt('New renewal date (YYYY-MM-DD):', currentISO.slice(0, 10));
    if (!next) return;
    setBusy(true);
    const r = await post({ op: 'renew', id, renewalAt: next });
    setBusy(false);
    if (r.ok) router.refresh(); else alert(r.error || 'Failed.');
  }
  async function remove(id: string) {
    if (!confirm('Delete this compliance item? This cannot be undone.')) return;
    setBusy(true);
    const r = await post({ op: 'delete', id });
    setBusy(false);
    if (r.ok) router.refresh(); else alert(r.error || 'Failed.');
  }

  return (
    <div className="mt-7">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Expired" value={counts.expired} tone={counts.expired ? 'red' : 'stone'} />
        <Stat label="Due within 30 days" value={counts.due} tone={counts.due ? 'blush' : 'stone'} />
        <Stat label="Due within 90 days" value={counts.soon} tone={counts.soon ? 'gold' : 'stone'} />
      </div>

      {canManage && (
        <div className="mt-6">
          {adding ? (
            <ItemForm initial={blank} busy={busy} onSave={(f) => submit('create', f)} onCancel={() => setAdding(false)} submitLabel="Add item" />
          ) : (
            <button onClick={() => setAdding(true)} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)] hover:bg-[var(--color-ink-soft)]">+ Add compliance item</button>
          )}
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-[var(--color-stone)]">No compliance items yet.{canManage ? ' Add your first renewal above.' : ''}</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[var(--color-line)] text-left text-xs uppercase tracking-wide text-[var(--color-stone)]">
              <th className="px-4 py-3">Item</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Renews</th><th className="px-4 py-3">Status</th><th className="px-4 py-3" />
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                editing === r.id ? (
                  <tr key={r.id}><td colSpan={5} className="border-b border-[var(--color-line)] bg-[var(--color-bone)] p-4">
                    <ItemForm
                      initial={{ name: r.name, category: r.category, renewalAt: r.renewalAt.slice(0, 10), provider: r.provider ?? '', reference: r.reference ?? '', costPence: r.costPence != null ? String(r.costPence / 100) : '', notes: r.notes ?? '' }}
                      busy={busy} onSave={(f) => submit('update', f, r.id)} onCancel={() => setEditing(null)} submitLabel="Save changes" />
                  </td></tr>
                ) : (
                  <tr key={r.id} className="border-b border-[var(--color-line)] last:border-0 align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[var(--color-ink)]">{r.name}</div>
                      <div className="text-xs text-[var(--color-stone)]">
                        {[r.provider, r.reference, r.costPence != null ? `${money(r.costPence)}/yr` : null].filter(Boolean).join(' · ')}
                      </div>
                      {r.notes && <div className="mt-1 max-w-md text-xs text-[var(--color-stone)]">{r.notes}</div>}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-stone)]">{r.category}</td>
                    <td className="px-4 py-3 tabular-nums">{fmtDate(r.renewalAt)}</td>
                    <td className="px-4 py-3"><span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${BADGE[r.status]}`}>{statusText(r)}</span></td>
                    <td className="px-4 py-3 text-right">
                      {canManage && (
                        <div className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-xs">
                          <button onClick={() => renew(r.id, r.renewalAt)} disabled={busy} className="font-medium text-[var(--color-gold)] hover:underline disabled:opacity-50">Renew</button>
                          <button onClick={() => setEditing(r.id)} disabled={busy} className="text-[var(--color-stone)] hover:text-[var(--color-ink)] disabled:opacity-50">Edit</button>
                          <button onClick={() => remove(r.id)} disabled={busy} className="text-[var(--color-blush-deep)] hover:underline disabled:opacity-50">Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-3 text-xs text-[var(--color-stone)]">Reminders fire automatically at 90, 60 and 30 days before each renewal (and once on expiry) to everyone who can view compliance.</p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'red' | 'blush' | 'gold' | 'stone' }) {
  const color = tone === 'red' ? 'text-red-700' : tone === 'blush' ? 'text-[var(--color-ink)]' : tone === 'gold' ? 'text-[var(--color-gold-deep)]' : 'text-[var(--color-stone)]';
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-stone)]">{label}</p>
      <p className={`mt-2 font-[family-name:var(--font-display)] text-3xl tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function ItemForm({ initial, busy, onSave, onCancel, submitLabel }: { initial: typeof blank; busy: boolean; onSave: (f: typeof blank) => void; onCancel: () => void; submitLabel: string }) {
  const [f, setF] = useState(initial);
  const set = (k: keyof typeof blank, v: string) => setF({ ...f, [k]: v });
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><label className={label}>Name *</label><input className={field} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Public liability insurance" /></div>
        <div><label className={label}>Category</label>
          <select className={field} value={f.category} onChange={(e) => set('category', e.target.value)}>
            {RENEWAL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div><label className={label}>Renewal / expiry date *</label><input type="date" className={field} value={f.renewalAt} onChange={(e) => set('renewalAt', e.target.value)} /></div>
        <div><label className={label}>Provider</label><input className={field} value={f.provider} onChange={(e) => set('provider', e.target.value)} placeholder="e.g. Hiscox" /></div>
        <div><label className={label}>Reference / policy no.</label><input className={field} value={f.reference} onChange={(e) => set('reference', e.target.value)} /></div>
        <div><label className={label}>Annual cost (£)</label><input type="number" min="0" className={field} value={f.costPence} onChange={(e) => set('costPence', e.target.value)} /></div>
        <div className="sm:col-span-2"><label className={label}>Notes</label><textarea className={field} rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button onClick={() => onSave(f)} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-60">{busy ? 'Saving…' : submitLabel}</button>
        <button onClick={onCancel} className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">Cancel</button>
      </div>
    </div>
  );
}
