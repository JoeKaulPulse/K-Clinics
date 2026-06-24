import Link from 'next/link';
import { ga4FullReport } from '@/lib/ga4-data';

// Compact GA4 traffic snapshot for the management dashboard — visitors, sessions
// and avg visit time over 28 days, plus a mini sessions sparkline and a link to
// the full analytics page. Async server component: render it inside a <Suspense>
// so a slow GA API call streams in without blocking the rest of the dashboard.
// Renders nothing when GA isn't connected, so it never shows an empty card.

const nf = (n: number) => Math.round(n).toLocaleString('en-GB');
const dur = (s: number) => {
  const m = Math.floor(s / 60), sec = Math.round(s % 60);
  return m > 0 ? `${m}m ${String(sec).padStart(2, '0')}s` : `${sec}s`;
};

export async function GaTrafficWidget({ days = 28 }: { days?: number }) {
  const ga = await ga4FullReport(days);
  if (!ga.configured) return null;

  const W = 320, H = 44, P = 2;
  const trend = ga.trend;
  const max = Math.max(1, ...trend.map((p) => p.sessions));
  const n = trend.length;
  const x = (i: number) => (n <= 1 ? P : P + (i * (W - 2 * P)) / (n - 1));
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  const line = trend.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.sessions).toFixed(1)}`).join(' ');
  const area = n > 0 ? `${line} L${x(n - 1).toFixed(1)},${H - P} L${x(0).toFixed(1)},${H - P} Z` : '';

  return (
    <Link href="/admin/marketing/analytics" className="group mt-6 block rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6 transition-colors hover:border-[var(--color-gold)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-[family-name:var(--font-display)] text-xl transition-colors group-hover:text-[var(--color-gold)]">Website traffic <span className="text-xs font-normal text-[var(--color-stone)]">· GA4 · {days} days</span></p>
        <span className="text-sm text-[var(--color-gold)]">Full analytics →</span>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-4">
        <Stat label="Visitors" value={nf(ga.totals.activeUsers)} />
        <Stat label="Sessions" value={nf(ga.totals.sessions)} />
        <Stat label="Page views" value={nf(ga.totals.pageViews)} />
        <Stat label="Avg. visit" value={dur(ga.totals.avgSessionDuration)} />
        {n > 0 && (
          <svg viewBox={`0 0 ${W} ${H}`} className="ml-auto h-11 w-40 max-w-full" preserveAspectRatio="none" role="img" aria-label="Daily sessions trend">
            <path d={area} fill="var(--color-gold)" opacity="0.12" />
            <path d={line} fill="none" stroke="var(--color-gold)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
        )}
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-[family-name:var(--font-display)] text-2xl tabular-nums text-[var(--color-ink)]">{value}</p>
      <p className="text-xs text-[var(--color-stone)]">{label}</p>
    </div>
  );
}
