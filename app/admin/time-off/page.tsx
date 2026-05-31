import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { TimeOffManager } from '@/components/admin/TimeOffManager';
import { getLocale } from '@/lib/locale';
import { translator } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function TimeOffPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!session) redirect('/admin/login');
  const canApprove = sessionCan(session, 'schedule.manage');

  const { db } = await import('@/lib/db');
  const { getSetting } = await import('@/lib/settings');

  const mineRaw = await db.staffTimeOff.findMany({
    where: { staffId: session.sub, kind: { not: 'GCAL_BUSY' } },
    orderBy: { startAt: 'desc' },
    take: 50,
  });
  const mine = mineRaw.map((t) => ({
    id: t.id, kind: t.kind as string, status: t.status as string, startAt: t.startAt.toISOString(), endAt: t.endAt.toISOString(),
    allDay: t.allDay, reason: t.reason, reviewNote: t.reviewNote, reviewedBy: t.reviewedBy,
  }));

  let pending: { id: string; kind: string; status: string; startAt: string; endAt: string; allDay: boolean; reason: string | null; staffName: string }[] = [];
  let teamUpcoming: { id: string; staffName: string; kind: string; startAt: string; endAt: string; allDay: boolean }[] = [];
  if (canApprove) {
    const p = await db.staffTimeOff.findMany({
      where: { status: 'PENDING' },
      orderBy: { startAt: 'asc' },
      include: { staff: { select: { name: true, email: true } } },
    });
    pending = p.map((t) => ({
      id: t.id, kind: t.kind as string, status: t.status as string, startAt: t.startAt.toISOString(), endAt: t.endAt.toISOString(),
      allDay: t.allDay, reason: t.reason,
      staffName: t.staff?.name || t.staff?.email || 'Staff',
    }));

    const upcoming = await db.staffTimeOff.findMany({
      where: { status: 'APPROVED', endAt: { gte: new Date() } },
      orderBy: { startAt: 'asc' },
      take: 60,
      include: { staff: { select: { name: true, email: true } } },
    });
    teamUpcoming = upcoming.map((t) => ({
      id: t.id, staffName: t.staff?.name || t.staff?.email || 'Staff', kind: t.kind,
      startAt: t.startAt.toISOString(), endAt: t.endAt.toISOString(), allDay: t.allDay,
    }));
  }

  const requiresApproval = await getSetting('time_off_requires_approval');
  const can = await sessionPermissions();
  const locale = await getLocale();
  const t = translator(locale);

  return (
    <AdminShell user={session.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">{t('timeoff.title')}</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">
        {locale === 'uk'
          ? 'Бронюйте відпустку, лікарняний та особистий час. Запитаний час одразу блокує ваші робочі години, доки його не відхилять.'
          : `Book your holiday, sick leave and personal time. ${requiresApproval ? 'Requests need manager approval' : 'Requests are confirmed automatically'} — and immediately block your bookable hours until declined.`}
      </p>
      <div className="mt-8">
        <TimeOffManager mine={mine} pending={pending} teamUpcoming={teamUpcoming} canApprove={canApprove} requiresApproval={requiresApproval} />
      </div>
    </AdminShell>
  );
}
