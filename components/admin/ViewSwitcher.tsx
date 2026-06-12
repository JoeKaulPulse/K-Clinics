'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { VIEWS, type DashboardView } from '@/lib/dashboard-views';

// PRJ-63 — OWNER/ADMIN segmented control to preview any role's dashboard view.
// Persists the choice (preferredDashboardView) so it follows them across devices,
// then refreshes so the server re-resolves the active view. Render only for roles
// that may switch (canSwitchViews). The per-view content is added in the shell +
// view-bundle items (PRJ-63.3–63.7).
export function ViewSwitcher({ active }: { active: DashboardView }) {
  const router = useRouter();
  const [busy, setBusy] = useState<DashboardView | null>(null);

  async function pick(view: DashboardView) {
    if (view === active || busy) return;
    setBusy(view);
    await fetch('/api/admin/preferences', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view }),
    }).catch(() => {});
    router.refresh();
    setBusy(null);
  }

  return (
    <div role="group" aria-label="Dashboard view" className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-[var(--color-line)] bg-[var(--color-porcelain)] p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {VIEWS.map((v) => {
        const on = v.id === active;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => pick(v.id)}
            aria-pressed={on}
            title={v.blurb}
            className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)] ${
              on ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'text-[var(--color-stone)] hover:text-[var(--color-ink)]'
            } ${busy === v.id ? 'opacity-60' : ''}`}
          >
            {v.label}
          </button>
        );
      })}
    </div>
  );
}
