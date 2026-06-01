import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { GiftVoucherManager } from '@/components/admin/GiftVoucherManager';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function AdminGiftVouchersPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'finance.view')) redirect('/admin');

  const { db } = await import('@/lib/db');
  const vouchers = await db.giftVoucher.findMany({ orderBy: { createdAt: 'desc' }, take: 500 });

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Gift vouchers</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">Track vouchers sold online, redeem balances in clinic, resend the email, or cancel. Vouchers are valid for 12 months.</p>
      <div className="mt-8">
        <GiftVoucherManager
          vouchers={vouchers.map((v) => ({
            id: v.id, code: v.code, status: v.status,
            amountPence: v.amountPence, balancePence: v.balancePence,
            purchaserName: v.purchaserName, purchaserEmail: v.purchaserEmail,
            recipientName: v.recipientName, recipientEmail: v.recipientEmail,
            message: v.message, delivered: v.delivered,
            deliverAt: v.deliverAt?.toISOString() ?? null,
            expiresAt: v.expiresAt?.toISOString() ?? null,
            createdAt: v.createdAt.toISOString(),
          }))}
        />
      </div>
    </AdminShell>
  );
}
