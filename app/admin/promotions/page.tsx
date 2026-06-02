import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { PromotionsManager } from '@/components/admin/PromotionsManager';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function PromotionsPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'discounts.manage')) redirect('/admin');

  const { db } = await import('@/lib/db');
  const rows = await db.promoCode.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  // Personal (campaign) codes are summarised, not listed one-by-one.
  const universal = rows.filter((r) => r.kind === 'UNIVERSAL');
  const personalGroups = new Map<string, { campaignId: string; count: number; redeemed: number }>();
  for (const r of rows.filter((r) => r.kind === 'PERSONAL' && r.campaignId)) {
    const g = personalGroups.get(r.campaignId!) ?? { campaignId: r.campaignId!, count: 0, redeemed: 0 };
    g.count++; g.redeemed += r.redeemedCount > 0 ? 1 : 0;
    personalGroups.set(r.campaignId!, g);
  }
  const campaignIds = [...personalGroups.keys()];
  const campaigns = campaignIds.length ? await db.campaign.findMany({ where: { id: { in: campaignIds } }, select: { id: true, name: true, sentAt: true } }) : [];
  const campaignName = new Map(campaigns.map((c) => [c.id, c.name]));

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Promotions</h1>
      <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">
        Create universal promo codes (e.g. <code className="rounded bg-[var(--color-bone)] px-1">K10SUMMERREADY</code> for 10% off in June), or send a campaign that gives each recipient their own unique code. Codes are entered at checkout.
      </p>
      <div className="mt-8">
        <PromotionsManager
          universal={universal.map((p) => ({
            id: p.id, code: p.code, label: p.label, discountType: p.discountType, percent: p.percent, amountPence: p.amountPence,
            redeemedCount: p.redeemedCount, maxRedemptions: p.maxRedemptions, active: p.active,
            startsAt: p.startsAt?.toISOString() ?? null, expiresAt: p.expiresAt?.toISOString() ?? null, treatmentSlugs: p.treatmentSlugs,
          }))}
          campaignBatches={[...personalGroups.values()].map((g) => ({ campaignId: g.campaignId, name: campaignName.get(g.campaignId) || 'Campaign', count: g.count, redeemed: g.redeemed }))}
        />
      </div>
    </AdminShell>
  );
}
