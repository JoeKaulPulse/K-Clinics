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
      select: { practitionerId: true, actualMinutes: true, durationMin: true, pricePence: true, chargedPence: true, pointsRedeemedPence: true, treatmentTitle: true, practitioner: { select: { name: true, email: true } } },
    }),
    db.stockItem.findMany({ where: { active: true }, select: { currentQty: true, costPence: true } }),
    db.stockMovement.findMany({ where: { reason: { in: ['USED', 'WASTED'] }, createdAt: { gte: since } }, select: { delta: true, item: { select: { costPence: true } } } }),
  ]);

  // Realised value of a completed treatment: the amount actually charged when
  // Realised revenue only — the amount actually charged. We never count a
  // completed-but-uncharged treatment as revenue (those surface separately via
  // the dashboard's "completed, not charged" prompt), so nothing shows as a
  // sale before payment is taken.
  const rev = (b: { chargedPence: number | null }) => b.chargedPence ?? 0;

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

  const totalRevenue = completed.reduce((s, b) => s + rev(b), 0);
  const totalActualMin = completed.reduce((s, b) => s + (b.actualMinutes ?? 0), 0);
  const inventoryValue = items.reduce((s, i) => s + i.currentQty * (i.costPence ?? 0), 0);
  const consumablesUsed = consumables.reduce((s, m) => s + Math.abs(m.delta) * (m.item.costPence ?? 0), 0);

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
            <Link key={r} href={`/admin/reports?range=${r}`} className={`rounded-full px-3 py-1 ${!all && days === r ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'text-[var(--color-stone)]'}`}>{r}d</Link>
          ))}
          <Link href="/admin/reports?range=all" className={`rounded-full px-3 py-1 ${all ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'text-[var(--color-stone)]'}`}>{L('All', 'Усе')}</Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        {[
          { label: L('Revenue (charged)', 'Дохід (стягнено)'), value: gbp(totalRevenue) },
          { label: L('Appointments', 'Записи'), value: String(completed.length) },
          { label: L('Clinical hours', 'Клінічні години'), value: hrs(totalActualMin) },
          { label: L('Consumables used', 'Витратні'), value: gbp(consumablesUsed) },
        ].map((k) => (
          <div key={k.label} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
            <div className="font-[family-name:var(--font-display)] text-2xl">{k.value}</div>
            <div className="mt-1 text-xs text-[var(--color-stone)]">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Staff performance */}
        <section>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">{L('Clinician performance', 'Ефективність клініцистів')}</h2>
          <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-[var(--color-bone)] text-xs uppercase tracking-wide text-[var(--color-stone)]">
                <tr>{[L('Clinician', 'Клініцист'), L('Appts', 'Записи'), L('Hours', 'Години'), L('Avg vs booked', 'Факт/план'), L('Revenue', 'Дохід')].map((h) => <th key={h} className="px-4 py-2.5 text-right first:text-left">{h}</th>)}</tr>
              </thead>
              <tbody>
                {staff.length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-[var(--color-stone)]">{L('No completed appointments yet.', 'Ще немає завершених записів.')}</td></tr>}
                {staff.map((s) => {
                  const avgActual = s.count ? Math.round(s.actualMin / s.count) : 0;
                  const avgBooked = s.count ? Math.round(s.bookedMin / s.count) : 0;
                  return (
                    <tr key={s.name} className="border-t border-[var(--color-line)] bg-[var(--color-porcelain)]">
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
                <div key={t.title} className="flex items-center justify-between border-b border-[var(--color-line)] bg-[var(--color-porcelain)] px-4 py-2.5 text-sm last:border-0">
                  <span>{t.title} <span className="text-xs text-[var(--color-stone-soft)]">×{t.count}</span></span>
                  <span className="text-[var(--color-jade)]">{gbp(t.revenue)}</span>
                </div>
              ))}
            </div>
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
    </AdminShell>
  );
}
