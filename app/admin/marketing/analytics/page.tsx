import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { getLocale } from '@/lib/locale';
import { ga4FullReport, type Ga4Row } from '@/lib/ga4-data';

export const dynamic = 'force-dynamic';

const RANGES = [7, 28, 90] as const;
const nf = (n: number) => Math.round(n).toLocaleString('en-GB');
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const dur = (s: number) => {
  const m = Math.floor(s / 60), sec = Math.round(s % 60);
  return m > 0 ? `${m}m ${String(sec).padStart(2, '0')}s` : `${sec}s`;
};

export default async function GaAnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'campaigns.view') && !sessionCan(session, 'finance.view')) redirect('/admin');

  const { days: daysParam } = await searchParams;
  const days = RANGES.includes(Number(daysParam) as typeof RANGES[number]) ? Number(daysParam) : 28;
  const ga = await ga4FullReport(days);

  const can = await sessionPermissions();
  const locale = await getLocale();

  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">Website analytics</h1>
          <p className="mt-1 max-w-3xl text-sm text-[var(--color-stone)]">
            Live traffic from Google Analytics 4 — visits, engagement, top pages, channels, devices and where visitors land.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-[var(--color-line)] bg-[var(--color-porcelain)] p-1 text-xs">
          {RANGES.map((r) => (
            <Link key={r} href={`/admin/marketing/analytics?days=${r}`}
              className={`rounded-full px-3 py-1.5 transition-colors ${r === days ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'text-[var(--color-stone)] hover:bg-[var(--color-bone)]'}`}>
              {r} days
            </Link>
          ))}
        </div>
      </div>

      {!ga.configured ? (
        <div className="mt-8 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-8 text-center">
          <p className="font-[family-name:var(--font-display)] text-lg">Google Analytics isn’t connected yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-stone)]">
            {ga.error ?? 'Connect Google and set the GA4 property id to see full website analytics here.'}
          </p>
          <p className="mx-auto mt-3 max-w-md text-xs text-[var(--color-stone)]">
            Connect Google in <Link href="/admin/marketing/connections" className="underline">Connections</Link>; set the numeric id in
            <code className="mx-1 rounded bg-[var(--color-bone)] px-1">GA4_PROPERTY_ID</code> (GA4 → Admin → Property settings — not the G-XXXX tag).
          </p>
        </div>
      ) : !ga.ok ? (
        <div className="mt-8 rounded-[var(--radius-lg)] border border-[var(--color-blush)]/50 bg-[var(--color-blush)]/10 p-6">
          <p className="font-[family-name:var(--font-display)] text-lg text-[var(--color-ink)]">Google Analytics returned an error</p>
          <p className="mt-2 text-sm text-[var(--color-ink)]">Google is connected, but the Data API rejected the request — so the figures below would be wrong. The numbers are hidden until this is fixed.</p>
          <p className="mt-3 rounded-[var(--radius-sm)] bg-[var(--color-bone)] px-3 py-2 font-mono text-xs text-[var(--color-ink)]">{ga.error}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-[var(--color-stone)]">
            <li><strong>404 / “not found”:</strong> the <code className="rounded bg-[var(--color-bone)] px-1">GA4_PROPERTY_ID</code> is wrong — use the numeric Property ID (GA4 → Admin → Property settings), not the G-XXXX tag.</li>
            <li><strong>403 / “permission”:</strong> the connected Google account isn’t a user on this GA4 property — add it (with at least Viewer) in GA4 → Admin → Property access management.</li>
            <li><strong>403 / “Analytics Data API has not been used…”:</strong> enable the <em>Google Analytics Data API</em> in the Google Cloud project behind your OAuth client.</li>
            <li><strong>401 / token:</strong> reconnect Google in <Link href="/admin/marketing/connections" className="underline">Connections</Link>.</li>
          </ul>
        </div>
      ) : (
        <>
          {ga.totals.sessions === 0 && ga.trend.length === 0 && (
            <div className="mt-7 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bone)] px-4 py-3 text-sm text-[var(--color-stone)]">
              GA4 is connected and responding, but reports <strong>no traffic</strong> in this period. If you expect visits, the on-site tracking tag (G-XXXX) may not be firing — check it’s set in <Link href="/admin/seo" className="underline">Admin → SEO</Link> and that visitors accept the analytics cookie — or this may be a different property than the one the site reports to.
            </div>
          )}
          {/* Overview KPIs */}
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <Kpi label="Visitors" value={nf(ga.totals.activeUsers)} sub={`${nf(ga.totals.newUsers)} new`} />
            <Kpi label="Sessions" value={nf(ga.totals.sessions)} sub={`${ga.totals.viewsPerSession.toFixed(1)} pages/visit`} />
            <Kpi label="Page views" value={nf(ga.totals.pageViews)} />
            <Kpi label="Avg. visit time" value={dur(ga.totals.avgSessionDuration)} sub={`${pct(ga.totals.engagementRate)} engaged`} />
            <Kpi label="Conversions" value={nf(ga.totals.conversions)} sub={`${pct(ga.totals.bounceRate)} bounce`} />
          </div>

          {/* Daily trend */}
          <TrendChart trend={ga.trend} days={days} />

          {/* Top pages + channels */}
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
              <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">Top pages</h2>
              {ga.topPages.length === 0 ? <Empty /> : (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs uppercase tracking-wide text-[var(--color-stone)]"><th className="pb-2">Page</th><th className="pb-2 text-right">Views</th><th className="pb-2 text-right">Avg. time</th></tr></thead>
                  <tbody>
                    {ga.topPages.map((p) => (
                      <tr key={p.path} className="border-t border-[var(--color-line)]">
                        <td className="max-w-0 truncate py-2" title={p.path}>{p.path}</td>
                        <td className="py-2 text-right tabular-nums">{nf(p.views)}</td>
                        <td className="py-2 text-right tabular-nums text-[var(--color-stone)]">{dur(p.avgEngagement)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
              <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">Traffic by channel</h2>
              {ga.byChannel.length === 0 ? <Empty /> : (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs uppercase tracking-wide text-[var(--color-stone)]"><th className="pb-2">Channel</th><th className="pb-2 text-right">Sessions</th><th className="pb-2 text-right">Conversions</th></tr></thead>
                  <tbody>
                    {ga.byChannel.map((c) => (
                      <tr key={c.source} className="border-t border-[var(--color-line)]">
                        <td className="py-2">{c.source}</td>
                        <td className="py-2 text-right tabular-nums">{nf(c.sessions)}</td>
                        <td className="py-2 text-right tabular-nums">{nf(c.conversions)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>

          {/* Devices + countries */}
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <BarList title="Devices" rows={ga.byDevice} capitalize />
            <BarList title="Top countries" rows={ga.byCountry} />
          </div>

          {/* Landing pages (where the journey starts) */}
          <section className="mt-6 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
            <h2 className="mb-1 font-[family-name:var(--font-display)] text-lg">Where visitors land</h2>
            <p className="mb-3 text-xs text-[var(--color-stone)]">The first page of each visit — the start of the journey — and how many of those visits converted.</p>
            {ga.landingPages.length === 0 ? <Empty /> : (
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-wide text-[var(--color-stone)]"><th className="pb-2">Landing page</th><th className="pb-2 text-right">Sessions</th><th className="pb-2 text-right">Conversions</th><th className="pb-2 text-right">Rate</th></tr></thead>
                <tbody>
                  {ga.landingPages.map((p) => (
                    <tr key={p.path} className="border-t border-[var(--color-line)]">
                      <td className="max-w-0 truncate py-2" title={p.path}>{p.path}</td>
                      <td className="py-2 text-right tabular-nums">{nf(p.sessions)}</td>
                      <td className="py-2 text-right tabular-nums">{nf(p.conversions)}</td>
                      <td className="py-2 text-right tabular-nums text-[var(--color-stone)]">{p.sessions ? pct(p.conversions / p.sessions) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <p className="mt-6 text-xs text-[var(--color-stone)]">
            Source: Google Analytics 4 (last {days} days). For revenue attribution by source &amp; campaign, see <Link href="/admin/marketing/performance" className="underline">Performance &amp; forecast</Link>.
          </p>
        </>
      )}
    </AdminShell>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-stone)]">{label}</p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-3xl tabular-nums text-[var(--color-ink)]">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[var(--color-stone)]">{sub}</p>}
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-[var(--color-stone)]">No data recorded in this period.</p>;
}

// Inline SVG area+line trend of daily sessions — no chart dependency, matches the
// hand-rolled visualisations elsewhere in the admin.
function TrendChart({ trend, days }: { trend: { date: string; sessions: number; users: number }[]; days: number }) {
  const W = 960, H = 180, P = 8;
  const max = Math.max(1, ...trend.map((p) => p.sessions));
  const n = trend.length;
  const x = (i: number) => (n <= 1 ? P : P + (i * (W - 2 * P)) / (n - 1));
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  const line = trend.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.sessions).toFixed(1)}`).join(' ');
  const area = n > 0 ? `${line} L${x(n - 1).toFixed(1)},${H - P} L${x(0).toFixed(1)},${H - P} Z` : '';
  const totalSessions = trend.reduce((s, p) => s + p.sessions, 0);
  return (
    <section className="mt-8 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-[family-name:var(--font-display)] text-lg">Sessions over time <span className="text-xs font-normal text-[var(--color-stone)]">· last {days} days</span></h2>
        <span className="text-xs tabular-nums text-[var(--color-stone)]">{nf(totalSessions)} sessions · peak {nf(max)}/day</span>
      </div>
      {n === 0 ? <Empty /> : (
        <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full" preserveAspectRatio="none" role="img" aria-label="Daily sessions trend">
          <path d={area} fill="var(--color-gold)" opacity="0.12" />
          <path d={line} fill="none" stroke="var(--color-gold)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
    </section>
  );
}

// Horizontal bar list (devices, countries) — share of sessions.
function BarList({ title, rows, capitalize }: { title: string; rows: Ga4Row[]; capitalize?: boolean }) {
  const total = Math.max(1, rows.reduce((s, r) => s + r.sessions, 0));
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">{title}</h2>
      {rows.length === 0 ? <Empty /> : (
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <li key={r.label}>
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span className={capitalize ? 'capitalize' : ''}>{r.label}</span>
                <span className="tabular-nums text-[var(--color-stone)]">{nf(r.sessions)} · {Math.round((r.sessions / total) * 100)}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-bone)]">
                <div className="h-full rounded-full bg-[var(--color-gold)]/70" style={{ width: `${Math.max(2, (r.sessions / total) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
