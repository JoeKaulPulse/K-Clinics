import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

const money = (p: number) => `£${(p / 100).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;

export default async function PerformancePage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'campaigns.view') && !sessionCan(session, 'finance.view')) redirect('/admin');

  const { marketingPerformance } = await import('@/lib/marketing-analytics');
  const { ga4Performance } = await import('@/lib/ga4-data');
  const [perf, ga4] = await Promise.all([marketingPerformance(90), ga4Performance(90)]);
  const maxWeek = Math.max(1, ...perf.weekly.map((w) => w.revenuePence));
  const trendArrow = perf.forecast.trend === 'up' ? '↑' : perf.forecast.trend === 'down' ? '↓' : '→';

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Performance &amp; forecast</h1>
      <p className="mt-1 max-w-3xl text-sm text-[var(--color-stone)]">
        Revenue attributed to marketing over the last 90 days — by source and campaign — with a data-driven forecast.
        Figures use the actual amount charged where available.
      </p>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Revenue · 90 days" value={money(perf.totals.revenuePence)} />
        <Kpi label="Attributed revenue" value={money(perf.totals.attributedRevenuePence)} sub={`${perf.totals.attributedPct}% of total`} />
        <Kpi label="Attributed bookings" value={String(perf.totals.attributedBookings)} />
        <Kpi label="Forecast · next 30 days" value={money(perf.forecast.next30Pence)} sub={`${trendArrow} ${money(perf.forecast.weeklyRunRatePence)}/wk run-rate`} />
      </div>

      {/* Weekly trend */}
      <section className="mt-8 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
        <h2 className="mb-4 font-[family-name:var(--font-display)] text-lg">Weekly revenue</h2>
        <div className="flex h-40 items-end gap-1">
          {perf.weekly.map((w) => (
            <div key={w.weekStart} className="group relative flex-1" title={`${w.weekStart}: ${money(w.revenuePence)}`}>
              <div className="mx-auto w-full rounded-t bg-[var(--color-gold)]/70 transition-colors group-hover:bg-[var(--color-gold)]" style={{ height: `${Math.max(2, (w.revenuePence / maxWeek) * 100)}%` }} />
            </div>
          ))}
        </div>
      </section>

      {/* GA4 traffic by channel — what GA4 actually sees (sessions + conversions),
          complementing the first-party attribution above. Live when Google is
          connected and the GA4 property id is set. */}
      <section className="mt-8 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg">Traffic by channel <span className="text-xs font-normal text-[var(--color-stone)]">· GA4 · 90 days</span></h2>
          {ga4.configured && <span className="text-xs text-[var(--color-stone)] tabular-nums">{ga4.sessions.toLocaleString('en-GB')} sessions · {ga4.conversions.toLocaleString('en-GB')} conversions</span>}
        </div>
        {!ga4.configured ? (
          <p className="text-sm text-[var(--color-stone)]">Connect Google in <Link href="/admin/marketing/connections" className="underline">Connections</Link> and set the GA4 property id (env <code className="rounded bg-[var(--color-bone)] px-1">GA4_PROPERTY_ID</code> — the numeric id, not the G-XXXX tag) to see live sessions, conversions and channel mix here.</p>
        ) : ga4.byChannel.length === 0 ? (
          <p className="text-sm text-[var(--color-stone)]">No GA4 traffic recorded in the last 90 days.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-[var(--color-stone)]"><th className="pb-2">Channel</th><th className="pb-2 text-right">Sessions</th><th className="pb-2 text-right">Conversions</th></tr></thead>
            <tbody>
              {ga4.byChannel.map((c) => (
                <tr key={c.source} className="border-t border-[var(--color-line)]">
                  <td className="py-2">{c.source}</td>
                  <td className="py-2 text-right tabular-nums">{c.sessions.toLocaleString('en-GB')}</td>
                  <td className="py-2 text-right tabular-nums">{c.conversions.toLocaleString('en-GB')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Table title="By source" rows={perf.bySource.map((s) => ({ label: s.label, bookings: s.bookings, revenuePence: s.revenuePence }))} empty="No attributed sources yet." />
        <Table
          title="By campaign"
          rows={perf.byCampaign.map((c) => ({ label: c.label, bookings: c.bookings, revenuePence: c.revenuePence, href: c.id ? `/admin/marketing/campaigns/${c.id}` : undefined }))}
          empty="No campaign-attributed bookings yet."
        />
      </div>

      <p className="mt-6 text-xs text-[var(--color-stone)]">
        Connect ad platforms in <Link href="/admin/marketing/connections" className="underline">Connections</Link> to layer spend &amp; ROAS on top of this attribution.
      </p>
    </AdminShell>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-stone)]">{label}</p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-3xl text-[var(--color-ink)]">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[var(--color-stone)]">{sub}</p>}
    </div>
  );
}

function Table({ title, rows, empty }: { title: string; rows: { label: string; bookings: number; revenuePence: number; href?: string }[]; empty: string }) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--color-stone)]">{empty}</p>
      ) : (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wide text-[var(--color-stone)]"><th className="pb-2">Name</th><th className="pb-2">Bookings</th><th className="pb-2 text-right">Revenue</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-[var(--color-line)]">
                <td className="py-2 capitalize">{r.href ? <Link href={r.href} className="hover:text-[var(--color-gold)]">{r.label}</Link> : r.label}</td>
                <td className="py-2">{r.bookings}</td>
                <td className="py-2 text-right font-medium">{money(r.revenuePence)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
