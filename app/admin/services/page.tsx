import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { ServicesManager } from '@/components/admin/ServicesManager';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function ServicesPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');

  const { listServices, liveOffers } = await import('@/lib/services');
  const { treatments } = await import('@/lib/treatments');
  const [services, offers] = await Promise.all([listServices(true), liveOffers(false)]);
  const treatmentOptions = treatments.map((t) => ({ slug: t.slug, title: t.title, category: t.category }));

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Services &amp; pricing</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">
        Manage every service and variant — retail price, cost of goods, duration and courses. Track margin, change prices
        in bulk by a percentage, and run special offers that promote on the site and in client portals.
      </p>
      <div className="mt-8">
        <ServicesManager
          services={services.map((s) => ({ id: s.id, slug: s.slug, name: s.name, category: s.category, active: s.active, variants: s.variants }))}
          offers={offers.map((o) => ({ ...o, startAt: o.startAt?.toISOString() ?? null, endAt: o.endAt?.toISOString() ?? null }))}
          treatments={treatmentOptions}
        />
      </div>
    </AdminShell>
  );
}
