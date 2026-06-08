'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Hit = { id: string; title: string; sub?: string; href: string };
type Group = { type: string; label: string; results: Hit[] };

const RECENT_KEY = 'kc-admin-recent-search';
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Wrap any matched query term in <mark> so the user sees why a result matched.
function Highlight({ text, q }: { text: string; q: string }) {
  const terms = useMemo(() => Array.from(new Set(q.toLowerCase().split(/\s+/).filter((t) => t.length >= 1))).sort((a, b) => b.length - a.length), [q]);
  if (!terms.length) return <>{text}</>;
  const alt = terms.map(escapeRe).join('|');
  const parts = text.split(new RegExp(`(${alt})`, 'gi'));
  const isMatch = new RegExp(`^(?:${alt})$`, 'i'); // non-global: safe to reuse in the loop
  return (
    <>
      {parts.map((p, i) =>
        isMatch.test(p) ? <mark key={i} className="rounded-[2px] bg-[var(--color-gold)]/25 text-inherit">{p}</mark> : <Fragment key={i}>{p}</Fragment>,
      )}
    </>
  );
}

export function GlobalSearch({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')); } catch { /* ignore */ }
  }, []);

  // Flatten for keyboard navigation across all groups.
  const flat = useMemo(() => groups.flatMap((g) => g.results.map((r) => r.href)), [groups]);
  const showRecent = q.trim().length < 2 && recent.length > 0;

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

  function remember(term: string) {
    const t = term.trim();
    if (t.length < 2) return;
    const next = [t, ...recent.filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(0, 6);
    setRecent(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }
  function clearRecent() { setRecent([]); try { localStorage.removeItem(RECENT_KEY); } catch { /* ignore */ } }
  function go(href: string) { remember(q); setOpen(false); setQ(''); setGroups([]); router.push(href); }

  let idx = -1; // running index for highlight mapping
  return (
    <div ref={boxRef} className="relative mb-4 px-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => { if (groups.length || showRecent) setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, flat.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === 'Enter' && flat[active]) { e.preventDefault(); go(flat[active]); }
          else if (e.key === 'Escape') setOpen(false);
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]"
      />
      {open && showRecent && (
        <div className="absolute z-30 mt-1 w-[calc(100%-1rem)] overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between bg-[var(--color-bone)] px-3 py-1">
            <span className="text-[0.62rem] font-semibold uppercase tracking-wide text-[var(--color-stone)]">Recent searches</span>
            <button onMouseDown={(e) => { e.preventDefault(); clearRecent(); }} className="text-[0.62rem] text-[var(--color-stone-soft)] hover:text-[var(--color-ink)]">Clear</button>
          </div>
          {recent.map((r) => (
            <button key={r} onMouseDown={(e) => { e.preventDefault(); setQ(r); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--color-bone)]">
              <span aria-hidden className="text-[var(--color-stone-soft)]">↺</span>
              <span className="truncate">{r}</span>
            </button>
          ))}
        </div>
      )}
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
                      <span className="block w-full truncate text-sm font-medium"><Highlight text={r.title} q={q} /></span>
                      {r.sub && <span className="block w-full truncate text-xs text-[var(--color-stone-soft)]"><Highlight text={r.sub} q={q} /></span>}
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
