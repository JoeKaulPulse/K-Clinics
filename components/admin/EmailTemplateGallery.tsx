'use client';

import { useMemo, useState } from 'react';

type Preview = { key: string; name: string; group: string; description: string; html: string };

export function EmailTemplateGallery({ previews }: { previews: Preview[] }) {
  const [active, setActive] = useState(previews[0]?.key ?? '');
  const [width, setWidth] = useState(390);
  const current = previews.find((p) => p.key === active) ?? previews[0];

  const groups = useMemo(() => {
    const m = new Map<string, Preview[]>();
    for (const p of previews) { const a = m.get(p.group) ?? []; a.push(p); m.set(p.group, a); }
    return [...m.entries()];
  }, [previews]);

  if (!current) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <nav className="space-y-4">
        {groups.map(([group, items]) => (
          <div key={group}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">{group}</p>
            <ul className="space-y-0.5">
              {items.map((p) => (
                <li key={p.key}>
                  <button onClick={() => setActive(p.key)} className={`w-full rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm transition-colors ${active === p.key ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'hover:bg-[var(--color-bone)]'}`}>{p.name}</button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-lg">{current.name}</h2>
            <p className="text-sm text-[var(--color-stone)]">{current.description}</p>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <button onClick={() => setWidth(390)} className={`rounded-full px-3 py-1 ${width === 390 ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'border border-[var(--color-line)]'}`}>Mobile</button>
            <button onClick={() => setWidth(680)} className={`rounded-full px-3 py-1 ${width === 680 ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'border border-[var(--color-line)]'}`}>Desktop</button>
          </div>
        </div>
        <div className="flex justify-center overflow-auto py-4">
          <iframe title={current.name} srcDoc={current.html} sandbox="" style={{ width, height: 720 }} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white shadow-[var(--shadow-soft)]" />
        </div>
      </section>
    </div>
  );
}
