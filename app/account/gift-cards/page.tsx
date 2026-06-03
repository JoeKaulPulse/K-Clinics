import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { PortalShell } from '@/components/portal/PortalShell';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { GiftCardClaim } from '@/components/portal/GiftCardClaim';
import type { Locale } from '@/lib/i18n-portal';

export const dynamic = 'force-dynamic';

export default async function GiftCardsPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  if (!crmEnabled) redirect('/account');
  const { getCurrentClient } = await import('@/lib/client-auth');
  const client = await getCurrentClient();
  if (!client) redirect('/account/login?from=/account/gift-cards');
  const sp = await searchParams;

  const { db } = await import('@/lib/db');
  const { isAdultOn } = await import('@/lib/age');
  const [row, claimed] = await Promise.all([
    db.client.findUnique({ where: { id: client.id }, select: { dob: true } }),
    db.giftVoucher.findMany({ where: { claimedByClientId: client.id }, select: { code: true, balancePence: true, status: true }, orderBy: { claimedAt: 'desc' } }),
  ]);
  const needsAge = !row?.dob || !isAdultOn(row.dob);
  const locale: Locale = client.locale === 'uk' ? 'uk' : 'en';

  return (
    <PortalShell firstName={client.firstName} locale={locale}>
      <PortalPageHeader eyebrow="Gift cards" title="Redeem a gift card" subtitle="Add a gift card to your account to use against your treatments." />
      <div className="mt-6 max-w-lg">
        <GiftCardClaim initialCode={sp.code ?? ''} needsAge={needsAge} claimed={claimed} />
      </div>
    </PortalShell>
  );
}
