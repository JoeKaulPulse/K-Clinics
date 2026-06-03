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
      const res = await redeemVoucher(id, amountPence);
      return NextResponse.json(res, { status: res.ok ? 200 : 400 });
    }
    case 'cancel': {
      if (!body.id) return bad();
      await db.giftVoucher.update({ where: { id: String(body.id) }, data: { status: 'CANCELLED' } });
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
