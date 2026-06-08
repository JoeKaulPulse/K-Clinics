import { redirect } from 'next/navigation';
import Link from 'next/link';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { getLocale } from '@/lib/locale';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { DayClosePanel } from '@/components/admin/DayClosePanel';

export const dynamic = 'force-dynamic';

export default async function DayClosePage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'dayclose.run')) redirect('/admin');

  const can = await sessionPermissions();
  const locale = await getLocale();
  const canManage = sessionCan(session, 'dayclose.manage');

  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">Day close</h1>
          <p className="mt-1 text-sm text-[var(--color-stone)]">End-of-day reconciliation, stock take and full clinic shutdown.</p>
        </div>
        {canManage && (
          <Link href="/admin/day-close/reports" className="shrink-0 rounded-full border border-[var(--color-line)] px-4 py-2 text-sm hover:bg-[var(--color-bone)]">
            Reports &amp; settings
          </Link>
        )}
      </div>
      <div className="mt-8">
        <DayClosePanel />
      </div>
    </AdminShell>
  );
}
