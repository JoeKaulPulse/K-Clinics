// Preview/capture route — enhanced gift cards with the real GiftCardClaim + mock data.
import { PortalShell } from '@/components/portal/PortalShell';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { GiftCardClaim } from '@/components/portal/GiftCardClaim';

export const dynamic = 'force-static';

export default function PreviewGiftCards() {
  return (
    <PortalShell firstName="Sofia" locale="en" activePath="/account/gift-cards">
      <PortalPageHeader eyebrow="Gift cards" title="Redeem a gift card" subtitle="Add a gift card to your account to use against your treatments." />
      <div className="mt-6 max-w-lg">
        <GiftCardClaim initialCode="KC-7H2K-9Qment" needsAge={false} claimed={[{ code: 'KC-2024-XMAS', balancePence: 5000, status: 'ACTIVE' }, { code: 'KC-BDAY-2210', balancePence: 0, status: 'REDEEMED' }]} />
      </div>
    </PortalShell>
  );
}
