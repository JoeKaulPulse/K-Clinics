import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { getLocale } from '@/lib/locale';
import { translator } from '@/lib/i18n';
import { getWorkspaceOverview } from '@/lib/google-workspace';
import { WorkspaceManager } from '@/components/admin/WorkspaceManager';

export const dynamic = 'force-dynamic';

// Google Workspace directory view (BLD-312, Phase A — read-only). Creating and
// suspending users / managing aliases & groups arrives in Phase B; this page
// proves the service-account connection and surfaces the live directory + seat
// usage for the cost audit.
export default async function WorkspacePage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');

  const overview = await getWorkspaceOverview();
  const can = await sessionPermissions();
  const locale = await getLocale();
  const t = translator(locale);

  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">{t('nav.workspace')}</h1>
      <WorkspaceManager overview={overview} />
    </AdminShell>
  );
}
