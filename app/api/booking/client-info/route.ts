import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// BLD-1833: /book moved to ISR (see app/(marketing)/book/page.tsx) so the
// treatment catalogue and review aggregate can be cached like the homepage.
// Signed-in personalisation (name, welcome-discount eligibility, SMS pref)
// still needs live cookies, so it's split out here and fetched client-side by
// BookingFlow once mounted, instead of being read at page-render time.
export async function GET() {
  let clientInfo = { signedIn: false, firstName: '', email: '', gender: null as string | null, smsReminders: false, hasPhone: false, welcomeEligible: true };
  try {
    const { getCurrentClient } = await import('@/lib/client-auth');
    const { db } = await import('@/lib/db');
    const client = await getCurrentClient();
    if (client) {
      const active = await db.discountClaim.findFirst({ where: { clientId: client.id, status: 'ACTIVE' } });
      clientInfo = { signedIn: true, firstName: client.firstName, email: client.email, gender: client.gender ?? null, smsReminders: client.smsReminders, hasPhone: !!client.phone, welcomeEligible: !!active };
    }
  } catch (e) {
    console.error('[booking/client-info] personalisation skipped (non-fatal):', (e as Error)?.message);
  }
  return NextResponse.json(clientInfo);
}
