import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { StudentsManager } from '@/components/admin/StudentsManager';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function AdminAcademyStudentsPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');

  const { db } = await import('@/lib/db');
  const students = await db.academyStudent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
    include: {
      enrolments: { select: { status: true, course: { select: { title: true } } }, orderBy: { createdAt: 'desc' } },
      _count: { select: { lessonProgress: true, quizAttempts: true } },
    },
  });

  const view = students.map((s) => ({
    id: s.id, firstName: s.firstName, lastName: s.lastName, email: s.email, phone: s.phone,
    createdAt: s.createdAt.toISOString(), lastLoginAt: s.lastLoginAt?.toISOString() ?? null,
    portalActive: s.portalActive, onboardedAt: s.onboardedAt?.toISOString() ?? null, notes: s.notes,
    lessonsCompleted: s._count.lessonProgress, quizAttempts: s._count.quizAttempts,
    enrolments: s.enrolments.map((e) => ({ courseTitle: e.course.title, status: e.status })),
  }));

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <Link href="/admin/academy" className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">← K Academy</Link>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">Trainees</h1>
      <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">Everyone with a trainee portal account. See their enrolments and progress, add internal notes, and suspend or reactivate access.</p>
      <div className="mt-8">
        <StudentsManager students={view} />
      </div>
    </AdminShell>
  );
}
