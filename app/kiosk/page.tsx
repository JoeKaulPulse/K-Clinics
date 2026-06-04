import { KioskShell } from '@/components/kiosk/KioskShell';

export const dynamic = 'force-dynamic';

// In-store "Get my plan" kiosk — the treatment finder in a full-screen, touch
// shell with attract loop, lead capture and auto-reset between visitors.
export default async function KioskPage() {
  const prices: Record<string, number | null> = {};
  try {
    const { crmEnabled } = await import('@/lib/crm');
    if (crmEnabled) {
      const { pricingByTreatment } = await import('@/lib/services');
      for (const [slug, p] of await pricingByTreatment()) prices[slug] = p.fromPence;
    }
  } catch { /* finder works without prices */ }

  return <KioskShell prices={prices} />;
}
