import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { OrdersManager, type OrderRow } from '@/components/admin/OrdersManager';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'finance.view')) redirect('/admin');

  const { db } = await import('@/lib/db');
  const orders = await db.order.findMany({ where: { status: { not: 'PENDING' } }, orderBy: { createdAt: 'desc' }, take: 200, include: { items: true } });
  const rows: OrderRow[] = orders.map((o) => ({
    id: o.id, number: o.number, createdAt: o.createdAt.toISOString(), name: o.name, email: o.email,
    method: o.method, totalPence: o.totalPence, status: o.status, fulfillment: o.fulfillment, trackingNote: o.trackingNote ?? '',
    address: o.method === 'ship' ? [o.shipLine1, o.shipLine2, o.shipCity, o.shipPostcode].filter(Boolean).join(', ') : 'Collect in clinic',
    items: o.items.map((i) => ({ name: i.name, qty: i.qty, ageRestricted: i.ageRestricted })),
  }));

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Orders</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">Retail product orders — fulfil, add tracking and manage status.</p>
      <div className="mt-8"><OrdersManager rows={rows} canManage={sessionCan(session, 'finance.manage')} /></div>
    </AdminShell>
  );
}
