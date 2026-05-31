import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { LocationsManager } from '@/components/admin/LocationsManager';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function LocationsPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');

  // Seed the existing clinic as the primary location on first visit.
  const { ensurePrimaryLocation, listLocations } = await import('@/lib/locations');
  await ensurePrimaryLocation();
  const locationsRaw = await listLocations(false);

  const { db } = await import('@/lib/db');
  const counts = await db.adminUser.findMany({
    where: { active: true, locations: { some: {} } },
    select: { id: true, locations: { select: { id: true } } },
  });
  const staffPerLocation: Record<string, number> = {};
  for (const s of counts) for (const l of s.locations) staffPerLocation[l.id] = (staffPerLocation[l.id] || 0) + 1;

  const locations = locationsRaw.map((l) => ({
    id: l.id, name: l.name, slug: l.slug, addressLine: l.addressLine, city: l.city, postcode: l.postcode,
    phone: l.phone, email: l.email, color: l.color, active: l.active, isPrimary: l.isPrimary,
    staffCount: staffPerLocation[l.id] || 0,
  }));

  const can = await sessionPermissions();
  const locale = await getLocale();
  const uk = locale === 'uk';

  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">{uk ? 'Локації' : 'Locations'}</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">
        {uk
          ? 'Керуйте клініками. Призначайте клініцистів у розкладі — клініцист працює в одній локації на день.'
          : 'Manage your clinic sites. Assign clinicians to locations in their schedule — each clinician works at one location per day.'}
      </p>
      <div className="mt-8">
        <LocationsManager locations={locations} uk={uk} />
      </div>
    </AdminShell>
  );
}
