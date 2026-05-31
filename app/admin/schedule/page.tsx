import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { ScheduleManager } from '@/components/admin/ScheduleManager';
import { bookableTreatments } from '@/lib/treatments';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ gcal?: string }> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'schedule.manage')) redirect('/admin');
  const { gcal } = await searchParams;

  const { db } = await import('@/lib/db');
  const { ensurePrimaryLocation, listLocations } = await import('@/lib/locations');
  await ensurePrimaryLocation();
  const locationsRaw = await listLocations(true);
  const locations = locationsRaw.map((l) => ({ id: l.id, name: l.name, color: l.color }));

  const rows = await db.adminUser.findMany({
    where: { active: true },
    orderBy: [{ isClinician: 'desc' }, { name: 'asc' }],
    include: {
      schedules: { select: { dayOfWeek: true, startMin: true, endMin: true, locationId: true } },
      timeOff: { orderBy: { startAt: 'asc' }, select: { id: true, kind: true, startAt: true, endAt: true, reason: true } },
      locations: { select: { id: true } },
    },
  });
  const staff = rows.map((s) => ({
    id: s.id, name: s.name, email: s.email, isClinician: s.isClinician, color: s.color, title: s.title,
    competencies: s.competencies,
    googleConnected: Boolean(s.googleRefreshToken),
    locationIds: s.locations.map((l) => l.id),
    schedules: s.schedules,
    timeOff: s.timeOff.map((t) => ({ id: t.id, kind: t.kind, startAt: t.startAt.toISOString(), endAt: t.endAt.toISOString(), reason: t.reason })),
  }));

  const { getSetting } = await import('@/lib/settings');
  const multiLocation = (await getSetting('multi_location_enabled')) || locations.length > 1;

  const { googleConfigured } = await import('@/lib/google-calendar');
  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Schedules &amp; availability</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">Set who’s a bookable clinician, their weekly hours, competencies, time off and Google Calendar sync.</p>
      {gcal === 'connected' && <p className="mt-4 rounded-[var(--radius-sm)] border border-green-600/30 bg-green-50 px-4 py-3 text-sm text-green-800">Google Calendar connected — busy times will now block bookable slots.</p>}
      {gcal === 'error' && <p className="mt-4 rounded-[var(--radius-sm)] border border-[var(--color-blush)]/40 bg-[var(--color-blush)]/10 px-4 py-3 text-sm text-[var(--color-ink)]">Couldn’t complete the Google Calendar connection. Please try again.</p>}
      <div className="mt-8">
        <ScheduleManager staff={staff} treatments={bookableTreatments.map((t) => ({ slug: t.slug, title: t.title }))} googleConfigured={googleConfigured()} locations={locations} multiLocation={multiLocation} />
      </div>
    </AdminShell>
  );
}
