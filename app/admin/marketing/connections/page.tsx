import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { ConnectionsManager } from '@/components/admin/ConnectionsManager';
import { connectionStatuses } from '@/lib/marketing-connections';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function ConnectionsPage({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');
  const sp = await searchParams;

  const providers = await connectionStatuses();
  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Connections</h1>
      <p className="mt-1 max-w-3xl text-sm text-[var(--color-stone)]">
        Connect your ad, analytics and email platforms. Once a platform’s app credentials are in place, connecting is a
        single click — authorise and you’re done. Each card has a guided setup if it isn’t ready yet.
      </p>
      <div className="mt-8">
        <ConnectionsManager providers={providers} flash={{ connected: sp.connected, error: sp.error }} />
      </div>
    </AdminShell>
  );
}
