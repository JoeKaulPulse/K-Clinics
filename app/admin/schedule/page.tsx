import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { ScheduleManager } from '@/components/admin/ScheduleManager';
import { bookableTreatments } from '@/lib/treatments';

export const dynamic = 'force-dynamic';

export default async function SchedulePage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'schedule.manage')) redirect('/admin');

  const { db } = await import('@/lib/db');
  const rows = await db.adminUser.findMany({
    where: { active: true },
    orderBy: [{ isClinician: 'desc' }, { name: 'asc' }],
    include: {
      schedules: { select: { dayOfWeek: true, startMin: true, endMin: true } },
      timeOff: { orderBy: { startAt: 'asc' }, select: { id: true, kind: true, startAt: true, endAt: true, reason: true } },
    },
  });
  const staff = rows.map((s) => ({
    id: s.id, name: s.name, email: s.email, isClinician: s.isClinician, color: s.color, title: s.title,
    competencies: s.competencies,
    schedules: s.schedules,
    timeOff: s.timeOff.map((t) => ({ id: t.id, kind: t.kind, startAt: t.startAt.toISOString(), endAt: t.endAt.toISOString(), reason: t.reason })),
  }));

  const can = await sessionPermissions();
  return (
    <AdminShell user={session?.email} can={can}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Schedules &amp; availability</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">Set who’s a bookable clinician, their weekly hours, competencies and time off.</p>
      <div className="mt-8">
        <ScheduleManager staff={staff} treatments={bookableTreatments.map((t) => ({ slug: t.slug, title: t.title }))} />
      </div>
    </AdminShell>
  );
}
