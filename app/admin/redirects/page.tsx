import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { RedirectsManager, type RedirectRow } from '@/components/admin/RedirectsManager';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function RedirectsPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');

  const { db } = await import('@/lib/db');
  const rows = await db.redirect.findMany({ orderBy: { createdAt: 'desc' } });
  const data: RedirectRow[] = rows.map((r) => ({ id: r.id, fromPath: r.fromPath, toUrl: r.toUrl, code: r.code, active: r.active, note: r.note }));

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Redirects</h1>
      <p className="mt-1 max-w-3xl text-sm text-[var(--color-stone)]">
        Send old or retired URLs to the right page — preserves SEO from the previous site and keeps any printed/QR links
        working. Enter a path like <code>/old-treatment</code> and where it should go. Changes apply within a minute.
      </p>
      <div className="mt-8">
        <RedirectsManager rows={data} />
      </div>
    </AdminShell>
  );
}
