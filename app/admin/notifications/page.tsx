import { redirect } from 'next/navigation';
import Link from 'next/link';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { getLocale } from '@/lib/locale';
import { NotificationsList } from '@/components/admin/NotificationsList';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!session) redirect('/admin/login');
  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session.email} can={can} locale={locale}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">Notifications</h1>
          <p className="mt-1 text-sm text-[var(--color-stone)]">Everything that needed you, grouped by category.</p>
        </div>
        <Link href="/admin/settings/notifications" className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm text-[var(--color-ink)] hover:bg-[var(--color-bone)]">Preferences</Link>
      </div>
      <NotificationsList />
    </AdminShell>
  );
}
