import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionPermissions, sessionCan } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { BlocksList } from '@/components/admin/BlocksList';
import { listGlobalSections } from '@/lib/global-sections';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function AdminBlocksPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');
  const blocks = (await listGlobalSections()).map((b) => ({ ...b, updatedAt: b.updatedAt.toISOString() }));
  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <BlocksList blocks={blocks} />
    </AdminShell>
  );
}
