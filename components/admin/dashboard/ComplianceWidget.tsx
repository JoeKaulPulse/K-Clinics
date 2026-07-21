import Link from 'next/link';
import { renewalsSummary } from '@/lib/renewals';
import { CLICKABLE_CARD } from './Widgets';

// Management-dashboard alert for compliance & renewals (BLD-587). Renders only
// when something needs attention (expired / due soon), so it stays quiet when
// everything is in date. Full list + management at /admin/compliance.
export async function ComplianceWidget() {
  const s = await renewalsSummary();
  if (s.needAttention === 0) return null;

  const fmt = (d: number) => (d < 0 ? `expired ${Math.abs(d)}d ago` : d === 0 ? 'due today' : `in ${d}d`);
  return (
    <Link href="/admin/compliance" className={`mt-6 block rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6 ${CLICKABLE_CARD}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <div className="min-w-[12rem] flex-1">
          <p className="font-[family-name:var(--font-display)] text-xl">Compliance &amp; renewals</p>
          <p className="mt-1 text-sm text-[var(--color-stone)]">
            {s.next.map((n) => n.name).slice(0, 3).join(', ')}{s.next.length > 3 ? '…' : ''}
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div>
            <p className={`font-[family-name:var(--font-display)] text-2xl ${s.expired > 0 ? 'text-red-700' : 'text-[var(--color-ink)]'}`}>{s.expired}</p>
            <p className="text-xs text-[var(--color-stone)]">Expired</p>
          </div>
          <div>
            <p className={`font-[family-name:var(--font-display)] text-2xl ${s.due > 0 ? 'text-[var(--color-gold-deep)]' : 'text-[var(--color-ink)]'}`}>{s.due}</p>
            <p className="text-xs text-[var(--color-stone)]">Due ≤30d</p>
          </div>
          <div>
            <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--color-ink)]">{s.soon}</p>
            <p className="text-xs text-[var(--color-stone)]">Due ≤90d</p>
          </div>
        </div>
        <span className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm text-[var(--color-ink)]">Open →</span>
      </div>
      {s.next[0] && (
        <p className="mt-3 text-xs text-[var(--color-stone)]">Soonest: <strong className="text-[var(--color-ink)]">{s.next[0].name}</strong> ({fmt(s.next[0].days)})</p>
      )}
    </Link>
  );
}
