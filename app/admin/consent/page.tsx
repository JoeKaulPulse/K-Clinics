import Link from 'next/link';
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
  const { bookableTreatments } = await import('@/lib/treatments');
  const templates = await db.consentTemplate.findMany({ orderBy: { category: 'asc' } });
  const rows: TemplateRow[] = templates.map((t) => ({ key: t.key, title: t.title, category: t.category, version: t.version, bodyMd: t.bodyMd, acknowledgements: t.acknowledgements ?? [], active: t.active, serviceSlugs: t.serviceSlugs ?? [], serviceGroups: t.serviceGroups ?? [] }));

  // Services + their marketing groups, for the assignment pickers.
  const services = bookableTreatments.map((t) => ({ slug: t.slug, title: t.title, group: t.group })).sort((a, b) => a.group.localeCompare(b.group) || a.title.localeCompare(b.title));
  const groups = Array.from(new Set(services.map((s) => s.group))).sort();

  // BLD-193: surface the health (medical history) form alongside consent forms.
  const healthCount = await db.healthAssessment.count({ where: { type: 'MEDICAL_HISTORY' } }).catch(() => 0);

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

      {/* Health (medical history) form — managed separately, surfaced here. */}
      <Link href="/admin/health-forms" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] px-5 py-4 transition-colors hover:border-[var(--color-gold)]">
        <span className="text-sm">
          <strong>Health form (medical history)</strong> — the confidential pre-treatment questionnaire clients complete in their portal.
          <span className="block text-xs text-[var(--color-stone)]">Manage its questions and add your own. {healthCount} submitted to date · every completed form is retained and viewable on the client’s record.</span>
        </span>
        <span className="shrink-0 rounded-full bg-[var(--color-ink)] px-4 py-2 text-xs font-medium text-[var(--color-porcelain)]">Manage health forms →</span>
      </Link>

      <div className="mt-8">
        <ConsentTemplatesManager rows={rows} services={services} groups={groups} />
      </div>
    </AdminShell>
  );
}
