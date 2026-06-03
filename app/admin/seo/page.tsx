import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { SeoDashboard } from '@/components/admin/SeoDashboard';
import { TrackingSettings } from '@/components/admin/TrackingSettings';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function SeoPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');

  const { auditSite } = await import('@/lib/seo-audit');
  const { getTrackingConfig } = await import('@/lib/tracking');
  const [audit, tracking] = await Promise.all([auditSite(), getTrackingConfig()]);

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">SEO &amp; AI search</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">
        Per-page ratings across on-page, technical, AI-answer (GEO) and local search, with an overall site health score.
        Edit any page’s SEO and get AI-written suggestions.
      </p>
      <div className="mt-8 space-y-8">
        <TrackingSettings initial={tracking} />
        <SeoDashboard audit={audit} />
      </div>
    </AdminShell>
  );
}
