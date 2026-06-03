import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionPermissions, sessionCan } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { SiteConfigEditor } from '@/components/admin/SiteConfigEditor';
import { getSiteConfig } from '@/lib/site-config';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function AdminSitePage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');

  const config = await getSiteConfig();
  let revisions: { id: string; label: string | null; createdAt: Date; createdBy: string | null }[] = [];
  try {
    const { db } = await import('@/lib/db');
    revisions = await db.siteConfigRevision.findMany({
      where: { configId: 'singleton' }, orderBy: { createdAt: 'desc' }, take: 15,
      select: { id: true, label: true, createdAt: true, createdBy: true },
    });
  } catch { /* table not migrated yet */ }

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <SiteConfigEditor initial={config} revisions={revisions.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))} />
    </AdminShell>
  );
}
