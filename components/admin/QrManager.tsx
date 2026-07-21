'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type QrRow = {
  id: string;
  code: string;
  label: string;
  destination: string;
  active: boolean;
  notes: string | null;
  scanCount: number;
  last30: number;
  lastAt: string | null;
  url: string;
  svg: string;
};

const field = 'rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm';

async function post(payload: object) {
  const res = await fetch('/api/admin/qr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return res.json().catch(() => ({ ok: res.ok }));
}

function downloadSvg(row: QrRow) {
  const blob = new Blob([row.svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `qr-${row.code}.svg`; a.click();
  URL.revokeObjectURL(url);
}

function downloadPng(row: QrRow, size = 1024) {
  const blob = new Blob([row.svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size); ctx.drawImage(img, 0, 0, size, size); }
    URL.revokeObjectURL(url);
    canvas.toBlob((png) => {
      if (!png) return;
      const purl = URL.createObjectURL(png);
      const a = document.createElement('a');
      a.href = purl; a.download = `qr-${row.code}.png`; a.click();
      URL.revokeObjectURL(purl);
    }, 'image/png');
  };
  img.src = url;
}

export function QrManager({ rows }: { rows: QrRow[] }) {
  return (
    <div className="space-y-8">
      <CreatePanel />
      {rows.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)] bg-[var(--color-porcelain)] p-6 text-sm text-[var(--color-stone)]">No QR codes yet — create one above. The QR image you download encodes a permanent link; you can change where it points whenever you like.</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {rows.map((r) => <QrCard key={r.id} row={r} />)}
        </div>
      )}
    </div>
  );
}

function CreatePanel() {
  const router = useRouter();
  const [label, setLabel] = useState('');
  const [destination, setDestination] = useState('');
  const [code, setCode] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function create() {
    if (!label.trim() || !destination.trim()) { setMsg('Name and destination are required.'); return; }
    setBusy(true); setMsg('');
    const r = await post({ op: 'create', label, destination, code: code || undefined, notes: notes || undefined });
    setBusy(false);
    if (r.ok) { setLabel(''); setDestination(''); setCode(''); setNotes(''); router.refresh(); }
    else setMsg(r.error || 'Failed');
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <h2 className="mb-1 font-[family-name:var(--font-display)] text-lg">New QR code</h2>
      <p className="mb-3 text-sm text-[var(--color-stone)]">Give it a name you’ll recognise and the page it should open. Leave the custom code blank for an auto-generated one.</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-[var(--color-stone)]">Name (internal)<br /><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Reception poster" className={`${field} w-52`} /></label>
        <label className="text-xs text-[var(--color-stone)]">Destination URL<br /><input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="https://kclinics.co.uk/offers" className={`${field} w-72`} /></label>
        <label className="text-xs text-[var(--color-stone)]">Custom code <span className="text-[var(--color-stone)]">(optional)</span><br /><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="auto" className={`${field} w-32`} /></label>
        <button onClick={create} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-sm text-[var(--color-porcelain)] disabled:opacity-60">{busy ? 'Creating…' : 'Create'}</button>
        {msg && <span className="text-sm text-[var(--color-blush-deep)]">{msg}</span>}
      </div>
      <label className="mt-2 block text-xs text-[var(--color-stone)]">Notes <span className="text-[var(--color-stone)]">(optional)</span><br /><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Where this code is displayed / campaign" className={`${field} w-full max-w-xl`} /></label>
    </section>
  );
}

function QrCard({ row }: { row: QrRow }) {
  const router = useRouter();
  const [destination, setDestination] = useState(row.destination);
  const [label, setLabel] = useState(row.label);
  const [code, setCode] = useState(row.code);
  const [saved, setSaved] = useState(false);
  const [editCode, setEditCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const dirty = destination !== row.destination || label !== row.label || code !== row.code;

  async function save() {
    setBusy(true);
    const r = await post({ op: 'update', id: row.id, label, destination, ...(code !== row.code ? { code } : {}) });
    setBusy(false);
    if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 1500); setEditCode(false); router.refresh(); }
    else alert(r.error || 'Save failed');
  }
  async function toggle() { await post({ op: 'update', id: row.id, active: !row.active }); router.refresh(); }
  async function remove() { if (confirm(`Delete “${row.label}”? Any printed copies of this code will stop working.`)) { await post({ op: 'remove', id: row.id }); router.refresh(); } }
  function copy() { navigator.clipboard?.writeText(row.url); setCopied(true); setTimeout(() => setCopied(false), 1200); }

  return (
    <section className={`rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5 ${row.active ? '' : 'opacity-70'}`}>
      <div className="flex gap-4">
        <div className="shrink-0">
          {/* eslint-disable-next-line react/no-danger */}
          <div className="h-28 w-28 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white p-1.5 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: row.svg }} />
          <div className="mt-2 flex gap-1">
            <button onClick={() => downloadPng(row)} className="rounded-full border border-[var(--color-line)] px-2 py-1 text-[0.65rem] hover:border-[var(--color-gold)]">PNG</button>
            <button onClick={() => downloadSvg(row)} className="rounded-full border border-[var(--color-line)] px-2 py-1 text-[0.65rem] hover:border-[var(--color-gold)]">SVG</button>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <input value={label} onChange={(e) => setLabel(e.target.value)} className="w-full border-0 bg-transparent p-0 font-[family-name:var(--font-display)] text-lg outline-none focus:underline" />
          <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--color-stone)]">
            {editCode ? (
              <input value={code} onChange={(e) => setCode(e.target.value)} className={`${field} w-32 py-0.5`} />
            ) : (
              <button onClick={copy} title="Copy link" className="font-mono hover:text-[var(--color-gold-deep)]">/qr/{row.code}{copied ? ' ✓' : ''}</button>
            )}
            <button onClick={() => setEditCode((v) => !v)} className="text-[var(--color-stone)] hover:underline">{editCode ? 'keep' : 'change code'}</button>
          </div>
          {editCode && <p className="mt-1 text-[0.65rem] text-[var(--color-blush-deep)]">Changing the code changes the printed URL — only do this before printing.</p>}

          <label className="mt-3 block text-xs text-[var(--color-stone)]">Redirects to
            <input value={destination} onChange={(e) => setDestination(e.target.value)} className={`${field} mt-0.5 w-full`} />
          </label>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-stone)]">
            <span><strong className="text-[var(--color-ink)]">{row.scanCount}</strong> scans</span>
            <span><strong className="text-[var(--color-ink)]">{row.last30}</strong> in 30 days</span>
            <span>{row.lastAt ? `last ${new Date(row.lastAt).toLocaleDateString('en-GB')}` : 'no scans yet'}</span>
          </div>

          <div className="mt-3 flex items-center gap-3">
            {dirty ? (
              <button onClick={save} disabled={busy} className="rounded-full bg-[var(--color-gold-deep)] px-4 py-1 text-xs text-white disabled:opacity-60">{busy ? 'Saving…' : 'Save'}</button>
            ) : saved ? <span className="text-xs text-green-700">Saved ✓</span> : null}
            <button onClick={toggle} className="text-xs text-[var(--color-stone)] hover:underline">{row.active ? 'Disable' : 'Enable'}</button>
            <button onClick={remove} className="text-xs text-[var(--color-blush-deep)] hover:underline">Delete</button>
          </div>
        </div>
      </div>
    </section>
  );
}
