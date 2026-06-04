import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Manage K Circle membership tiers (thresholds, multipliers, perks) and trigger
// a recompute. Requires discounts.manage.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('discounts.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');
  const { clearTierCache } = await import('@/lib/membership');

  if (body.op === 'recomputeAll') {
    const { recomputeActiveTiers } = await import('@/lib/membership');
    const n = await recomputeActiveTiers();
    return NextResponse.json({ ok: true, recomputed: n });
  }

  // Default op: update a tier's editable fields.
  if (!body.id) return NextResponse.json({ ok: false, error: 'Missing tier.' }, { status: 400 });
  const num = (v: unknown, min = 0, max = 100_000_000) => Math.min(max, Math.max(min, Math.round(Number(v) || 0)));
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = String(body.name).slice(0, 40);
  if (body.minSpendPence !== undefined) data.minSpendPence = num(body.minSpendPence);
  if (body.pointsMultiplierBps !== undefined) data.pointsMultiplierBps = num(body.pointsMultiplierBps, 100, 1000);
  if (body.birthdayBonusPoints !== undefined) data.birthdayBonusPoints = num(body.birthdayBonusPoints, 0, 100000);
  if (body.earlyAccessHours !== undefined) data.earlyAccessHours = num(body.earlyAccessHours, 0, 336);
  if (body.retailDiscountPct !== undefined) data.retailDiscountPct = num(body.retailDiscountPct, 0, 50);
  if (Array.isArray(body.perks)) data.perks = body.perks.map((p: string) => String(p).slice(0, 120)).filter(Boolean).slice(0, 8);
  if (typeof body.active === 'boolean') data.active = body.active;
  if (body.color !== undefined) data.color = String(body.color).slice(0, 16) || null;

  await db.membershipTier.update({ where: { id: String(body.id) }, data });
  clearTierCache();
  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: 'Updated a membership tier' });
  const { revalidatePath } = await import('next/cache');
  revalidatePath('/admin/membership');
  return NextResponse.json({ ok: true });
}
