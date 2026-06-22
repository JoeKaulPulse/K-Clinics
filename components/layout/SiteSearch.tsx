'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Hit = { type: string; title: string; href: string; excerpt: string };

// Header live search: expands an input, shows a quick dropdown of matches, and
// Enter goes to the full /search page. Replaces the old SearchWP live search.
export function SiteSearch({ light }: { light?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
              className="w-full rounded-[var(--radius-sm)] bg-[var(--color-bone)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none"
            />
          </form>
          {hits.length > 0 ? (
            <ul id="site-search-listbox" role="listbox" className="max-h-80 overflow-y-auto">
              {hits.map((h) => (
                <li key={`${h.type}-${h.href}`} role="option" aria-selected={false}>
                  <Link href={h.href} onClick={() => setOpen(false)} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-[var(--color-bone)]">
                    <span className="min-w-0 truncate text-[var(--color-ink)]">{h.title}</span>
                    <span className="shrink-0 text-[0.6rem] uppercase tracking-wide text-[var(--color-stone)]">{h.type}</span>
                  </Link>
                </li>
              ))}
              <li role="option" aria-selected={false}><button onClick={submit} className="w-full px-3 py-2.5 text-left text-xs font-medium text-[var(--color-gold)] hover:bg-[var(--color-bone)]">See all results →</button></li>
            </ul>
          ) : q.trim().length >= 2 ? (
            <p className="px-3 py-4 text-sm text-[var(--color-stone)]">No quick matches — press Enter to search.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
