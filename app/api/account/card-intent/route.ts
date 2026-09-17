import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';
import { stripeEnabled } from '@/lib/stripe';

export const runtime = 'nodejs';

// BLD-1797: self-service card-on-file — starts a Stripe SetupIntent for the
// signed-in client so they can add/replace a card for no-show/cancellation
// protection from their own account, reusing the exact SetupIntent + Stripe
// Elements mechanism the admin-sent secure link already uses (no second
// payment-collection path). No charge is taken here.
export async function POST(req: Request) {
  if (!crmEnabled || !stripeEnabled) return NextResponse.json({ ok: false, error: 'Not available.' }, { status: 503 });

  const { getClientSession } = await import('@/lib/auth');
  const session = await getClientSession();
  if (!session) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });

  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'account-card-intent', 20, 3600, 'client'))) {
    return NextResponse.json({ ok: false, error: 'Too many attempts — please try again later.' }, { status: 429 });
  }

  try {
    const { db } = await import('@/lib/db');
    const client = await db.client.findUnique({ where: { id: session.sub } });
    if (!client) return NextResponse.json({ ok: false, error: 'Account not found.' }, { status: 404 });

    const { stripe, ensureCustomer } = await import('@/lib/stripe');
    const customerId = await ensureCustomer(client);
    const si = await stripe().setupIntents.create({
      customer: customerId,
      usage: 'off_session',
      payment_method_types: ['card'],
      metadata: { clientId: client.id, source: 'account-self-service' },
    });
    if (!si.client_secret) return NextResponse.json({ ok: false, error: 'Could not start the card form.' }, { status: 502 });
    return NextResponse.json({ ok: true, clientSecret: si.client_secret });
  } catch (e) {
    console.error('[account/card-intent] failed:', (e as Error)?.message);
    try { const Sentry = await import('@sentry/nextjs'); Sentry.captureException(e, { tags: { area: 'account/card-intent' } }); } catch { /* Sentry unavailable */ }
    return NextResponse.json({ ok: false, error: 'Could not start the card form.' }, { status: 500 });
  }
}
