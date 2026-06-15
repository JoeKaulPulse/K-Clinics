import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { OnboardingHost } from '@/components/onboarding/OnboardingHost';
import { ONBOARDING } from '@/lib/onboarding-steps';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { getLocale } from '@/lib/locale';
import { translator } from '@/lib/i18n';
import { fmtClinicTime } from '@/lib/clinic-time';
import { ClockInOut } from '@/components/admin/ClockInOut';
import { getWeather, uvBand } from '@/lib/weather';
import { LiveClock } from '@/components/admin/DashboardLive';
import { DashboardShell } from '@/components/admin/dashboard/DashboardShell';
import { ClinicianView } from '@/components/admin/dashboard/ClinicianView';
import { ReceptionistView } from '@/components/admin/dashboard/ReceptionistView';
import { DeveloperMyDay, ContractorMyDay } from '@/components/admin/dashboard/MyDayFocus';
import { ScaffoldView } from '@/components/admin/dashboard/ScaffoldView';
import { resolveView, canSwitchViews, type DashboardView } from '@/lib/dashboard-views';

export const dynamic = 'force-dynamic';

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-[var(--color-ink)] text-[var(--color-porcelain)]',
  CANCELLED: 'bg-[var(--color-blush)]/20 text-[var(--color-ink)]',
  NO_SHOW: 'bg-[var(--color-blush)]/30 text-[var(--color-ink)]',
};

function dayBounds(d: Date) {
  const start = new Date(d); start.setHours(0, 0, 0, 0);
  const end = new Date(d); end.setHours(23, 59, 59, 999);
  return { start, end };
}
const iso = (d: Date) => d.toISOString().slice(0, 10);

// PRJ-63.13 — role-tailored My Day: the day-planner counterpart of the dashboards.
// Viewing today: renders the same role-specific view widgets as the dashboard
// (ClinicianView, ReceptionistView, DeveloperView, ContractorView) so each user
// sees their job-shaped content in a date-nav wrapper. Viewing other dates: shows
// a date-specific appointment timeline scoped by role. OWNER/ADMIN retain the
// view switcher. Time clock and personal stats always shown.
export default async function MyDayPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!session) redirect('/admin/login');
  const { d } = await searchParams;

  const day = d && !isNaN(Date.parse(d)) ? new Date(d + 'T12:00:00') : new Date();
  const { start, end } = dayBounds(day);
  const prev = new Date(day); prev.setDate(prev.getDate() - 1);
  const next = new Date(day); next.setDate(next.getDate() + 1);
  const isToday = iso(day) === iso(new Date());

  const role = session.role ?? 'STAFF';
  const { db } = await import('@/lib/db');
  const meProf = await db.adminUser.findUnique({
    where: { id: session.sub },
    select: { onboardedAt: true, name: true, title: true, credentials: true, photoUrl: true, publicPhone: true, preferredDashboardView: true },
  });
  const staffOnb = meProf ? {
    pending: !meProf.onboardedAt,
    initial: { name: meProf.name ?? '', title: meProf.title ?? '', credentials: meProf.credentials ?? '', photoUrl: meProf.photoUrl ?? '', publicPhone: meProf.publicPhone ?? '' },
  } : null;

  const view: DashboardView = resolveView(role, meProf?.preferredDashboardView);

  const weather = isToday ? await getWeather() : null;
  const uv = weather?.uvMax != null ? uvBand(weather.uvMax) : null;

  // Time tracking for the bottom panel (always own record).
  const { timeStatus, timesheet, fmtDuration } = await import('@/lib/time-tracking');
  const clock = await timeStatus(session.sub).catch(() => null);
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); weekStart.setHours(0, 0, 0, 0);
  const week = await timesheet(session.sub, weekStart, new Date()).catch(() => ({ days: [], totalWorkedMin: 0 }));

  const can = await sessionPermissions();
  const locale = await getLocale();
  const t = translator(locale);
  const uk = locale === 'uk';

  // Date-specific timeline (for non-today dates, or as fallback for roles
  // whose day-view content is the appointment list).
  const canViewAll = sessionCan(session, 'bookings.view');
  const selectBooking = {
    id: true, startAt: true, endAt: true, durationMin: true, treatmentTitle: true, status: true,
    startedAt: true, finishedAt: true, actualMinutes: true,
    client: { select: { id: true, firstName: true, lastName: true, medicalFlag: true } },
    practitioner: { select: { name: true } },
    location: { select: { name: true, color: true } },
  } as const;
  const [mine, clinic] = await Promise.all([
    db.booking.findMany({ where: { practitionerId: session.sub, startAt: { gte: start, lte: end }, status: { notIn: ['CANCELLED'] } }, orderBy: { startAt: 'asc' }, select: selectBooking }).catch(() => []),
    canViewAll ? db.booking.findMany({ where: { startAt: { gte: start, lte: end }, status: { notIn: ['CANCELLED'] } }, orderBy: { startAt: 'asc' }, select: selectBooking }).catch(() => []) : Promise.resolve([]),
  ]);

  const totalMin = mine.reduce((s, b) => s + b.durationMin, 0);
  const completed = mine.filter((b) => b.status === 'COMPLETED').length;
  const fmtTime = (x: Date) => fmtClinicTime(x);
  const clientName = (c: { firstName: string | null; lastName: string | null }) => [c.firstName, c.lastName].filter(Boolean).join(' ') || '—';

  const clockWeather = isToday ? (
    <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-4 py-2 text-sm">
      <LiveClock />
      {weather && (
        <div className="border-l border-[var(--color-line)] pl-3 leading-tight">
          <p className="font-medium text-[var(--color-ink)]"><span className="tabular-nums">{weather.tempC}°</span> <span className="font-normal text-[var(--color-stone)]">{weather.label}</span></p>
          {weather.uvMax != null && uv && (
            <p className="text-xs text-[var(--color-stone)]">UV <span className="tabular-nums">{weather.uvMax}</span> · <span className={uv.tone === 'high' ? 'text-[#b23b3b]' : uv.tone === 'moderate' ? 'text-[var(--color-gold-deep)]' : 'text-[var(--color-jade)]'}>{uv.label}</span></p>
          )}
        </div>
      )}
    </div>
  ) : null;

  const heading = (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">{t('nav.myday')}</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">
        {day.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        {isToday ? ` · ${uk ? 'сьогодні' : 'today'}` : ''}
      </p>
    </div>
  );

  const dateNav = (
    <div className="flex items-center gap-2">
      <Link href={`/admin/my-day?d=${iso(prev)}`} className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-sm transition-colors duration-150 hover:bg-[var(--color-bone)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]" aria-label="Previous day">←</Link>
      <Link href="/admin/my-day" className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-sm transition-colors duration-150 hover:bg-[var(--color-bone)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]">{uk ? 'Сьогодні' : 'Today'}</Link>
      <Link href={`/admin/my-day?d=${iso(next)}`} className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-sm transition-colors duration-150 hover:bg-[var(--color-bone)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]" aria-label="Next day">→</Link>
    </div>
  );

  // For other-date views: a date-specific timeline, same for all roles.
  const AppointmentRow = ({ b, showClinician }: { b: (typeof mine)[number]; showClinician?: boolean }) => (
    <Link href={`/admin/bookings/${b.id}`} className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-4 py-3 transition-colors hover:border-[var(--color-gold)] sm:gap-4">
      <div className="w-14 shrink-0 text-center sm:w-16">
        <div className="font-[family-name:var(--font-display)] text-base leading-none sm:text-lg">{fmtTime(b.startAt)}</div>
        <div className="mt-1 text-xs text-[var(--color-stone)]">{b.durationMin}m</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="truncate text-sm font-medium">{clientName(b.client)}</span>
          {b.client.medicalFlag && (
            <span className="shrink-0 rounded-full bg-[var(--color-blush)]/25 px-2 py-0.5 text-[0.6rem] font-medium text-[var(--color-ink)]">⚠ {uk ? 'мед.' : 'med'}</span>
          )}
        </div>
        <p className="truncate text-xs text-[var(--color-stone)]">{b.treatmentTitle}</p>
        {showClinician && b.practitioner?.name && (
          <p className="text-xs text-[var(--color-stone-soft)]">{b.practitioner.name}</p>
        )}
        {b.location?.name && (
          <p className="flex items-center gap-1 text-xs text-[var(--color-stone)]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: b.location.color || 'var(--color-gold)' }} />
            {b.location.name}
          </p>
        )}
      </div>
      <div className="shrink-0">
        <span className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide ${STATUS_BADGE[b.status] || 'bg-[var(--color-bone)]'}`}>
          {b.status.toLowerCase().replace('_', ' ')}
        </span>
        {b.startedAt && !b.finishedAt && <p className="mt-0.5 text-center text-[0.65rem] text-green-700">● {uk ? 'триває' : 'live'}</p>}
        {b.finishedAt && b.actualMinutes != null && <p className="mt-0.5 text-center text-[0.65rem] text-[var(--color-stone)]">{b.actualMinutes}m</p>}
      </div>
    </Link>
  );

  const dateTimeline = (
    <>
      {/* Personal stats for selected day */}
      <div className="mt-4 grid grid-cols-3 gap-2 sm:max-w-sm sm:gap-3">
        {[
          { label: uk ? 'Записи' : 'Appts', value: mine.length },
          { label: uk ? 'Заброньовано' : 'Booked', value: `${Math.floor(totalMin / 60)}h ${totalMin % 60}m` },
          { label: uk ? 'Завершено' : 'Done', value: completed },
        ].map((s) => (
          <div key={s.label} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-3 sm:p-4">
            <div className="font-[family-name:var(--font-display)] text-xl sm:text-2xl">{s.value}</div>
            <div className="mt-0.5 text-xs text-[var(--color-stone)]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* My appointments for the selected day */}
      <section className="mt-6">
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">{uk ? 'Мої записи' : 'My appointments'}</h2>
        <div className="space-y-2">
          {mine.length === 0 && <p className="text-sm text-[var(--color-stone)]">{uk ? 'Жодних записів на цей день.' : 'No appointments assigned to you on this day.'}</p>}
          {mine.map((b) => <AppointmentRow key={b.id} b={b} />)}
        </div>
      </section>

      {/* Full clinic view (managers / front desk) */}
      {canViewAll && (
        <section className="mt-8">
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">{uk ? 'Уся клініка' : 'Whole clinic'}</h2>
          <div className="space-y-2">
            {clinic.length === 0 && <p className="text-sm text-[var(--color-stone)]">{uk ? 'Немає записів.' : 'No appointments.'}</p>}
            {clinic.map((b) => <AppointmentRow key={b.id} b={b} showClinician />)}
          </div>
        </section>
      )}
    </>
  );

  // Time clock panel — below the main content, always shown.
  const timeClock = clock ? (
    <div className="mt-8 grid gap-3 sm:max-w-sm sm:grid-cols-[1fr_auto] sm:items-stretch">
      <ClockInOut
        onShift={clock.onShift}
        onBreak={clock.onBreak}
        shiftStartIso={clock.shiftStart ? clock.shiftStart.toISOString() : null}
        workedTodayMin={clock.workedTodayMin}
        breakTodayMin={clock.breakTodayMin}
      />
      <div className="flex flex-col justify-center rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4 text-center">
        <div className="font-[family-name:var(--font-display)] text-2xl">{fmtDuration(week.totalWorkedMin)}</div>
        <div className="mt-1 text-xs text-[var(--color-stone)]">{uk ? 'Цього тижня' : 'This week'}</div>
      </div>
    </div>
  ) : null;

  // All built views.
  const BUILT_VIEWS: DashboardView[] = ['admin', 'clinician', 'reception', 'developer', 'contractor'];
  const renderedView: DashboardView = BUILT_VIEWS.includes(view) ? view : 'admin';
  // Developer & contractor days aren't appointment-shaped — their My Day is their
  // own work (assigned items / jobs), the same whatever the date picker says, so
  // they skip the date-nav + appointment timeline entirely (PRJ-63.12).
  const isWorkRole = renderedView === 'developer' || renderedView === 'contractor';

  return (
    <AdminShell user={session.email} can={can} locale={locale}>
      {/* Date navigation bar — always visible */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-[family-name:var(--font-display)] text-3xl">{t('nav.myday')}</h1>
          <p className="mt-1 text-sm text-[var(--color-stone)]">
            {day.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {isToday ? ` · ${uk ? 'сьогодні' : 'today'}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isToday && clockWeather}
          {!isWorkRole && dateNav}
        </div>
      </div>

      {isWorkRole ? (
        // Developer / contractor: their own work for the day (not appointment-shaped).
        renderedView === 'developer' ? <DeveloperMyDay session={session} /> : <ContractorMyDay session={session} />
      ) : isToday ? (
        // Today: show the full role-specific view (same as dashboard) via DashboardShell.
        <DashboardShell role={role} view={renderedView} heading={<></>} aside={undefined}>
          {renderedView === 'clinician' ? <ClinicianView session={session} />
            : renderedView === 'reception' ? <ReceptionistView session={session} />
            : (
              // Admin / Owner: show personal appointments as the day-planner and
              // let the dashboard handle the full management overview.
              <>
                {dateTimeline}
                <p className="mt-6 text-sm text-[var(--color-stone)]">
                  <Link href="/admin" className="font-medium text-[var(--color-gold)] hover:underline">{uk ? 'Відкрити дашборд →' : 'Open management dashboard →'}</Link>
                </p>
              </>
            )}
        </DashboardShell>
      ) : (
        // Other dates: role-scoped appointment timeline (no live room/arrivals data).
        dateTimeline
      )}

      {/* Time clock + week total — always below the main content */}
      {timeClock}

      {staffOnb && <OnboardingHost pending={staffOnb.pending} title={ONBOARDING.staff.title} intro={ONBOARDING.staff.intro} steps={ONBOARDING.staff.steps} initial={staffOnb.initial} endpoint={ONBOARDING.staff.endpoint} />}
    </AdminShell>
  );
}
