import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { SupplierManager } from '@/components/admin/SupplierManager';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function AdminSuppliersPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'suppliers.view')) redirect('/admin');

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Suppliers</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">
        Supplier contacts and account details. Numbers here are matched on inbound calls, and each supplier links to their Xero contact for bills.
      </p>
      <div className="mt-6">
        <SupplierManager canManage={sessionCan(session, 'suppliers.manage')} />
      </div>
    </AdminShell>
  );
}
