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

  const order = await db.order.create({
    data: {
      number: await nextOrderNumber(), email, name, phone, method: 'collect',
      subtotalPence: cart.subtotalPence, shippingPence: 0, totalPence: cart.subtotalPence,
      ageVerified: !cart.hasAgeRestricted ? true : Boolean(b.ageVerified),
      fulfillment: 'collected', trackingNote: `POS — ${method}`,
      items: { create: cart.lines.map((l) => ({ productId: l.productId, name: l.name, sku: l.sku, unitPence: l.unitPence, qty: l.qty, ageRestricted: l.ageRestricted })) },
    },
  });

  // Age gate for 18+ products taken over the counter.
  if (cart.hasAgeRestricted && !b.ageVerified) {
    await db.order.delete({ where: { id: order.id } }).catch(() => {});
    return NextResponse.json({ ok: false, error: 'This sale includes an 18+ product — confirm the customer is over 18 first.', needAge: true }, { status: 400 });
  }

  // Cash / external card machine → record as paid now (decrements stock).
  if (method !== 'card') {
    const { finalizeOrder } = await import('@/lib/shop');
    const r = await finalizeOrder(order.id);
    const { logAudit } = await import('@/lib/audit');
    await logAudit({ action: 'PAYMENT_CHARGED', actor: session.email, actorRole: session.role, summary: `POS sale ${order.number} — ${method} — £${(cart.subtotalPence / 100).toFixed(2)}` }).catch(() => {});
    return NextResponse.json({ ok: true, paid: true, number: r.number, totalPence: cart.subtotalPence, issues: cart.issues });
  }

  // Card → Stripe Checkout link the customer scans + pays on their phone.
  const { stripe, stripeEnabled } = await import('@/lib/stripe');
  if (!stripeEnabled) { await db.order.delete({ where: { id: order.id } }).catch(() => {}); return NextResponse.json({ ok: false, error: 'Card payments aren’t configured.' }, { status: 503 }); }
  const base = (process.env.NEXT_PUBLIC_SITE_URL || (await import('@/lib/site')).site.url).replace(/\/$/, '');
  try {
    const checkout = await stripe().checkout.sessions.create({
      mode: 'payment',
      line_items: cart.lines.map((l) => ({ quantity: l.qty, price_data: { currency: 'gbp', unit_amount: l.unitPence, product_data: { name: l.name } } })),
      payment_intent_data: { metadata: { orderId: order.id, kind: 'shop_order' }, description: `KClinics POS ${order.number}` },
      ...(email ? { customer_email: email } : {}),
      success_url: `${base}/pos-paid?n=${order.number}`,
      cancel_url: `${base}/pos-paid?cancelled=1`,
    });
    const QR = (await import('qrcode')).default;
    const qr = await QR.toDataURL(checkout.url || '', { margin: 1, width: 320 });
    return NextResponse.json({ ok: true, orderId: order.id, url: checkout.url, qr, totalPence: cart.subtotalPence, issues: cart.issues });
  } catch (e) {
    await db.order.delete({ where: { id: order.id } }).catch(() => {});
    return NextResponse.json({ ok: false, error: (e as Error)?.message || 'Could not start the card payment.' }, { status: 400 });
  }
}
