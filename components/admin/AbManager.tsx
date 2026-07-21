'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type AbVariantRow = { id: string; key: string; label: string; weight: number; headline: string; subhead: string; ctaLabel: string; ctaHref: string; exposures: number; conversions: number };
export type AbTestRow = { id: string; name: string; slug: string; status: string; variants: AbVariantRow[] };

const field = 'rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm';
const rate = (c: number, e: number) => (e > 0 ? (c / e) * 100 : 0);

async function post(payload: object) {
  const res = await fetch('/api/admin/marketing/ab', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return res.json().catch(() => ({ ok: res.ok }));
}

export function AbManager({ rows, canManage }: { rows: AbTestRow[]; canManage: boolean }) {
  const router = useRouter();
  const [name, setName] = useState('');
  async function create() { if (!name.trim()) return; const r = await post({ op: 'createTest', name }); if (r.ok) { setName(''); router.refresh(); } }

  return (
    <div className="space-y-6">
      {canManage && (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
          <h2 className="mb-1 font-[family-name:var(--font-display)] text-lg">New test</h2>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-[var(--color-stone)]">Name<br /><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Valentine’s hero headline" className={`${field} w-72`} /></label>
            <button onClick={create} className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-sm text-[var(--color-porcelain)]">Create (A/B)</button>
          </div>
        </section>
      )}
      {rows.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)] bg-[var(--color-porcelain)] p-6 text-sm text-[var(--color-stone)]">No tests yet.</p>
      ) : rows.map((t) => <TestCard key={t.id} t={t} canManage={canManage} />)}
    </div>
  );
}

function TestCard({ t, canManage }: { t: AbTestRow; canManage: boolean }) {
  const router = useRouter();
  const best = [...t.variants].sort((a, b) => rate(b.conversions, b.exposures) - rate(a.conversions, a.exposures))[0];
  async function act(payload: object) { await post(payload); router.refresh(); }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg">{t.name}</h2>
          <p className="text-xs text-[var(--color-stone)]">code: <span className="font-mono">{t.slug}</span></p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <select value={t.status} onChange={(e) => act({ op: 'updateTest', id: t.id, status: e.target.value })} className={field}>
              <option value="DRAFT">Draft</option><option value="RUNNING">Running</option><option value="STOPPED">Stopped</option>
            </select>
            <button onClick={() => { if (confirm('Delete this test?')) act({ op: 'removeTest', id: t.id }); }} className="text-xs text-[var(--color-blush-deep)] hover:underline">Delete</button>
          </div>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {t.variants.map((v) => {
          const r = rate(v.conversions, v.exposures);
          const isBest = best && v.id === best.id && v.exposures > 0;
          return (
            <div key={v.id} className={`rounded-[var(--radius-md)] border p-3 ${isBest ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/5' : 'border-[var(--color-line)] bg-white'}`}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--color-ink)] text-xs font-semibold text-[var(--color-porcelain)]">{v.key}</span>
                <span className="text-sm font-medium">{v.label}{isBest && <span className="ml-2 text-xs text-[var(--color-gold-deep)]">★ leading</span>}</span>
                <span className="ml-auto text-xs text-[var(--color-stone)]">{v.exposures} views · {v.conversions} clicks · <strong className="text-[var(--color-ink)]">{r.toFixed(1)}%</strong></span>
              </div>
              {canManage && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <input defaultValue={v.headline} onBlur={(e) => e.target.value !== v.headline && act({ op: 'updateVariant', id: v.id, headline: e.target.value })} placeholder="Headline" aria-label="Headline" className={field} />
                  <input defaultValue={v.subhead} onBlur={(e) => e.target.value !== v.subhead && act({ op: 'updateVariant', id: v.id, subhead: e.target.value })} placeholder="Subhead" aria-label="Subhead" className={field} />
                  <input defaultValue={v.ctaLabel} onBlur={(e) => e.target.value !== v.ctaLabel && act({ op: 'updateVariant', id: v.id, ctaLabel: e.target.value })} placeholder="CTA label" aria-label="CTA label" className={field} />
                  <input defaultValue={v.ctaHref} onBlur={(e) => e.target.value !== v.ctaHref && act({ op: 'updateVariant', id: v.id, ctaHref: e.target.value })} placeholder="CTA link (/book)" aria-label="CTA link" className={field} />
                </div>
              )}
              {canManage && t.variants.length > 2 && <button onClick={() => act({ op: 'removeVariant', id: v.id })} className="mt-2 text-xs text-[var(--color-blush-deep)] hover:underline">Remove variant</button>}
            </div>
          );
        })}
      </div>
      {canManage && <button onClick={() => act({ op: 'addVariant', testId: t.id })} className="mt-3 rounded-full border border-[var(--color-line)] px-3 py-1 text-xs hover:border-[var(--color-gold)]">+ Add variant</button>}
    </section>
  );
}
