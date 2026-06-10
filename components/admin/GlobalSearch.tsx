'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Hit = { id: string; title: string; sub?: string; href: string };
type Group = { type: string; label: string; results: Hit[] };
type NavPage = { href: string; label: string; group: string; keywords: string };

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

// Rank navigation pages so the closest label match leads: exact > label-prefix >
// label-contains > keyword/group match. Returns top matches as ordinary hits.
function matchPages(pages: NavPage[], q: string): Hit[] {
  const query = q.trim().toLowerCase();
  if (!query) return [];
  const scored = pages
    .map((p) => {
      const label = p.label.toLowerCase();
      let score = 0;
      if (label === query) score = 100;
      else if (label.startsWith(query)) score = 80;
      else if (label.includes(query)) score = 60;
      else if (p.keywords.toLowerCase().includes(query)) score = 40;
      else if (p.group.toLowerCase().includes(query)) score = 20;
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.p.label.length - b.p.label.length)
    .slice(0, 6);
  return scored.map(({ p }) => ({ id: `nav:${p.href}`, title: p.label, sub: p.group, href: p.href }));
}

const SearchIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className} aria-hidden>
    <circle cx="9" cy="9" r="6.25" /><path d="m14 14 3.5 3.5" />
  </svg>
);

export function GlobalSearch({ placeholder, pages = [] }: { placeholder: string; pages?: NavPage[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const [mac, setMac] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')); } catch { /* ignore */ }
    if (typeof navigator !== 'undefined') setMac(/mac/i.test(navigator.platform));
  }, []);

  // Navigation matches are computed client-side (instant) and lead the results
  // so the sidebar itself is searchable; entity groups come from the server.
  const navHits = useMemo(() => matchPages(pages, q), [pages, q]);
  const allGroups = useMemo<Group[]>(
    () => (navHits.length ? [{ type: 'nav', label: 'Go to', results: navHits }, ...groups] : groups),
    [navHits, groups],
  );

  // Flatten for keyboard navigation across all groups (nav first, then entities).
  const flat = useMemo(() => allGroups.flatMap((g) => g.results.map((r) => r.href)), [allGroups]);
  const showRecent = q.trim().length < 1 && recent.length > 0;

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

  // Keep the active row in range as results change.
  useEffect(() => { setActive((a) => Math.min(a, Math.max(flat.length - 1, 0))); }, [flat.length]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Global ⌘K / Ctrl+K focuses search from anywhere in the admin.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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

  const hasResults = allGroups.length > 0;
  const showPanel = open && (showRecent || q.trim().length >= 1);
  let idx = -1; // running index for highlight mapping

  return (
    <div ref={boxRef} className="relative">
      <div className="group relative flex items-center">
        <span className="pointer-events-none absolute left-3 text-[var(--color-stone)] transition-colors group-focus-within:text-[var(--color-gold-deep)]">
          <SearchIcon />
        </span>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="kc-search-list"
          aria-activedescendant={showPanel && flat[active] ? `kc-opt-${active}` : undefined}
          autoComplete="off"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, flat.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === 'Enter' && flat[active]) { e.preventDefault(); go(flat[active]); }
            else if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white pl-9 pr-16 text-sm text-[var(--color-ink)] outline-none transition-shadow placeholder:text-[var(--color-stone-soft)] focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-gold)_22%,transparent)]"
        />
        <span className="absolute right-2.5 flex items-center gap-1">
          {loading && (
            <svg className="animate-spin text-[var(--color-stone-soft)]" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          )}
          {q ? (
            <button
              type="button"
              onClick={() => { setQ(''); setGroups([]); inputRef.current?.focus(); }}
              aria-label="Clear search"
              className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--color-stone)] transition-colors hover:bg-[var(--color-bone)] hover:text-[var(--color-ink)]"
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="m3 3 8 8M11 3l-8 8" /></svg>
            </button>
          ) : (
            <kbd className="pointer-events-none hidden select-none items-center rounded-[var(--radius-xs)] border border-[var(--color-line)] bg-[var(--color-bone)] px-1.5 py-0.5 text-[0.6rem] font-medium text-[var(--color-stone)] sm:inline-flex">
              {mac ? '⌘' : 'Ctrl'} K
            </kbd>
          )}
        </span>
      </div>

      {showPanel && (
        <div
          id="kc-search-list"
          role="listbox"
          className="absolute z-40 mt-2 max-h-[min(70vh,30rem)] w-full overflow-auto overscroll-contain rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white shadow-[var(--shadow-lift)]"
        >
          {showRecent ? (
            <>
              <div className="flex items-center justify-between bg-[var(--color-bone)]/70 px-3 py-1.5">
                <span className="text-[0.62rem] font-semibold uppercase tracking-wide text-[var(--color-stone)]">Recent searches</span>
                <button onMouseDown={(e) => { e.preventDefault(); clearRecent(); }} className="text-[0.62rem] text-[var(--color-stone-soft)] transition-colors hover:text-[var(--color-ink)]">Clear</button>
              </div>
              {recent.map((r) => (
                <button key={r} onMouseDown={(e) => { e.preventDefault(); setQ(r); }} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--color-bone)]">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="shrink-0 text-[var(--color-stone-soft)]" aria-hidden><path d="M8 4v4l2.5 1.5" /><path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9M2.5 3v2h2" /></svg>
                  <span className="truncate">{r}</span>
                </button>
              ))}
            </>
          ) : !hasResults ? (
            <div className="px-3 py-6 text-center">
              <p className="text-sm text-[var(--color-stone)]">{loading ? 'Searching…' : `No matches for "${q.trim()}"`}</p>
              {!loading && <p className="mt-1 text-xs text-[var(--color-stone-soft)]">Try a name, email, code, page or reference (e.g. BLD-12).</p>}
            </div>
          ) : (
            allGroups.map((g) => (
              <div key={g.type} className="py-1">
                <p className="sticky top-0 z-10 bg-[var(--color-bone)]/85 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-wide text-[var(--color-stone)] backdrop-blur">{g.label}</p>
                {g.results.map((r) => {
                  idx++; const i = idx;
                  const isNav = g.type === 'nav';
                  return (
                    <button
                      key={r.id}
                      id={`kc-opt-${i}`}
                      role="option"
                      aria-selected={i === active}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(r.href)}
                      className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${i === active ? 'bg-[var(--color-gold)]/12' : ''}`}
                    >
                      {isNav && <SearchIcon className="shrink-0 text-[var(--color-stone-soft)]" />}
                      <span className="min-w-0 flex-1">
                        <span className="block w-full truncate text-sm font-medium text-[var(--color-ink)]"><Highlight text={r.title} q={q} /></span>
                        {r.sub && <span className="block w-full truncate text-xs text-[var(--color-stone-soft)]"><Highlight text={r.sub} q={q} /></span>}
                      </span>
                      {i === active && <span aria-hidden className="shrink-0 text-xs text-[var(--color-stone-soft)]">↵</span>}
                    </button>
                  );
                })}
              </div>
            ))
          )}
          {!showRecent && hasResults && (
            <div className="sticky bottom-0 flex items-center gap-3 border-t border-[var(--color-line)] bg-white/95 px-3 py-1.5 text-[0.62rem] text-[var(--color-stone-soft)] backdrop-blur">
              <span><kbd className="font-sans">↑</kbd> <kbd className="font-sans">↓</kbd> navigate</span>
              <span><kbd className="font-sans">↵</kbd> open</span>
              <span><kbd className="font-sans">esc</kbd> close</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
