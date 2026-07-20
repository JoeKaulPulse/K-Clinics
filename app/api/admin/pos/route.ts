import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// In-store point of sale. Front desk sells products over the counter — no client
// account needed. Card payments use a Stripe Checkout link (QR → pay on the
// customer's phone), finalised by the existing shop webhook; cash / external
// card-machine sales are recorded immediately. Inventory decrements either way.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('pos.use');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');

  // Poll a card order's status after the customer pays on their phone.
  if (b.op === 'status') {
    if (!b.orderId) return NextResponse.json({ ok: false }, { status: 400 });
    const o = await db.order.findUnique({ where: { id: String(b.orderId) }, select: { status: true, number: true } });
    return NextResponse.json({ ok: true, status: o?.status ?? 'UNKNOWN', number: o?.number ?? null });
  }

  // BLD-882: read-only voucher lookup so front desk can see the balance before
  // completing the sale. Nothing is reserved here — the atomic reservation
  // happens at checkout, so an abandoned basket can never strand a balance.
  if (b.op === 'voucher-check') {
    const code = String(b.code || '').trim().toUpperCase();
    if (!code) return NextResponse.json({ ok: false, error: 'Enter the voucher code.' }, { status: 400 });
    const v = await db.giftVoucher.findUnique({ where: { code }, select: { status: true, balancePence: true, expiresAt: true } });
    if (!v || v.status !== 'ACTIVE' || v.balancePence <= 0 || (v.expiresAt && v.expiresAt < new Date())) {
      return NextResponse.json({ ok: false, error: 'That voucher code isn’t valid, has expired, or has no balance left.' }, { status: 400 });
    }
    return NextResponse.json({ ok: true, balancePence: v.balancePence });
  }

  // BLD-882: staff cancelled a pending card sale (QR never paid). Claims the
  // PENDING order atomically so a concurrent webhook finalisation wins cleanly,
  // re-credits any voucher reservation, and expires the Stripe Checkout link so
  // the abandoned QR can't be paid later against a cancelled sale.
  if (b.op === 'cancel') {
    const orderId = String(b.orderId || '');
    if (!orderId) return NextResponse.json({ ok: false }, { status: 400 });
    const o = await db.order.findUnique({ where: { id: orderId }, select: { status: true, giftCardCode: true, giftCardPence: true } });
    if (!o) return NextResponse.json({ ok: false, error: 'Sale not found.' }, { status: 404 });
    const claimed = await db.order.updateMany({ where: { id: orderId, status: 'PENDING' }, data: { status: 'CANCELLED' } });
    if (claimed.count === 0) return NextResponse.json({ ok: false, error: 'This sale has already been paid — use the Orders screen to refund it if needed.' }, { status: 409 });
    if (o.giftCardCode && o.giftCardPence > 0) {
      const { creditVoucher } = await import('@/lib/gift-vouchers');
      await creditVoucher(o.giftCardCode, o.giftCardPence).catch(() => {});
    }
    if (b.sessionId) {
      try {
        const { stripe, stripeEnabled } = await import('@/lib/stripe');
        if (stripeEnabled) {
          const s = await stripe().checkout.sessions.retrieve(String(b.sessionId));
          if (s.metadata?.orderId === orderId && s.status === 'open') await stripe().checkout.sessions.expire(s.id);
        }
      } catch { /* best-effort — finalizeOrder's CANCELLED guard (BLD-761) covers a payment racing this expiry */ }
    }
    return NextResponse.json({ ok: true });
  }

  if (b.op !== 'checkout') return NextResponse.json({ ok: false, error: 'Unknown op.' }, { status: 400 });

  const method = b.method === 'cash' || b.method === 'terminal' ? b.method : 'card';
  const items = Array.isArray(b.items) ? b.items.map((i: { productId: string; qty: number }) => ({ productId: String(i.productId), qty: Number(i.qty) || 1 })) : [];
  if (items.length === 0) return NextResponse.json({ ok: false, error: 'The basket is empty.' }, { status: 400 });

  const { validateCart, nextOrderNumber } = await import('@/lib/shop');
  const cart = await validateCart(items);
  if (cart.lines.length === 0) return NextResponse.json({ ok: false, error: cart.issues[0] || 'No sellable items.' }, { status: 400 });

  const name = (b.customerName ? String(b.customerName) : '').slice(0, 120) || 'In-store sale';
  const email = (b.customerEmail ? String(b.customerEmail) : '').slice(0, 160);
  const phone = b.customerPhone ? String(b.customerPhone).slice(0, 40) : null;

  // Age gate for 18+ products taken over the counter — checked BEFORE the
  // order exists so no voucher reservation or order row needs unwinding.
  if (cart.hasAgeRestricted && !b.ageVerified) {
    return NextResponse.json({ ok: false, error: 'This sale includes an 18+ product — confirm the customer is over 18 first.', needAge: true }, { status: 400 });
  }

  // BLD-882: gift voucher against the sale. Reserve ATOMICALLY now (the same
  // reserveVoucher pattern as shop checkout — the live balance is decremented
  // so two tills can't spend the same pounds twice); re-credited on every
  // failure path below. Leftover balance stays on the voucher — no cash change.
  let giftCardPence = 0; let giftCardCode: string | null = null;
  if (b.voucherCode) {
    const code = String(b.voucherCode).trim().toUpperCase();
    const { reserveVoucher } = await import('@/lib/gift-vouchers');
    const { reservedPence } = await reserveVoucher(code, cart.subtotalPence);
    if (reservedPence <= 0) return NextResponse.json({ ok: false, error: 'That voucher code isn’t valid, has expired, or has no balance left.' }, { status: 400 });
    giftCardPence = reservedPence; giftCardCode = code;
  }
  const totalPence = Math.max(0, cart.subtotalPence - giftCardPence);
  const undoReservation = async () => {
    if (giftCardCode && giftCardPence > 0) {
      const { creditVoucher } = await import('@/lib/gift-vouchers');
      await creditVoucher(giftCardCode, giftCardPence).catch(() => {});
    }
  };

  let order: Awaited<ReturnType<typeof db.order.create>>;
  try {
    order = await db.order.create({
      data: {
        number: await nextOrderNumber(), email, name, phone, method: 'collect',
        subtotalPence: cart.subtotalPence, shippingPence: 0, giftCardCode, giftCardPence, totalPence,
        ageVerified: !cart.hasAgeRestricted ? true : Boolean(b.ageVerified),
        fulfillment: 'collected', trackingNote: `POS — ${giftCardPence > 0 ? `gift voucher £${(giftCardPence / 100).toFixed(2)} + ` : ''}${method}`,
        items: { create: cart.lines.map((l) => ({ productId: l.productId, name: l.name, sku: l.sku, unitPence: l.unitPence, qty: l.qty, ageRestricted: l.ageRestricted })) },
      },
    });
  } catch (e) {
    console.error('[pos] order create failed:', (e as Error)?.message);
    await undoReservation();
    return NextResponse.json({ ok: false, error: 'Could not start the sale — please try again.' }, { status: 500 });
  }

  const voucherNote = giftCardPence > 0 ? ` (gift voucher ${giftCardCode} £${(giftCardPence / 100).toFixed(2)})` : '';

  // Voucher covers the whole sale → paid, regardless of the method chosen.
  if (totalPence <= 0) {
    const { finalizeOrder } = await import('@/lib/shop');
    const r = await finalizeOrder(order.id);
    const { logAudit } = await import('@/lib/audit');
    await logAudit({ action: 'PAYMENT_CHARGED', actor: session.email, actorRole: session.role, summary: `POS sale ${order.number} — paid in full by gift voucher${voucherNote}` }).catch(() => {});
    return NextResponse.json({ ok: true, paid: true, number: r.number, totalPence: 0, voucherPence: giftCardPence, issues: cart.issues });
  }

  // Cash / external card machine → record as paid now (decrements stock).
  if (method !== 'card') {
    const { finalizeOrder } = await import('@/lib/shop');
    const r = await finalizeOrder(order.id);
    const { logAudit } = await import('@/lib/audit');
    await logAudit({ action: 'PAYMENT_CHARGED', actor: session.email, actorRole: session.role, summary: `POS sale ${order.number} — ${method} — £${(totalPence / 100).toFixed(2)}${voucherNote}` }).catch(() => {});
    return NextResponse.json({ ok: true, paid: true, number: r.number, totalPence, voucherPence: giftCardPence, issues: cart.issues });
  }

  // Card → Stripe Checkout link the customer scans + pays on their phone.
  // With a voucher applied the session charges only the remainder, as one line
  // (Stripe line items can't go negative); the webhook finalises by orderId.
  const { stripe, stripeEnabled } = await import('@/lib/stripe');
  if (!stripeEnabled) { await db.order.delete({ where: { id: order.id } }).catch(() => {}); await undoReservation(); return NextResponse.json({ ok: false, error: 'Card payments aren’t configured.' }, { status: 503 }); }
  const base = (process.env.NEXT_PUBLIC_SITE_URL || (await import('@/lib/site')).site.url).replace(/\/$/, '');
  try {
    const checkout = await stripe().checkout.sessions.create({
      mode: 'payment',
      line_items: giftCardPence > 0
        ? [{ quantity: 1, price_data: { currency: 'gbp', unit_amount: totalPence, product_data: { name: `KClinics purchase ${order.number} (after £${(giftCardPence / 100).toFixed(2)} gift voucher)` } } }]
        : cart.lines.map((l) => ({ quantity: l.qty, price_data: { currency: 'gbp', unit_amount: l.unitPence, product_data: { name: l.name } } })),
      payment_intent_data: { metadata: { orderId: order.id, kind: 'shop_order' }, description: `KClinics POS ${order.number}` },
      // Session-level metadata lets the 'cancel' op verify a sessionId belongs
      // to this order before expiring it.
      metadata: { orderId: order.id },
      ...(email ? { customer_email: email } : {}),
      success_url: `${base}/pos-paid?n=${order.number}`,
      cancel_url: `${base}/pos-paid?cancelled=1`,
    }, { idempotencyKey: `pos-checkout-${order.id}` });
    const QR = (await import('qrcode')).default;
    const qr = await QR.toDataURL(checkout.url || '', { margin: 1, width: 320 });
    return NextResponse.json({ ok: true, orderId: order.id, sessionId: checkout.id, url: checkout.url, qr, totalPence, voucherPence: giftCardPence, issues: cart.issues });
  } catch (e) {
    await db.order.delete({ where: { id: order.id } }).catch(() => {});
    await undoReservation();
    return NextResponse.json({ ok: false, error: (e as Error)?.message || 'Could not start the card payment.' }, { status: 400 });
  }
}
