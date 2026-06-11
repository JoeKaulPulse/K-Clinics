import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { PosTerminal } from '@/components/admin/PosTerminal';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function PosPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'pos.use')) redirect('/admin');

  const { db } = await import('@/lib/db');
  const rows = await db.product.findMany({
    where: { status: 'ACTIVE' },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, pricePence: true, stockQty: true, trackInventory: true, ageRestricted: true, images: true, category: true, barcode: true, sku: true },
  });
  const products = rows.map(({ images, ...p }) => ({ ...p, image: images[0] ?? null }));

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Till · Point of sale</h1>
      <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">
        Sell products over the counter — no client account needed. Card payments show a QR the customer scans on their
        phone; cash and card-machine sales are recorded here. Stock updates automatically.
      </p>
      <div className="mt-8"><PosTerminal products={products} /></div>
    </AdminShell>
  );
}
