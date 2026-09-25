import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
// This response is the caller's own name, email, gender and discount
// eligibility, keyed on their session cookie. While it was inline in /book's
// HTML it inherited that page's `private, no-store` (force-dynamic); as a route
// handler it was being served with no Cache-Control and no `Vary: cookie` at
// all, which any shared cache in front of it is entitled to reuse for the next
// visitor. Both lines mirror /api/account/packages, the sibling endpoint this
// component already fetches.
export const dynamic = 'force-dynamic';

// BLD-1833: /book stopped reading the session cookie at render time (see
// app/(marketing)/book/page.tsx) so its treatment catalogue and review
// aggregate could be served from an hourly cache like the homepage's.
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
  return NextResponse.json(clientInfo, { headers: { 'Cache-Control': 'no-store' } });
}
