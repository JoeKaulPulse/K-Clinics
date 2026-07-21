import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { MessagesPage } from '@/components/admin/teamchat/MessagesPage';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function TeamMessagesPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!session) redirect('/admin/login');
  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session.email} can={can} locale={locale}>
      <MessagesPage />
    </AdminShell>
  );
}
