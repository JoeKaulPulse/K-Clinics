import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Pricing planner writes (Finance → Pricing planner, BLD-1758).
//
//   saveScenario   — create or update a saved costing (finance.manage)
//   deleteScenario — remove one (finance.manage)
//   applyPrice     — write a price/cost back onto a catalogue row. That edits
//                    what clients are charged, so it needs settings.manage —
//                    the same permission the Services and Products editors ask
//                    for — not finance.manage.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const b = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');
  const { logAudit } = await import('@/lib/audit');

  if (b.op === 'saveScenario' || b.op === 'deleteScenario') {
    const session = await requirePermission('finance.manage');
    if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

    if (b.op === 'deleteScenario') {
      const id = String(b.id || '');
      if (!id) return NextResponse.json({ ok: false, error: 'Missing scenario.' }, { status: 400 });
      await db.pricingScenario.delete({ where: { id } }).catch(() => {});
      return NextResponse.json({ ok: true });
    }

    const name = String(b.name || '').trim().slice(0, 120);
    if (!name) return NextResponse.json({ ok: false, error: 'Give the costing a name so you can find it again.' }, { status: 400 });
    const inputs = b.inputs && typeof b.inputs === 'object' ? b.inputs : null;
    if (!inputs) return NextResponse.json({ ok: false, error: 'Nothing to save.' }, { status: 400 });
    const int = (v: unknown) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);
    const data = {
      name,
      linkedType: b.linkedType === 'variant' || b.linkedType === 'product' ? b.linkedType : null,
      linkedId: b.linkedId ? String(b.linkedId).slice(0, 60) : null,
      inputs,
      pricePence: Math.max(0, int(b.pricePence)),
      costPence: Math.max(0, int(b.costPence)),
      marginPct: Math.max(-999, Math.min(999, int(b.marginPct))),
      notes: typeof b.notes === 'string' ? b.notes.slice(0, 2000) : null,
    };
    const saved = b.id
      ? await db.pricingScenario.update({ where: { id: String(b.id) }, data })
      : await db.pricingScenario.create({ data: { ...data, createdBy: session.email } });
    return NextResponse.json({ ok: true, id: saved.id });
  }

  if (b.op === 'applyPrice') {
    const session = await requirePermission('settings.manage');
    if (!session) return NextResponse.json({ ok: false, error: 'You need the “Manage settings” permission to change a live price.' }, { status: 403 });
    const id = String(b.id || '');
    const pricePence = Math.round(Number(b.pricePence));
    if (!id || !Number.isFinite(pricePence) || pricePence < 0) return NextResponse.json({ ok: false, error: 'Give a valid price.' }, { status: 400 });
    // costPence is optional — sent when the planner's cost working should
    // replace whatever cost of goods the row currently records.
    const costRaw = Number(b.costPence);
    const costPence = Number.isFinite(costRaw) && costRaw >= 0 ? Math.round(costRaw) : undefined;

    if (b.kind === 'variant') {
      const before = await db.serviceVariant.findUnique({ where: { id }, select: { name: true, pricePence: true, service: { select: { name: true } } } });
      if (!before) return NextResponse.json({ ok: false, error: 'That service option no longer exists.' }, { status: 404 });
      await db.serviceVariant.update({ where: { id }, data: { pricePence, ...(costPence === undefined ? {} : { costPence }) } });
      await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: `Pricing planner: ${before.service.name} — ${before.name} price ${(before.pricePence / 100).toFixed(2)} → ${(pricePence / 100).toFixed(2)} (BLD-1758)` }).catch(() => {});
      return NextResponse.json({ ok: true });
    }
    if (b.kind === 'product') {
      const before = await db.product.findUnique({ where: { id }, select: { name: true, pricePence: true } });
      if (!before) return NextResponse.json({ ok: false, error: 'That product no longer exists.' }, { status: 404 });
      await db.product.update({ where: { id }, data: { pricePence, ...(costPence === undefined ? {} : { costPence }) } });
      await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: `Pricing planner: ${before.name} price ${(before.pricePence / 100).toFixed(2)} → ${(pricePence / 100).toFixed(2)} (BLD-1758)` }).catch(() => {});
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false, error: 'Unknown item type.' }, { status: 400 });
  }

  return NextResponse.json({ ok: false, error: 'Unknown op' }, { status: 400 });
}
