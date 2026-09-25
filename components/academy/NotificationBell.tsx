'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// BLD-1620: the trainee portal's notification bell — homework reviewed/needs
// revision/approved. Mirrors components/admin/NotificationBell.tsx at a
// smaller scale (no categories/preferences — students only get homework
// events today).

type Note = { id: string; kind: string; title: string; body: string | null; href: string | null; readAt: string | null; createdAt: string };

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
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (typeof document !== 'undefined' && document.hidden) return;
    const j = await fetch('/api/academy/notifications').then((r) => r.json()).catch(() => null);
    if (j?.ok) { setItems(j.items); setUnread(j.unread || 0); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 25000);
    const onVis = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [load]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, []);

  async function markRead(ids?: string[]) {
    await fetch('/api/academy/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ids ? { ids } : {}) }).catch(() => {});
  }
  async function markAll() {
    await markRead();
    setUnread(0);
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

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-line)] bg-white text-[var(--color-ink)] hover:bg-[var(--color-bone)]"
      >
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
        {unread > 0 && <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[var(--color-gold-deep)] px-1 text-[0.6rem] font-semibold text-[var(--color-porcelain)]">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[22rem] max-w-[92vw] overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white shadow-[var(--shadow-lift)]">
          <div className="flex items-center justify-between border-b border-[var(--color-line)] bg-[var(--color-bone)] px-3 py-2">
            <span className="text-[0.62rem] font-semibold uppercase tracking-wide text-[var(--color-stone)]">Notifications</span>
            {unread > 0 && <button onClick={markAll} className="text-[0.65rem] text-[var(--color-gold-deep)] hover:underline">Mark all read</button>}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-[var(--color-stone)]">You’re all caught up.</p>
            ) : items.map((n) => (
              <button key={n.id} onClick={() => go(n)} className={`flex w-full items-start gap-2 border-b border-[var(--color-line)] px-3 py-2.5 text-left last:border-0 hover:bg-[var(--color-bone)] ${n.kind === 'homework_needs_revision' ? 'border-l-2 border-l-[var(--color-blush-deep)]' : ''} ${n.readAt ? '' : 'bg-[var(--color-gold)]/5'}`}>
                <span className="min-w-0 flex-1">
                  <span className="truncate text-sm font-medium leading-snug text-[var(--color-ink)]">{n.title}</span>
                  {n.body && <span className="mt-0.5 line-clamp-2 block text-xs text-[var(--color-stone)]">{n.body}</span>}
                  <span className="mt-0.5 block text-[0.65rem] text-[var(--color-stone)]">{ago(n.createdAt)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
