import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// ── Day-close data + submit ──────────────────────────────────────────────────
// GET  ?status=1            → lightweight: is today already closed? (reminder banner)
// GET  ?locationId=…        → everything the closedown runner needs
// POST                      → record a completed close (recomputes money server-side)

async function activeLocations() {
  const { db } = await import('@/lib/db');
  return db.location.findMany({
    where: { active: true },
    orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, isPrimary: true },
  });
}

export async function GET(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'Not enabled.' }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('dayclose.run');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const { db } = await import('@/lib/db');
  const dc = await import('@/lib/day-close');
  const url = new URL(req.url);
  const config = await dc.getDayCloseConfig();

  // Lightweight status for the closing-time reminder banner.
  if (url.searchParams.get('status') === '1') {
    try {
      const closedToday = await db.dayClose.count({
        where: { status: 'COMPLETED', businessDate: dc.localDayStart() },
      });
      return NextResponse.json({
        ok: true,
        closedToday: closedToday > 0,
        closingTime: config.closingTime,
        reminderOffsetsMin: config.reminderOffsetsMin,
      });
    } catch {
      return NextResponse.json({ ok: true, closedToday: true }); // fail safe: don't nag on a blip
    }
  }

  const locations = await activeLocations();
  const wanted = url.searchParams.get('locationId');
  const selected = wanted ? locations.find((l) => l.id === wanted) : locations.find((l) => l.isPrimary) || locations[0];
  const locationId = selected?.id ?? null;
  const includeOrders = locations.length <= 1 || !!selected?.isPrimary;

  const today = new Date();
  const [expected, existing, stock] = await Promise.all([
    dc.computeExpected(locationId, today, includeOrders),
    dc.getDayClose(locationId, today),
    config.stockTake ? dc.stockTakeItems() : Promise.resolve([]),
  ]);

  return NextResponse.json({
    ok: true,
    config,
    locations,
    locationId,
    businessDate: dc.localDayStart(today).toISOString(),
    expected,
    stock,
    existing,
  });
}

type Submission = {
  locationId?: string | null;
  financial?: {
    countedCardPence?: number;
    floatOpenPence?: number;
    cashCountedPence?: number;
    cashTakingsPence?: number;
  };
  stock?: { itemId: string; countedQty: number }[];
  checklist?: Record<string, Record<string, { checked?: boolean; note?: string }>>;
  notes?: string;
};

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'Not enabled.' }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('dayclose.run');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const { db } = await import('@/lib/db');
  const dc = await import('@/lib/day-close');
  const body = (await req.json().catch(() => ({}))) as Submission;

  const config = await dc.getDayCloseConfig();
  const locations = await activeLocations();
  const selected = body.locationId ? locations.find((l) => l.id === body.locationId) : locations.find((l) => l.isPrimary) || locations[0];
  const locationId = selected?.id ?? null;
  const includeOrders = locations.length <= 1 || !!selected?.isPrimary;

  const today = new Date();
  const businessDate = dc.localDayStart(today);
  const expected = await dc.computeExpected(locationId, today, includeOrders);

  // ── Money (never trust the client for "expected") ──
  const f = body.financial ?? {};
  const countedCardPence = Math.round(Number(f.countedCardPence) || 0);
  const floatOpenPence = Math.round(Number(f.floatOpenPence) || 0);
  const cashCountedPence = config.cashHandling ? Math.round(Number(f.cashCountedPence) || 0) : null;
  const cashTakingsPence = config.cashHandling ? Math.round(Number(f.cashTakingsPence) || 0) : null;

  const cardVariance = countedCardPence - expected.cardPence;
  const cashDrawerVariance = config.cashHandling ? (cashCountedPence ?? 0) - (floatOpenPence + (cashTakingsPence ?? 0)) : 0;
  const variancePence = cardVariance + cashDrawerVariance;

  // ── Checklist completeness ──
  const checklist = body.checklist ?? {};
  const total = dc.countItems(config);
  let done = 0;
  for (const section of config.sections) {
    for (const item of section.items) {
      if (checklist[section.id]?.[item.id]?.checked) done += 1;
    }
  }

  // ── Stock take → append ADJUSTMENT movements for any counted differences ──
  const stockOps: Promise<unknown>[] = [];
  const stockSnapshot: { itemId: string; countedQty: number; delta: number }[] = [];
  if (config.stockTake && Array.isArray(body.stock) && body.stock.length) {
    const ids = body.stock.map((s) => s.itemId);
    const items = await db.stockItem.findMany({ where: { id: { in: ids } }, select: { id: true, currentQty: true } });
    const byId = new Map(items.map((i) => [i.id, i.currentQty]));
    for (const s of body.stock) {
      if (!byId.has(s.itemId)) continue;
      const counted = Number(s.countedQty);
      if (!Number.isFinite(counted)) continue;
      const current = byId.get(s.itemId)!;
      const delta = counted - current;
      stockSnapshot.push({ itemId: s.itemId, countedQty: counted, delta });
      if (Math.abs(delta) > 1e-9) {
        stockOps.push(
          db.stockMovement.create({
            data: { itemId: s.itemId, delta, reason: 'ADJUSTMENT', by: session.email, note: 'Day-close stock take' },
          }),
          db.stockItem.update({ where: { id: s.itemId }, data: { currentQty: counted } }),
        );
      }
    }
  }
  if (stockOps.length) await Promise.all(stockOps);

  const payload = {
    checklist,
    stock: stockSnapshot,
    expected,
    cardVariance,
    cashDrawerVariance,
  };

  // One record per location per business day — update if a close was already started/done.
  const existing = await dc.getDayClose(locationId, today);
  const data = {
    locationId,
    businessDate,
    status: 'COMPLETED' as const,
    expectedCardPence: expected.cardPence,
    countedCardPence,
    floatOpenPence,
    cashCountedPence,
    cashTakingsPence,
    variancePence,
    checklistDone: done,
    checklistTotal: total,
    payload,
    notes: (body.notes || '').trim() || null,
    completedBy: session.email,
    completedAt: new Date(),
  };

  let id: string;
  if (existing) {
    await db.dayClose.update({ where: { id: existing.id }, data });
    id = existing.id;
  } else {
    const created = await db.dayClose.create({ data: { ...data, startedBy: session.email } });
    id = created.id;
  }

  return NextResponse.json({ ok: true, id, variancePence, cardVariance, cashDrawerVariance, checklistDone: done, checklistTotal: total });
}
