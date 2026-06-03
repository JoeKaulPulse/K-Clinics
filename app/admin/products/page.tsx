import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { ProductsList, type ProductRow } from '@/components/admin/ProductsList';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');

  const { db } = await import('@/lib/db');
  const { stockState } = await import('@/lib/products');
  const products = await db.product.findMany({ orderBy: { updatedAt: 'desc' } });
  const rows: ProductRow[] = products.map((p) => ({
    id: p.id, name: p.name, image: p.images[0] ?? null, pricePence: p.pricePence, status: p.status,
    ageRestricted: p.ageRestricted, stockQty: p.stockQty, stock: stockState(p),
  }));

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Products</h1>
      <p className="mt-1 max-w-3xl text-sm text-[var(--color-stone)]">
        Manage retail products and stock — like Shopify. Each product can be marked <strong>age-restricted (18+)</strong>,
        which will require an age check at checkout when selling goes live.
      </p>
      <div className="mt-8">
        <ProductsList rows={rows} />
      </div>
    </AdminShell>
  );
}
