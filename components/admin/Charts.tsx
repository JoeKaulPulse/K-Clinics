import { formatPrice } from '@/lib/treatments';

// Dependency-free SVG charts for the CRM dashboard.

export function RevenueChart({ series }: { series: { label: string; value: number }[] }) {
  const max = Math.max(1, ...series.map((s) => s.value));
  const W = 100; // viewBox units (responsive via width:100%)
  const H = 40;
  const gap = 2;
  const barW = (W - gap * (series.length - 1)) / series.length;
  const total = series.reduce((s, d) => s + d.value, 0);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="eyebrow">Revenue · last 14 days</h2>
        <span className="font-[family-name:var(--font-display)] text-lg tabular-nums">{formatPrice(total)}</span>
      </div>
      {total === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--color-stone)]">No charges in this period yet.</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-28 w-full" role="img" aria-label="Daily revenue bar chart">
          {series.map((d, i) => {
            const h = (d.value / max) * (H - 2);
            return (
              <rect
                key={i}
                x={i * (barW + gap)}
                y={H - h}
                width={barW}
                height={h || 0.4}
                rx={0.6}
                fill="var(--color-gold)"
                opacity={d.value ? 0.9 : 0.25}
              >
                <title>{`${d.label}: ${formatPrice(d.value)}`}</title>
              </rect>
            );
          })}
        </svg>
      )}
      <div className="mt-2 flex justify-between text-[0.65rem] text-[var(--color-stone)]">
        <span>{series[0]?.label}</span>
        <span>{series[series.length - 1]?.label}</span>
      </div>
    </div>
  );
}

export function TopTreatments({ items }: { items: { name: string; count: number }[] }) {
  const max = Math.max(1, ...items.map((t) => t.count));
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
      <h2 className="eyebrow mb-4">Most-booked · 30 days</h2>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--color-stone)]">No bookings yet.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((t) => (
            <li key={t.name}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="truncate pr-3">{t.name}</span>
                <span className="shrink-0 text-[var(--color-stone)]">{t.count}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-sand)]">
                <div className="h-full rounded-full bg-[var(--color-gold)]" style={{ width: `${(t.count / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
