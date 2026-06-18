'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// PRJ-63 — facility knowledge base viewer. Groups docs by type with image
// thumbnails / PDF links; reused read-only by the contractor view and with delete
// controls on the admin manage page. No client/clinical data.
export type FacilityDocView = {
  id: string;
  title: string;
  type: string;
  fileUrl: string;
  isPdf: boolean;
  description: string | null;
  tags: string[];
};

const TYPE_LABEL: Record<string, string> = {
  FLOOR_PLAN: 'Floor plans', ELECTRICAL: 'Electrical', PLUMBING: 'Plumbing',
  EQUIPMENT: 'Equipment', INSTRUCTION: 'Instructions', OTHER: 'Other',
};
const TYPE_ORDER = ['FLOOR_PLAN', 'ELECTRICAL', 'PLUMBING', 'EQUIPMENT', 'INSTRUCTION', 'OTHER'];

export function FacilityDocsViewer({ docs, canManage = false }: { docs: FacilityDocView[]; canManage?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function remove(id: string) {
    if (busy) return;
    setBusy(id);
    try {
      const res = await fetch('/api/admin/facility', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      if (res.ok) router.refresh();
    } finally { setBusy(null); }
  }

  if (docs.length === 0) {
    return <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-line)] bg-[var(--color-bone)]/40 px-6 py-8 text-center text-sm text-[var(--color-stone)]">No facility documents yet.</p>;
  }

  const groups = TYPE_ORDER.map((t) => ({ type: t, items: docs.filter((d) => d.type === t) })).filter((g) => g.items.length);

  return (
    <div className="space-y-7">
      {groups.map((g) => (
        <section key={g.type}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-stone)]">{TYPE_LABEL[g.type] ?? g.type}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {g.items.map((d) => (
              <div key={d.id} className="group relative overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
                <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="block">
                  <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-[var(--color-bone)]">
                    {d.isPdf ? (
                      <span className="flex flex-col items-center gap-1 text-[var(--color-stone)]"><span className="text-3xl" aria-hidden>📄</span><span className="text-xs">PDF</span></span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.fileUrl} alt={d.title} className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]" />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-medium">{d.title}</p>
                    {d.description && <p className="mt-0.5 line-clamp-2 text-xs text-[var(--color-stone)]">{d.description}</p>}
                    {d.tags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {d.tags.slice(0, 4).map((t) => <span key={t} className="rounded-full bg-[var(--color-bone)] px-2 py-0.5 text-[0.6rem] text-[var(--color-stone)]">{t}</span>)}
                      </div>
                    )}
                  </div>
                </a>
                {canManage && (
                  <button type="button" onClick={() => remove(d.id)} disabled={busy === d.id}
                    className="absolute right-2 top-2 rounded-full bg-[var(--color-ink)]/80 px-2 py-1 text-[0.65rem] font-medium text-[var(--color-porcelain)] opacity-0 transition-opacity hover:bg-[#b23b3b] group-hover:opacity-100 disabled:opacity-50">
                    {busy === d.id ? '…' : 'Delete'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
