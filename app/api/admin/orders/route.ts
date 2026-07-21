import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import * as Sentry from '@sentry/nextjs';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Manage retail orders (status + fulfilment). These change money/fulfilment
// state, so require finance.manage.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('finance.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  if (!body.id) return NextResponse.json({ ok: false }, { status: 400 });
  const { db } = await import('@/lib/db');

  // When marking an order as REFUNDED, or CANCELLING one that's already been
  // paid for (BLD-763: "Cancel" must not leave the customer charged with
  // nothing to show for it), issue the actual Stripe refund first.
  if (body.status === 'REFUNDED' || body.status === 'CANCELLED') {
    const order = await db.order.findUnique({ where: { id: body.id }, select: { stripePaymentIntentId: true, totalPence: true, status: true, giftCardCode: true, giftCardPence: true, email: true, number: true } });
    if (!order) return NextResponse.json({ ok: false, error: 'Order not found.' }, { status: 404 });
    const wasPaid = order.status === 'PAID' || order.status === 'FULFILLED';
    // Already in a reversed state (e.g. Cancel ran, then Mark-refunded fires on the
    // same order via a second tab / direct API call): the money was already put
    // back, so the non-idempotent side-effects below must not run a second time.
    const alreadyReversed = order.status === 'REFUNDED' || order.status === 'CANCELLED';
    const needsMoneyReversal = body.status === 'REFUNDED' || wasPaid;

    if (needsMoneyReversal) {
      // CAS guard: atomically claim the target status before touching Stripe.
      // A concurrent retry that lost the race gets count===0 and bails out,
      // preventing a second full refund on a transient 5xx re-submit.
      const claimed = await db.order.updateMany({ where: { id: body.id, status: { not: body.status } }, data: { status: body.status } });
      if (claimed.count === 0) return NextResponse.json({ ok: false, error: `Order already ${body.status.toLowerCase()}.` }, { status: 409 });
      if (order.stripePaymentIntentId) {
        const { stripe, stripeEnabled } = await import('@/lib/stripe');
        if (!stripeEnabled) {
          // Roll back the status claim — never leave an order marked refunded/
          // cancelled with the customer still charged and no refund issued.
          await db.order.updateMany({ where: { id: body.id, status: body.status }, data: { status: order.status } }).catch(() => {});
          return NextResponse.json({ ok: false, error: 'Stripe not configured.' }, { status: 503 });
        }
        try {
          await stripe().refunds.create(
            { payment_intent: order.stripePaymentIntentId, amount: order.totalPence, metadata: { orderId: body.id } },
            // Shared with the REFUNDED path (not scoped by body.status) so whichever
            // of "Mark refunded" / "Cancel" staff click first also wins at Stripe —
            // the other can never trigger a second refund for the same order.
            { idempotencyKey: `order-refund-${body.id}-${order.totalPence}` },
          );
        } catch (e) {
          Sentry.captureException(e, { tags: { area: 'admin/orders', stage: 'stripe-refund' } });
          // Roll back the status change so staff can retry after fixing Stripe config.
          await db.order.updateMany({ where: { id: body.id, status: body.status }, data: { status: order.status } }).catch(() => {});
          return NextResponse.json({ ok: false, error: (e as Error).message || 'Refund failed at Stripe.' }, { status: 502 });
        }
      }
      // BLD-393: restore the gift-card balance debited at checkout (it was permanently
      // lost on refund — only the card portion was refunded via Stripe above). Skip
      // when the order was already in a reversed state, so a Cancel-then-refund on
      // the same order can't credit the voucher twice.
      if (!alreadyReversed && order.giftCardCode && order.giftCardPence && order.giftCardPence > 0) {
        try { const { creditVoucher } = await import('@/lib/gift-vouchers'); await creditVoucher(order.giftCardCode, order.giftCardPence); }
        catch (e) {
          console.error('[orders] gift-card balance restore failed for', body.id, (e as Error)?.message);
          Sentry.captureException(e, { tags: { area: 'admin/orders', stage: 'voucher-restore' } });
        }
      }
      // PRJ-918.10: give back stock decremented at finalizeOrder time — ONLY if the
      // order was actually in a stock-decremented state (PAID/FULFILLED) first. Stock
      // is never decremented for a PENDING order, so restocking one (e.g. marking a
      // never-paid order refunded) would add phantom inventory. restockOrder is itself
      // idempotent (CAS on Order.restockedAt), so a retried/duplicate request, or
      // REFUNDED-after-CANCELLED, can't double-restock.
      if (wasPaid) {
        try { const { restockOrder } = await import('@/lib/shop'); await restockOrder(body.id); }
        catch (e) {
          console.error('[orders] restock failed for', body.id, (e as Error)?.message);
          Sentry.captureException(e, { tags: { area: 'admin/orders', stage: 'restock' } });
        }
      }
      // BLD-763: staff cancelling/refunding a paid order must not leave the
      // customer wondering where their money went. Only when money was actually
      // taken (wasPaid) — a never-charged order has nothing to return, and this also
      // stops a duplicate email on a Cancel-then-refund of the same order.
      if (wasPaid && order.email && order.stripePaymentIntentId) {
        try {
          const { sendEmail, emailShell } = await import('@/lib/email');
          const fmt = (p: number) => `£${(p / 100).toFixed(2)}`;
          const num = order.number.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
          const verb = body.status === 'CANCELLED' ? 'cancelled and refunded' : 'refunded';
          const subject = `Your KClinics order ${order.number} has been ${verb}`;
          const html = `<h1 style="font-size:22px;margin:0 0 10px;">Order ${verb}</h1><p>Order <strong>${num}</strong> has been ${verb}. <strong>${fmt(order.totalPence)}</strong> will be returned to your original payment method — this usually takes 5–10 business days to appear.</p><p style="font-size:14px;color:#91766e;">If you have any questions, please reply to this email.</p>`;
          await sendEmail({ to: order.email, subject, html: emailShell({ body: html, preheader: subject }) });
        } catch (e) { console.error('[orders] refund/cancel email failed for', body.id, (e as Error)?.message); }
      }
    }
    // PRJ-1033.2: a PENDING (unpaid) order that reserved a gift voucher at
    // checkout still has that balance debited. needsMoneyReversal is false for an
    // unpaid Cancel, so the restore above is skipped — and because this manual
    // flip consumes the PENDING status, neither the payment_intent.canceled nor
    // the checkout.session.expired webhook can win the claim to credit it either,
    // stranding real customer balance. Claim the transition atomically here and
    // credit only on the winning claim, so a concurrent webhook can't double-credit.
    else if (body.status === 'CANCELLED' && !alreadyReversed && order.giftCardCode && order.giftCardPence && order.giftCardPence > 0) {
      const claimed = await db.order.updateMany({ where: { id: body.id, status: 'PENDING' }, data: { status: 'CANCELLED' } });
      if (claimed.count > 0) {
        try { const { creditVoucher } = await import('@/lib/gift-vouchers'); await creditVoucher(order.giftCardCode, order.giftCardPence); }
        catch (e) {
          console.error('[orders] unpaid-cancel voucher restore failed for', body.id, (e as Error)?.message);
          Sentry.captureException(e, { tags: { area: 'admin/orders', stage: 'voucher-restore-unpaid' } });
        }
      }
    }
  }

  const data: Record<string, unknown> = {};
  if (body.status && ['PENDING', 'PAID', 'FULFILLED', 'CANCELLED', 'REFUNDED'].includes(body.status)) data.status = body.status;
  if (body.fulfillment && ['unfulfilled', 'shipped', 'collected'].includes(body.fulfillment)) data.fulfillment = body.fulfillment;
  if (body.trackingNote !== undefined) data.trackingNote = body.trackingNote ? String(body.trackingNote).slice(0, 300) : null;
  if (Object.keys(data).length === 0) return NextResponse.json({ ok: false, error: 'Nothing to update.' }, { status: 400 });

  // Fetch order before update so we can detect fulfillment transitions.
  const prevOrder = await db.order.findUnique({
    where: { id: body.id },
    select: { email: true, number: true, fulfillment: true, method: true, trackingNote: true, status: true, paidAt: true },
  });

  // PRJ-1033.3: a manual PENDING→PAID must go through finalizeOrder, not a bare
  // status write. finalizeOrder atomically claims the order, decrements stock,
  // redeems any reserved voucher, stamps paidAt (PRJ-1032.7) and emails
  // confirmation — it is the single canonical "order is now paid" path and is
  // idempotent. Writing status:PAID directly skipped the stock decrement, so a
  // later Cancel/Refund (wasPaid=true) ran restockOrder and inflated inventory.
  if (data.status === 'PAID' && prevOrder?.status === 'PENDING') {
    const { finalizeOrder } = await import('@/lib/shop');
    await finalizeOrder(body.id);
    delete data.status; // finalizeOrder owns the PAID flip + paidAt
  } else if (data.status === 'PAID' && prevOrder && !prevOrder.paidAt) {
    // Rare non-PENDING → PAID (e.g. reinstating an order): keep the plain flip
    // and still stamp the settlement time so day-close brackets it correctly.
    data.paidAt = new Date();
  }

  if (Object.keys(data).length > 0) await db.order.update({ where: { id: body.id }, data });
  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: `Updated order ${body.id}` });

  // Send dispatch/collection-ready email when fulfillment first transitions to shipped or collected.
  if (prevOrder && body.fulfillment && prevOrder.fulfillment !== body.fulfillment &&
      (body.fulfillment === 'shipped' || body.fulfillment === 'collected')) {
    try {
      const { sendEmail, emailShell } = await import('@/lib/email');
      const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
      const tracking = esc(String(body.trackingNote || prevOrder.trackingNote || ''));
      const num = esc(prevOrder.number);
      const isCollect = body.fulfillment === 'collected';
      const subject = isCollect ? `Your KClinics order ${prevOrder.number} is ready to collect` : `Your KClinics order ${prevOrder.number} has been dispatched`;
      const body2 = isCollect
        ? `<h1 style="font-size:22px;margin:0 0 10px;">Ready to collect</h1><p>Order <strong>${num}</strong> is ready for you at the clinic.${tracking ? ` <em>${tracking}</em>` : ''}</p><p style="font-size:14px;color:#91766e;">Pop in at your convenience — we're looking forward to seeing you.</p>`
        : `<h1 style="font-size:22px;margin:0 0 10px;">On its way</h1><p>Order <strong>${num}</strong> has been dispatched.${tracking ? ` ${tracking}` : ''}</p><p style="font-size:14px;color:#91766e;">If you have any questions about your delivery please reply to this email.</p>`;
      await sendEmail({ to: prevOrder.email, subject, html: emailShell({ body: body2, preheader: subject }) });
    } catch { /* non-fatal */ }
  }

  revalidatePath('/admin/orders');
  return NextResponse.json({ ok: true });
}
