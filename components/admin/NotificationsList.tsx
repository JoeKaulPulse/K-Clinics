'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Note = { id: string; kind: string; category: string | null; priority: string | null; title: string; body: string | null; href: string | null; readAt: string | null; createdAt: string };

const CATEGORIES = ['messages', 'bookings', 'clinical', 'finance', 'reviews', 'inventory', 'team', 'academy', 'marketing', 'system'] as const;
const CATEGORY_LABEL: Record<string, string> = {
  messages: 'Messages', bookings: 'Bookings', clinical: 'Clinical', finance: 'Finance', reviews: 'Reviews',
  inventory: 'Inventory', team: 'Team', academy: 'Academy', marketing: 'Marketing', system: 'System',
};
const PRIORITY_ACCENT: Record<string, string> = { urgent: 'border-l-2 border-l-[#c0392b]', high: 'border-l-2 border-l-amber-400', normal: '', low: '' };
const PRIORITY_DOT: Record<string, string> = { urgent: 'bg-[#c0392b]', high: 'bg-amber-400', normal: 'bg-[var(--color-stone-soft)]', low: 'bg-[var(--color-line)]' };

const ago = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 90) return 'just now';
  if (s < 5400) return `${Math.round(s / 60)}m ago`;
  if (s < 172800) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};

export function NotificationsList() {
  const router = useRouter();
  const [items, setItems] = useState<Note[]>([]);
  const [byCategory, setByCategory] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (cat: string | null) => {
    setLoading(true);
    const q = cat ? `?take=100&category=${cat}` : '?take=100';
    const j = await fetch(`/api/admin/notifications${q}`).then((r) => r.json()).catch(() => null);
    if (j?.ok) { setItems(j.items); setByCategory(j.byCategory || {}); }
    setLoading(false);
  }, []);
  useEffect(() => { load(filter); }, [load, filter]);

  async function markAll() {
    await fetch('/api/admin/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {});
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
    setByCategory({});
  }
  function go(n: Note) {
    if (!n.readAt) {
      fetch('/api/admin/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [n.id] }) }).catch(() => {});
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
    }
    if (n.href) router.push(n.href);
  }

  const tab = (key: string | null, label: string, count?: number) => (
    <button key={label} onClick={() => setFilter(key)} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors ${filter === key ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'border border-[var(--color-line)] text-[var(--color-stone)] hover:bg-[var(--color-bone)]'}`}>
      {label}{count ? <span className="rounded-full bg-amber-400 px-1.5 text-[0.6rem] font-semibold text-amber-950">{count}</span> : null}
    </button>
  );

  return (
    <div className="mt-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tab(null, 'All')}
        {CATEGORIES.map((c) => tab(c, CATEGORY_LABEL[c], byCategory[c]))}
        <button onClick={markAll} className="ml-auto text-sm text-[var(--color-gold-deep)] hover:underline">Mark all read</button>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
        {loading ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--color-stone)]">Loading…</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-[var(--color-stone)]">Nothing here.</p>
        ) : items.map((n) => (
          <button key={n.id} onClick={() => go(n)} className={`flex w-full items-start gap-3 border-b border-[var(--color-line)] px-4 py-3 text-left last:border-0 hover:bg-[var(--color-bone)] ${PRIORITY_ACCENT[n.priority || 'normal'] || ''} ${n.readAt ? '' : 'bg-[var(--color-gold)]/5'}`}>
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[n.priority || 'normal'] || PRIORITY_DOT.normal}`} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-[var(--color-ink)]">{n.title}</span>
              {n.body && <span className="mt-0.5 block text-xs text-[var(--color-stone)]">{n.body}</span>}
              <span className="mt-1 flex items-center gap-2 text-[0.65rem] text-[var(--color-stone)]">
                {n.category && <span className="rounded-full bg-[var(--color-bone)] px-1.5 py-0.5">{CATEGORY_LABEL[n.category] || n.category}</span>}
                {n.priority && n.priority !== 'normal' && <span className="uppercase tracking-wide">{n.priority}</span>}
                <span>{ago(n.createdAt)}</span>
                {!n.readAt && <span className="text-[var(--color-gold-deep)]">• new</span>}
              </span>
            </span>
            {n.href && <span aria-hidden className="mt-1 text-[var(--color-stone)]">→</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
