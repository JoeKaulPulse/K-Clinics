import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Manager: create / update / remove catalogue rewards. Requires rewards.manage.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('rewards.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { action, id, name, description, costPoints, emoji, stock, active, sortOrder } = body;
  const { db } = await import('@/lib/db');

  if (action === 'delete') {
    if (!id) return NextResponse.json({ ok: false, error: 'Missing id.' }, { status: 400 });
    await db.reward.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }

  if (action === 'toggle') {
    if (!id) return NextResponse.json({ ok: false, error: 'Missing id.' }, { status: 400 });
    await db.reward.update({ where: { id }, data: { active: !!active } });
    return NextResponse.json({ ok: true });
  }

  // create or update
  const cost = Math.max(1, Math.round(Number(costPoints) || 0));
  if (!name?.trim() || !cost) return NextResponse.json({ ok: false, error: 'Name and a positive point cost are required.' }, { status: 400 });
  const data = {
    name: String(name).slice(0, 120),
    description: description?.trim() ? String(description).slice(0, 500) : null,
    costPoints: cost,
    emoji: emoji?.trim() ? String(emoji).slice(0, 8) : null,
    stock: stock === '' || stock == null ? null : Math.max(0, Math.round(Number(stock))),
    sortOrder: Math.round(Number(sortOrder) || 0),
  };

  if (id) {
    // On edit, only change `active` when explicitly provided — so editing a
    // hidden reward (the form doesn't send `active`) doesn't silently re-show it.
    await db.reward.update({ where: { id }, data: active === undefined ? data : { ...data, active: !!active } });
  } else {
    await db.reward.create({ data: { ...data, active: active === undefined ? true : !!active } });
  }

  return NextResponse.json({ ok: true });
}
