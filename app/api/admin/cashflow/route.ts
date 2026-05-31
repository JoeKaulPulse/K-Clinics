import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

const TYPES = ['INCOME', 'EXPENSE'];
const CADENCES = ['ONE_OFF', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'];
const toPence = (v: unknown) => Math.round(Number(v) * 100) || 0;

// Cashflow forecast management. Requires finance.manage.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('finance.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');

  if (body.op === 'config') {
    const { setFinanceConfig } = await import('@/lib/cashflow');
    await setFinanceConfig({
      ...(body.openingPounds !== undefined ? { openingPence: toPence(body.openingPounds) } : {}),
      ...(body.floorPounds !== undefined ? { safetyFloorPence: toPence(body.floorPounds) } : {}),
      ...(body.months !== undefined ? { months: Math.min(Math.max(parseInt(body.months, 10) || 12, 1), 36) } : {}),
    }, session.email);
    return NextResponse.json({ ok: true });
  }

  if (body.op === 'drivers') {
    const { setDrivers } = await import('@/lib/cashflow');
    await setDrivers({
      ...(body.monthlyVisitors !== undefined ? { monthlyVisitors: Number(body.monthlyVisitors) || 0 } : {}),
      ...(body.conversionPct !== undefined ? { conversionPct: Number(body.conversionPct) || 0 } : {}),
      ...(body.avgValuePounds !== undefined ? { avgValuePence: toPence(body.avgValuePounds) } : {}),
      ...(body.monthlyNewClients !== undefined ? { monthlyNewClients: Number(body.monthlyNewClients) || 0 } : {}),
      ...(body.industryGrowthPct !== undefined ? { industryGrowthPct: Number(body.industryGrowthPct) || 0 } : {}),
      ...(body.seoRank !== undefined ? { seoRank: Number(body.seoRank) || 20 } : {}),
      ...(body.useSeasonality !== undefined ? { useSeasonality: !!body.useSeasonality } : {}),
      ...(body.useBookings !== undefined ? { useBookings: !!body.useBookings } : {}),
    }, session.email);
    return NextResponse.json({ ok: true });
  }

  if (body.op === 'createEntry') {
    const { type, category, label, amountPounds, cadence, startDate, endDate } = body;
    if (!TYPES.includes(type) || !label?.trim()) return NextResponse.json({ ok: false, error: 'Type and label required.' }, { status: 400 });
    await db.cashflowEntry.create({
      data: {
        type, category: (category || 'Other').toString().slice(0, 60), label: label.trim().slice(0, 120),
        amountPence: toPence(amountPounds), cadence: (CADENCES.includes(cadence) ? cadence : 'MONTHLY'),
        startDate: startDate ? new Date(startDate) : null, endDate: endDate ? new Date(endDate) : null,
        createdBy: session.email,
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.op === 'deleteEntry') {
    if (!body.id) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
    await db.cashflowEntry.delete({ where: { id: body.id } });
    return NextResponse.json({ ok: true });
  }

  if (body.op === 'createReserve') {
    const { name, targetPounds, balancePounds, monthlyPounds, color } = body;
    if (!name?.trim()) return NextResponse.json({ ok: false, error: 'A name is required.' }, { status: 400 });
    const max = await db.cashReserve.aggregate({ _max: { sortOrder: true } });
    await db.cashReserve.create({
      data: {
        name: name.trim().slice(0, 80), targetPence: toPence(targetPounds), balancePence: toPence(balancePounds),
        monthlyContributionPence: toPence(monthlyPounds), color: color || '#7a9a8a', sortOrder: (max._max.sortOrder ?? 0) + 1,
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.op === 'updateReserve') {
    const { id, name, targetPounds, balancePounds, monthlyPounds, color } = body;
    if (!id) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
    await db.cashReserve.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: String(name).trim().slice(0, 80) } : {}),
        ...(targetPounds !== undefined ? { targetPence: toPence(targetPounds) } : {}),
        ...(balancePounds !== undefined ? { balancePence: toPence(balancePounds) } : {}),
        ...(monthlyPounds !== undefined ? { monthlyContributionPence: toPence(monthlyPounds) } : {}),
        ...(color !== undefined ? { color: String(color) } : {}),
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.op === 'deleteReserve') {
    if (!body.id) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
    await db.cashReserve.delete({ where: { id: body.id } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: 'Unknown op' }, { status: 400 });
}
