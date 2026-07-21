import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { getLocale } from '@/lib/locale';
import { getSessionTimingStats, getClinicianTimingStats, fmtDuration } from '@/lib/session-analytics';

export const dynamic = 'force-dynamic';

const RANGES = [30, 90, 365];
const pct = (x: number) => `${Math.round(x * 100)}%`;

// BLD-138 — Session insights: where time goes across the guided appointment
// session (per-step average/median, revisit and skip rates) so the clinic can
// see which sections run long or get skipped and improve the flow.
export default async function SessionInsightsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'bookings.view')) redirect('/admin');

  const { range } = await searchParams;
  const all = range === 'all';
  const days = all ? 0 : (RANGES.includes(Number(range)) ? Number(range) : 90);
  const since = all ? new Date(0) : new Date(Date.now() - days * 864e5);

  const [stats, clinicians] = await Promise.all([
    getSessionTimingStats({ since }),
    getClinicianTimingStats({ since }),
  ]);
  const can = await sessionPermissions();
  const locale = await getLocale();

  const rangeLabel = all ? 'All time' : `Last ${days} days`;
  const maxAvg = Math.max(1, ...stats.steps.map((s) => s.avgSeconds));

  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-stone)]">Reports · {rangeLabel}</p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl">Session insights</h1>
        </div>
        <div className="flex gap-1 rounded-full border border-[var(--color-line)] bg-[var(--color-porcelain)] p-1 text-sm">
          {RANGES.map((r) => (
            <Link key={r} href={`/admin/reports/sessions?range=${r}`}
              className={`rounded-full px-3 py-1.5 ${days === r && !all ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'text-[var(--color-stone)] hover:text-[var(--color-ink)]'}`}>{r}d</Link>
          ))}
          <Link href="/admin/reports/sessions?range=all" className={`rounded-full px-3 py-1.5 ${all ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'text-[var(--color-stone)] hover:text-[var(--color-ink)]'}`}>All</Link>
        </div>
      </div>
      <p className="mt-1 text-sm text-[var(--color-stone)]">How time is spent across the guided appointment session — to find sections that run long, get revisited, or are skipped.</p>

      {stats.totalSessions === 0 ? (
        <div className="mt-8 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-10 text-center">
          <p className="font-[family-name:var(--font-display)] text-xl">No completed sessions yet</p>
          <p className="mt-1 text-sm text-[var(--color-stone)]">Once clinicians run guided sessions through to completion, their per-section timings appear here.</p>
        </div>
      ) : (
        <>
          {/* Headline cards */}
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Completed sessions" value={String(stats.totalSessions)} sub={rangeLabel.toLowerCase()} />
            <Kpi label="Avg session length" value={fmtDuration(stats.avgSessionSeconds)} sub={`median ${fmtDuration(stats.medianSessionSeconds)}`} />
            <Kpi label="Longest section" value={stats.slowest ? stats.slowest.label : '—'} sub={stats.slowest ? `avg ${fmtDuration(stats.slowest.avgSeconds)}` : 'not enough data'} />
            <Kpi label="Most skipped" value={stats.mostSkipped ? stats.mostSkipped.label : 'None'} sub={stats.mostSkipped ? pct(stats.mostSkipped.skipRate) + ' of sessions' : 'no skips'} />
          </div>

          {/* Per-step breakdown */}
          <section className="mt-8 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-bone)] text-left text-xs uppercase tracking-wide text-[var(--color-stone)]">
                  <th className="p-3">Section</th>
                  <th className="p-3">Avg time</th>
                  <th className="p-3 hidden sm:table-cell">Median</th>
                  <th className="p-3">Revisited</th>
                  <th className="p-3">Skipped</th>
                  <th className="p-3 hidden sm:table-cell">Sessions</th>
                </tr>
              </thead>
              <tbody>
                {stats.steps.map((s) => (
                  <tr key={s.key} className="border-t border-[var(--color-line)]">
                    <td className="p-3 font-medium">{s.label}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums">{fmtDuration(s.avgSeconds)}</span>
                        <span className="h-1.5 flex-1 max-w-24 overflow-hidden rounded-full bg-[var(--color-bone)]">
                          <span className="block h-full rounded-full bg-[var(--color-gold)]" style={{ width: `${Math.round((s.avgSeconds / maxAvg) * 100)}%` }} />
                        </span>
                      </div>
                    </td>
                    <td className="p-3 hidden sm:table-cell tabular-nums text-[var(--color-stone)]">{fmtDuration(s.medianSeconds)}</td>
                    <td className="p-3 tabular-nums">{s.revisitRate > 0 ? <span className={s.revisitRate >= 0.25 ? 'text-[var(--color-gold-deep)]' : ''}>{pct(s.revisitRate)}</span> : <span className="text-[var(--color-stone)]">—</span>}</td>
                    <td className="p-3 tabular-nums">{s.skipRate > 0 ? <span className={s.skipRate >= 0.25 ? 'text-[#b23b3b]' : ''}>{pct(s.skipRate)}</span> : <span className="text-[var(--color-stone)]">—</span>}</td>
                    <td className="p-3 hidden sm:table-cell tabular-nums text-[var(--color-stone)]">{s.sessions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <p className="mt-3 text-xs text-[var(--color-stone)]">“Revisited” = the clinician returned to a section after moving on (often a sign it needs more room in the flow). “Skipped” = the section was passed without recording time. Headline callouts use a minimum sample so one unusual session can’t skew them.</p>

          {/* By clinician */}
          {clinicians.length > 0 && (
            <section className="mt-9">
              <h2 className="mb-1 font-[family-name:var(--font-display)] text-xl">By clinician</h2>
              <p className="mb-3 text-sm text-[var(--color-stone)]">How long each clinician’s sessions run, and where their time goes — busiest first.</p>
              <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--color-bone)] text-left text-xs uppercase tracking-wide text-[var(--color-stone)]">
                      <th className="p-3">Clinician</th>
                      <th className="p-3">Sessions</th>
                      <th className="p-3">Avg length</th>
                      <th className="p-3 hidden sm:table-cell">Median</th>
                      <th className="p-3 hidden sm:table-cell">Longest section</th>
                      <th className="p-3 hidden md:table-cell">Most revisited</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clinicians.map((c) => (
                      <tr key={c.clinicianId} className="border-t border-[var(--color-line)]">
                        <td className="p-3 font-medium">{c.name}</td>
                        <td className="p-3 tabular-nums">{c.sessions}</td>
                        <td className="p-3 tabular-nums">{fmtDuration(c.avgSessionSeconds)}</td>
                        <td className="p-3 hidden sm:table-cell tabular-nums text-[var(--color-stone)]">{fmtDuration(c.medianSessionSeconds)}</td>
                        <td className="p-3 hidden sm:table-cell text-[var(--color-stone)]">{c.slowestStep ?? '—'}</td>
                        <td className="p-3 hidden md:table-cell text-[var(--color-stone)]">{c.mostRevisitedStep ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-[var(--color-stone)]">Sessions are attributed to the appointment’s practitioner. Use this to spot training opportunities or steps that consistently need more time — not as a productivity league table.</p>
            </section>
          )}
        </>
      )}
    </AdminShell>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
      <p className="text-xs uppercase tracking-wide text-[var(--color-stone)]">{label}</p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-2xl text-[var(--color-ink)]">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[var(--color-stone)]">{sub}</p>}
    </div>
  );
}
