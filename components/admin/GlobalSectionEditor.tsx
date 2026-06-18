'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { sectionDef } from '@/lib/sections';
import { SectionFields } from '@/components/admin/SectionFields';

export function GlobalSectionEditor({ block }: { block: { id: string; name: string; type: string; data: Record<string, unknown> } }) {
  const router = useRouter();
  const def = sectionDef(block.type);
  const [name, setName] = useState(block.name);
  const [data, setData] = useState<Record<string, unknown>>(block.data || {});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function save() {
    setBusy(true); setMsg('');
    const res = await fetch('/api/admin/blocks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'save', id: block.id, name, data }) });
    setBusy(false);
    setMsg(res.ok ? 'Saved — every page using this block is updated.' : 'Could not save.');
    router.refresh();
  }
  async function del() {
    if (!confirm('Delete this reusable block? Pages referencing it will drop it.')) return;
    await fetch('/api/admin/blocks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'delete', id: block.id }) });
    router.push('/admin/blocks');
  }

  return (
    <div className="pb-16">
      <Link href="/admin/blocks" className="text-sm text-[var(--color-gold)] hover:underline">← Reusable blocks</Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <input className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 font-[family-name:var(--font-display)] text-2xl outline-none focus:border-[var(--color-gold)]" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--color-stone)]">{def?.label ?? block.type}</span>
          <button disabled={busy} onClick={save} className="rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
      {msg && <p className="mt-2 text-sm text-[var(--color-jade)]">{msg}</p>}

      <div className="mt-6 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
        {def ? <SectionFields fields={def.fields} data={data} onChange={setData} /> : <p className="text-sm text-[#c0392b]">Unknown section type.</p>}
      </div>
      <button onClick={del} className="mt-6 text-sm text-[var(--color-stone)] hover:text-[#c0392b]">Delete block</button>
    </div>
  );
}
