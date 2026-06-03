import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionPermissions, sessionCan } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { PagesList } from '@/components/admin/PagesList';
import { listPages } from '@/lib/pages';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function AdminPagesPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');
  const pages = (await listPages()).map((p) => ({ ...p, updatedAt: p.updatedAt.toISOString() }));
  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <PagesList pages={pages} />
    </AdminShell>
  );
}
