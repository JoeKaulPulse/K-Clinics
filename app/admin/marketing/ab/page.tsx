import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { AbManager, type AbTestRow } from '@/components/admin/AbManager';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function AbPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'campaigns.view')) redirect('/admin');

  const { db } = await import('@/lib/db');
  const tests = await db.abTest.findMany({ orderBy: { createdAt: 'desc' }, include: { variants: { orderBy: { key: 'asc' } } } });
  const rows: AbTestRow[] = tests.map((t) => ({
    id: t.id, name: t.name, slug: t.slug, status: t.status,
    variants: t.variants.map((v) => ({ id: v.id, key: v.key, label: v.label, weight: v.weight, headline: v.headline ?? '', subhead: v.subhead ?? '', ctaLabel: v.ctaLabel ?? '', ctaHref: v.ctaHref ?? '', exposures: v.exposures, conversions: v.conversions })),
  }));

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">A/B testing</h1>
      <p className="mt-1 max-w-3xl text-sm text-[var(--color-stone)]">
        Split-test landing-page headlines &amp; CTAs. Create a test, set the variants, then add an
        “A/B test hero” section to a page and enter the test code. Conversions are CTA clicks.
      </p>
      <div className="mt-8">
        <AbManager rows={rows} canManage={sessionCan(session, 'campaigns.send') || sessionCan(session, 'settings.manage')} />
      </div>
    </AdminShell>
  );
}
