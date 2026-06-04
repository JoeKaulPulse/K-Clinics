import 'server-only';
import crypto from 'crypto';
import { db } from '@/lib/db';

// Promo-code engine: validation/pricing, redemption, and code generation for
// both universal promotions and per-recipient campaign codes.

export function generatePromoCode(prefix = 'KC'): string {
  const body = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}${body}`.replace(/[^A-Z0-9]/g, '').slice(0, 16);
}

export type PromoContext = { clientId?: string | null; email?: string | null; treatmentSlug?: string | null; pricePence: number };
export type PromoResult =
  | { ok: true; promoId: string; code: string; label: string | null; discountPence: number; finalPence: number }
  | { ok: false; error: string };

/** Validate a code in context and compute the discount. Read-only (no redemption). */
export async function priceWithPromo(rawCode: string, ctx: PromoContext): Promise<PromoResult> {
  const code = (rawCode || '').trim().toUpperCase();
  if (!code) return { ok: false, error: 'Enter a code.' };
  const promo = await db.promoCode.findUnique({ where: { code } });
  if (!promo || !promo.active) return { ok: false, error: 'That code isn’t valid.' };

  const now = new Date();
  if (promo.startsAt && promo.startsAt > now) return { ok: false, error: 'This code isn’t active yet.' };
  if (promo.expiresAt && promo.expiresAt < now) return { ok: false, error: 'This code has expired.' };
  if (promo.maxRedemptions != null && promo.redeemedCount >= promo.maxRedemptions) return { ok: false, error: 'This code has been fully redeemed.' };
  if (promo.treatmentSlugs.length && ctx.treatmentSlug && !promo.treatmentSlugs.includes(ctx.treatmentSlug)) {
    return { ok: false, error: 'This code doesn’t apply to that treatment.' };
  }
  if (promo.minSpendPence && ctx.pricePence < promo.minSpendPence) {
    return { ok: false, error: `Spend at least £${Math.round(promo.minSpendPence / 100)} to use this code.` };
  }
  if (promo.kind === 'PERSONAL' && promo.assignedEmail) {
    const email = (ctx.email || '').trim().toLowerCase();
    if (!email || email !== promo.assignedEmail.toLowerCase()) return { ok: false, error: 'This code is registered to a different account.' };
  }
  if (promo.oncePerClient && ctx.clientId) {
    const used = await db.promoRedemption.findFirst({ where: { promoCodeId: promo.id, clientId: ctx.clientId } });
    if (used) return { ok: false, error: 'You’ve already used this code.' };
  }

  const discountPence = promo.discountType === 'FIXED'
    ? Math.min(promo.amountPence ?? 0, ctx.pricePence)
    : Math.round((ctx.pricePence * Math.min(100, Math.max(0, promo.percent ?? 0))) / 100);
  if (discountPence <= 0) return { ok: false, error: 'That code doesn’t apply here.' };

  return { ok: true, promoId: promo.id, code: promo.code, label: promo.label, discountPence, finalPence: Math.max(0, ctx.pricePence - discountPence) };
}

/** Record a redemption. Re-checks the max-redemptions cap and the
 *  once-per-client rule inside a Serializable transaction, so concurrent
 *  redemptions of a single-use/capped code can't both succeed. Returns whether
 *  a redemption was recorded. */
export async function redeemPromo(promoId: string, opts: { clientId?: string | null; email?: string | null; bookingId?: string | null; amountOffPence: number }): Promise<boolean> {
  try {
    return await db.$transaction(async (tx) => {
      const promo = await tx.promoCode.findUnique({ where: { id: promoId }, select: { maxRedemptions: true, redeemedCount: true, oncePerClient: true } });
      if (!promo) return false;
      if (promo.maxRedemptions != null && promo.redeemedCount >= promo.maxRedemptions) return false;
      if (promo.oncePerClient && opts.clientId) {
        const used = await tx.promoRedemption.findFirst({ where: { promoCodeId: promoId, clientId: opts.clientId }, select: { id: true } });
        if (used) return false;
      }
      await tx.promoRedemption.create({ data: { promoCodeId: promoId, clientId: opts.clientId ?? null, email: opts.email?.toLowerCase() ?? null, bookingId: opts.bookingId ?? null, amountOffPence: opts.amountOffPence } });
      await tx.promoCode.update({ where: { id: promoId }, data: { redeemedCount: { increment: 1 } } });
      return true;
    }, { isolationLevel: 'Serializable' });
  } catch (e) {
    console.error('[promo] redeem failed (continuing):', (e as Error)?.message);
    return false;
  }
}

/** Create one PERSONAL code for a campaign recipient. */
export async function createPersonalCode(opts: { campaignId: string; email: string; discountType: 'PERCENT' | 'FIXED'; percent?: number; amountPence?: number; treatmentSlugs?: string[]; expiresAt?: Date | null; label?: string }): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const code = generatePromoCode('KC');
    try {
      await db.promoCode.create({
        data: {
          code, kind: 'PERSONAL', campaignId: opts.campaignId, assignedEmail: opts.email.toLowerCase(),
          discountType: opts.discountType, percent: opts.discountType === 'PERCENT' ? opts.percent : null, amountPence: opts.discountType === 'FIXED' ? opts.amountPence : null,
          treatmentSlugs: opts.treatmentSlugs ?? [], maxRedemptions: 1, oncePerClient: true,
          expiresAt: opts.expiresAt ?? null, label: opts.label ?? null,
        },
      });
      return code;
    } catch { /* unique clash — retry */ }
  }
  throw new Error('Could not generate a unique code.');
}
