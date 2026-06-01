'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Hit = { id: string; title: string; sub?: string; href: string };
type Group = { type: string; label: string; results: Hit[] };

export function GlobalSearch({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  // Flatten for keyboard navigation across all groups.
  const flat = useMemo(() => groups.flatMap((g) => g.results.map((r) => r.href)), [groups]);

  useEffect(() => {
    if (q.trim().length < 2) { setGroups([]); setLoading(false); return; }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/admin/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((j) => { if (j?.ok) { setGroups(j.groups); setOpen(true); setActive(0); } })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 200);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function go(href: string) { setOpen(false); setQ(''); setGroups([]); router.push(href); }

  let idx = -1; // running index for highlight mapping
  return (
    <div ref={boxRef} className="relative mb-4 px-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => groups.length && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, flat.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === 'Enter' && flat[active]) { e.preventDefault(); go(flat[active]); }
          else if (e.key === 'Escape') setOpen(false);
        }}
        placeholder={placeholder}
        className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]"
      />
      {open && (q.trim().length >= 2) && (
        <div className="absolute z-30 mt-1 max-h-[70vh] w-[calc(100%-1rem)] overflow-auto rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white shadow-[var(--shadow-soft)]">
          {groups.length === 0 ? (
            <p className="px-3 py-3 text-sm text-[var(--color-stone-soft)]">{loading ? 'Searching…' : 'No matches found.'}</p>
          ) : (
            groups.map((g) => (
              <div key={g.type}>
                <p className="sticky top-0 bg-[var(--color-bone)] px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-wide text-[var(--color-stone)]">{g.label}</p>
                {g.results.map((r) => {
                  idx++; const i = idx;
                  return (
                    <button
                      key={r.id}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(r.href)}
                      className={`flex w-full flex-col items-start px-3 py-2 text-left ${i === active ? 'bg-[var(--color-bone)]' : ''}`}
                    >
                      <span className="block w-full truncate text-sm font-medium">{r.title}</span>
                      {r.sub && <span className="block w-full truncate text-xs text-[var(--color-stone-soft)]">{r.sub}</span>}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
