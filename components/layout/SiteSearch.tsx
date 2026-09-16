'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Hit = { type: string; title: string; href: string; excerpt: string };
// Keyboard-navigable options: every result plus the trailing "See all results"
// row, in the same order they render — so arrow keys and aria-activedescendant
// stay in sync with what's on screen. Mirrors GlobalSearch's `flat` list, but
// SiteSearch has one flat group instead of GlobalSearch's grouped results.
type Option = { type: 'hit'; hit: Hit } | { type: 'seeAll' };

// Header live search: expands an input, shows a quick dropdown of matches, and
// Enter goes to the full /search page. Replaces the old SearchWP live search.
export function SiteSearch({ light }: { light?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const options = useMemo<Option[]>(() => {
    const list: Option[] = hits.map((h) => ({ type: 'hit', hit: h }));
    if (hits.length > 0) list.push({ type: 'seeAll' });
    return list;
  }, [hits]);

  // Keep the active row in range as results change (BLD-1800).
  useEffect(() => { setActive((a) => Math.min(a, Math.max(options.length - 1, 0))); }, [options.length]);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const ctrl = new AbortController();
    const id = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d) => setHits(d.hits ?? []))
        .catch(() => {});
    }, 180);
    return () => { clearTimeout(id); ctrl.abort(); };
  }, [q]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button" aria-label="Search" onClick={() => setOpen((v) => !v)}
        className={`grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-[var(--color-gold)]/15 ${light ? 'text-[var(--color-porcelain)]' : 'text-[var(--color-ink)]'}`}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(22rem,90vw)] overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] shadow-[var(--shadow-lift)]">
          <form onSubmit={submit} className="border-b border-[var(--color-line)] p-2">
            <input
              ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search treatments, articles…"
              role="combobox" aria-label="Search site" aria-expanded={hits.length > 0} aria-autocomplete="list" aria-controls="site-search-listbox"
              aria-activedescendant={options[active] ? `site-search-opt-${active}` : undefined}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, options.length - 1)); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
                else if (e.key === 'Enter') {
                  const opt = options[active];
                  if (opt?.type === 'hit') { e.preventDefault(); setOpen(false); router.push(opt.hit.href); }
                  // opt.type === 'seeAll' (or no options): fall through to the form's submit handler.
                }
              }}
              className="w-full rounded-[var(--radius-sm)] bg-[var(--color-bone)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold-deep)]"
            />
          </form>
          {hits.length > 0 ? (
            <ul id="site-search-listbox" role="listbox" className="max-h-80 overflow-y-auto">
              {hits.map((h, i) => (
                <li key={`${h.type}-${h.href}`} id={`site-search-opt-${i}`} role="option" aria-selected={i === active}>
                  <Link
                    href={h.href}
                    onClick={() => setOpen(false)}
                    onMouseEnter={() => setActive(i)}
                    className={`flex items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-[var(--color-bone)] ${i === active ? 'bg-[var(--color-gold)]/12' : ''}`}
                  >
                    <span className="min-w-0 truncate text-[var(--color-ink)]">{h.title}</span>
                    <span className="shrink-0 text-[0.6rem] uppercase tracking-wide text-[var(--color-stone)]">{h.type}</span>
                  </Link>
                </li>
              ))}
              <li id={`site-search-opt-${hits.length}`} role="option" aria-selected={hits.length === active}>
                <button
                  onClick={submit}
                  onMouseEnter={() => setActive(hits.length)}
                  className={`w-full px-3 py-2.5 text-left text-xs font-medium text-[var(--color-gold-deep)] hover:bg-[var(--color-bone)] ${hits.length === active ? 'bg-[var(--color-gold)]/12' : ''}`}
                >
                  See all results →
                </button>
              </li>
            </ul>
          ) : q.trim().length >= 2 ? (
            <p className="px-3 py-4 text-sm text-[var(--color-stone)]">No quick matches — press Enter to search.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
