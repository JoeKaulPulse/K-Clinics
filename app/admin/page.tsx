import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { formatPrice } from '@/lib/treatments';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { RevenueChart, TopTreatments } from '@/components/admin/Charts';
import { OnboardingHost } from '@/components/onboarding/OnboardingHost';
import { ONBOARDING } from '@/lib/onboarding-steps';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function AdminOverview() {
  if (!crmEnabled) return <CrmDisabled />;
  const { getOverview, getAnalytics } = await import('@/lib/crm-data');
  const session = await getSession();
  const { db } = await import('@/lib/db');

  const meProf = session ? await db.adminUser.findUnique({ where: { id: session.sub }, select: { onboardedAt: true, name: true, title: true, credentials: true, photoUrl: true, publicPhone: true } }) : null;
  const staffOnb = meProf ? { pending: !meProf.onboardedAt, initial: { name: meProf.name ?? '', title: meProf.title ?? '', credentials: meProf.credentials ?? '', photoUrl: meProf.photoUrl ?? '', publicPhone: meProf.publicPhone ?? '' } } : null;

  // A practising clinician's home is "My day", not the owner KPI overview.
  // Send clinical-only roles there; managers (OWNER/ADMIN) keep the overview.
  if (session && !['OWNER', 'ADMIN'].includes(session.role)) {
    const me = await db.adminUser.findUnique({ where: { id: session.sub }, select: { isClinician: true } });
    if (me?.isClinician) redirect('/admin/my-day');
  }

  const canApproveTimeOff = sessionCan(session, 'schedule.manage');
  const canInventory = sessionCan(session, 'inventory.view');
  const canFinance = sessionCan(session, 'finance.view');
  const canBookings = sessionCan(session, 'bookings.view');
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(); dayEnd.setHours(23, 59, 59, 999);
  const [o, a, pendingTimeOff, myTasks, stockItems, expiringSoon, ordersToFulfil, retailProducts, todaysBookings, reqConsent, reqPhoto] = await Promise.all([
    getOverview(),
    getAnalytics(),
    canApproveTimeOff ? db.staffTimeOff.count({ where: { status: 'PENDING' } }) : Promise.resolve(0),
    session ? db.task.count({ where: { assigneeId: session.sub, status: 'OPEN' } }) : Promise.resolve(0),
    canInventory ? db.stockItem.findMany({ where: { active: true }, select: { currentQty: true, lowStockAt: true } }) : Promise.resolve([]),
    canInventory ? db.stockMovement.count({ where: { reason: 'RECEIVED', expiry: { not: null, gte: new Date(), lte: new Date(Date.now() + 90 * 864e5) } } }) : Promise.resolve(0),
    canFinance ? db.order.count({ where: { status: 'PAID', fulfillment: 'unfulfilled' } }) : Promise.resolve(0),
    canFinance ? db.product.findMany({ where: { status: 'ACTIVE', trackInventory: true }, select: { stockQty: true, lowStockThreshold: true } }) : Promise.resolve([]),
    canBookings ? db.booking.findMany({ where: { startAt: { gte: dayStart, lte: dayEnd }, status: { in: ['PENDING', 'CONFIRMED'] } }, select: { id: true, treatmentSlug: true } }) : Promise.resolve([]),
    import('@/lib/settings').then((m) => m.getSetting('require_consent')),
    import('@/lib/settings').then((m) => m.getSetting('require_before_photo')),
  ]);
  const lowStock = stockItems.filter((i) => i.lowStockAt > 0 && i.currentQty <= i.lowStockAt).length;
  const productsLow = retailProducts.filter((p) => p.stockQty <= p.lowStockThreshold).length;
  // Completed treatments in the last 30 days that haven't been charged (revenue at risk).
  const unchargedCompleted = canFinance
    ? await db.booking.count({ where: { status: 'COMPLETED', chargedAt: null, pricePence: { gt: 0 }, finishedAt: { gte: new Date(Date.now() - 30 * 864e5) } } })
    : 0;

  // Today's appointments still missing consent or a laser before-photo.
  let todayNotReady = 0;
  if (todaysBookings.length && (reqConsent || reqPhoto)) {
    const ids = todaysBookings.map((b) => b.id);
    const { isLaserTreatment } = await import('@/lib/consent');
    const [signedRows, photoRows] = await Promise.all([
      db.signedConsent.findMany({ where: { bookingId: { in: ids } }, select: { bookingId: true, kind: true } }),
      db.beforePhoto.findMany({ where: { bookingId: { in: ids } }, select: { bookingId: true } }),
    ]);
    const consentSet = new Set(signedRows.filter((s) => s.kind === 'treatment').map((s) => s.bookingId));
    const photoSet = new Set([...photoRows.map((p) => p.bookingId), ...signedRows.filter((s) => s.kind === 'photo_opt_out').map((s) => s.bookingId)]);
    todayNotReady = todaysBookings.filter((b) => (reqConsent && !consentSet.has(b.id)) || (reqPhoto && isLaserTreatment(b.treatmentSlug) && !photoSet.has(b.id))).length;
  }
  const attention = [
    { show: todayNotReady > 0, label: 'Appointments not ready today', value: todayNotReady, href: '/admin/my-day', tone: 'amber' },
    { show: canFinance && unchargedCompleted > 0, label: 'Completed, not charged', value: unchargedCompleted, href: '/admin/bookings', tone: 'amber' },
    { show: ordersToFulfil > 0, label: 'Orders to fulfil', value: ordersToFulfil, href: '/admin/orders', tone: 'amber' },
    { show: canFinance && productsLow > 0, label: 'Products to restock', value: productsLow, href: '/admin/products', tone: 'blush' },
    { show: canApproveTimeOff && pendingTimeOff > 0, label: 'Time-off to approve', value: pendingTimeOff, href: '/admin/time-off', tone: 'amber' },
    { show: myTasks > 0, label: 'My open tasks', value: myTasks, href: '/admin/tasks', tone: 'ink' },
    { show: canInventory && lowStock > 0, label: 'Low-stock items', value: lowStock, href: '/admin/inventory', tone: 'blush' },
    { show: canInventory && expiringSoon > 0, label: 'Batches expiring ≤90d', value: expiringSoon, href: '/admin/inventory', tone: 'amber' },
  ].filter((x) => x.show);

  const toneCls: Record<string, string> = {
    amber: 'border-amber-300 bg-amber-50 text-amber-900',
    blush: 'border-[var(--color-blush)]/40 bg-[var(--color-blush)]/10 text-[var(--color-ink)]',
    ink: 'border-[var(--color-line)] bg-[var(--color-porcelain)] text-[var(--color-ink)]',
  };

  const kpis = [
    { label: 'Revenue · 30 days', value: formatPrice(a.rev30), trend: a.revTrend, href: '/admin/bookings' },
    { label: 'Upcoming appointments', value: String(a.upcomingCount), href: '/admin/bookings' },
    { label: 'Consult → booking', value: `${a.conversion}%`, sub: 'last 30 days' },
    { label: 'New clients · 30 days', value: String(a.newClients30), href: '/admin/clients' },
  ];

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Overview</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">Welcome back{session?.name ? `, ${session.name}` : ''}.</p>

      {/* Needs attention */}
      {attention.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-3">
          {attention.map((x) => (
            <Link key={x.label} href={x.href} className={`flex items-center gap-3 rounded-full border px-4 py-2 text-sm transition-shadow hover:shadow-[var(--shadow-soft)] ${toneCls[x.tone]}`}>
              <span className="font-[family-name:var(--font-display)] text-lg leading-none">{x.value}</span>
              <span>{x.label}</span>
            </Link>
          ))}
        </div>
      )}

      {/* KPI row */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Link
            key={k.label}
            href={k.href || '#'}
            className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6 transition-shadow hover:shadow-[var(--shadow-soft)]"
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-[family-name:var(--font-display)] text-3xl text-[var(--color-ink)]">{k.value}</p>
              {typeof k.trend === 'number' && (
                <span className={`text-xs font-medium ${k.trend >= 0 ? 'text-[var(--color-jade)]' : 'text-[var(--color-blush)]'}`}>
                  {k.trend >= 0 ? '▲' : '▼'} {Math.abs(k.trend)}%
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-[var(--color-stone)]">{k.label}{k.sub ? ` · ${k.sub}` : ''}</p>
          </Link>
        ))}
      </div>

      {/* Charts */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <RevenueChart series={a.series} />
        <TopTreatments items={a.topTreatments} />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        {/* Today's schedule */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-display)] text-xl">Today’s schedule</h2>
            <Link href="/admin/bookings" className="text-sm text-[var(--color-gold)] hover:underline">All bookings</Link>
          </div>
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
            {a.today.length === 0 && <p className="p-6 text-sm text-[var(--color-stone)]">No appointments today.</p>}
            {a.today.map((b) => (
              <Link key={b.id} href={`/admin/bookings/${b.id}`} className="flex items-center gap-4 border-b border-[var(--color-line)] px-5 py-3.5 last:border-0 hover:bg-[var(--color-bone)]">
                <span className="w-14 shrink-0 font-[family-name:var(--font-display)] text-lg text-[var(--color-gold)]">{b.time}</span>
                <div className="flex-1">
                  <p className="font-medium">{b.treatment}</p>
                  <p className="text-xs text-[var(--color-stone)]">{b.client}</p>
                </div>
                <span className="rounded-full bg-[var(--color-bone)] px-3 py-1 text-xs">{b.status.toLowerCase()}</span>
              </Link>
            ))}
          </div>

          <div className="mb-3 mt-8 flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-display)] text-xl">Recent consultations</h2>
            <Link href="/admin/consultations" className="text-sm text-[var(--color-gold)] hover:underline">View all</Link>
          </div>
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
            {o.recentConsults.length === 0 && <p className="p-6 text-sm text-[var(--color-stone)]">No consultations yet.</p>}
            {o.recentConsults.map((c) => (
              <Link key={c.id} href={`/admin/clients/${c.clientId}`} className="flex items-center justify-between gap-4 border-b border-[var(--color-line)] px-5 py-3.5 last:border-0 hover:bg-[var(--color-bone)]">
                <div>
                  <p className="font-medium">{c.client.firstName} {c.client.lastName ?? ''}</p>
                  <p className="text-xs text-[var(--color-stone)]">{c.category} · {c.treatments.slice(0, 2).join(', ') || 'general'}</p>
                </div>
                <span className="rounded-full bg-[var(--color-bone)] px-3 py-1 text-xs">{c.status}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-8">
          <div>
            <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">At a glance</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total clients', value: o.clients },
                { label: 'New consults', value: o.newConsults },
                { label: 'This week', value: o.weekConsults },
                { label: 'Subscribers', value: o.marketingClients },
              ].map((s) => (
                <div key={s.label} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
                  <p className="font-[family-name:var(--font-display)] text-2xl">{s.value}</p>
                  <p className="text-xs text-[var(--color-stone)]">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">Upcoming birthdays</h2>
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
              {o.upcomingBirthdays.length === 0 && <p className="p-6 text-sm text-[var(--color-stone)]">None in the next two weeks.</p>}
              {o.upcomingBirthdays.map((b) => (
                <div key={b.id} className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-3 last:border-0">
                  <span className="text-sm">{b.name}</span>
                  <span className="text-xs text-[var(--color-stone)]">{b.date} · {b.inDays === 0 ? 'today' : `in ${b.inDays}d`}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
      {staffOnb && <OnboardingHost pending={staffOnb.pending} title={ONBOARDING.staff.title} intro={ONBOARDING.staff.intro} steps={ONBOARDING.staff.steps} initial={staffOnb.initial} endpoint={ONBOARDING.staff.endpoint} />}
    </AdminShell>
  );
}
