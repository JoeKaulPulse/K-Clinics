import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { BundlesManager, type AdminBundle } from '@/components/admin/BundlesManager';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

// BLD-532: staff author course bundles / learning pathways.
export default async function AdminAcademyBundlesPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');

  const { db } = await import('@/lib/db');
  const [bundleRows, courseRows] = await Promise.all([
    db.courseBundle.findMany({
      orderBy: { order: 'asc' },
      include: { items: { orderBy: { order: 'asc' }, include: { course: { select: { id: true, title: true } } } } },
    }),
    db.course.findMany({ orderBy: [{ order: 'asc' }], select: { id: true, title: true } }),
  ]);

  const bundles: AdminBundle[] = bundleRows.map((b) => ({
    id: b.id, title: b.title, slug: b.slug, summary: b.summary, description: b.description,
    heroImage: b.heroImage, pricePence: b.pricePence, active: b.active,
    items: b.items.map((i) => ({ id: i.id, courseId: i.courseId, courseTitle: i.course.title })),
  }));
  const courses = courseRows.map((c) => ({ id: c.id, title: c.title }));

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <Link href="/admin/academy" className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">← K Academy</Link>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">Bundles &amp; pathways</h1>
      <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">Group related courses into a pathway (e.g. “Foundation to Advanced”) so learners can see the full route in one place. Each active bundle with at least one published course appears on the public academy catalogue. Adding a course to a bundle never changes the course itself.</p>
      <div className="mt-8">
        <BundlesManager bundles={bundles} courses={courses} />
      </div>
    </AdminShell>
  );
}
