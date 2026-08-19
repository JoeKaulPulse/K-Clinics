import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Manage gift vouchers from the CRM: redeem against a balance, cancel, or
// re-send the voucher email. These change money state, so require finance.manage.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('finance.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');
  const bad = () => NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });

  switch (body.op) {
    case 'redeem': {
      const id = String(body.id || '');
      const amountPence = Math.round(Number(body.amountPence));
      if (!id || !(amountPence > 0)) return bad();
      const { redeemVoucher } = await import('@/lib/gift-vouchers');
      const voucher = await db.giftVoucher.findUnique({ where: { id }, select: { code: true, claimedByClientId: true } });
      const res = await redeemVoucher(id, amountPence);
      if (res.ok) {
        // BLD-1416: money-mutating action needs an audit trail, matching the
        // REWARD_REDEEMED convention used everywhere else a gift voucher's
        // balance moves (app/api/admin/bookings/session/route.ts, lib/shop.ts).
        const { logAudit } = await import('@/lib/audit');
        const reason = body.reason ? String(body.reason).slice(0, 200) : undefined;
        // redeemVoucher caps the deduction at the live balance, so the requested
        // amount is not necessarily what was taken (staff typing £100 against a
        // £30 card redeems £30). The audit trail records the amount actually
        // deducted, and keeps the requested figure only when the two differ.
        const redeemedPence = res.redeemedPence ?? amountPence;
        await logAudit({
          action: 'REWARD_REDEEMED',
          actor: session.email,
          actorRole: session.role,
          clientId: voucher?.claimedByClientId ?? null,
          summary: `Gift voucher ${voucher?.code || id} redeemed £${(redeemedPence / 100).toFixed(2)} by staff${reason ? ` — ${reason}` : ''}`,
          meta: { voucherCode: voucher?.code, amountPence: redeemedPence, ...(redeemedPence !== amountPence ? { requestedPence: amountPence } : {}), reason },
        }).catch(() => {});
      }
      return NextResponse.json(res, { status: res.ok ? 200 : 400 });
    }
    case 'cancel': {
      if (!body.id) return bad();
      const id = String(body.id);
      const voucher = await db.giftVoucher.findUnique({ where: { id }, select: { code: true, balancePence: true, claimedByClientId: true } });
      if (!voucher) return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 });
      await db.giftVoucher.update({ where: { id }, data: { status: 'CANCELLED' } });
      // BLD-1416: cancelling voids the remaining balance — audit it the same
      // way as every other gift-voucher balance change (REWARD_REDEEMED).
      const { logAudit } = await import('@/lib/audit');
      const reason = body.reason ? String(body.reason).slice(0, 200) : undefined;
      await logAudit({
        action: 'REWARD_REDEEMED',
        actor: session.email,
        actorRole: session.role,
        clientId: voucher.claimedByClientId ?? null,
        summary: `Gift voucher ${voucher.code} cancelled — £${(voucher.balancePence / 100).toFixed(2)} balance voided${reason ? ` — ${reason}` : ''}`,
        meta: { voucherCode: voucher.code, amountPence: voucher.balancePence, reason },
      }).catch(() => {});
      return NextResponse.json({ ok: true });
    }
    case 'markPosted': {
      if (!body.id) return bad();
      await db.giftVoucher.update({ where: { id: String(body.id) }, data: { fulfillment: 'posted', postedAt: new Date() } });
      return NextResponse.json({ ok: true });
    }
    case 'resend': {
      if (!body.id) return bad();
      const v = await db.giftVoucher.findUnique({ where: { id: String(body.id) } });
      if (!v) return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 });
      if (v.status === 'PENDING' || v.status === 'CANCELLED') return NextResponse.json({ ok: false, error: 'Voucher is not active.' }, { status: 400 });
      const { sendEmail, tmplGiftVoucher } = await import('@/lib/email');
      const { site } = await import('@/lib/site');
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || site.url;
      const money = `£${(v.amountPence / 100).toLocaleString('en-GB', { minimumFractionDigits: v.amountPence % 100 ? 2 : 0 })}`;
      const to = v.recipientEmail || v.purchaserEmail;
      const res = await sendEmail({ to, subject: `Your KClinics gift voucher — ${money}`, html: tmplGiftVoucher({ recipientName: v.recipientName || 'there', fromName: v.purchaserName, amount: money, code: v.code, message: v.message, bookUrl: `${baseUrl.replace(/\/$/, '')}/account/gift-cards?code=${v.code}` }) });
      if (res.ok) await db.giftVoucher.update({ where: { id: v.id }, data: { delivered: true } });
      return NextResponse.json({ ok: res.ok, error: res.ok ? undefined : 'Could not send email.' });
    }
  }
  return NextResponse.json({ ok: false, error: 'Unknown op' }, { status: 400 });
}
