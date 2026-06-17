import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Passwordless account activation (migration magic link). A client whose booking
// was moved onto the new site has no password; this link validates the one-time
// token, signs them in, and drops them on the step that matters — saving a card
// for their upcoming appointment — or the dashboard if nothing is outstanding.
// Listed in the middleware public allowlist so it's reachable without a session.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token') || '';
  const id = searchParams.get('id') || '';
  const back = (notice: string) => NextResponse.redirect(new URL(`/account/login?notice=${notice}`, req.url));

  const { crmEnabled } = await import('@/lib/crm');
  if (!crmEnabled || !token || !id) return back('link-invalid');

  // Bound brute-forcing of activation tokens from a single IP.
  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'account-activate', 30, 600, 'client'))) return back('too-many');

  const { activateAccount } = await import('@/lib/client-auth');
  const result = await activateAccount(id, token);
  if (!result.ok) return back('link-expired');

  // Open a portal session (cookie is attached to the redirect response — mirrors
  // the admin login route's createSession + NextResponse pattern).
  const { createClientSession } = await import('@/lib/auth');
  await createClientSession({ sub: result.client.id, email: result.client.email, firstName: result.client.firstName, epoch: result.client.sessionEpoch });

  // Land them where the next action is: the soonest upcoming booking that still
  // needs a card → its (token-based) card page; otherwise the dashboard.
  let dest = '/account?welcome=1';
  try {
    const { db } = await import('@/lib/db');
    const next = await db.booking.findFirst({
      where: {
        clientId: result.client.id,
        stripePaymentMethodId: null,
        startAt: { gte: new Date() },
        status: { notIn: ['CANCELLED', 'COMPLETED', 'NO_SHOW'] },
      },
      orderBy: { startAt: 'asc' },
      select: { manageToken: true },
    });
    if (next?.manageToken) dest = `/booking/card?t=${next.manageToken}`;
  } catch {
    // Fall back to the dashboard if the lookup blips.
  }

  return NextResponse.redirect(new URL(dest, req.url));
}
