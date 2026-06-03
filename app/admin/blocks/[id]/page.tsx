import { redirect, notFound } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionPermissions, sessionCan } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { GlobalSectionEditor } from '@/components/admin/GlobalSectionEditor';
import { getGlobalSection } from '@/lib/global-sections';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function EditBlockPage({ params }: { params: Promise<{ id: string }> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');
  const { id } = await params;
  const block = await getGlobalSection(id);
  if (!block) notFound();
  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <GlobalSectionEditor block={{ id: block.id, name: block.name, type: block.type, data: (block.data as Record<string, unknown>) || {} }} />
    </AdminShell>
  );
}
