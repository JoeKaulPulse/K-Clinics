import { NextResponse } from 'next/server';
import { z } from 'zod';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// BLD-148: require the Stripe PaymentIntent client_secret so only the actual
// payer (who received it during purchase) can activate a voucher. Without this
// any voucherId — guessed or enumerated — could be confirmed for free.
const schema = z.object({
  voucherId: z.string().min(1),
  clientSecret: z.string().min(1),
});

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 422 });

  const { voucherId, clientSecret } = parsed.data;

  const { db } = await import('@/lib/db');
  const { stripe, stripeEnabled } = await import('@/lib/stripe');
  if (!stripeEnabled) return NextResponse.json({ ok: false, error: 'Payments not configured.' }, { status: 503 });

  const voucher = await db.giftVoucher.findUnique({ where: { id: voucherId }, select: { stripePaymentIntentId: true } });
  if (!voucher?.stripePaymentIntentId) return NextResponse.json({ ok: false, error: 'Voucher not found.' }, { status: 404 });

  const pi = await stripe().paymentIntents.retrieve(voucher.stripePaymentIntentId);
  if (pi.client_secret !== clientSecret) return NextResponse.json({ ok: false, error: 'Invalid payment reference.' }, { status: 403 });

  const { confirmVoucher } = await import('@/lib/gift-vouchers');
  const res = await confirmVoucher(voucherId);
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
