'use client';
import { useEffect, useState } from 'react';
import type { Ga4Realtime } from '@/lib/ga4-data';

// PRJ-724.5: live GA4 realtime widget — active users on the site right now (last
// 30 min), the top events firing, and the busiest pages. Polls the session-gated
// feed every 30s. Renders nothing until GA is connected AND the realtime call
// succeeds, so it never shows a misleading empty/zero card on the dashboard.

const nf = (n: number) => Math.round(n).toLocaleString('en-GB');
// Friendly labels for the noisiest built-in GA4 events.
const eventLabel = (name: string) =>
  ({ page_view: 'Page views', session_start: 'Sessions started', first_visit: 'First visits', user_engagement: 'Engaged', scroll: 'Scrolls', click: 'Clicks', form_start: 'Form starts', begin_checkout: 'Checkouts started', purchase: 'Purchases' } as Record<string, string>)[name] || name;

export function GaRealtimeWidget() {
  const [rt, setRt] = useState<Ga4Realtime | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch('/api/admin/ga4/realtime', { cache: 'no-store' });
        const j = await res.json();
        if (alive && j?.ok) setRt(j.data as Ga4Realtime);
      } catch { /* keep the last good snapshot on a blip */ }
    };
    load();
    const t = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  // Hide entirely unless GA is connected and the realtime call actually worked.
  if (!rt || !rt.configured || !rt.ok) return null;

  return (
    <div className="mt-6 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-[family-name:var(--font-display)] text-xl">
          On the site now
          <span className="ml-2 text-xs font-normal text-[var(--color-stone)]">· GA4 realtime · last 30 min</span>
        </p>
        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-stone)]">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--color-gold)]" aria-hidden />
          live
        </span>
      </div>

      <div className="mt-4 flex items-end gap-8">
        <div>
          <p className="font-[family-name:var(--font-display)] text-4xl tabular-nums text-[var(--color-ink)]">{nf(rt.activeUsers)}</p>
          <p className="text-xs text-[var(--color-stone)]">Active {rt.activeUsers === 1 ? 'visitor' : 'visitors'}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-6 sm:grid-cols-2">
        {rt.byPage.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-stone)]">Busiest pages</p>
            <ul className="space-y-1.5">
              {rt.byPage.slice(0, 5).map((p) => (
                <li key={p.name} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate text-[var(--color-ink-soft)]" title={p.name}>{p.name}</span>
                  <span className="shrink-0 tabular-nums text-[var(--color-stone)]">{nf(p.users)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {rt.byEvent.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-stone)]">Events firing</p>
            <ul className="space-y-1.5">
              {rt.byEvent.slice(0, 5).map((e) => (
                <li key={e.name} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate text-[var(--color-ink-soft)]" title={e.name}>{eventLabel(e.name)}</span>
                  <span className="shrink-0 tabular-nums text-[var(--color-stone)]">{nf(e.count)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
