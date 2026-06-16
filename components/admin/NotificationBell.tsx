'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Note = { id: string; kind: string; category: string | null; priority: string | null; title: string; body: string | null; href: string | null; readAt: string | null; createdAt: string };

const CATEGORY_LABEL: Record<string, string> = {
  messages: 'Messages', bookings: 'Bookings', clinical: 'Clinical', finance: 'Finance', reviews: 'Reviews',
  inventory: 'Inventory', team: 'Team', academy: 'Academy', marketing: 'Marketing', system: 'System',
};
// Left accent + dot per priority so urgent/high stand out without colour-only meaning.
const PRIORITY_ACCENT: Record<string, string> = { urgent: 'border-l-2 border-l-[#c0392b]', high: 'border-l-2 border-l-amber-400', normal: '', low: '' };
const PRIORITY_DOT: Record<string, string> = { urgent: 'bg-[#c0392b]', high: 'bg-amber-400', normal: 'bg-[var(--color-stone-soft)]', low: 'bg-[var(--color-line)]' };

const ago = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 90) return 'just now';
  if (s < 5400) return `${Math.round(s / 60)}m ago`;
  if (s < 172800) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};

export function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const [byCategory, setByCategory] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async (category?: string | null) => {
    if (typeof document !== 'undefined' && document.hidden) return;
    const q = category ? `?category=${category}` : '';
    const j = await fetch(`/api/admin/notifications${q}`).then((r) => r.json()).catch(() => null);
    if (j?.ok) { setItems(j.items); setUnread(j.unread || 0); setByCategory(j.byCategory || {}); }
  }, []);

  useEffect(() => {
    load(filter);
    // Faster than before (was 45s) so notifications feel live without a socket.
    const t = setInterval(() => load(filter), 25000);
    const onVis = () => { if (!document.hidden) load(filter); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [load, filter]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function markRead(ids?: string[]) {
    await fetch('/api/admin/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ids ? { ids } : {}) }).catch(() => {});
  }
  async function markAll() {
    await markRead();
    setUnread(0); setByCategory({});
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
  }
  function go(n: Note) {
    setOpen(false);
    if (!n.readAt) {
      markRead([n.id]);
      setUnread((u) => Math.max(0, u - 1));
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
    }
    if (n.href) router.push(n.href);
  }
  function pickFilter(cat: string | null) { setFilter(cat); load(cat); }

  const chips = Object.entries(byCategory).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]);

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-line)] bg-white text-[var(--color-ink)] hover:bg-[var(--color-bone)]"
      >
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
        {unread > 0 && <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-amber-400 px-1 text-[0.6rem] font-semibold text-amber-950">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[22rem] max-w-[92vw] overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white shadow-[var(--shadow-lift)]">
          <div className="flex items-center justify-between border-b border-[var(--color-line)] bg-[var(--color-bone)] px-3 py-2">
            <span className="text-[0.62rem] font-semibold uppercase tracking-wide text-[var(--color-stone)]">Notifications</span>
            <div className="flex items-center gap-2">
              {unread > 0 && <button onClick={markAll} className="text-[0.65rem] text-[var(--color-gold)] hover:underline">Mark all read</button>}
              <Link href="/admin/settings/notifications" onClick={() => setOpen(false)} aria-label="Notification settings" className="text-[var(--color-stone)] hover:text-[var(--color-ink)]">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
              </Link>
            </div>
          </div>

          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1 border-b border-[var(--color-line)] px-2 py-1.5">
              <button onClick={() => pickFilter(null)} className={`rounded-full px-2 py-0.5 text-[0.6rem] ${!filter ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'border border-[var(--color-line)] text-[var(--color-stone)]'}`}>All</button>
              {chips.map(([cat, c]) => (
                <button key={cat} onClick={() => pickFilter(cat)} className={`rounded-full px-2 py-0.5 text-[0.6rem] ${filter === cat ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'border border-[var(--color-line)] text-[var(--color-stone)]'}`}>
                  {CATEGORY_LABEL[cat] || cat} {c}
                </button>
              ))}
            </div>
          )}

          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-[var(--color-stone-soft)]">You’re all caught up.</p>
            ) : items.map((n) => (
              <button key={n.id} onClick={() => go(n)} className={`flex w-full items-start gap-2 border-b border-[var(--color-line)] px-3 py-2.5 text-left last:border-0 hover:bg-[var(--color-bone)] ${PRIORITY_ACCENT[n.priority || 'normal'] || ''} ${n.readAt ? '' : 'bg-[var(--color-gold)]/5'}`}>
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[n.priority || 'normal'] || PRIORITY_DOT.normal}`} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium leading-snug text-[var(--color-ink)]">{n.title}</span>
                  </span>
                  {n.body && <span className="mt-0.5 line-clamp-2 block text-xs text-[var(--color-stone)]">{n.body}</span>}
                  <span className="mt-0.5 flex items-center gap-1.5 text-[0.65rem] text-[var(--color-stone-soft)]">
                    {n.category && <span className="rounded-full bg-[var(--color-bone)] px-1.5 py-0.5">{CATEGORY_LABEL[n.category] || n.category}</span>}
                    {ago(n.createdAt)}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <Link href="/admin/notifications" onClick={() => setOpen(false)} className="block border-t border-[var(--color-line)] px-3 py-2 text-center text-xs text-[var(--color-gold)] hover:bg-[var(--color-bone)]">See all notifications →</Link>
        </div>
      )}
    </div>
  );
}
