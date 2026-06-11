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
import { getWeather, uvBand } from '@/lib/weather';
import { LiveClock } from '@/components/admin/DashboardLive';

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

  const canViewAll = sessionCan(session, 'bookings.view');
  const { db } = await import('@/lib/db');
  const meProf = await db.adminUser.findUnique({ where: { id: session.sub }, select: { onboardedAt: true, name: true, title: true, credentials: true, photoUrl: true, publicPhone: true } });
  const staffOnb = meProf ? { pending: !meProf.onboardedAt, initial: { name: meProf.name ?? '', title: meProf.title ?? '', credentials: meProf.credentials ?? '', photoUrl: meProf.photoUrl ?? '', publicPhone: meProf.publicPhone ?? '' } } : null;

  const selectBooking = {
    id: true, startAt: true, endAt: true, durationMin: true, treatmentTitle: true, treatmentSlug: true, status: true,
    startedAt: true, finishedAt: true, actualMinutes: true,
    sopAcknowledgedAt: true, medicalFlagReviewedAt: true, practitionerId: true,
    client: { select: { id: true, firstName: true, lastName: true, phone: true, medicalFlag: true } },
    practitioner: { select: { name: true } },
    location: { select: { name: true, color: true } },
  } as const;

  const mine = await db.booking.findMany({
    where: { practitionerId: session.sub, startAt: { gte: start, lte: end }, status: { notIn: ['CANCELLED'] } },
    orderBy: { startAt: 'asc' },
    select: selectBooking,
  });

  const clinic = canViewAll
    ? await db.booking.findMany({
        where: { startAt: { gte: start, lte: end }, status: { notIn: ['CANCELLED'] } },
        orderBy: { startAt: 'asc' },
        select: selectBooking,
      })
    : [];

  // Per-appointment readiness alerts (consent / laser before-photo outstanding).
  const allBk = [...mine, ...clinic];
  const ids = [...new Set(allBk.map((b) => b.id))];
  const { getSetting } = await import('@/lib/settings');
  const { isLaserTreatment } = await import('@/lib/consent');
  const [signedRows, photoRows, reqConsent, reqPhoto, reqSop, reqMedical] = await Promise.all([
    ids.length ? db.signedConsent.findMany({ where: { bookingId: { in: ids } }, select: { bookingId: true, kind: true } }) : [],
    ids.length ? db.beforePhoto.findMany({ where: { bookingId: { in: ids } }, select: { bookingId: true } }) : [],
    getSetting('require_consent'), getSetting('require_before_photo'), getSetting('require_sop_ack'), getSetting('require_medical_review'),
  ]);
  const consentTreat = new Set(signedRows.filter((s) => s.kind === 'treatment').map((s) => s.bookingId));
  const photoOrOpt = new Set([...photoRows.map((p) => p.bookingId), ...signedRows.filter((s) => s.kind === 'photo_opt_out').map((s) => s.bookingId)]);
  // Mirrors the startAppointment gate so the day view can't show a false "all clear".
  const alertsFor = (b: { id: string; treatmentSlug: string; status: string; sopAcknowledgedAt: Date | null; medicalFlagReviewedAt: Date | null; client: { medicalFlag: string | null } }) => {
    if (b.status === 'COMPLETED') return [] as string[];
    const a: string[] = [];
    if (reqMedical && b.client.medicalFlag && !b.medicalFlagReviewedAt) a.push('Med review');
    if (reqSop && !b.sopAcknowledgedAt) a.push('SOP');
    if (reqConsent && !consentTreat.has(b.id)) a.push('Consent');
    if (isLaserTreatment(b.treatmentSlug) && reqPhoto && !photoOrOpt.has(b.id)) a.push('Photo');
    return a;
  };

  const can = await sessionPermissions();
  const locale = await getLocale();
  const t = translator(locale);
  const uk = locale === 'uk';

  const weather = await getWeather();
  const uv = weather?.uvMax != null ? uvBand(weather.uvMax) : null;

  const totalMin = mine.reduce((s, b) => s + b.durationMin, 0);
  const completed = mine.filter((b) => b.status === 'COMPLETED').length;

  const fmtTime = (x: Date) => new Date(x).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
  const name = (c: { firstName: string | null; lastName: string | null }) => [c.firstName, c.lastName].filter(Boolean).join(' ') || '—';

  const Row = ({ b, showClinician }: { b: (typeof mine)[number]; showClinician?: boolean }) => (
    <Link href={`/admin/bookings/${b.id}`} className="flex items-center gap-4 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4 transition-colors hover:border-[var(--color-gold)]">
      <div className="w-16 shrink-0 text-center">
        <div className="font-[family-name:var(--font-display)] text-lg leading-none">{fmtTime(b.startAt)}</div>
        <div className="mt-1 text-xs text-[var(--color-stone-soft)]">{b.durationMin}m</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{name(b.client)}</span>
          {b.client.medicalFlag && (
            <span title="Medical flag — review before treating" className="shrink-0 rounded-full bg-[var(--color-blush)]/25 px-2 py-0.5 text-[0.6rem] font-medium text-[var(--color-ink)]">⚠ {uk ? 'мед. флаг' : 'medical'}</span>
          )}
          {alertsFor(b).map((a) => (
            <span key={a} title={`${a} outstanding before treatment`} className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[0.6rem] font-medium text-amber-800">{a}</span>
          ))}
        </div>
        <p className="truncate text-sm text-[var(--color-stone)]">{b.treatmentTitle}</p>
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-[var(--color-stone-soft)]">
          {showClinician && b.practitioner?.name && <span>{b.practitioner.name}</span>}
          {b.location?.name && <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: b.location.color || 'var(--color-gold)' }} />{b.location.name}</span>}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide ${STATUS_BADGE[b.status] || 'bg-[var(--color-bone)]'}`}>{b.status.toLowerCase().replace('_', ' ')}</span>
        {b.startedAt && !b.finishedAt && <span className="text-[0.65rem] text-green-700">● {uk ? 'триває' : 'in progress'}</span>}
        {b.finishedAt && b.actualMinutes != null && <span className="text-[0.65rem] text-[var(--color-stone-soft)]">{b.actualMinutes}m {uk ? 'факт' : 'actual'}</span>}
      </div>
    </Link>
  );

  return (
    <AdminShell user={session.email} can={can} locale={locale}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">{t('nav.myday')}</h1>
          <p className="mt-1 text-sm text-[var(--color-stone)]">
            {day.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}{isToday ? ` · ${uk ? 'сьогодні' : 'today'}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isToday && (
            <div className="flex items-center gap-4 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-4 py-2.5">
              <LiveClock />
              {weather && (
                <div className="border-l border-[var(--color-line)] pl-4 leading-tight">
                  <p className="text-sm font-medium text-[var(--color-ink)]"><span className="tabular-nums">{weather.tempC}°</span> <span className="font-normal text-[var(--color-stone)]">{weather.label}</span></p>
                  {weather.uvMax != null && uv && (
                    <p className="text-xs text-[var(--color-stone)]">UV <span className="tabular-nums">{weather.uvMax}</span> · <span className={uv.tone === 'high' ? 'text-[#b23b3b]' : uv.tone === 'moderate' ? 'text-[var(--color-gold-deep)]' : 'text-[var(--color-jade)]'}>{uv.label}</span></p>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Link href={`/admin/my-day?d=${iso(prev)}`} className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-sm hover:bg-[var(--color-bone)]">←</Link>
            <Link href="/admin/my-day" className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-sm hover:bg-[var(--color-bone)]">{uk ? 'Сьогодні' : 'Today'}</Link>
            <Link href={`/admin/my-day?d=${iso(next)}`} className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-sm hover:bg-[var(--color-bone)]">→</Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-3 gap-3 sm:max-w-md">
        {[
          { label: uk ? 'Записи' : 'Appointments', value: mine.length },
          { label: uk ? 'Заброньовано' : 'Booked', value: `${Math.floor(totalMin / 60)}h ${totalMin % 60}m` },
          { label: uk ? 'Завершено' : 'Completed', value: completed },
        ].map((s) => (
          <div key={s.label} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
            <div className="font-[family-name:var(--font-display)] text-2xl">{s.value}</div>
            <div className="mt-1 text-xs text-[var(--color-stone)]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* My appointments */}
      <section className="mt-8">
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">{uk ? 'Мої записи' : 'My appointments'}</h2>
        <div className="space-y-2">
          {mine.length === 0 && <p className="text-sm text-[var(--color-stone)]">{uk ? 'На цей день вам не призначено записів.' : 'No appointments assigned to you on this day.'}</p>}
          {mine.map((b) => <Row key={b.id} b={b} />)}
        </div>
      </section>

      {/* Whole clinic (managers / front desk) */}
      {canViewAll && (
        <section className="mt-10">
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">{uk ? 'Уся клініка — цей день' : 'Whole clinic — this day'}</h2>
          <div className="space-y-2">
            {clinic.length === 0 && <p className="text-sm text-[var(--color-stone)]">{uk ? 'Немає записів.' : 'No appointments.'}</p>}
            {clinic.map((b) => <Row key={b.id} b={b} showClinician />)}
          </div>
        </section>
      )}
      {staffOnb && <OnboardingHost pending={staffOnb.pending} title={ONBOARDING.staff.title} intro={ONBOARDING.staff.intro} steps={ONBOARDING.staff.steps} initial={staffOnb.initial} endpoint={ONBOARDING.staff.endpoint} />}
    </AdminShell>
  );
}
