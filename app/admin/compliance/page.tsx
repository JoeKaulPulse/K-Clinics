import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { getLocale } from '@/lib/locale';
import { listRenewals } from '@/lib/renewals';
import { ComplianceManager } from '@/components/admin/ComplianceManager';

export const dynamic = 'force-dynamic';

// BLD-587 — Compliance & Renewals: track business renewal dates (insurance,
// licences, PAT/EICR, servicing, waste contracts…) with due/expired status.
export default async function CompliancePage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'compliance.view')) redirect('/admin');
  const canManage = sessionCan(session, 'compliance.manage');

  const items = await listRenewals();
  const rows = items.map((r) => ({
    id: r.id, name: r.name, category: r.category, provider: r.provider, reference: r.reference,
    renewalAt: r.renewalAt.toISOString(), costPence: r.costPence, notes: r.notes,
    reminderDays: r.reminderDays, lastRenewedAt: r.lastRenewedAt ? r.lastRenewedAt.toISOString() : null,
    status: r.status, days: r.days,
  }));

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">Compliance &amp; renewals</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">
            Every important business deadline in one place — insurance, licences, certifications, equipment servicing,
            PAT testing, EICR and waste contracts. The dashboard flags what&rsquo;s expired or due soon, and staff are
            reminded automatically at your chosen thresholds.
          </p>
        </div>
      </div>
      <ComplianceManager rows={rows} canManage={canManage} />
    </AdminShell>
  );
}
