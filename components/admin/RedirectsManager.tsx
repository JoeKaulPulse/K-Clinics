'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type RedirectRow = { id: string; fromPath: string; toUrl: string; code: number; active: boolean; note: string | null };

const field = 'rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm';

async function post(payload: object) {
  const res = await fetch('/api/admin/redirects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return res.json().catch(() => ({ ok: res.ok }));
}

export function RedirectsManager({ rows }: { rows: RedirectRow[] }) {
  return (
    <div className="space-y-8">
      <CreatePanel />
      <BulkPanel />
      <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)]">
        <table className="w-full text-sm">
          <thead><tr className="bg-[var(--color-bone)] text-left text-xs uppercase tracking-wide text-[var(--color-stone-soft)]">
            <th className="p-3">From</th><th className="p-3">To</th><th className="p-3">Type</th><th className="p-3"></th>
          </tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="p-6 text-center text-sm text-[var(--color-stone)]">No redirects yet.</td></tr>
            ) : rows.map((r) => <Row key={r.id} r={r} />)}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function CreatePanel() {
  const router = useRouter();
  const [fromPath, setFrom] = useState('');
  const [toUrl, setTo] = useState('');
  const [code, setCode] = useState(301);
  const [msg, setMsg] = useState('');
  async function create() {
    if (!fromPath.trim() || !toUrl.trim()) { setMsg('Both fields are required.'); return; }
    const r = await post({ op: 'create', fromPath, toUrl, code });
    if (r.ok) { setFrom(''); setTo(''); setMsg(''); router.refresh(); } else setMsg(r.error || 'Failed');
  }
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <h2 className="mb-1 font-[family-name:var(--font-display)] text-lg">New redirect</h2>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-[var(--color-stone)]">From (old path)<br /><input value={fromPath} onChange={(e) => setFrom(e.target.value)} placeholder="/old-page" className={`${field} w-56 font-mono`} /></label>
        <label className="text-xs text-[var(--color-stone)]">To (destination)<br /><input value={toUrl} onChange={(e) => setTo(e.target.value)} placeholder="/treatments/laser-hair-removal" className={`${field} w-72 font-mono`} /></label>
        <label className="text-xs text-[var(--color-stone)]">Type<br />
          <select value={code} onChange={(e) => setCode(Number(e.target.value))} className={field}>
            <option value={301}>301 permanent</option>
            <option value={302}>302 temporary</option>
          </select>
        </label>
        <button onClick={create} className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-sm text-[var(--color-porcelain)]">Add</button>
        {msg && <span className="text-sm text-[var(--color-blush)]">{msg}</span>}
      </div>
    </section>
  );
}

function BulkPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  async function run() {
    const r = await post({ op: 'bulk', text });
    setMsg(r.ok ? `${r.created} added/updated · ${r.skipped} skipped` : r.error || 'Failed');
    if (r.ok) { setText(''); router.refresh(); }
  }
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <div className="flex items-center justify-between">
        <div><h2 className="font-[family-name:var(--font-display)] text-lg">Bulk import</h2><p className="text-sm text-[var(--color-stone)]">Paste one redirect per line: <code>/old, /new</code> (comma, tab or → between them).</p></div>
        <button onClick={() => setOpen((v) => !v)} className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-sm hover:border-[var(--color-gold)]">{open ? 'Close' : 'Open'}</button>
      </div>
      {open && (
        <div className="mt-3 space-y-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder={'/old-laser, /treatments/laser-hair-removal\n/promo-2023, /offers'} className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white p-3 font-mono text-xs" />
          <div className="flex items-center gap-2"><button onClick={run} className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-sm text-[var(--color-porcelain)]">Import</button>{msg && <span className="text-sm text-[var(--color-stone)]">{msg}</span>}</div>
        </div>
      )}
    </section>
  );
}

function Row({ r }: { r: RedirectRow }) {
  const router = useRouter();
  const [toUrl, setTo] = useState(r.toUrl);
  const [saved, setSaved] = useState(false);
  const dirty = toUrl !== r.toUrl;
  async function save() { await post({ op: 'update', id: r.id, toUrl }); setSaved(true); setTimeout(() => setSaved(false), 1500); router.refresh(); }
  async function toggle() { await post({ op: 'update', id: r.id, active: !r.active }); router.refresh(); }
  async function remove() { if (confirm(`Delete redirect ${r.fromPath}?`)) { await post({ op: 'remove', id: r.id }); router.refresh(); } }
  return (
    <tr className={`border-t border-[var(--color-line)] ${r.active ? '' : 'opacity-50'}`}>
      <td className="p-3 font-mono text-xs">{r.fromPath}</td>
      <td className="p-3"><input value={toUrl} onChange={(e) => setTo(e.target.value)} className={`${field} w-full font-mono text-xs`} /></td>
      <td className="p-3 text-xs text-[var(--color-stone)]">{r.code}</td>
      <td className="p-3 text-right">
        <span className="flex items-center justify-end gap-3">
          {dirty ? <button onClick={save} className="rounded-full bg-[var(--color-gold)] px-3 py-1 text-xs text-white">Save</button> : saved ? <span className="text-xs text-green-700">Saved ✓</span> : null}
          <button onClick={toggle} className="text-xs text-[var(--color-stone)] hover:underline">{r.active ? 'Disable' : 'Enable'}</button>
          <button onClick={remove} className="text-xs text-[var(--color-blush)] hover:underline">Delete</button>
        </span>
      </td>
    </tr>
  );
}
