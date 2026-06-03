import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Recipient claims a gift card onto their account. Gift cards are for treatments,
// so the claimer must be 18+ — confirmed by DOB + declaration (set here if the
// account doesn't have an adult DOB yet).
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getCurrentClient } = await import('@/lib/client-auth');
  const client = await getCurrentClient();
  if (!client) return NextResponse.json({ ok: false, error: 'Please sign in to claim your gift card.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const code = String(body.code || '').trim();
  if (!code) return NextResponse.json({ ok: false, error: 'Enter your gift card code.' }, { status: 400 });

  const { db } = await import('@/lib/db');
  const { isAdultOn } = await import('@/lib/age');
  const row = await db.client.findUnique({ where: { id: client.id }, select: { dob: true } });

  // Determine an effective DOB: existing adult DOB, or a new one supplied now.
  let dob = row?.dob ?? null;
  if (!dob || !isAdultOn(dob)) {
    if (body.dob) {
      const d = new Date(String(body.dob));
      if (isNaN(+d)) return NextResponse.json({ ok: false, error: 'Enter a valid date of birth.' }, { status: 400 });
      dob = d;
    }
    if (!dob || !isAdultOn(dob)) {
      return NextResponse.json({ ok: false, error: 'Gift cards can only be redeemed by someone aged 18 or over.', needAge: true }, { status: 403 });
    }
    if (body.ageDeclare !== true) return NextResponse.json({ ok: false, error: 'Please confirm you are 18 or over.', needAge: true }, { status: 400 });
    await db.client.update({ where: { id: client.id }, data: { dob, ageDeclaredAt: new Date() } });
  }

  const { claimVoucher } = await import('@/lib/gift-vouchers');
  const res = await claimVoucher(client.id, code);
  if (!res.ok) return NextResponse.json(res, { status: 400 });

  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'SETTINGS_UPDATED', actor: 'client', clientId: client.id, summary: `Claimed a gift card (£${((res.amountPence ?? 0) / 100).toFixed(2)})` });
  return NextResponse.json({ ok: true, amountPence: res.amountPence });
}
