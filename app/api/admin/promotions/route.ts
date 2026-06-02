import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

const num = (v: unknown) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? n : null; };

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('discounts.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { db } = await import('@/lib/db');
  const bad = (e = 'Bad request') => NextResponse.json({ ok: false, error: e }, { status: 400 });

  switch (b.op) {
    case 'create': {
      const discountType = b.discountType === 'FIXED' ? 'FIXED' : 'PERCENT';
      const percent = discountType === 'PERCENT' ? Math.min(100, Math.max(1, num(b.percent) ?? 0)) : null;
      const amountPence = discountType === 'FIXED' ? Math.max(1, num(b.amountPence) ?? 0) : null;
      if (discountType === 'PERCENT' && !percent) return bad('Enter a percentage 1–100.');
      if (discountType === 'FIXED' && !amountPence) return bad('Enter an amount.');

      const { generatePromoCode } = await import('@/lib/promo');
      let code = String(b.code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!code) code = generatePromoCode('KC');
      if (code.length < 4) return bad('Code must be at least 4 characters.');
      const exists = await db.promoCode.findUnique({ where: { code }, select: { id: true } });
      if (exists) return bad('That code already exists.');

      const item = await db.promoCode.create({
        data: {
          code, kind: 'UNIVERSAL', discountType, percent, amountPence,
          label: (b.label as string)?.slice(0, 120) || null,
          treatmentSlugs: Array.isArray(b.treatmentSlugs) ? (b.treatmentSlugs as string[]).map(String) : [],
          minSpendPence: num(b.minSpendPence) || null,
          maxRedemptions: num(b.maxRedemptions) || null,
          oncePerClient: b.oncePerClient !== false,
          startsAt: b.startsAt ? new Date(b.startsAt as string) : null,
          expiresAt: b.expiresAt ? new Date(b.expiresAt as string) : null,
          createdBy: session.email,
        },
        select: { id: true, code: true },
      });
      return NextResponse.json({ ok: true, ...item });
    }
    case 'toggle': {
      if (!b.id) return bad();
      await db.promoCode.update({ where: { id: String(b.id) }, data: { active: !!b.active } });
      return NextResponse.json({ ok: true });
    }
    case 'remove': {
      if (!b.id) return bad();
      await db.promoCode.delete({ where: { id: String(b.id) } });
      return NextResponse.json({ ok: true });
    }
  }
  return bad('Unknown op');
}
