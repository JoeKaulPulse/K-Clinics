'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SECTION_DEFS } from '@/lib/sections';

type Row = { id: string; name: string; type: string; updatedAt: string };
const PICKABLE = SECTION_DEFS.filter((d) => !['contactInfo', 'map', 'enquiryForm'].includes(d.type));

export function BlocksList({ blocks }: { blocks: Row[] }) {
  const router = useRouter();
  const [type, setType] = useState(PICKABLE[0]?.type ?? 'cta');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    const res = await fetch('/api/admin/blocks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'create', type, name: name.trim() || undefined }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (data.id) router.push(`/admin/blocks/${data.id}`);
  }

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Reusable blocks</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">Build a section once and reuse it on any page. Edit it here and every page that uses it updates.</p>

      <div className="mt-6 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
        <p className="text-sm font-medium">New reusable block</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input className="w-56 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" value={name} placeholder="Name (e.g. Footer CTA)" onChange={(e) => setName(e.target.value)} />
          <select className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
            {PICKABLE.map((d) => <option key={d.type} value={d.type}>{d.label}</option>)}
          </select>
          <button disabled={busy} onClick={create} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-50">Create</button>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
        {blocks.length === 0 ? <p className="p-6 text-sm text-[var(--color-stone)]">No reusable blocks yet.</p> : blocks.map((b) => (
          <Link key={b.id} href={`/admin/blocks/${b.id}`} className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-3.5 last:border-0 hover:bg-[var(--color-bone)]">
            <span><span className="font-medium">{b.name}</span><span className="ml-2 text-sm text-[var(--color-stone)]">{b.type}</span></span>
            <span className="text-xs text-[var(--color-stone)]">{new Date(b.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
