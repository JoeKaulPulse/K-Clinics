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
  const [completed, items, consumables] = await Promise.all([
    db.booking.findMany({
      // Filter on the appointment date (startAt) so imported/historical completed
      // bookings — which have no finishedAt — are counted too.
      where: { status: 'COMPLETED', startAt: { gte: since } },
      select: { id: true, practitionerId: true, actualMinutes: true, durationMin: true, pricePence: true, chargedPence: true, refundedPence: true, pointsRedeemedPence: true, treatmentTitle: true, treatmentSlug: true, practitioner: { select: { name: true, email: true } } },
    }),
    db.stockItem.findMany({ where: { active: true }, select: { currentQty: true, costPence: true } }),
    db.stockMovement.findMany({ where: { reason: { in: ['USED', 'WASTED'] }, createdAt: { gte: since } }, select: { delta: true, item: { select: { costPence: true } } } }),
  ]);

  // Realised value of a completed treatment: the amount actually charged when
  // Realised revenue only — the amount actually charged. We never count a
  // completed-but-uncharged treatment as revenue (those surface separately via
  // the dashboard's "completed, not charged" prompt), so nothing shows as a
  // sale before payment is taken.
  const rev = (b: { chargedPence: number | null; refundedPence: number | null }) => (b.chargedPence ?? 0) - (b.refundedPence ?? 0);

  // Staff performance.
  const staffMap = new Map<string, { name: string; count: number; actualMin: number; bookedMin: number; revenue: number }>();
  for (const b of completed) {
    const key = b.practitionerId || 'unassigned';
    const name = b.practitioner?.name || b.practitioner?.email || 'Unassigned';
    const s = staffMap.get(key) || { name, count: 0, actualMin: 0, bookedMin: 0, revenue: 0 };
    s.count++; s.actualMin += b.actualMinutes ?? 0; s.bookedMin += b.durationMin; s.revenue += rev(b);
    staffMap.set(key, s);
  }
  const staff = [...staffMap.values()].sort((a, b) => b.revenue - a.revenue);

  // Treatments.
  const txMap = new Map<string, { count: number; revenue: number }>();
  for (const b of completed) {
    const t = txMap.get(b.treatmentTitle) || { count: 0, revenue: 0 };
    t.count++; t.revenue += rev(b);
    txMap.set(b.treatmentTitle, t);
  }
  const treatments = [...txMap.entries()].map(([title, v]) => ({ title, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 12);

  // Profitability by service: revenue (charged − refunded) minus attributable
  // cost — variant cost-of-goods (from booking items) + consumables used on that
  // booking. Cost is conservative (0 where not recorded), so margin never overstates.
  const bookingIds = completed.map((b) => b.id);
  const [itemRows, moveRows] = await Promise.all([
    bookingIds.length ? db.bookingItem.findMany({ where: { bookingId: { in: bookingIds } }, select: { bookingId: true, sessions: true, variant: { select: { costPence: true } } } }) : Promise.resolve([]),
    bookingIds.length ? db.stockMovement.findMany({ where: { bookingId: { in: bookingIds }, reason: { in: ['USED', 'WASTED'] } }, select: { bookingId: true, delta: true, item: { select: { costPence: true } } } }) : Promise.resolve([]),
  ]);
  const costByBooking = new Map<string, number>();
  const addCost = (id: string, c: number) => costByBooking.set(id, (costByBooking.get(id) ?? 0) + c);
  for (const it of itemRows) if (it.variant?.costPence) addCost(it.bookingId, it.variant.costPence * (it.sessions || 1));
  for (const m of moveRows) if (m.bookingId) addCost(m.bookingId, Math.abs(m.delta) * (m.item.costPence ?? 0));
  const profMap = new Map<string, { title: string; count: number; revenue: number; cost: number }>();
  for (const b of completed) {
    const p = profMap.get(b.treatmentTitle) || { title: b.treatmentTitle, count: 0, revenue: 0, cost: 0 };
    p.count++; p.revenue += rev(b); p.cost += costByBooking.get(b.id) ?? 0;
    profMap.set(b.treatmentTitle, p);
  }
  const profitability = [...profMap.values()]
    .map((p) => ({ ...p, margin: p.revenue - p.cost, marginPct: p.revenue > 0 ? Math.round(((p.revenue - p.cost) / p.revenue) * 100) : 0 }))
    .sort((a, b) => b.margin - a.margin).slice(0, 15);
  const minMarginPct = await import('@/lib/settings').then((m) => m.getConfigNumber('min_margin_pct')).catch(() => 0);

  const totalRevenue = completed.reduce((s, b) => s + rev(b), 0);
  // VAT collected over the period (only when the clinic is VAT-registered).
  let totalVat = 0; let vatRegistered = false;
  try {
    const { getVatConfig, effectiveVatClass, vatBreakdown } = await import('@/lib/vat');
    const vatCfg = await getVatConfig();
    vatRegistered = vatCfg.registered;
    if (vatCfg.registered) {
      const svcRows = await db.service.findMany({ select: { treatmentSlug: true, vatClass: true, category: true } });
      const byTreatment = new Map(svcRows.map((s) => [s.treatmentSlug, s]));
      for (const b of completed) {
        const svc = byTreatment.get(b.treatmentSlug);
        totalVat += vatBreakdown(rev(b), vatCfg, effectiveVatClass({ vatClass: svc?.vatClass, category: svc?.category })).vatPence;
      }
    }
  } catch { /* VAT figure is best-effort */ }
  const totalActualMin = completed.reduce((s, b) => s + (b.actualMinutes ?? 0), 0);
  const inventoryValue = items.reduce((s, i) => s + i.currentQty * (i.costPence ?? 0), 0);
  const consumablesUsed = consumables.reduce((s, m) => s + Math.abs(m.delta) * (m.item.costPence ?? 0), 0);

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
          { label: L('Appointments', 'Записи'), value: String(completed.length) },
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
