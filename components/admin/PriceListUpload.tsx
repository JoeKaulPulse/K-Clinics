'use client';

import { useRef, useState } from 'react';

type Section = { header: string; slugGuess: string | null; raw: string; count: number; samples: string[]; treatmentSlug: string; include: boolean };
const field = 'rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-2 py-1.5 text-sm outline-none focus:border-[var(--color-gold)]';

export function PriceListUpload({ treatments, onImported }: { treatments: { slug: string; title: string }[]; onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function upload(file: File) {
    setBusy(true); setMsg(null); setSections([]);
    const fd = new FormData(); fd.append('file', file);
    const res = await fetch('/api/admin/services/import-xlsx', { method: 'POST', body: fd });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !data.ok) { setMsg({ kind: 'err', text: data.error || 'Could not read the file.' }); return; }
    setSections((data.sections as Section[]).map((s) => ({ ...s, treatmentSlug: s.slugGuess || '', include: !!s.slugGuess })));
    if (!data.sections.length) setMsg({ kind: 'err', text: 'No priced sections were found in that spreadsheet.' });
  }

  async function commit() {
    const chosen = sections.filter((s) => s.include && s.treatmentSlug);
    if (!chosen.length) { setMsg({ kind: 'err', text: 'Tick at least one section and pick its treatment.' }); return; }
    if (!confirm(`Import ${chosen.length} section(s)? This replaces the variants on each linked service with the spreadsheet’s prices.`)) return;
    setBusy(true); setMsg(null);
    const res = await fetch('/api/admin/services/import-xlsx', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ op: 'commit', sections: chosen.map((s) => ({ treatmentSlug: s.treatmentSlug, serviceName: s.header, raw: s.raw })) }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !data.ok) { setMsg({ kind: 'err', text: data.error || 'Import failed.' }); return; }
    setMsg({ kind: 'ok', text: `Imported ${data.variants} prices across ${chosen.length} section(s).${data.skipped?.length ? ` Skipped: ${data.skipped.join(', ')}.` : ''}` });
    setSections([]); onImported();
  }

  const set = (i: number, patch: Partial<Section>) => setSections((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <div className="rounded-[var(--radius-md)] border border-[color-mix(in_oklab,var(--color-gold)_40%,var(--color-line))] bg-[var(--color-bone)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">Upload the price list (.xlsx)</p>
          <p className="text-sm text-[var(--color-stone)]">Bulk-import every treatment at once. We’ll show a preview so you can check each section before it’s applied.</p>
        </div>
        <button onClick={() => fileRef.current?.click()} disabled={busy} className="shrink-0 rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Reading…' : 'Choose .xlsx'}</button>
        <input ref={fileRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); if (fileRef.current) fileRef.current.value = ''; }} />
      </div>
      {msg && <p className={`mt-3 text-sm ${msg.kind === 'ok' ? 'text-[var(--color-jade)]' : 'text-[#c0392b]'}`}>{msg.text}</p>}

      {sections.length > 0 && (
        <div className="mt-4">
          <div className="overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
            <div className="grid grid-cols-[auto_1.4fr_1.6fr_auto] items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-bone)] px-3 py-2 text-xs uppercase tracking-wide text-[var(--color-stone)]">
              <span></span><span>Spreadsheet section</span><span>Link to treatment</span><span>Prices</span>
            </div>
            {sections.map((s, i) => (
              <div key={i} className="grid grid-cols-[auto_1.4fr_1.6fr_auto] items-center gap-3 border-b border-[var(--color-line)] px-3 py-2 last:border-0">
                <input type="checkbox" checked={s.include} onChange={(e) => set(i, { include: e.target.checked })} />
                <span><span className="font-medium">{s.header}</span><span className="block text-xs text-[var(--color-stone)]">{s.samples[0]}</span></span>
                <select className={`${field} w-full`} value={s.treatmentSlug} onChange={(e) => set(i, { treatmentSlug: e.target.value, include: !!e.target.value })}>
                  <option value="">— skip —</option>
                  {treatments.map((t) => <option key={t.slug} value={t.slug}>{t.title}</option>)}
                </select>
                <span className="text-right text-sm text-[var(--color-stone)]">{s.count}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button onClick={commit} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Importing…' : `Import ${sections.filter((s) => s.include && s.treatmentSlug).length} section(s)`}</button>
            <span className="text-xs text-[var(--color-stone)]">Replaces each linked service’s variants with the spreadsheet prices.</span>
          </div>
        </div>
      )}
    </div>
  );
}
