import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Server-authoritative checkout: re-prices the cart, enforces age on restricted
// items, applies any gift card, then either creates a Stripe PaymentIntent or
// (if a gift card covers it) finalises immediately.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!await enforceRateLimit(req, 'shop-checkout', 8, 600)) {
    return NextResponse.json({ ok: false, error: 'Too many requests — please wait 10 minutes.' }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  const items = Array.isArray(body.items) ? body.items.map((i: { productId: string; qty: number }) => ({ productId: String(i.productId), qty: Number(i.qty) })) : [];
  const name = String(body.name || '').trim().slice(0, 120);
  const email = String(body.email || '').trim().toLowerCase();
  if (!name || !/\S+@\S+\.\S+/.test(email)) return NextResponse.json({ ok: false, error: 'Please enter your name and a valid email.' }, { status: 400 });

  const { validateCart, shippingFor, nextOrderNumber } = await import('@/lib/shop');
  const cart = await validateCart(items);
  if (cart.lines.length === 0) return NextResponse.json({ ok: false, error: 'Your bag is empty.' }, { status: 400 });

  // Age gate for restricted items.
  let ageVerified = !cart.hasAgeRestricted;
  if (cart.hasAgeRestricted) {
    const { isAdultOn } = await import('@/lib/age');
    if (body.ageDeclare !== true || !body.dob || !isAdultOn(String(body.dob))) {
      return NextResponse.json({ ok: false, error: 'This order contains age-restricted items — please confirm your date of birth and that you are 18 or over.', needAge: true }, { status: 403 });
    }
    ageVerified = true;
  }

  const method = body.method === 'collect' ? 'collect' : 'ship';
  if (method === 'ship' && (!body.shipLine1 || !body.shipPostcode)) {
    return NextResponse.json({ ok: false, error: 'Please enter a delivery address (or choose collect in clinic).' }, { status: 400 });
  }
  const shippingPence = shippingFor(method, cart.subtotalPence);

  // Gift card (optional).
  const { db } = await import('@/lib/db');
  let giftCardPence = 0; let giftCardCode: string | null = null;
  const grossPence = cart.subtotalPence + shippingPence;
  if (body.giftCardCode) {
    const code = String(body.giftCardCode).trim().toUpperCase();
    // Reserve the gift-card amount ATOMICALLY now (decrement the live balance),
    // so two concurrent checkouts can't each apply the full balance and
    // under-charge the clinic. Re-credited on the failure paths below; because
    // this IS the redemption, finalizeOrder no longer redeems again.
    const { reserveVoucher } = await import('@/lib/gift-vouchers');
    const { reservedPence } = await reserveVoucher(code, grossPence);
    if (reservedPence <= 0) return NextResponse.json({ ok: false, error: 'That gift card code isn’t valid or has no balance.' }, { status: 400 });
    giftCardPence = reservedPence; giftCardCode = code;
  }
  const totalPence = Math.max(0, grossPence - giftCardPence);

  // BLD-466: attribute the order ONLY to the caller's authenticated portal
  // session — never trust a clientId from the request body (anyone could claim
  // another client's account). No session → guest order (null clientId).
  const { getClientSession } = await import('@/lib/auth');
  const clientId = (await getClientSession())?.sub ?? null;

  const order = await db.order.create({
    data: {
      number: await nextOrderNumber(), clientId, email, name, phone: body.phone ? String(body.phone).slice(0, 40) : null,
      method, shipName: method === 'ship' ? (body.shipName || name).slice(0, 120) : null,
      shipLine1: method === 'ship' ? String(body.shipLine1).slice(0, 160) : null, shipLine2: method === 'ship' ? (body.shipLine2 ? String(body.shipLine2).slice(0, 160) : null) : null,
      shipCity: method === 'ship' ? (body.shipCity ? String(body.shipCity).slice(0, 80) : null) : null, shipPostcode: method === 'ship' ? String(body.shipPostcode).slice(0, 12) : null,
      subtotalPence: cart.subtotalPence, shippingPence, giftCardCode, giftCardPence, totalPence, ageVerified,
      items: { create: cart.lines.map((l) => ({ productId: l.productId, name: l.name, sku: l.sku, unitPence: l.unitPence, qty: l.qty, ageRestricted: l.ageRestricted })) },
    },
  });

  // Fully covered by gift card → finalise now, no payment needed.
  if (totalPence <= 0) {
    const { finalizeOrder } = await import('@/lib/shop');
    const r = await finalizeOrder(order.id);
    return NextResponse.json({ ok: true, paid: true, number: r.number, issues: cart.issues });
  }

  // Re-credit the reserved gift-card balance if the order can't proceed to payment.
  const undoReservation = async () => {
    if (giftCardCode && giftCardPence > 0) {
      const { creditVoucher } = await import('@/lib/gift-vouchers');
      await creditVoucher(giftCardCode, giftCardPence).catch(() => {});
    }
  };

  const { stripe, stripeEnabled } = await import('@/lib/stripe');
  if (!stripeEnabled) { await db.order.delete({ where: { id: order.id } }).catch(() => {}); await undoReservation(); return NextResponse.json({ ok: false, error: 'Payments aren’t available right now.' }, { status: 503 }); }
  try {
    const pi = await stripe().paymentIntents.create({
      amount: totalPence, currency: 'gbp', automatic_payment_methods: { enabled: true },
      description: `KClinics order ${order.number}`, receipt_email: email, metadata: { orderId: order.id, kind: 'shop_order' },
    }, { idempotencyKey: `shop-order-${order.id}` });
    await db.order.update({ where: { id: order.id }, data: { stripePaymentIntentId: pi.id } });
    return NextResponse.json({ ok: true, clientSecret: pi.client_secret, orderId: order.id, totalPence, issues: cart.issues });
  } catch (e) {
    await db.order.delete({ where: { id: order.id } }).catch(() => {});
    await undoReservation();
    return NextResponse.json({ ok: false, error: (e as Error).message || 'Could not start payment.' }, { status: 500 });
  }
}
