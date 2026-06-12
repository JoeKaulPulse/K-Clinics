'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { VIEWS, type DashboardView } from '@/lib/dashboard-views';

// PRJ-63 / BLD-226 — OWNER/ADMIN control to preview any role's dashboard view.
// A compact "Viewing as ▾" dropdown (replacing the old segmented control that
// wrapped to two lines on mobile and felt unanchored on desktop). Persists the
// choice (preferredDashboardView) and refreshes so the server re-resolves the
// active view.
export function ViewSwitcher({ active }: { active: DashboardView }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<DashboardView | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  async function pick(view: DashboardView) {
    setOpen(false);
    if (view === active || busy) return;
    setBusy(view);
    await fetch('/api/admin/preferences', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view }),
    }).catch(() => {});
    router.refresh();
    setBusy(null);
  }

  const activeLabel = VIEWS.find((v) => v.id === active)?.label ?? 'Management';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)] disabled:opacity-60"
        disabled={!!busy}
      >
        <span className="text-[var(--color-stone)]">Viewing as</span>
        <span className="font-semibold">{busy ? VIEWS.find((v) => v.id === busy)?.label : activeLabel}</span>
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden className={`transition-transform ${open ? 'rotate-180' : ''}`}><path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] shadow-[var(--shadow-soft)]">
          {VIEWS.map((v) => {
            const on = v.id === active;
            return (
              <button
                key={v.id}
                type="button"
                role="menuitemradio"
                aria-checked={on}
                onClick={() => pick(v.id)}
                className={`flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--color-bone)] ${on ? 'bg-[var(--color-bone)]' : ''}`}
              >
                <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${on ? 'bg-[var(--color-gold)]' : 'bg-transparent'}`} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-[var(--color-ink)]">{v.label}</span>
                  <span className="block text-xs text-[var(--color-stone)]">{v.blurb}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
