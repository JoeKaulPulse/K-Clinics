import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

const gbp = (p: number) => `£${(p / 100).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
const RANGES = [30, 90, 365];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'finance.view')) redirect('/admin');
  const { financeUnlocked } = await import('@/lib/finance-lock');
  if (!(await financeUnlocked(session!.sub))) redirect('/admin/finance/unlock?next=/admin/reports');
  const { range } = await searchParams;
  const all = range === 'all';
  const days = all ? 0 : (RANGES.includes(Number(range)) ? Number(range) : 90);
  const since = all ? new Date(0) : new Date(Date.now() - days * 864e5);

  const { db } = await import('@/lib/db');
  // Filter on the appointment date (startAt) so imported/historical completed
  // bookings — which have no finishedAt — are counted too.
  const bookingWhere = { status: 'COMPLETED' as const, startAt: { gte: since } };

  // Aggregate in the database, not in JS (BLD-889). range=all used to load
  // every completed booking row into memory and reduce in JS, then run
  // unbounded `bookingId IN (…)` lookups over the full id list — on years of
  // history that walks tens of thousands of rows per page view. groupBy /
  // aggregate returns one row per clinician / treatment instead, and the cost
  // joins below are SQL aggregates.
  const [totals, byStaff, byTreatment, items] = await Promise.all([
    db.booking.aggregate({ where: bookingWhere, _count: true, _sum: { chargedPence: true, refundedPence: true, actualMinutes: true } }),
    db.booking.groupBy({ by: ['practitionerId'], where: bookingWhere, _count: true, _sum: { actualMinutes: true, durationMin: true, chargedPence: true, refundedPence: true } }),
    db.booking.groupBy({ by: ['treatmentTitle'], where: bookingWhere, _count: true, _sum: { chargedPence: true, refundedPence: true } }),
    db.stockItem.findMany({ where: { active: true }, select: { currentQty: true, costPence: true } }),
  ]);

  // Realised revenue only — the amount actually charged minus refunds. We never
  // count a completed-but-uncharged treatment as revenue (those surface
  // separately via the dashboard's "completed, not charged" prompt), so nothing
  // shows as a sale before payment is taken.
  const rev = (s: { chargedPence: number | null; refundedPence: number | null } | null | undefined) => (s?.chargedPence ?? 0) - (s?.refundedPence ?? 0);
  const completedCount = totals._count;

  // Staff performance.
  const staffIds = byStaff.map((g) => g.practitionerId).filter((id): id is string => !!id);
  const staffRows = staffIds.length ? await db.adminUser.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true, email: true } }) : [];
  const nameById = new Map(staffRows.map((u) => [u.id, u.name || u.email]));
  const staff = byStaff.map((g) => ({
    name: (g.practitionerId && nameById.get(g.practitionerId)) || 'Unassigned',
    count: g._count,
    actualMin: g._sum.actualMinutes ?? 0,
    bookedMin: g._sum.durationMin ?? 0,
    revenue: rev(g._sum),
  })).sort((a, b) => b.revenue - a.revenue);

  // Treatments.
  const treatmentAgg = byTreatment.map((g) => ({ title: g.treatmentTitle, count: g._count, revenue: rev(g._sum) })).sort((a, b) => b.revenue - a.revenue);
  const treatments = treatmentAgg.slice(0, 12);

  // Profitability by service: revenue (charged − refunded) minus attributable
  // cost — variant cost-of-goods (from booking items) + consumables used on that
  // booking. Cost is conservative (0 where not recorded), so margin never
  // overstates. Both cost sources aggregate per treatment in SQL; StockMovement
  // has no Booking relation in the Prisma schema (bare bookingId column), so a
  // join here replaces the old unbounded id list.
  const goodsCost = await db.$queryRaw<{ title: string; cost: number | null }[]>`
    SELECT b."treatmentTitle" AS title,
           SUM(v."costPence" * GREATEST(bi."sessions", 1))::float8 AS cost
      FROM "BookingItem" bi
      JOIN "Booking" b ON b."id" = bi."bookingId"
      JOIN "ServiceVariant" v ON v."id" = bi."variantId"
     WHERE b."status" = 'COMPLETED' AND b."startAt" >= ${since} AND v."costPence" > 0
     GROUP BY 1
  `.catch(() => [] as { title: string; cost: number | null }[]);
  const usedCost = await db.$queryRaw<{ title: string; cost: number | null }[]>`
    SELECT b."treatmentTitle" AS title,
           SUM(ABS(m."delta") * COALESCE(si."costPence", 0))::float8 AS cost
      FROM "StockMovement" m
      JOIN "Booking" b ON b."id" = m."bookingId"
      JOIN "StockItem" si ON si."id" = m."itemId"
     WHERE m."reason" IN ('USED', 'WASTED') AND b."status" = 'COMPLETED' AND b."startAt" >= ${since}
     GROUP BY 1
  `.catch(() => [] as { title: string; cost: number | null }[]);
  const costByTreatment = new Map<string, number>();
  for (const r of [...goodsCost, ...usedCost]) costByTreatment.set(r.title, (costByTreatment.get(r.title) ?? 0) + Math.round(r.cost ?? 0));
  const profitability = treatmentAgg
    .map((t) => ({ ...t, cost: costByTreatment.get(t.title) ?? 0 }))
    .map((p) => ({ ...p, margin: p.revenue - p.cost, marginPct: p.revenue > 0 ? Math.round(((p.revenue - p.cost) / p.revenue) * 100) : 0 }))
    .sort((a, b) => b.margin - a.margin).slice(0, 15);
  const minMarginPct = await import('@/lib/settings').then((m) => m.getConfigNumber('min_margin_pct')).catch(() => 0);

  const totalRevenue = rev(totals._sum);
  // VAT collected over the period (only when the clinic is VAT-registered).
  // Summed per treatment slug (the VAT class is per service), so the rate is
  // applied to the period total per service rather than per booking.
  let totalVat = 0; let vatRegistered = false;
  try {
    const { getVatConfig, effectiveVatClass, vatBreakdown } = await import('@/lib/vat');
    const vatCfg = await getVatConfig();
    vatRegistered = vatCfg.registered;
    if (vatCfg.registered) {
      const [bySlug, svcRows] = await Promise.all([
        db.booking.groupBy({ by: ['treatmentSlug'], where: bookingWhere, _sum: { chargedPence: true, refundedPence: true } }),
        db.service.findMany({ select: { treatmentSlug: true, vatClass: true, category: true } }),
      ]);
      const svcBySlug = new Map(svcRows.map((s) => [s.treatmentSlug, s]));
      for (const g of bySlug) {
        const svc = svcBySlug.get(g.treatmentSlug);
        totalVat += vatBreakdown(rev(g._sum), vatCfg, effectiveVatClass({ vatClass: svc?.vatClass, category: svc?.category })).vatPence;
      }
    }
  } catch { /* VAT figure is best-effort */ }
  const totalActualMin = totals._sum.actualMinutes ?? 0;
  const inventoryValue = items.reduce((s, i) => s + i.currentQty * (i.costPence ?? 0), 0);
  const usedRow = await db.$queryRaw<[{ used: number | null }]>`
    SELECT SUM(ABS(m."delta") * COALESCE(si."costPence", 0))::float8 AS used
      FROM "StockMovement" m
      JOIN "StockItem" si ON si."id" = m."itemId"
     WHERE m."reason" IN ('USED', 'WASTED') AND m."createdAt" >= ${since}
  `.catch(() => [{ used: 0 }] as [{ used: number | null }]);
  const consumablesUsed = Math.round(usedRow[0]?.used ?? 0);

  // Appointment-session timing analytics (BLD-143): how long each stage takes,
  // what gets skipped, and where the most time goes — from AppointmentSession.steps.
  const { SESSION_STEPS } = await import('@/lib/appointment-session');
  const sessions = await db.appointmentSession.findMany({
    where: { booking: { status: 'COMPLETED', startAt: { gte: since } } },
    select: { steps: true },
  }).catch(() => [] as { steps: unknown }[]);
  const stepAgg = new Map<string, { secs: number; n: number; skips: number; visits: number }>();
  for (const s of sessions) {
    const steps = (s.steps && typeof s.steps === 'object') ? s.steps as Record<string, { seconds?: number; visits?: number; skipped?: boolean }> : {};
    for (const [k, t] of Object.entries(steps)) {
      if (!t || typeof t !== 'object') continue;
      const a = stepAgg.get(k) || { secs: 0, n: 0, skips: 0, visits: 0 };
      a.secs += t.seconds || 0; a.n += 1; if (t.skipped) a.skips += 1; a.visits += t.visits || 0;
      stepAgg.set(k, a);
    }
  }
  const stepRows = SESSION_STEPS.filter((s) => stepAgg.has(s.key)).map((s) => {
    const a = stepAgg.get(s.key)!;
    return { label: s.label, avgSec: a.n ? Math.round(a.secs / a.n) : 0, skipPct: a.n ? Math.round((a.skips / a.n) * 100) : 0, avgVisits: a.n ? a.visits / a.n : 0 };
  });
  const maxAvgSec = Math.max(1, ...stepRows.map((r) => r.avgSec));
  const mmss = (s: number) => `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;

  const can = await sessionPermissions();
  const locale = await getLocale();
  const uk = locale === 'uk';
  const L = (en: string, ukt: string) => (uk ? ukt : en);
  const hrs = (min: number) => `${Math.floor(min / 60)}h ${min % 60}m`;

  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">{L('Reports', 'Звіти')}</h1>
          <p className="mt-1 text-sm text-[var(--color-stone)]">{all ? L('Performance — all time (incl. imported history).', 'Показники — за весь час.') : L(`Performance over the last ${days} days.`, `Показники за останні ${days} днів.`)}</p>
        </div>
        <div className="flex gap-1 rounded-full border border-[var(--color-line)] p-0.5 text-sm">
          {RANGES.map((r) => (
            <Link key={r} href={`/admin/reports?range=${r}`} className={`rounded-full px-3 py-1 transition-colors duration-150 ${!all && days === r ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'text-[var(--color-stone)] hover:bg-[var(--color-bone)]'}`}>{r}d</Link>
          ))}
          <Link href="/admin/reports?range=all" className={`rounded-full px-3 py-1 transition-colors duration-150 ${all ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'text-[var(--color-stone)] hover:bg-[var(--color-bone)]'}`}>{L('All', 'Усе')}</Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        {[
          { label: L('Revenue (charged)', 'Дохід (стягнено)'), value: gbp(totalRevenue) },
          ...(vatRegistered ? [{ label: L('of which VAT', 'у т.ч. ПДВ'), value: gbp(totalVat) }] : []),
          { label: L('Appointments', 'Записи'), value: String(completedCount) },
          { label: L('Clinical hours', 'Клінічні години'), value: hrs(totalActualMin) },
          { label: L('Consumables used', 'Витратні'), value: gbp(consumablesUsed) },
        ].map((k) => (
          <div key={k.label} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4 transition-shadow duration-150 hover:shadow-[var(--shadow-soft)]">
            <div className="font-[family-name:var(--font-display)] text-2xl tabular-nums">{k.value}</div>
            <div className="mt-1 text-xs text-[var(--color-stone)]">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Staff performance */}
        <section>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">{L('Clinician performance', 'Ефективність клініцистів')}</h2>
          <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
            <table className="w-full min-w-[480px] text-sm tabular-nums">
              <thead className="bg-[var(--color-bone)] text-xs uppercase tracking-wide text-[var(--color-stone)]">
                <tr>{[L('Clinician', 'Клініцист'), L('Appts', 'Записи'), L('Hours', 'Години'), L('Avg vs booked', 'Факт/план'), L('Revenue', 'Дохід')].map((h) => <th key={h} className="px-4 py-2.5 text-right first:text-left">{h}</th>)}</tr>
              </thead>
              <tbody>
                {staff.length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-[var(--color-stone)]">{L('No completed appointments yet.', 'Ще немає завершених записів.')}</td></tr>}
                {staff.map((s) => {
                  const avgActual = s.count ? Math.round(s.actualMin / s.count) : 0;
                  const avgBooked = s.count ? Math.round(s.bookedMin / s.count) : 0;
                  return (
                    <tr key={s.name} className="border-t border-[var(--color-line)] bg-[var(--color-porcelain)] transition-colors duration-150 hover:bg-[var(--color-bone)]">
                      <td className="px-4 py-2.5 font-medium">{s.name}</td>
                      <td className="px-4 py-2.5 text-right">{s.count}</td>
                      <td className="px-4 py-2.5 text-right">{hrs(s.actualMin)}</td>
                      <td className="px-4 py-2.5 text-right text-[var(--color-stone)]">{avgActual}/{avgBooked}m</td>
                      <td className="px-4 py-2.5 text-right text-[var(--color-jade)]">{gbp(s.revenue)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Treatments + inventory */}
        <section className="space-y-8">
          <div>
            <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">{L('Top treatments', 'Топ процедур')}</h2>
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)]">
              {treatments.length === 0 && <p className="p-4 text-sm text-[var(--color-stone)]">{L('No data yet.', 'Немає даних.')}</p>}
              {treatments.map((t) => (
                <div key={t.title} className="flex items-center justify-between border-b border-[var(--color-line)] bg-[var(--color-porcelain)] px-4 py-2.5 text-sm transition-colors last:border-0 hover:bg-[var(--color-bone)]">
                  <span>{t.title} <span className="text-xs tabular-nums text-[var(--color-stone)]">×{t.count}</span></span>
                  <span className="tabular-nums text-[var(--color-jade)]">{gbp(t.revenue)}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h2 className="font-[family-name:var(--font-display)] text-xl">{L('Profitability by service', 'Прибутковість за послугою')}</h2>
              <span className="text-xs text-[var(--color-stone)]">{L('revenue − goods & consumables', 'дохід − товари та витратні')}</span>
            </div>
            <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
              <table className="w-full text-sm tabular-nums">
                <thead><tr className="bg-[var(--color-bone)] text-xs uppercase tracking-wide text-[var(--color-stone)]">{[L('Service', 'Послуга'), L('Revenue', 'Дохід'), L('Cost', 'Собівартість'), L('Margin', 'Маржа'), '%'].map((h) => <th key={h} className="px-4 py-2.5 text-right first:text-left">{h}</th>)}</tr></thead>
                <tbody>
                  {profitability.length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-[var(--color-stone)]">{L('No data yet.', 'Немає даних.')}</td></tr>}
                  {profitability.map((p) => (
                    <tr key={p.title} className="border-t border-[var(--color-line)] bg-[var(--color-porcelain)] transition-colors duration-150 hover:bg-[var(--color-bone)]">
                      <td className="px-4 py-2.5 font-medium">{p.title} <span className="text-xs text-[var(--color-stone)]">×{p.count}</span>{minMarginPct > 0 && p.cost > 0 && p.marginPct < minMarginPct && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[0.6rem] font-medium text-amber-800">⚠ below {minMarginPct}%</span>}</td>
                      <td className="px-4 py-2.5 text-right text-[var(--color-jade)]">{gbp(p.revenue)}</td>
                      <td className="px-4 py-2.5 text-right text-[var(--color-stone)]">{p.cost > 0 ? gbp(p.cost) : '—'}</td>
                      <td className="px-4 py-2.5 text-right font-medium">{gbp(p.margin)}</td>
                      <td className={`px-4 py-2.5 text-right ${minMarginPct > 0 && p.cost > 0 && p.marginPct < minMarginPct ? 'text-amber-700' : p.marginPct >= 50 ? 'text-[var(--color-jade)]' : p.marginPct >= 0 ? 'text-[var(--color-ink)]' : 'text-[var(--color-blush-deep)]'}`}>{p.marginPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-[var(--color-stone)]">{L('Cost is conservative — only recorded goods (variant cost) and consumables linked to a booking are counted, so margin is never overstated.', 'Собівартість консервативна — лише зафіксовані товари та витратні, прив’язані до запису.')}</p>
          </div>
          <div>
            <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">{L('Inventory valuation', 'Вартість складу')}</h2>
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
              <div className="font-[family-name:var(--font-display)] text-2xl">{gbp(inventoryValue)}</div>
              <p className="mt-1 text-sm text-[var(--color-stone)]">{L('Current stock at cost', 'Поточні запаси за собівартістю')}</p>
            </div>
          </div>
        </section>
      </div>

      {/* Appointment timing — where each session spends time + what gets skipped (BLD-143) */}
      <section className="mt-10">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="font-[family-name:var(--font-display)] text-xl">{L('Appointment timing', 'Тривалість етапів')}</h2>
          <span className="text-xs text-[var(--color-stone)]">{L(`avg per stage across ${sessions.length} live session${sessions.length === 1 ? '' : 's'}`, `середнє за ${sessions.length} сесій`)}</span>
        </div>
        {stepRows.length === 0 ? (
          <p className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4 text-sm text-[var(--color-stone)]">{L('No live-session timing recorded in this period yet.', 'Ще немає даних про тривалість сесій за цей період.')}</p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
            <table className="w-full min-w-[520px] text-sm tabular-nums">
              <thead className="bg-[var(--color-bone)] text-xs uppercase tracking-wide text-[var(--color-stone)]">
                <tr>{[L('Stage', 'Етап'), L('Avg time', 'Сер. час'), L('Skipped', 'Пропущено'), L('Revisits', 'Повернення')].map((h) => <th key={h} className="px-4 py-2.5 text-right first:text-left">{h}</th>)}</tr>
              </thead>
              <tbody>
                {stepRows.map((r) => (
                  <tr key={r.label} className="border-t border-[var(--color-line)] bg-[var(--color-porcelain)] transition-colors duration-150 hover:bg-[var(--color-bone)]">
                    <td className="px-4 py-2.5 font-medium">{r.label}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="inline-flex items-center justify-end gap-2">
                        <span aria-hidden className="hidden h-1.5 rounded-full bg-[var(--color-gold)]/60 sm:inline-block" style={{ width: `${Math.round((r.avgSec / maxAvgSec) * 80)}px` }} />
                        {mmss(r.avgSec)}
                      </span>
                    </td>
                    <td className={`px-4 py-2.5 text-right ${r.skipPct >= 25 ? 'text-amber-700' : 'text-[var(--color-stone)]'}`}>{r.skipPct}%</td>
                    <td className="px-4 py-2.5 text-right text-[var(--color-stone)]">{r.avgVisits > 1.05 ? `${r.avgVisits.toFixed(1)}×` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-[var(--color-stone)]">{L('Longest stages show where time concentrates; high skip rates flag stages staff routinely bypass; revisits > 1× mean a stage is returned to.', 'Найдовші етапи показують, де зосереджено час; високий відсоток пропусків — етапи, які часто оминають.')}</p>
      </section>
    </AdminShell>
  );
}
