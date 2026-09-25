import { NextResponse } from 'next/server';
import { z } from 'zod';
import { crmEnabled } from '@/lib/crm';
import { stripeEnabled } from '@/lib/stripe';

export const runtime = 'nodejs';

const schema = z.object({ setupIntentId: z.string().min(1) });

// BLD-1797: called after the signed-in client confirms the SetupIntent
// started by /api/account/card-intent. Mirrors /api/booking/card-saved (same
// SetupIntent-confirmation mechanism), but authorised by the client's own
// portal session instead of a one-time booking token, and not scoped to a
// single appointment. No charge is taken here.
export async function POST(req: Request) {
  if (!crmEnabled || !stripeEnabled) return NextResponse.json({ ok: false }, { status: 503 });

  const { getClientSession } = await import('@/lib/auth');
  const session = await getClientSession();
  if (!session) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 422 });

  const { db } = await import('@/lib/db');
  const { stripe } = await import('@/lib/stripe');
  const client = await db.client.findUnique({ where: { id: session.sub } });
  if (!client) return NextResponse.json({ ok: false, error: 'Account not found.' }, { status: 404 });

  const si = await stripe().setupIntents.retrieve(parsed.data.setupIntentId).catch(() => null);
  // The SetupIntent id is derivable from its own client secret (the browser
  // already held that), so it isn't a secret in itself — ownership is what
  // matters, checked here against the signed-in client's Stripe customer
  // before anything is trusted or written.
  //
  // BLD-1797 (review fix): compare two resolved, non-null customer ids.
  // `si.customer !== client.stripeCustomerId` alone had two holes:
  //   - a client with no Stripe customer yet (null) matched a SetupIntent
  //     created with no customer (also null), since null !== null is false;
  //   - si.customer is `string | Customer | DeletedCustomer | null`, so an
  //     expanded object would never equal the stored id.
  // Nothing may be written unless the client HAS a customer id and the
  // SetupIntent is attached to exactly that customer.
  const siCustomerId = typeof si?.customer === 'string' ? si.customer : si?.customer?.id ?? null;
  if (!si || !client.stripeCustomerId || siCustomerId !== client.stripeCustomerId) {
    return NextResponse.json({ ok: false, error: 'Card request not found.' }, { status: 404 });
  }
  if (si.status !== 'succeeded' || !si.payment_method) {
    return NextResponse.json({ ok: false, error: 'Card not confirmed yet.' }, { status: 400 });
  }
  const pmId = typeof si.payment_method === 'string' ? si.payment_method : si.payment_method.id;

  if (client.stripeCustomerId) {
    await stripe().customers.update(client.stripeCustomerId, { invoice_settings: { default_payment_method: pmId } }).catch(() => {});
  }
  await db.client.update({ where: { id: client.id }, data: { stripeDefaultPaymentMethodId: pmId } });

  // Extend no-show/cancellation protection to any of the client's own open,
  // upcoming appointments that don't already have a card on this specific
  // booking (never overwrites one that's already set).
  const protectedCount = await db.booking.updateMany({
    where: {
      clientId: client.id,
      stripePaymentMethodId: null,
      startAt: { gte: new Date() },
      status: { notIn: ['CANCELLED', 'COMPLETED', 'NO_SHOW'] },
    },
    data: { stripePaymentMethodId: pmId, stripeCustomerId: client.stripeCustomerId },
  }).then((r) => r.count).catch(() => 0);

  await db.interaction.create({
    data: { clientId: client.id, type: 'APPOINTMENT', summary: `Card added/updated in account (self-service, no-show protection)${protectedCount ? ` — applied to ${protectedCount} upcoming booking(s)` : ''}`, author: 'client' },
  }).catch(() => {});

  // Return display details for the UI to update in place without a reload —
  // read back from Stripe rather than trusting whatever the browser's
  // (unexpanded) confirmSetup result happened to contain.
  let card: { brand?: string; last4?: string; expMonth?: number; expYear?: number } = {};
  try {
    const pm = await stripe().paymentMethods.retrieve(pmId);
    if (pm.card) card = { brand: pm.card.brand, last4: pm.card.last4, expMonth: pm.card.exp_month, expYear: pm.card.exp_year };
  } catch { /* card was saved either way — display detail is best-effort */ }

  return NextResponse.json({ ok: true, appliedToBookings: protectedCount, card });
}
