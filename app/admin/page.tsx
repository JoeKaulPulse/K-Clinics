import Link from 'next/link';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { formatPrice, bookableTreatments } from '@/lib/treatments';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { RevenueChart, TopTreatments } from '@/components/admin/Charts';
import { OnboardingHost } from '@/components/onboarding/OnboardingHost';
import { ONBOARDING } from '@/lib/onboarding-steps';
import { getLocale } from '@/lib/locale';
import { getWeather, uvBand } from '@/lib/weather';
import { ClockInOut } from '@/components/admin/ClockInOut';
import { fmtClinicTime, fmtClinicDate } from '@/lib/clinic-time';
import { LiveClock } from '@/components/admin/DashboardLive';
import { ArrivalPrep, type NextArrival } from '@/components/admin/ArrivalPrep';
import { NewBookingButton } from '@/components/admin/NewBookingButton';
import { decClinical } from '@/lib/clinical-crypto';
import { resolveView, canSwitchViews, type DashboardView } from '@/lib/dashboard-views';
import { DashboardShell } from '@/components/admin/dashboard/DashboardShell';
import { ScaffoldView } from '@/components/admin/dashboard/ScaffoldView';
import { ClinicianView } from '@/components/admin/dashboard/ClinicianView';
import { ReceptionistView } from '@/components/admin/dashboard/ReceptionistView';
import { DeveloperView } from '@/components/admin/dashboard/DeveloperView';
import { ContractorView } from '@/components/admin/dashboard/ContractorView';
import { RoomPrepStatus } from '@/components/admin/rooms/RoomPrepStatus';

export const dynamic = 'force-dynamic';

export default async function AdminOverview() {
  if (!crmEnabled) return <CrmDisabled />;
  const { getOverview, getAnalytics } = await import('@/lib/crm-data');
  const session = await getSession();
  const { db, withDbRetry } = await import('@/lib/db');

  const meProf = session ? await db.adminUser.findUnique({ where: { id: session.sub }, select: { onboardedAt: true, name: true, title: true, credentials: true, photoUrl: true, publicPhone: true, preferredDashboardView: true } }) : null;
  const staffOnb = meProf ? { pending: !meProf.onboardedAt, initial: { name: meProf.name ?? '', title: meProf.title ?? '', credentials: meProf.credentials ?? '', photoUrl: meProf.photoUrl ?? '', publicPhone: meProf.publicPhone ?? '' } } : null;

  // (PRJ-63) Clinicians used to be redirected to /admin/my-day; they now land on
  // the role-shaped Clinician dashboard view below (My day stays in the nav and
  // is linked from that view). The per-role view is resolved next.

  // ── Which dashboard view is active? (PRJ-63) Each role has a default view;
  //    OWNER/ADMIN may pin another role's view to preview it. Views whose
  //    dedicated bundle hasn't shipped yet fall back to the Admin overview, so
  //    real role users never regress — only an admin actively previewing an
  //    unbuilt view lands on its scaffold.
  const role = session?.role ?? 'STAFF';
  const view: DashboardView = resolveView(role, meProf?.preferredDashboardView);
  const BUILT_VIEWS: DashboardView[] = ['admin', 'clinician', 'reception', 'developer', 'contractor'];
  const renderedView: DashboardView = BUILT_VIEWS.includes(view) ? view : canSwitchViews(role) ? view : 'admin';

  // Time-aware greeting in clinic-local (London) time — the server may run in UTC.
  const now = new Date();
  const londonHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: 'numeric', hour12: false }).format(now));
  const greeting = londonHour < 12 ? 'Good morning' : londonHour < 18 ? 'Good afternoon' : 'Good evening';
  const todayLabel = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long' }).format(now);

  // Live clock + local weather/UV — shown in the greeting header so it is the
  // first thing visible on every view (not buried below the ViewSwitcher).
  const weather = await getWeather();
  const uv = weather?.uvMax != null ? uvBand(weather.uvMax) : null;

  // Greeting only — the live clock/weather + clock-in live in the header control
  // cluster (built below) so the top row stays one tidy, anchored band.
  const heading = (
    <div>
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-stone-soft)]">Overview · {todayLabel}</p>
      <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl">{greeting}{session?.name ? `, ${session.name}` : ''}</h1>
    </div>
  );

  // BLD-226: one compact, right-aligned control cluster for every view —
  // [live clock + weather] · [clock-in pill] · (Viewing-as ▾ added by the shell).
  // Replaces the floaty stacked card so real content sits higher above the fold.
  const clock = session ? await (await import('@/lib/time-tracking')).timeStatus(session.sub).catch(() => null) : null;
  const clockWeather = (
    <>
      <div className="flex items-center gap-2.5 rounded-full border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3.5 py-1.5">
        <LiveClock className="font-[family-name:var(--font-display)] text-base font-medium tabular-nums leading-none text-[var(--color-ink)]" />
        {weather && (
          <div className="min-w-0 border-l border-[var(--color-line)] pl-2.5 leading-tight">
            <p className="text-xs font-medium text-[var(--color-ink)]">
              <span className="tabular-nums">{weather.tempC}°</span>
              <span className="ml-1 inline-block max-w-[7rem] truncate align-bottom font-normal text-[var(--color-stone)]">{weather.label}</span>
              {weather.uvMax != null && uv && (
                <span className="ml-1.5 text-[var(--color-stone-soft)]">· UV <span className={uv.tone === 'high' ? 'text-[#b23b3b]' : uv.tone === 'moderate' ? 'text-[var(--color-gold-deep)]' : 'text-[var(--color-jade)]'}>{weather.uvMax}</span></span>
              )}
            </p>
          </div>
        )}
      </div>
      {clock && (
        <ClockInOut
          compact
          onShift={clock.onShift}
          onBreak={clock.onBreak}
          shiftStartIso={clock.shiftStart ? clock.shiftStart.toISOString() : null}
          workedTodayMin={clock.workedTodayMin}
          breakTodayMin={clock.breakTodayMin}
        />
      )}
    </>
  );

  // Preview branch: an OWNER/ADMIN is viewing a role whose dashboard is still
  // being built — skip the heavy overview queries and show its planned widgets.
  if (renderedView !== 'admin') {
    const can = await sessionPermissions();
    const locale = await getLocale();
    return (
      <AdminShell user={session?.email} can={can} locale={locale}>
        <DashboardShell role={role} view={renderedView} heading={heading} aside={clockWeather}>
          {renderedView === 'clinician' && session ? <ClinicianView session={session} />
            : renderedView === 'reception' && session ? <ReceptionistView session={session} />
            : renderedView === 'developer' && session ? <DeveloperView session={session} />
            : renderedView === 'contractor' && session ? <ContractorView session={session} />
            : <ScaffoldView view={renderedView} />}
        </DashboardShell>
        {staffOnb && <OnboardingHost pending={staffOnb.pending} title={ONBOARDING.staff.title} intro={ONBOARDING.staff.intro} steps={ONBOARDING.staff.steps} initial={staffOnb.initial} endpoint={ONBOARDING.staff.endpoint} />}
      </AdminShell>
    );
  }

  const canApproveTimeOff = sessionCan(session, 'schedule.manage');
  const canInventory = sessionCan(session, 'inventory.view');
  const canFinance = sessionCan(session, 'finance.view');
  const canBookings = sessionCan(session, 'bookings.view');
  const canReviews = sessionCan(session, 'reviews.manage');
  const canBuild = sessionCan(session, 'build.view');
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(); dayEnd.setHours(23, 59, 59, 999);
  // Load the whole dashboard through a couple of quick retries, so a single
  // transient DB blip doesn't 500 the overview (it recomposes the queries each
  // attempt — safe, as these are all reads).
  const [o, a, pendingTimeOff, myTasks, stockItems, expiringSoon, ordersToFulfil, retailProducts, todaysBookings, reqConsent, reqPhoto, gReviewAgg, googleUnreplied, buildOpen, buildBlocked, buildUnsynced] = await withDbRetry(() => Promise.all([
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
    canReviews ? db.googleReview.aggregate({ _avg: { starRating: true }, _count: { _all: true } }) : Promise.resolve(null),
    canReviews ? db.googleReview.count({ where: { replyComment: null } }) : Promise.resolve(0),
    canBuild ? db.buildItem.count({ where: { status: { not: 'SHIPPED' } } }) : Promise.resolve(0),
    canBuild ? db.buildItem.count({ where: { status: 'BLOCKED' } }) : Promise.resolve(0),
    canBuild ? db.buildItem.count({ where: { githubUrl: null } }) : Promise.resolve(0),
  ]));
  const googleAvg = gReviewAgg?._avg.starRating ?? null;
  const googleCount = gReviewAgg?._count._all ?? 0;
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
    { show: canReviews && googleUnreplied > 0, label: 'Google reviews to reply to', value: googleUnreplied, href: '/admin/reviews', tone: 'amber' },
    { show: canBuild && buildBlocked > 0, label: 'Blocked build items', value: buildBlocked, href: '/admin/build', tone: 'amber' },
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
    ...(canReviews && googleCount > 0 && googleAvg != null
      ? [{ label: 'Google rating', value: `${googleAvg.toFixed(1)}★`, sub: `${googleCount} review${googleCount === 1 ? '' : 's'}`, href: '/admin/reviews' }]
      : []),
  ];

  const can = await sessionPermissions();
  const locale = await getLocale();

  // ── Front-of-house essentials: the next client arrival (clock/weather above) ──
  const treatments = bookableTreatments.map((t) => ({ slug: t.slug, title: t.title, group: t.group }));
  const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);
  const nextBk = canBookings
    ? await db.booking.findFirst({
        where: { startAt: { gte: now }, status: { in: ['CONFIRMED', 'PENDING'] } },
        orderBy: { startAt: 'asc' },
        select: {
          id: true, startAt: true, treatmentTitle: true, refreshments: true, clientId: true,
          client: { select: { firstName: true, lastName: true, allergies: true, medicalFlag: true } },
          practitioner: { select: { name: true } },
        },
      }).catch(() => null)
    : null;
  const canRoomsPrep = sessionCan(session, 'rooms.prep.manage');
  const nextRoom = nextBk ? await db.resource.findFirst({ where: { kind: 'ROOM', bookings: { some: { id: nextBk.id } } }, select: { id: true, name: true } }).catch(() => null) : null;
  // The next arrival's room prep state (for the live arrival-prep checklist).
  const { getRoomPrepFor, getRoomsForDay } = await import('@/lib/room-prep');
  const nextRoomPrep = nextRoom ? await getRoomPrepFor(nextRoom.id).catch(() => null) : null;
  const nextArrival: NextArrival | null = nextBk ? {
    id: nextBk.id,
    clientId: nextBk.clientId,
    clientName: [nextBk.client.firstName, nextBk.client.lastName].filter(Boolean).join(' ') || 'Client',
    treatment: nextBk.treatmentTitle,
    startIso: nextBk.startAt.toISOString(),
    timeLabel: fmtClinicTime(nextBk.startAt) + (nextBk.startAt <= endOfToday ? '' : ` · ${fmtClinicDate(nextBk.startAt)}`),
    practitioner: nextBk.practitioner?.name ?? null,
    room: nextRoom?.name ?? null,
    roomId: nextRoom?.id ?? null,
    roomPrep: nextRoomPrep?.status,
    canManageRoom: canRoomsPrep,
    drinks: nextBk.refreshments ?? [],
    allergies: decClinical(nextBk.client.allergies) ?? null,
    medicalFlag: decClinical(nextBk.client.medicalFlag) ?? null,
  } : null;
  // Rooms board (front-of-house / clinician): availability + prep for the day.
  const roomsToday = canRoomsPrep ? await getRoomsForDay().catch(() => []) : [];

  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <DashboardShell role={role} view={renderedView} heading={heading} aside={clockWeather}>

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

      {/* Up next · prepare for arrival + day actions — the front-of-house core */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.5fr_1fr] [&>*]:min-w-0">
        {nextArrival ? (
          <ArrivalPrep a={nextArrival} />
        ) : (
          <section className="flex flex-col items-start justify-center rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
            <p className="eyebrow text-[var(--color-stone)]">Up next</p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-xl">No upcoming appointments</p>
            <p className="mt-1 text-sm text-[var(--color-stone)]">Nothing booked ahead right now — enjoy the calm, or take a new booking.</p>
          </section>
        )}
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
          <p className="eyebrow mb-3 text-[var(--color-stone)]">Quick actions</p>
          {canBookings && <div className="mb-3"><NewBookingButton treatments={treatments} /></div>}
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: '/admin/calendar', label: 'Calendar', perm: 'calendar.view' },
              { href: '/admin/my-day', label: 'My day' },
              { href: '/admin/schedule', label: 'Lunch & breaks', perm: 'schedule.manage' },
              { href: '/admin/day-close', label: 'Day-close', perm: 'dayclose.run' },
            ]
              .filter((t) => !t.perm || sessionCan(session, t.perm))
              .map((t) => (
                <Link key={t.href} href={t.href} className="flex items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-line)] px-3 py-3 text-center text-sm text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-bone)] hover:text-[var(--color-ink)]">
                  {t.label}
                </Link>
              ))}
          </div>
        </section>
      </div>

      {/* Rooms today — live availability + prep handoff (front-of-house / clinician) */}
      {canRoomsPrep && roomsToday.length > 0 && (
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-display)] text-xl">Rooms today</h2>
            <span className="text-xs text-[var(--color-stone)]">Tap a room to set its readiness · updates live</span>
          </div>
          <RoomPrepStatus initialRooms={roomsToday} initialCanManage={canRoomsPrep} />
        </section>
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
              <p className="font-[family-name:var(--font-display)] text-3xl tabular-nums text-[var(--color-ink)]">{k.value}</p>
              {typeof k.trend === 'number' && (
                <span className={`text-xs font-medium tabular-nums ${k.trend >= 0 ? 'text-[var(--color-jade)]' : 'text-[var(--color-blush)]'}`}>
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

      {/* Build & issues — live status of the work board */}
      {canBuild && (
        <Link
          href="/admin/build"
          className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6 transition-shadow hover:shadow-[var(--shadow-soft)]"
        >
          <div className="flex-1 min-w-[12rem]">
            <p className="font-[family-name:var(--font-display)] text-xl">Build &amp; issues</p>
            <p className="mt-1 text-sm text-[var(--color-stone)]">The live work board — report a bug, track tasks, and sync to GitHub.</p>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--color-ink)]">{buildOpen}</p>
              <p className="text-xs text-[var(--color-stone)]">Open</p>
            </div>
            <div>
              <p className={`font-[family-name:var(--font-display)] text-2xl ${buildBlocked > 0 ? 'text-amber-700' : 'text-[var(--color-ink)]'}`}>{buildBlocked}</p>
              <p className="text-xs text-[var(--color-stone)]">Blocked</p>
            </div>
            <div>
              <p className={`font-[family-name:var(--font-display)] text-2xl ${buildUnsynced > 0 ? 'text-[var(--color-gold)]' : 'text-[var(--color-ink)]'}`}>{buildUnsynced}</p>
              <p className="text-xs text-[var(--color-stone)]">Not on GitHub</p>
            </div>
          </div>
          <span className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm text-[var(--color-ink)]">Open board →</span>
        </Link>
      )}

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
                  <p className="font-[family-name:var(--font-display)] text-2xl tabular-nums">{s.value}</p>
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
      </DashboardShell>
      {staffOnb && <OnboardingHost pending={staffOnb.pending} title={ONBOARDING.staff.title} intro={ONBOARDING.staff.intro} steps={ONBOARDING.staff.steps} initial={staffOnb.initial} endpoint={ONBOARDING.staff.endpoint} />}
    </AdminShell>
  );
}
