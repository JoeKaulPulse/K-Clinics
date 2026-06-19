import { redirect } from 'next/navigation';
import Link from 'next/link';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionPermissions, sessionCan } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { getLocale } from '@/lib/locale';
import { TaskAutomationsManager } from '@/components/admin/TaskAutomationsManager';

export const dynamic = 'force-dynamic';

export default async function TaskAutomationsPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!session) redirect('/admin/login');
  if (!sessionCan(session, 'tasks.automate')) redirect('/admin/tasks');
  const can = await sessionPermissions();
  const locale = await getLocale();

  return (
    <AdminShell user={session.email} can={can} locale={locale}>
      <Link
        href="/admin/tasks"
        className="text-sm text-[var(--color-stone)] hover:text-[var(--color-gold-deep)]"
      >
        ← Back to tasks
      </Link>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl">Task automations</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">
        Set up recurring work and repeat events for the team — created automatically on a schedule or when a task is completed.
      </p>
      <div className="mt-8">
        <TaskAutomationsManager />
      </div>
    </AdminShell>
  );
}
