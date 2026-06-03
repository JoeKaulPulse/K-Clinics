import 'server-only';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { site } from '@/lib/site';

export const VOUCHER_PRESETS = [2500, 5000, 7500, 10000, 15000, 25000];
export const VOUCHER_MIN = 1000;   // £10
export const VOUCHER_MAX = 50000;  // £500

const baseUrl = () => process.env.NEXT_PUBLIC_SITE_URL || site.url;
const money = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0 })}`;

function genCode(): string {
  const part = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  return `KC-GV-${part()}-${part()}`;
}

export type VoucherInput = {
  amountPence: number;
  purchaserName: string;
  purchaserEmail: string;
  recipientName?: string;
  recipientEmail?: string;
  message?: string;
  deliverAt?: string | null; // ISO date for scheduled delivery
};

/** Create a PENDING voucher + a Stripe PaymentIntent (charged now). */
export async function createVoucherIntent(input: VoucherInput): Promise<{ ok: boolean; error?: string; voucherId?: string; clientSecret?: string }> {
  const amount = Math.round(input.amountPence);
  if (!(amount >= VOUCHER_MIN && amount <= VOUCHER_MAX)) return { ok: false, error: `Choose an amount between ${money(VOUCHER_MIN)} and ${money(VOUCHER_MAX)}.` };
  if (!input.purchaserName?.trim() || !/\S+@\S+\.\S+/.test(input.purchaserEmail || '')) return { ok: false, error: 'Please enter your name and a valid email.' };

  const { stripe, stripeEnabled } = await import('@/lib/stripe');
  if (!stripeEnabled) return { ok: false, error: 'Payments aren’t available right now. Please call us.' };

  const deliverAt = input.deliverAt ? new Date(input.deliverAt) : null;
  const voucher = await db.giftVoucher.create({
    data: {
      code: genCode(), amountPence: amount, balancePence: amount, status: 'PENDING',
      purchaserName: input.purchaserName.trim(), purchaserEmail: input.purchaserEmail.trim().toLowerCase(),
      recipientName: input.recipientName?.trim() || null, recipientEmail: input.recipientEmail?.trim().toLowerCase() || null,
      message: input.message?.slice(0, 500) || null,
      deliverAt: deliverAt && !isNaN(+deliverAt) ? deliverAt : null,
    },
  });

  try {
    const pi = await stripe().paymentIntents.create({
      amount, currency: 'gbp', automatic_payment_methods: { enabled: true },
      description: `KClinics gift voucher ${money(amount)}`,
      receipt_email: input.purchaserEmail.trim().toLowerCase(),
      metadata: { voucherId: voucher.id, kind: 'gift_voucher' },
    });
    await db.giftVoucher.update({ where: { id: voucher.id }, data: { stripePaymentIntentId: pi.id } });
    return { ok: true, voucherId: voucher.id, clientSecret: pi.client_secret || undefined };
  } catch (e) {
    await db.giftVoucher.delete({ where: { id: voucher.id } }).catch(() => {});
    return { ok: false, error: (e as Error).message || 'Could not start payment.' };
  }
}

/** Confirm after the card is charged: activate + email (immediate delivery). */
export async function confirmVoucher(voucherId: string): Promise<{ ok: boolean; error?: string; code?: string }> {
  const v = await db.giftVoucher.findUnique({ where: { id: voucherId } });
  if (!v) return { ok: false, error: 'Voucher not found.' };
  if (v.status === 'ACTIVE' || v.status === 'REDEEMED') return { ok: true, code: v.code };
  if (!v.stripePaymentIntentId) return { ok: false, error: 'No payment found.' };

  const { stripe } = await import('@/lib/stripe');
  const pi = await stripe().paymentIntents.retrieve(v.stripePaymentIntentId);
  if (pi.status !== 'succeeded') return { ok: false, error: 'Payment not completed.' };

  const expiresAt = new Date(); expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  const immediate = !v.deliverAt || v.deliverAt <= new Date();
  await db.giftVoucher.update({ where: { id: v.id }, data: { status: 'ACTIVE', expiresAt, delivered: immediate } });

  await sendVoucherEmails(v.id, immediate).catch((e) => console.error('[gift-voucher] email failed:', (e as Error)?.message));
  return { ok: true, code: v.code };
}

async function sendVoucherEmails(voucherId: string, sendToRecipient: boolean) {
  const v = await db.giftVoucher.findUnique({ where: { id: voucherId } });
  if (!v) return;
  const { sendEmail, tmplGiftVoucher, tmplGiftVoucherReceipt } = await import('@/lib/email');
  const tasks: Promise<unknown>[] = [
    sendEmail({ to: v.purchaserEmail, subject: `Your KClinics gift voucher — ${money(v.amountPence)}`, html: tmplGiftVoucherReceipt({ purchaserName: v.purchaserName, amount: money(v.amountPence), code: v.code, recipientName: v.recipientName, scheduled: !sendToRecipient && !!v.deliverAt, deliverAt: v.deliverAt }) }),
  ];
  if (sendToRecipient && v.recipientEmail) {
    tasks.push(sendEmail({ to: v.recipientEmail, subject: `${v.purchaserName} sent you a KClinics gift voucher 🎁`, html: tmplGiftVoucher({ recipientName: v.recipientName || 'there', fromName: v.purchaserName, amount: money(v.amountPence), code: v.code, message: v.message, bookUrl: `${baseUrl()}/account/gift-cards?code=${v.code}` }) }));
  }
  await Promise.allSettled(tasks);
}

/** Cron: deliver scheduled vouchers whose date has arrived. */
export async function deliverDueVouchers(): Promise<number> {
  const due = await db.giftVoucher.findMany({ where: { status: 'ACTIVE', delivered: false, deliverAt: { lte: new Date() }, recipientEmail: { not: null } } });
  let sent = 0;
  for (const v of due) {
    await sendVoucherEmails(v.id, true).catch(() => {});
    await db.giftVoucher.update({ where: { id: v.id }, data: { delivered: true } });
    sent++;
  }
  return sent;
}

/** Staff: deduct from a voucher's balance (manual redemption). */
export async function redeemVoucher(id: string, amountPence: number): Promise<{ ok: boolean; error?: string; balancePence?: number }> {
  const v = await db.giftVoucher.findUnique({ where: { id } });
  if (!v || v.status === 'CANCELLED') return { ok: false, error: 'Voucher unavailable.' };
  const take = Math.min(Math.max(0, Math.round(amountPence)), v.balancePence);
  const balancePence = v.balancePence - take;
  await db.giftVoucher.update({ where: { id }, data: { balancePence, status: balancePence === 0 ? 'REDEEMED' : 'ACTIVE' } });
  return { ok: true, balancePence };
}

/** Recipient claims/validates a voucher onto their account. The recipient must
 *  be 18+ (gift cards are for treatments). The API ensures the client is 18+
 *  before calling this. */
export async function claimVoucher(clientId: string, code: string): Promise<{ ok: boolean; error?: string; amountPence?: number }> {
  const v = await db.giftVoucher.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!v) return { ok: false, error: 'We couldn’t find that gift card code.' };
  if (v.status === 'PENDING') return { ok: false, error: 'This gift card isn’t active yet.' };
  if (v.status === 'CANCELLED') return { ok: false, error: 'This gift card is no longer valid.' };
  if (v.claimedByClientId && v.claimedByClientId !== clientId) return { ok: false, error: 'This gift card has already been claimed by another account.' };
  const { db: dbi } = await import('@/lib/db');
  const client = await dbi.client.findUnique({ where: { id: clientId }, select: { email: true } });
  await db.giftVoucher.update({ where: { id: v.id }, data: { claimedByClientId: clientId, claimedAt: new Date(), recipientEmail: v.recipientEmail ?? client?.email ?? null } });
  return { ok: true, amountPence: v.balancePence };
}
