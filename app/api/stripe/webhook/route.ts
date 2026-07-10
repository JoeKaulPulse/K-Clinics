import { NextResponse } from 'next/server';
import { stripeEnabled, stripe } from '@/lib/stripe';
import * as Sentry from '@sentry/nextjs';

export const runtime = 'nodejs';

// Keeps booking/payment state in sync with Stripe. Verifies the signature with
// STRIPE_WEBHOOK_SECRET. Configure this endpoint in the Stripe dashboard.
export async function POST(req: Request) {
  if (!stripeEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get('stripe-signature');
  if (!secret || !sig) return NextResponse.json({ ok: false }, { status: 400 });

  const body = await req.text();
  let event;
  try {
    event = stripe().webhooks.constructEvent(body, sig, secret);
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 400 });
  }

  const { db } = await import('@/lib/db');

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        const bookingId = pi.metadata?.bookingId;
        if (bookingId) {
          // BLD-396: guard against underpayment on full-balance booking charges.
          // BLD-797: a staff-created payment link (app/api/admin/bookings/session/route.ts
          // 'paylink' case) can legitimately charge less than booking.pricePence for an
          // agreed discount -- it stamps the intended amount into expectedPence so the
          // guard checks against what staff actually asked for, not the undiscounted price.
          if (pi.metadata?.kind === 'booking_balance') {
            const expectedPence = pi.metadata?.expectedPence ? Number(pi.metadata.expectedPence) : undefined;
            if (expectedPence !== undefined) {
              if ((pi.amount_received ?? 0) < expectedPence) {
                console.error('[webhook] booking balance underpayment — not finalising:', { received: pi.amount_received, expected: expectedPence, bookingId });
                break;
              }
            } else {
              const bk = await db.booking.findUnique({ where: { id: bookingId }, select: { pricePence: true } });
              if (bk && (pi.amount_received ?? 0) < bk.pricePence) {
                console.error('[webhook] booking balance underpayment — not finalising:', { received: pi.amount_received, expected: bk.pricePence, bookingId });
                break;
              }
            }
          }
          // Idempotent: records the charge, emails the receipt and credits loyalty
          // if it hasn't already been finalised synchronously. This is the backstop
          // that completes an SCA charge once the client authenticates via /booking/pay.
          // BLD-508: record ONLY the amount actually captured (amount_received), never
          // the requested amount (pi.amount). For a partially-captured / not-fully-paid
          // intent amount_received is below pi.amount, so the old `?? pi.amount` fallback
          // could mark a booking fully paid for money that was never taken. If nothing
          // was received, do not finalise — leave it for staff.
          const receivedPence = pi.amount_received ?? 0;
          if (receivedPence <= 0) {
            console.error('[webhook] payment_intent.succeeded with no amount_received — not finalising:', { bookingId, piId: pi.id });
          } else {
            const { finalizeBookingCharge } = await import('@/lib/booking-actions');
            await finalizeBookingCharge(bookingId, pi.id, receivedPence, { late: pi.metadata?.late === 'true' });
          }
        }
        // Finalise retail orders server-side so they complete even if the customer
        // closes the tab. Assert amount_received matches the stored order total to
        // guard against discount/currency manipulation.
        if (pi.metadata?.kind === 'shop_order' && pi.metadata?.orderId) {
          try {
            const order = await db.order.findUnique({ where: { id: pi.metadata.orderId }, select: { totalPence: true } });
            if (order && pi.currency === 'gbp' && pi.amount_received >= order.totalPence) {
              const { finalizeOrder } = await import('@/lib/shop');
              await finalizeOrder(pi.metadata.orderId);
            } else {
              console.error('[webhook] shop order skipped — amount mismatch or currency:', { received: pi.amount_received, expected: order?.totalPence, currency: pi.currency });
            }
          } catch (e) { console.error('[webhook] order finalize failed:', (e as Error)?.message); }
        }
        // BLD-119: handle both gift_voucher and gift_package — gift_package used the
        // wrong kind constant so the webhook backstop never confirmed it, leaving
        // paid-but-tab-closed purchases stuck in PENDING.
        if ((pi.metadata?.kind === 'gift_voucher' || pi.metadata?.kind === 'gift_package') && pi.metadata?.voucherId) {
          try { const { confirmVoucher } = await import('@/lib/gift-vouchers'); await confirmVoucher(pi.metadata.voucherId); } catch (e) { console.error('[webhook] voucher confirm failed:', (e as Error)?.message); }
        }
        // BLD-399 (BLD-409 course context): a Buy-Now-Pay-Later course pre-payment
        // succeeded (Klarna/Clearpay via hosted Checkout). Mark the booking PRE-PAID
        // so NO card-on-file charge is taken for it. Correctness-critical:
        //  • idempotent — no-op if already pre-paid;
        //  • validates currency (GBP) and that the full course total was received;
        //  • derives the method from the charge (klarna / afterpay_clearpay → bnpl).
        // BLD-528: an academy enrolment payment (course fee / deposit / balance)
        // succeeded — card or Klarna/Clearpay. Idempotently mark the payment PAID,
        // advance the enrolment to PAID (unlocking course content) and notify staff.
        // Shares finalizeEnrolmentPayment with the synchronous confirm endpoint.
        if (pi.metadata?.kind === 'enrolment' && pi.metadata?.enrolmentId) {
          let methodType: string | undefined;
          try {
            const chargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id;
            if (chargeId) methodType = (await stripe().charges.retrieve(chargeId)).payment_method_details?.type;
          } catch { /* method is best-effort */ }
          const { finalizeEnrolmentPayment } = await import('@/lib/academy-payments');
          await finalizeEnrolmentPayment(pi.id, pi.amount_received ?? 0, pi.currency, methodType);
        }
        if (pi.metadata?.kind === 'course_prepaid' && pi.metadata?.bookingId) {
          const courseBookingId = pi.metadata.bookingId;
          const booking = await db.booking.findUnique({ where: { id: courseBookingId }, select: { prepaidVia: true, clientId: true } });
          if (!booking) {
            console.error('[webhook] course_prepaid skipped — booking not found:', courseBookingId);
          } else if (booking.prepaidVia) {
            // Already pre-paid (redelivery / double-fire) — nothing to do.
          } else {
            const { courseTotalPence } = await import('@/lib/booking-actions');
            const course = await courseTotalPence(courseBookingId);
            const received = pi.amount_received ?? 0;
            if (!course || pi.currency !== 'gbp' || received < course.pence) {
              // Underpayment / wrong currency — do NOT mark paid; leave it for staff.
              console.error('[webhook] course pre-payment not validated — not marking paid:', { received, expected: course?.pence, currency: pi.currency, bookingId: courseBookingId });
            } else {
              // Method: klarna → 'klarna', afterpay_clearpay → 'clearpay', else 'bnpl'.
              // The PI carries the charge id (latest_charge); fetch it for the method.
              let method = 'bnpl';
              try {
                const chargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id;
                const type = chargeId ? (await stripe().charges.retrieve(chargeId)).payment_method_details?.type : undefined;
                if (type === 'klarna') method = 'klarna';
                else if (type === 'afterpay_clearpay') method = 'clearpay';
              } catch (e) { console.error('[webhook] course pre-payment method lookup failed (defaulting to bnpl):', (e as Error)?.message); }
              // Claim idempotently: only the writer that flips prepaidVia from null
              // runs the side-effects, guarding webhook redeliveries.
              const claimed = await db.booking.updateMany({
                where: { id: courseBookingId, prepaidVia: null },
                data: { prepaidVia: method, prepaidPence: received, prepaidAt: new Date(), prepaidCheckoutId: pi.metadata.checkoutId || undefined, status: 'CONFIRMED' },
              });
              if (claimed.count > 0) {
                try {
                  const { logAudit } = await import('@/lib/audit');
                  await logAudit({ action: 'PAYMENT_CHARGED', actor: 'stripe-webhook', bookingId: courseBookingId, clientId: booking.clientId, summary: `Course pre-paid via ${method} — £${(received / 100).toFixed(2)}`, meta: { kind: 'course_prepaid', method, amountPence: received, paymentIntentId: pi.id } });
                } catch { /* non-fatal */ }
                try { await db.interaction.create({ data: { clientId: booking.clientId, type: 'APPOINTMENT', summary: `Course pre-paid in full via ${method} — £${(received / 100).toFixed(2)}`, author: 'stripe-webhook' } }); } catch { /* non-fatal */ }
                // BLD-568: send the booking confirmation email to the client.
                try { const { notifyBookingConfirmed } = await import('@/lib/booking-notify'); await notifyBookingConfirmed(courseBookingId); } catch { /* non-fatal */ }
              }
            }
          }
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        // An off-session charge that failed asynchronously (decline/expiry).
        // Make it visible to staff instead of letting it vanish.
        const pi = event.data.object;
        const bookingId = pi.metadata?.bookingId;
        if (bookingId) {
          const { recordChargeFailure } = await import('@/lib/booking-actions');
          const reason = pi.last_payment_error?.message || 'The card was declined.';
          await recordChargeFailure(bookingId, reason);
          try {
            const { notifyStaffByPermission } = await import('@/lib/notifications');
            await notifyStaffByPermission('finance.view', { kind: 'status', category: 'finance', priority: 'urgent', title: 'Payment failed', body: reason.slice(0, 140), href: `/admin/bookings/${bookingId}` });
          } catch { /* non-fatal */ }
        }
        // BLD-761: a shop order's reserved gift-card balance is NOT re-credited
        // here. A declined Elements attempt fires payment_failed while the
        // PaymentIntent stays alive at requires_payment_method for an immediate
        // retry on the SAME PI, so cancelling/crediting now would restore the
        // gift card on a PI that then succeeds — doubling its value. The re-credit
        // happens only once the PI reaches its terminal 'canceled' state, handled
        // in the payment_intent.canceled case below. (payment_failed never carries
        // status 'canceled' — that transition arrives as payment_intent.canceled.)
        break;
      }
      case 'payment_intent.canceled': {
        // The PaymentIntent reached its terminal 'canceled' state (the customer
        // gave up and it was cancelled explicitly, Stripe auto-cancelled it, or a
        // checkout session expired). Re-credit any gift-card balance reserved at
        // checkout so the value isn't permanently lost (BLD-567/BLD-761).
        // Idempotent + race-safe: only the caller that wins the PENDING→CANCELLED
        // transition credits, so a redelivered event or a prior admin cancel can't
        // double-credit, and an order that already went PAID (a retry succeeded
        // first) is never touched.
        const pi = event.data.object;
        if (pi.metadata?.kind === 'shop_order' && pi.metadata?.orderId) {
          try {
            const order = await db.order.findUnique({ where: { id: pi.metadata.orderId }, select: { giftCardCode: true, giftCardPence: true } });
            if (order?.giftCardCode && order.giftCardPence && order.giftCardPence > 0) {
              const claimed = await db.order.updateMany({ where: { id: pi.metadata.orderId, status: 'PENDING' }, data: { status: 'CANCELLED' } });
              if (claimed.count > 0) {
                const { creditVoucher } = await import('@/lib/gift-vouchers');
                await creditVoucher(order.giftCardCode, order.giftCardPence);
              }
            }
          } catch (e) { console.error('[webhook] gift card re-credit failed:', (e as Error)?.message); }
        }
        break;
      }
      case 'setup_intent.succeeded': {
        const si = event.data.object;
        const bookingId = si.metadata?.bookingId;
        const pm = typeof si.payment_method === 'string' ? si.payment_method : si.payment_method?.id;
        if (bookingId && pm) {
          await db.booking.updateMany({
            where: { id: bookingId, stripePaymentMethodId: null },
            data: { stripePaymentMethodId: pm },
          });
        }
        break;
      }
      // BLD-123: refunds issued directly in the Stripe dashboard bypass the app.
      // Reconcile: compute the delta vs what's already recorded and run the same
      // post-refund side-effects (loyalty reversal, Xero credit note, audit log).
      case 'charge.refunded': {
        const charge = event.data.object;
        const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : null;
        if (!piId) break;
        // Refunds raised in-app carry metadata.bookingId (booking refunds) or
        // metadata.orderId (shop order refunds) and already run every side-effect
        // themselves. Their webhook echo can race ahead of the in-app DB write —
        // without this skip we'd double-log or double-credit gift cards.
        const originatedInApp = (charge.refunds?.data ?? []).some((r) => Boolean(r.metadata?.bookingId) || Boolean(r.metadata?.orderId));
        if (originatedInApp) break;
        const booking = await db.booking.findFirst({
          where: { chargePaymentIntentId: piId },
          include: { client: true },
        });
        if (!booking) {
          // Not a booking charge — check, in turn, whether this PaymentIntent is a
          // shop order, a gift-voucher's own purchase, or an academy enrolment
          // payment. Each PI belongs to exactly one of these, so the first match wins.
          //
          // Dashboard refund on a shop order — restore gift-card balance if applicable
          // and restock any trackInventory items (PRJ-918.10): a PAID/FULFILLED order
          // already decremented stock at finalizeOrder time, so a refund permanently
          // loses that stock unless we give it back here too. restockOrder is
          // idempotent (CAS on Order.restockedAt), so a redelivered event can't
          // double-restock.
          const order = await db.order.findFirst({
            where: { stripePaymentIntentId: piId },
            select: { id: true, status: true, giftCardCode: true, giftCardPence: true },
          });
          if (order?.giftCardCode && order.giftCardPence && order.giftCardPence > 0) {
            // creditVoucher now caps the balance at the card's face value (BLD-646)
            // but is not per-call idempotent, and charge.refunded redelivers / fires
            // per partial refund — so claim the order's status → REFUNDED atomically
            // and only credit when *this* call wins the transition. Mirrors the
            // in-app refund route and the payment_failed order block.
            const wasStockDecremented = order.status === 'PAID' || order.status === 'FULFILLED';
            const claimed = await db.order.updateMany({ where: { id: order.id, status: { not: 'REFUNDED' } }, data: { status: 'REFUNDED' } });
            if (claimed.count > 0) {
              if (wasStockDecremented) {
                try { const { restockOrder } = await import('@/lib/shop'); await restockOrder(order.id); } catch (e) { console.error('[webhook] order restock failed:', (e as Error)?.message); }
              }
              try { const { creditVoucher } = await import('@/lib/gift-vouchers'); await creditVoucher(order.giftCardCode, order.giftCardPence); } catch (e) { console.error('[webhook] gift card re-credit failed:', (e as Error)?.message); }
            }
          }
          // PRJ-918.2: a gift-voucher's OWN purchase PaymentIntent was refunded. This
          // is distinct from the order case above (an order that merely redeemed a
          // voucher as a discount — that one still credits back, correctly, since
          // the customer's cash for THAT purchase wasn't refunded). Here the customer
          // got their money back for buying the gift card itself, so the old
          // behaviour — creditVoucher, which increased the balance and revived a
          // REDEEMED card — was a double payout: cash back AND a spendable (or
          // regrown) card. Debit/cancel it instead. purchaseRefundedPence is the
          // watermark of how much of the purchase we've already reconciled (mirrors
          // the booking.refundedPence CAS above), so a redelivered event or a
          // partial-then-full refund pair can't double-debit.
          if (!order) {
            const voucher = await db.giftVoucher.findFirst({
              where: { stripePaymentIntentId: piId },
              select: { id: true, amountPence: true, purchaseRefundedPence: true },
            });
            if (voucher) {
              const totalRefundedByStripe = charge.amount_refunded ?? 0;
              const alreadyRecorded = voucher.purchaseRefundedPence ?? 0;
              const delta = totalRefundedByStripe - alreadyRecorded;
              if (delta > 0) {
                const claimedV = await db.giftVoucher.updateMany({
                  where: { id: voucher.id, purchaseRefundedPence: alreadyRecorded },
                  data: { purchaseRefundedPence: totalRefundedByStripe },
                });
                if (claimedV.count > 0) {
                  try {
                    const { debitVoucherForPurchaseRefund } = await import('@/lib/gift-vouchers');
                    await debitVoucherForPurchaseRefund(voucher.id, Math.min(delta, voucher.amountPence), totalRefundedByStripe);
                  } catch (e) { console.error('[webhook] voucher purchase refund debit failed:', (e as Error)?.message); }
                }
              }
            }
            // PRJ-918.12: not a booking, shop order or voucher purchase — check
            // whether this PaymentIntent paid an academy enrolment fee/deposit/
            // balance. Stripe-dashboard refunds bypass refundEnrolmentPayment, which
            // is the only place that otherwise flips the payment row to REFUNDED and
            // rolls back Enrolment.paidPence, so without this the payment stays PAID
            // and paidPence-gated course access stays unlocked after the money has
            // left the Stripe balance. reconcileEnrolmentPaymentRefund mirrors that
            // function's DB effects; no admin actor is available here (out-of-band),
            // so its audit entry is attributed to the webhook.
            if (!voucher && charge.refunded) {
              try {
                const { reconcileEnrolmentPaymentRefund } = await import('@/lib/academy-payments');
                await reconcileEnrolmentPaymentRefund(piId);
              } catch (e) { console.error('[webhook] enrolment payment refund reconcile failed:', (e as Error)?.message); }
            }
          }
          break;
        }
        const totalRefundedByStripe = charge.amount_refunded ?? 0;
        const alreadyRecorded = booking.refundedPence ?? 0;
        const delta = totalRefundedByStripe - alreadyRecorded;
        if (delta <= 0) break; // already fully reconciled
        const newTotal = alreadyRecorded + delta;
        const fully = newTotal >= (booking.chargedPence ?? 0);
        // Compare-and-swap: only the writer that advances refundedPence past the
        // value it observed runs the side-effects. Guards webhook redeliveries.
        const claimed = await db.booking.updateMany({
          where: { id: booking.id, refundedPence: booking.refundedPence },
          data: { refundedPence: newTotal, refundedAt: new Date() },
        });
        if (claimed.count === 0) break; // a concurrent writer got there first
        if (fully) {
          try { const { refundBookingPoints } = await import('@/lib/client-loyalty'); await refundBookingPoints(booking.id); } catch { /* non-fatal */ }
        }
        try { const { pushBookingRefundToXero } = await import('@/lib/xero'); await pushBookingRefundToXero(booking.id, delta, 'Stripe refund'); } catch { /* non-fatal */ }
        try { const { logAudit } = await import('@/lib/audit'); await logAudit({ action: 'PAYMENT_REFUNDED', actor: 'stripe-webhook', bookingId: booking.id, clientId: booking.clientId, summary: `Webhook refund £${(delta / 100).toFixed(2)}${fully ? ' (full)' : ' (partial)'}`, meta: { delta, fully } }); } catch { /* non-fatal */ }
        // BLD-569: email the client when a refund is issued directly in the Stripe
        // dashboard (in-app refunds already send via refundBooking()).
        try {
          const { sendEmail, tmplRefund } = await import('@/lib/email');
          await sendEmail({ to: booking.client.email, subject: `Refund processed — ${booking.treatmentTitle}`, html: tmplRefund({ firstName: booking.client.firstName, treatment: booking.treatmentTitle, amountPence: delta, fully }) });
        } catch { /* non-fatal */ }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error('webhook handler error', e);
    Sentry.captureException(e, { tags: { eventType: event.type } });
    // Return 500 for revenue-critical events so Stripe retries rather than
    // silently dropping the event on a transient DB failure.
    // BLD-412: setup_intent.succeeded must also retry — a 200 on DB failure
    // tells Stripe "delivered", losing the saved card permanently.
    // BLD-399: a course pre-payment (course_prepaid) is real money — a DB failure
    // while marking it PRE-PAID must also retry, not silently drop the payment.
    // (payment_intent.succeeded already covers it; the explicit kind check keeps
    // the intent clear and survives any future narrowing of the type test.)
    const pmtKind = event.type.startsWith('payment_intent.') ? (event.data.object as { metadata?: { kind?: string } }).metadata?.kind : undefined;
    // BLD-603: payment_intent.payment_failed must also retry — a 200 on DB failure
    // loses the recordChargeFailure write, leaving staff blind to the failed charge.
    const critical =
      event.type === 'payment_intent.succeeded' ||
      event.type === 'payment_intent.payment_failed' ||
      event.type === 'charge.refunded' ||
      event.type === 'setup_intent.succeeded' ||
      pmtKind === 'course_prepaid';
    if (critical) return NextResponse.json({ received: false, error: 'Handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
