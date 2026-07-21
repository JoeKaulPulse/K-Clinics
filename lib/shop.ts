import 'server-only';

export const SHIPPING_PENCE = 495;
export const FREE_SHIP_THRESHOLD = 5000; // free shipping over £50

export const formatPence = (p: number) => (p <= 0 ? 'Free' : `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0 })}`);

export async function activeProducts() {
  const { db } = await import('@/lib/db');
  return db.product.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true, slug: true, name: true, description: true, brand: true,
      category: true, pricePence: true, compareAtPence: true, sku: true,
      images: true, status: true, ageRestricted: true, trackInventory: true,
      stockQty: true, lowStockThreshold: true, createdAt: true, updatedAt: true,
    },
  });
}

export async function getProductBySlug(slug: string) {
  const { db } = await import('@/lib/db');
  return db.product.findFirst({ where: { slug, status: 'ACTIVE' } });
}

export type CartInput = { productId: string; qty: number }[];
export type CartLine = { productId: string; name: string; sku: string | null; unitPence: number; qty: number; ageRestricted: boolean; image: string | null };
export type ValidatedCart = { lines: CartLine[]; subtotalPence: number; hasAgeRestricted: boolean; issues: string[] };

/** Server-authoritative cart: re-prices from the DB and checks stock. */
export async function validateCart(input: CartInput): Promise<ValidatedCart> {
  const { db } = await import('@/lib/db');
  const ids = [...new Set(input.map((i) => i.productId))];
  const products = ids.length ? await db.product.findMany({
    where: { id: { in: ids }, status: 'ACTIVE' },
    select: {
      id: true, name: true, sku: true, pricePence: true, ageRestricted: true,
      trackInventory: true, stockQty: true, images: true, status: true,
    },
  }) : [];
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines: CartLine[] = [];
  const issues: string[] = [];
  for (const i of input) {
    const p = byId.get(i.productId);
    const qty = Math.max(1, Math.min(20, Math.round(i.qty)));
    if (!p) { issues.push('An item is no longer available and was removed.'); continue; }
    let available = qty;
    if (p.trackInventory && p.stockQty < qty) { available = Math.max(0, p.stockQty); if (available === 0) { issues.push(`${p.name} is out of stock.`); continue; } issues.push(`Only ${available} of ${p.name} left — quantity reduced.`); }
    lines.push({ productId: p.id, name: p.name, sku: p.sku, unitPence: p.pricePence, qty: available, ageRestricted: p.ageRestricted, image: p.images[0] ?? null });
  }
  const subtotalPence = lines.reduce((s, l) => s + l.unitPence * l.qty, 0);
  return { lines, subtotalPence, hasAgeRestricted: lines.some((l) => l.ageRestricted), issues };
}

export const shippingFor = (method: string, subtotalPence: number) =>
  method === 'collect' || subtotalPence >= FREE_SHIP_THRESHOLD ? 0 : SHIPPING_PENCE;

export async function nextOrderNumber(): Promise<string> {
  const { db } = await import('@/lib/db');
  // Atomic counter — serialises concurrent checkouts so no two orders can ever
  // get the same human-facing number. The Setting row acts as the sequence;
  // ON CONFLICT ensures only one writer increments at a time.
  //
  // First-run seed must clear any orders that predate this counter (minted by
  // the old count()-based scheme), otherwise the first new number would collide
  // with an existing Order.number (@unique) and block checkout. The seed is the
  // greater of 1001 and (max existing KC#### + 1), computed in the same atomic
  // statement. All values are SQL literals/subqueries — no interpolation.
  const rows = await db.$queryRaw<[{ value: string }]>`
    INSERT INTO "Setting" (key, value, "updatedAt")
    VALUES (
      '_order_seq',
      GREATEST(
        1001,
        COALESCE(
          (SELECT MAX(CAST(SUBSTRING(number FROM 3) AS INTEGER)) + 1
             FROM "Order"
            WHERE number ~ '^KC[0-9]+$'),
          1001
        )
      )::TEXT,
      NOW()
    )
    ON CONFLICT (key) DO UPDATE
      SET value = (CAST("Setting".value AS INTEGER) + 1)::TEXT,
          "updatedAt" = NOW()
    RETURNING value
  `;
  return `KC${rows[0].value}`;
}

/** Finalise a paid order: decrement stock, redeem any gift card, send the
 *  confirmation email. Idempotent — only runs once (when status flips to PAID). */
export async function finalizeOrder(orderId: string): Promise<{ ok: boolean; number?: string }> {
  const { db } = await import('@/lib/db');
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return { ok: false };
  if (order.status === 'PAID' || order.status === 'FULFILLED') return { ok: true, number: order.number };

  // Claim the order atomically — only the caller that actually flips it to PAID
  // proceeds to decrement stock / redeem the gift card / email. A concurrent
  // webhook + /confirm therefore can't double-decrement stock or double-redeem.
  // CANCELLED is excluded too (BLD-761): a cancelled order already had its
  // gift-card reservation credited back, so silently re-claiming it here on a
  // late/retried PaymentIntent success would fulfil the order for free on top
  // of that refund. Leave it CANCELLED for staff to review instead.
  // PRJ-1032.7: stamp the settlement time in the same atomic claim that flips the
  // order to PAID, so day-close can bracket card takings by when money was taken.
  const claim = await db.order.updateMany({ where: { id: orderId, status: { notIn: ['PAID', 'FULFILLED', 'CANCELLED'] } }, data: { status: 'PAID', paidAt: new Date() } });
  if (claim.count === 0) {
    // Lost the claim. Normally a concurrent caller already flipped it to
    // PAID/FULFILLED (the intended idempotent no-op). But if it's now CANCELLED,
    // a payment nonetheless succeeded against a cancelled order (whose gift-card
    // reservation was already credited back) — a paid customer stranded with no
    // fulfilment. Surface it for staff instead of returning silently. (BLD-761)
    const now = await db.order.findUnique({ where: { id: orderId }, select: { status: true } });
    if (now?.status === 'CANCELLED') console.error(`[shop] finalizeOrder: payment succeeded for CANCELLED order ${orderId} (${order.number}) — needs staff review; possible stranded payment.`);
    return { ok: true, number: order.number };
  }

  // Decrement stock for tracked products — guarded so it can never drive
  // stockQty negative (BLD-898). validateCart's stock read is a UX pre-check,
  // not a reservation: two carts can both pass it and both pay. The customer
  // here has already paid, so a lost race must not reject the order — instead
  // we take whatever stock is left (down to zero) and flag the oversell for
  // staff, rather than the old unconditional decrement + global negative-clamp
  // that hid it.
  for (const it of order.items) {
    if (!it.productId) continue;
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        // Normal case: enough stock — one conditional, atomic decrement.
        const dec = await db.product.updateMany({ where: { id: it.productId, trackInventory: true, stockQty: { gte: it.qty } }, data: { stockQty: { decrement: it.qty } } });
        if (dec.count > 0) break;
        // Short: take what's left. The stockQty < qty guard means a concurrent
        // restock between the two statements can't be clobbered to zero — the
        // update misses and the loop retries the plain decrement instead.
        const short = await db.product.updateMany({ where: { id: it.productId, trackInventory: true, stockQty: { lt: it.qty } }, data: { stockQty: 0 } });
        if (short.count > 0) {
          console.error(`[shop] finalizeOrder: oversold "${it.name}" on order ${order.number} — ordered ${it.qty}, stock ran out first (concurrent checkout). Remaining stock zeroed; fulfilment needs staff review. (BLD-898)`);
          try {
            const Sentry = await import('@sentry/nextjs');
            Sentry.captureMessage('[shop] order oversold — stock ran out between cart validation and payment', { level: 'warning', tags: { area: 'shop', order: order.number } });
          } catch { /* monitoring is best-effort */ }
          break;
        }
        // Neither matched: either the product is untracked/deleted (nothing to
        // decrement) or a restock landed between the two statements — retry.
        const p = await db.product.findUnique({ where: { id: it.productId }, select: { trackInventory: true } });
        if (!p || !p.trackInventory) break;
      }
    } catch { /* stock accounting is best-effort; never blocks fulfilment */ }
  }

  // NB: the gift-card balance was already RESERVED (atomically decremented) at
  // checkout time via reserveVoucher, so we deliberately do NOT redeem again here
  // — doing so would double-decrement the card. A failed/abandoned order
  // re-credits via creditVoucher (see the checkout route).

  // Confirmation email (best-effort).
  try {
    const { sendEmail, emailShell } = await import('@/lib/email');
    const rows = order.items.map((i) => `<tr><td style="padding:6px 0;">${i.name} × ${i.qty}</td><td style="padding:6px 0;text-align:right;">${formatPence(i.unitPence * i.qty)}</td></tr>`).join('');
    const body = `<h1 style="font-size:24px;margin:0 0 10px;">Thank you for your order</h1>
      <p>Order <strong>${order.number}</strong> is confirmed.</p>
      <table style="width:100%;font-size:14px;border-collapse:collapse;">${rows}
      <tr><td style="padding-top:8px;">Shipping</td><td style="padding-top:8px;text-align:right;">${formatPence(order.shippingPence)}</td></tr>
      ${order.giftCardPence ? `<tr><td>Gift card</td><td style="text-align:right;">−${formatPence(order.giftCardPence)}</td></tr>` : ''}
      <tr><td style="padding-top:8px;font-weight:bold;">Total paid</td><td style="padding-top:8px;text-align:right;font-weight:bold;">${formatPence(order.totalPence)}</td></tr></table>
      <p style="font-size:14px;color:#91766e;">${order.method === 'collect' ? 'Collect in clinic — we’ll let you know when it’s ready.' : 'We’ll dispatch your order shortly.'}</p>`;
    await sendEmail({ to: order.email, subject: `Your KClinics order ${order.number}`, html: emailShell({ body, preheader: `Order ${order.number} confirmed` }) });
  } catch { /* non-fatal */ }

  return { ok: true, number: order.number };
}

/** Restore stock decremented at finalizeOrder time when a paid/fulfilled order
 *  is later cancelled or refunded (PRJ-918.10). Idempotent: the CAS on
 *  Order.restockedAt means only the first caller for a given order actually
 *  increments stockQty, so a re-cancelled order, a webhook redelivery, or the
 *  admin route and a dashboard-refund webhook racing on the same order can't
 *  double-restock. Callers are responsible for only invoking this when the
 *  order was actually in a stock-decremented state (PAID/FULFILLED) before the
 *  cancel/refund — this function does not check that itself. */
export async function restockOrder(orderId: string): Promise<void> {
  const { db } = await import('@/lib/db');
  const claimed = await db.order.updateMany({ where: { id: orderId, restockedAt: null }, data: { restockedAt: new Date() } });
  if (claimed.count === 0) return; // already restocked
  const order = await db.order.findUnique({ where: { id: orderId }, select: { items: { select: { productId: true, qty: true } } } });
  if (!order) return;
  for (const it of order.items) {
    if (!it.productId) continue;
    await db.product.updateMany({ where: { id: it.productId, trackInventory: true }, data: { stockQty: { increment: it.qty } } }).catch(() => {});
  }
}
