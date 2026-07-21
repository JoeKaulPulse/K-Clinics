import { NextResponse } from 'next/server';
import { z } from 'zod';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// BLD-148: the caller must supply the Stripe PaymentIntent client_secret from
// the checkout it just completed. Its PaymentIntent id is matched against the
// voucher's stored stripePaymentIntentId, so a guessed/enumerated voucherId
// alone can no longer activate someone else's pending voucher (IDOR).
const schema = z.object({ voucherId: z.string().min(1), clientSecret: z.string().min(1) });

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 422 });

  const { db } = await import('@/lib/db');
  const voucher = await db.giftVoucher.findUnique({
    where: { id: parsed.data.voucherId },
    select: { stripePaymentIntentId: true, amountPence: true, physicalFeePence: true, purchaserEmail: true },
  });
  // The PaymentIntent id is the portion of the client_secret before `_secret_`.
  const providedPi = parsed.data.clientSecret.split('_secret_')[0];
  if (!voucher?.stripePaymentIntentId || !providedPi || providedPi !== voucher.stripePaymentIntentId) {
    return NextResponse.json({ ok: false, error: 'Payment could not be verified.' }, { status: 403 });
  }

  const { confirmVoucher } = await import('@/lib/gift-vouchers');
  const res = await confirmVoucher(parsed.data.voucherId);
  if (res.ok) {
    const { sendPurchase } = await import('@/lib/conversions');
    const totalPence = (voucher.amountPence ?? 0) + (voucher.physicalFeePence ?? 0);
    // PRJ-918.13: the purchaser gave no marketing consent at checkout (no opt-in
    // field on this form), so only pass their email to Meta/GA4 if they're
    // already an opted-in, non-unsubscribed client from elsewhere.
    const purchaser = await db.client.findFirst({
      where: { email: voucher.purchaserEmail },
      select: { marketingOptIn: true, unsubscribed: true },
    });
    const consentedEmail = purchaser?.marketingOptIn && !purchaser.unsubscribed ? voucher.purchaserEmail : null;
    sendPurchase({ bookingId: parsed.data.voucherId, valuePence: totalPence, email: consentedEmail }).catch(() => {});
  }
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
