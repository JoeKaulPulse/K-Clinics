import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { ConsentTemplatesManager, type TemplateRow } from '@/components/admin/ConsentTemplatesManager';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function ConsentPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');

  const { ensureDefaultTemplates } = await import('@/lib/consent');
  await ensureDefaultTemplates();
  const { db } = await import('@/lib/db');
  const templates = await db.consentTemplate.findMany({ orderBy: { category: 'asc' } });
  const rows: TemplateRow[] = templates.map((t) => ({ key: t.key, title: t.title, category: t.category, version: t.version, bodyMd: t.bodyMd, acknowledgements: t.acknowledgements, active: t.active }));

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Consent forms</h1>
      <p className="mt-1 max-w-3xl text-sm text-[var(--color-stone)]">
        The wording clients read and e-sign before treatment. Edit each form and tick statements; every change creates a
        new version, and the exact version a client signs is recorded immutably with a timestamp, signature and certificate.
        <strong> Review the wording with your clinical lead and insurer before going live.</strong>
      </p>
      <div className="mt-8">
        <ConsentTemplatesManager rows={rows} />
      </div>
    </AdminShell>
  );
}
