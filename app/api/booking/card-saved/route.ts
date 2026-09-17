import { NextResponse } from 'next/server';
import { z } from 'zod';
import { crmEnabled } from '@/lib/crm';
import { stripeEnabled } from '@/lib/stripe';

export const runtime = 'nodejs';

const schema = z.object({ token: z.string().min(1) });

// Called after the client confirms the SetupIntent on the card-on-file page.
// Attaches the saved card to the (already-confirmed, offline) booking. Authorised
// by the unguessable manage token — no charge is taken here.
export async function POST(req: Request) {
  if (!crmEnabled || !stripeEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 422 });

  const { db } = await import('@/lib/db');
  const { stripe } = await import('@/lib/stripe');
  const booking = await db.booking.findUnique({ where: { manageToken: parsed.data.token } });
  if (!booking) return NextResponse.json({ ok: false, error: 'Booking not found.' }, { status: 404 });
  if (booking.stripePaymentMethodId) return NextResponse.json({ ok: true, already: true });
  if (!booking.stripeSetupIntentId) return NextResponse.json({ ok: false, error: 'No card request found.' }, { status: 400 });

  const si = await stripe().setupIntents.retrieve(booking.stripeSetupIntentId);
  if (si.status !== 'succeeded' || !si.payment_method) {
    return NextResponse.json({ ok: false, error: 'Card not confirmed yet.' }, { status: 400 });
  }
  const pmId = typeof si.payment_method === 'string' ? si.payment_method : si.payment_method.id;

  if (booking.stripeCustomerId) {
    await stripe().customers.update(booking.stripeCustomerId, { invoice_settings: { default_payment_method: pmId } }).catch(() => {});
  }
  await db.booking.update({ where: { id: booking.id }, data: { stripePaymentMethodId: pmId } });
  // BLD-1797: keep the client-level card-on-file status (shown in their
  // account) in sync with a card saved via this booking-scoped link too, so
  // the self-service section reflects it without the client having to re-add
  // it. Best-effort — the booking is already protected either way.
  await db.client.update({ where: { id: booking.clientId }, data: { stripeDefaultPaymentMethodId: pmId } }).catch(() => {});
  await db.interaction.create({ data: { clientId: booking.clientId, type: 'APPOINTMENT', summary: `Card saved to booking for ${booking.treatmentTitle} (no-show protection active)`, author: 'client' } }).catch(() => {});

  return NextResponse.json({ ok: true });
}
