import 'server-only';
import { db } from '@/lib/db';
import { site } from '@/lib/site';

// Multi-location helpers. The clinic begins single-site: the first time we need
// locations we seed a primary location from the site config so existing data
// (schedules, bookings) can be associated without manual setup.

export async function ensurePrimaryLocation() {
  const count = await db.location.count();
  if (count > 0) return;
  await db.location.create({
    data: {
      name: site.name,
      slug: 'main',
      addressLine: site.address.street,
      city: [site.address.locality, site.address.region].filter(Boolean).join(', '),
      postcode: site.address.postalCode,
      phone: site.phone,
      email: site.email,
      color: '#a98a6d',
      isPrimary: true,
      sortOrder: 0,
    },
  });
}

export async function listLocations(activeOnly = true) {
  return db.location.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
}

export async function locationCount() {
  return db.location.count({ where: { active: true } });
}
