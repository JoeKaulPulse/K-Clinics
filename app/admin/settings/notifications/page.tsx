import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { getLocale } from '@/lib/locale';
import { NotificationPreferences } from '@/components/admin/NotificationPreferences';

export const dynamic = 'force-dynamic';

export default async function NotificationSettingsPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!session) redirect('/admin/login');
  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Notifications</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">Choose what you’re notified about and how. These settings apply to your account only.</p>
      <NotificationPreferences />
    </AdminShell>
  );
}
