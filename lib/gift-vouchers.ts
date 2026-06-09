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
  design?: string;           // chosen card theme id (lib/gift-card-themes)
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
      design: input.design?.slice(0, 40) || null,
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
  // Activate atomically — only the call that flips PENDING→ACTIVE sends the
  // emails, so a concurrent webhook + client-confirm don't double-send.
  const claimed = await db.giftVoucher.updateMany({ where: { id: v.id, status: 'PENDING' }, data: { status: 'ACTIVE', expiresAt, delivered: immediate } });
  if (claimed.count === 0) return { ok: true, code: v.code };

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
  if (!v) return { ok: false, error: 'Voucher not found.' };
  if (v.status !== 'ACTIVE') return { ok: false, error: v.status === 'PENDING' ? 'This voucher isn’t active yet (payment pending).' : 'This voucher is no longer valid.' };
  if (v.expiresAt && v.expiresAt < new Date()) return { ok: false, error: 'This voucher has expired.' };
  if (v.balancePence <= 0) return { ok: false, error: 'This voucher has no balance left.' };
  const take = Math.min(Math.max(0, Math.round(amountPence)), v.balancePence);
  if (take <= 0) return { ok: false, error: 'Enter an amount to redeem.' };
  // Atomic decrement: the `balancePence >= take` guard means two concurrent
  // redemptions can't both succeed and overspend the card.
  const res = await db.giftVoucher.updateMany({
    where: { id, status: 'ACTIVE', balancePence: { gte: take } },
    data: { balancePence: { decrement: take } },
  });
  if (res.count === 0) return { ok: false, error: 'This voucher no longer has enough balance.' };
  const after = await db.giftVoucher.findUnique({ where: { id }, select: { balancePence: true } });
  if (after?.balancePence === 0) await db.giftVoucher.updateMany({ where: { id, balancePence: 0 }, data: { status: 'REDEEMED' } });
  return { ok: true, balancePence: after?.balancePence ?? 0 };
}

/** Recipient claims/validates a voucher onto their account. The recipient must
 *  be 18+ (gift cards are for treatments). The API ensures the client is 18+
 *  before calling this. */
export async function claimVoucher(clientId: string, code: string): Promise<{ ok: boolean; error?: string; amountPence?: number }> {
  const v = await db.giftVoucher.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!v) return { ok: false, error: 'We couldn’t find that gift card code.' };
  if (v.status === 'PENDING') return { ok: false, error: 'This gift card isn’t active yet.' };
  if (v.status === 'CANCELLED') return { ok: false, error: 'This gift card is no longer valid.' };
  if (v.expiresAt && v.expiresAt < new Date()) return { ok: false, error: 'This gift card has expired.' };
  if (v.claimedByClientId === clientId) return { ok: true, amountPence: v.balancePence }; // already on this account
  if (v.claimedByClientId) return { ok: false, error: 'This gift card has already been claimed by another account.' };
  const { db: dbi } = await import('@/lib/db');
  const client = await dbi.client.findUnique({ where: { id: clientId }, select: { email: true } });
  // Atomic claim: only the first unclaimed write wins, so two accounts can't
  // race to claim the same card.
  const res = await db.giftVoucher.updateMany({ where: { id: v.id, claimedByClientId: null }, data: { claimedByClientId: clientId, claimedAt: new Date(), recipientEmail: v.recipientEmail ?? client?.email ?? null } });
  if (res.count === 0) return { ok: false, error: 'This gift card has just been claimed by another account.' };
  return { ok: true, amountPence: v.balancePence };
}
