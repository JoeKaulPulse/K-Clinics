import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { GalleryManager } from '@/components/admin/GalleryManager';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function AdminGalleryPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');

  const { db } = await import('@/lib/db');
  const rows = await db.galleryItem.findMany({
    orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    select: { id: true, category: true, treatmentSlug: true, caption: true, published: true, consent: true, updatedAt: true },
  });

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Before &amp; After gallery</h1>
      <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">
        Upload your own client before/after photos. A case only appears on the public website once you confirm the client’s consent <em>and</em> tick “Show on website”. Never upload photos you don’t own or have permission to publish.
      </p>
      <div className="mt-8">
        <GalleryManager
          items={rows.map((r) => ({
            id: r.id, category: r.category, treatmentSlug: r.treatmentSlug, caption: r.caption,
            published: r.published, consent: r.consent, v: r.updatedAt.getTime(),
          }))}
        />
      </div>
    </AdminShell>
  );
}
