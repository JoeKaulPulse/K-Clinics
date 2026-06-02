import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { ChatManager } from '@/components/admin/ChatManager';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function AdminChatPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'clients.view')) redirect('/admin');

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Live chat</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">Reply to visitors chatting from the website. New messages appear here automatically.</p>
      <div className="mt-6">
        <ChatManager />
      </div>
    </AdminShell>
  );
}
