'use client';

import { useCallback, useEffect, useState } from 'react';

type Row = { id: string; name: string; category: string | null; contactName: string | null; email: string | null; phone: string | null; accountNumber: string | null; xeroContactId: string | null; active: boolean };
type Call = { id: string; direction: string; startedAt: string; durationSec: number; fromNumber: string; toNumber: string };
type Full = Row & { website: string | null; addressLine: string | null; city: string | null; postcode: string | null; country: string | null; notes: string | null; calls: Call[] };

const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]';
const label = 'mb-1 block text-xs uppercase tracking-[0.12em] text-[var(--color-stone)]';

async function post(payload: object) {
  const r = await fetch('/api/admin/suppliers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return r.json().catch(() => ({ ok: false }));
}
const blank = (): Partial<Full> => ({ name: '', category: '', contactName: '', email: '', phone: '', website: '', addressLine: '', city: '', postcode: '', country: 'GB', accountNumber: '', xeroContactId: '', notes: '', active: true });

export function SupplierManager({ canManage }: { canManage: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [editing, setEditing] = useState<Partial<Full> | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [importing, setImporting] = useState(false);
  const [bills, setBills] = useState<{ invoiceNumber: string; date: string | null; total: number; amountDue: number; status: string; currency: string }[] | null>(null);
  const [billsMsg, setBillsMsg] = useState('');

  const load = useCallback(async () => { const r = await post({ op: 'list' }); if (r.ok) setRows(r.suppliers); }, []);
  useEffect(() => { load(); }, [load]);

  async function openEdit(id: string) { setBills(null); setBillsMsg(''); const r = await post({ op: 'get', id }); if (r.ok) setEditing(r.supplier); }
  async function importXero() {
    if (!confirm('Import / refresh supplier contacts from Xero?')) return;
    setImporting(true);
    const r = await post({ op: 'importXero' });
    setImporting(false);
    if (r.ok) { alert(`Imported ${r.created} new and updated ${r.updated} supplier(s) from Xero.`); load(); }
    else alert(r.error || 'Could not import from Xero.');
  }
  async function loadBills(id: string) {
    setBillsMsg('Loading bills from Xero…'); setBills(null);
    const r = await post({ op: 'bills', id });
    if (r.ok) { setBills(r.bills); setBillsMsg(r.bills.length ? '' : 'No bills found in Xero.'); }
    else setBillsMsg(r.error || 'Could not load bills.');
  }
  async function save() {
    if (!editing?.name?.trim()) return;
    setBusy(true);
    const r = await post({ op: 'upsert', ...editing });
    setBusy(false);
    if (r.ok) { setEditing(null); load(); } else alert(r.error || 'Could not save.');
  }
  async function remove(id: string) {
    if (!confirm('Deactivate this supplier? Call history is kept.')) return;
    await post({ op: 'remove', id }); setEditing(null); load();
  }

  const filtered = rows.filter((s) => !q || `${s.name} ${s.category ?? ''} ${s.contactName ?? ''} ${s.phone ?? ''}`.toLowerCase().includes(q.toLowerCase()));
  const set = <K extends keyof Full>(k: K, v: Full[K]) => setEditing((e) => ({ ...e, [k]: v }));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search suppliers…" className={`${field} max-w-xs`} />
        {canManage && <button onClick={() => setEditing(blank())} className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-[var(--color-porcelain)] hover:bg-[var(--color-gold)]">Add supplier</button>}
        {canManage && <button onClick={importXero} disabled={importing} className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-medium hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] disabled:opacity-50">{importing ? 'Importing…' : 'Import from Xero'}</button>}
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
        {filtered.length === 0 ? (
          <p className="p-6 text-sm text-[var(--color-stone)]">No suppliers yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--color-line)] text-left text-xs uppercase tracking-wide text-[var(--color-stone)]">
              <tr><th scope="col" className="px-4 py-2.5">Supplier</th><th scope="col" className="px-4 py-2.5">Category</th><th scope="col" className="px-4 py-2.5">Contact</th><th scope="col" className="px-4 py-2.5">Phone</th><th scope="col" className="px-4 py-2.5">Xero</th></tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} onClick={() => openEdit(s.id)} className={`cursor-pointer border-b border-[var(--color-line)] last:border-0 hover:bg-[var(--color-bone)] ${!s.active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-2.5 font-medium">{s.name}{!s.active && <span className="ml-2 text-[0.6rem] uppercase text-[var(--color-stone)]">inactive</span>}</td>
                  <td className="px-4 py-2.5 text-[var(--color-stone)]">{s.category || '—'}</td>
                  <td className="px-4 py-2.5 text-[var(--color-stone)]">{s.contactName || s.email || '—'}</td>
                  <td className="px-4 py-2.5 text-[var(--color-stone)]">{s.phone || '—'}</td>
                  <td className="px-4 py-2.5">{s.xeroContactId ? <span className="rounded-full bg-[var(--color-jade)]/15 px-2 py-0.5 text-[0.6rem] font-medium text-[var(--color-jade)]">linked</span> : <span className="text-[var(--color-stone)]">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-[var(--radius-lg)] bg-[var(--color-porcelain)] p-6 shadow-[var(--shadow-lift)]">
            <h2 className="font-[family-name:var(--font-display)] text-xl">{editing.id ? 'Edit supplier' : 'New supplier'}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><label className={label}>Name *</label><input className={field} value={editing.name || ''} onChange={(e) => set('name', e.target.value)} disabled={!canManage} /></div>
              <div><label className={label}>Category</label><input className={field} value={editing.category || ''} onChange={(e) => set('category', e.target.value)} disabled={!canManage} placeholder="Consumables, Equipment…" /></div>
              <div><label className={label}>Account number</label><input className={field} value={editing.accountNumber || ''} onChange={(e) => set('accountNumber', e.target.value)} disabled={!canManage} /></div>
              <div><label className={label}>Contact name</label><input className={field} value={editing.contactName || ''} onChange={(e) => set('contactName', e.target.value)} disabled={!canManage} /></div>
              <div><label className={label}>Phone</label><input className={field} value={editing.phone || ''} onChange={(e) => set('phone', e.target.value)} disabled={!canManage} /></div>
              <div><label className={label}>Email</label><input className={field} value={editing.email || ''} onChange={(e) => set('email', e.target.value)} disabled={!canManage} /></div>
              <div><label className={label}>Website</label><input className={field} value={editing.website || ''} onChange={(e) => set('website', e.target.value)} disabled={!canManage} /></div>
              <div className="sm:col-span-2"><label className={label}>Address</label><input className={field} value={editing.addressLine || ''} onChange={(e) => set('addressLine', e.target.value)} disabled={!canManage} /></div>
              <div><label className={label}>City</label><input className={field} value={editing.city || ''} onChange={(e) => set('city', e.target.value)} disabled={!canManage} /></div>
              <div><label className={label}>Postcode</label><input className={field} value={editing.postcode || ''} onChange={(e) => set('postcode', e.target.value)} disabled={!canManage} /></div>
              <div className="sm:col-span-2"><label className={label}>Xero contact ID</label><input className={field} value={editing.xeroContactId || ''} onChange={(e) => set('xeroContactId', e.target.value)} disabled={!canManage} placeholder="Links to their bills in Xero" /></div>
              <div className="sm:col-span-2"><label className={label}>Notes</label><textarea rows={2} className={field} value={editing.notes || ''} onChange={(e) => set('notes', e.target.value)} disabled={!canManage} /></div>
            </div>

            {editing.calls && editing.calls.length > 0 && (
              <div className="mt-5">
                <p className={label}>Recent calls</p>
                <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white text-sm">
                  {editing.calls.map((c) => (
                    <li key={c.id} className="flex items-center justify-between px-3 py-2">
                      <span>{c.direction === 'INBOUND' ? '↘ Inbound' : '↗ Outbound'} · {new Date(c.startedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="tabular-nums text-[var(--color-stone)]">{Math.floor(c.durationSec / 60)}m {c.durationSec % 60}s</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {editing.id && (
              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <p className={label}>Xero bills</p>
                  {editing.xeroContactId
                    ? <button onClick={() => loadBills(editing.id!)} className="text-xs font-medium text-[var(--color-gold)] hover:underline">Load bills →</button>
                    : <span className="text-xs text-[var(--color-stone)]">Add a Xero contact ID to see bills</span>}
                </div>
                {billsMsg && <p className="mt-1 text-sm text-[var(--color-stone)]">{billsMsg}</p>}
                {bills && bills.length > 0 && (
                  <ul className="mt-2 divide-y divide-[var(--color-line)] rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white text-sm">
                    {bills.map((bl, i) => (
                      <li key={i} className="flex items-center justify-between px-3 py-2">
                        <span>{bl.invoiceNumber} · {bl.date ? new Date(bl.date).toLocaleDateString('en-GB') : '—'} <span className="text-[var(--color-stone)]">({bl.status})</span></span>
                        <span className="font-medium tabular-nums">£{bl.total.toFixed(2)}{bl.amountDue > 0 && <span className="ml-1 text-[var(--color-blush-deep)]">· £{bl.amountDue.toFixed(2)} due</span>}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="mt-6 flex items-center justify-between">
              <div className="flex gap-2">
                {canManage && <button onClick={save} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm font-medium text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>}
                <button onClick={() => setEditing(null)} className="rounded-full border border-[var(--color-line)] px-5 py-2 text-sm font-medium">Close</button>
              </div>
              {canManage && editing.id && <button onClick={() => remove(editing.id!)} className="text-sm text-[var(--color-blush-deep)] hover:underline">Deactivate</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
