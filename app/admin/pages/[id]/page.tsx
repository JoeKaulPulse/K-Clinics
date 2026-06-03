import { redirect, notFound } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionPermissions, sessionCan } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { PageBuilder } from '@/components/admin/PageBuilder';
import { getPageForEdit, pageRevisions } from '@/lib/pages';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function EditPagePage({ params }: { params: Promise<{ id: string }> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');
  const { id } = await params;
  const page = await getPageForEdit(id);
  if (!page) notFound();
  const revisions = await pageRevisions(id);

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <PageBuilder initial={page} revisions={revisions} />
    </AdminShell>
  );
}
