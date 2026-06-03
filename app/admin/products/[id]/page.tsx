import { notFound, redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { ProductEditor, type ProductData } from '@/components/admin/ProductEditor';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function ProductEditorPage({ params }: { params: Promise<{ id: string }> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');
  const { id } = await params;

  const { db } = await import('@/lib/db');
  const p = await db.product.findUnique({ where: { id } });
  if (!p) notFound();

  const gbp = (v: number | null) => (v == null ? '' : (v / 100).toString());
  const data: ProductData = {
    id: p.id, name: p.name, description: p.description ?? '', brand: p.brand ?? '', category: p.category ?? '',
    price: gbp(p.pricePence), compareAt: gbp(p.compareAtPence), cost: gbp(p.costPence), sku: p.sku ?? '', barcode: p.barcode ?? '',
    images: p.images, status: p.status, ageRestricted: p.ageRestricted, trackInventory: p.trackInventory,
    stockQty: p.stockQty, lowStockThreshold: p.lowStockThreshold,
  };

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <ProductEditor data={data} />
    </AdminShell>
  );
}
