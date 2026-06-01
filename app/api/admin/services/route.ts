import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Manage the service catalogue: prices, costs, durations, bulk price changes and
// special offers. Requires settings.manage (owner/admin/manager).
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('settings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');
  const { logAudit } = await import('@/lib/audit');
  const num = (v: unknown) => (v == null || v === '' ? null : Math.round(Number(v)));

  switch (body.op) {
    // ── Variants ──
    case 'updateVariant': {
      if (!body.id) return bad();
      await db.serviceVariant.update({
        where: { id: body.id },
        data: {
          ...(body.name != null ? { name: String(body.name).slice(0, 120) } : {}),
          ...(body.pricePence != null ? { pricePence: Math.max(0, num(body.pricePence) ?? 0) } : {}),
          ...(body.costPence !== undefined ? { costPence: body.costPence === null || body.costPence === '' ? null : Math.max(0, num(body.costPence) ?? 0) } : {}),
          ...(body.durationMin != null ? { durationMin: Math.max(5, num(body.durationMin) ?? 30) } : {}),
          ...(typeof body.active === 'boolean' ? { active: body.active } : {}),
        },
      });
      return ok();
    }
    case 'addVariant': {
      if (!body.serviceId || !body.name) return bad();
      const count = await db.serviceVariant.count({ where: { serviceId: body.serviceId } });
      await db.serviceVariant.create({
        data: { serviceId: body.serviceId, name: String(body.name).slice(0, 120), pricePence: Math.max(0, num(body.pricePence) ?? 0), durationMin: Math.max(5, num(body.durationMin) ?? 30), costPence: body.costPence ? num(body.costPence) : null, order: count },
      });
      return ok();
    }
    case 'removeVariant': {
      if (!body.id) return bad();
      await db.serviceVariant.delete({ where: { id: body.id } });
      return ok();
    }
    case 'updateService': {
      if (!body.id) return bad();
      await db.service.update({ where: { id: body.id }, data: { ...(typeof body.active === 'boolean' ? { active: body.active } : {}), ...(body.name ? { name: String(body.name).slice(0, 120) } : {}) } });
      return ok();
    }

    // ── Bulk price change (percentage), all services or one ──
    case 'bulkPrice': {
      const pct = Number(body.percent);
      if (!isFinite(pct) || pct === 0) return NextResponse.json({ ok: false, error: 'Enter a non-zero percentage.' }, { status: 400 });
      const where = body.serviceId ? { serviceId: body.serviceId } : {};
      const variants = await db.serviceVariant.findMany({ where, select: { id: true, pricePence: true, costPence: true, courses: true } });
      const factor = 1 + pct / 100;
      const bump = (n: number) => Math.max(0, Math.round(n * factor));
      await db.$transaction(variants.map((v) => {
        const courses = Array.isArray(v.courses)
          ? (v.courses as { sessions: number; totalPence: number }[]).map((c) => ({ ...c, totalPence: bump(c.totalPence) }))
          : v.courses;
        return db.serviceVariant.update({ where: { id: v.id }, data: { pricePence: bump(v.pricePence), courses: courses ?? undefined } });
      }));
      await logAudit({ action: 'SERVICE_PRICES_BULK', actor: session.email, actorRole: session.role, summary: `Bulk price change ${pct > 0 ? '+' : ''}${pct}% on ${variants.length} variant(s)${body.serviceId ? ' (one service)' : ' (all services)'}` });
      return NextResponse.json({ ok: true, updated: variants.length });
    }

    // ── Bulk import: paste the price matrix into a service ──
    case 'import': {
      const { parsePriceMatrix } = await import('@/lib/price-import');
      const { raw, serviceId, newServiceName, treatmentSlug, category, mode } = body as {
        raw?: string; serviceId?: string; newServiceName?: string; treatmentSlug?: string; category?: string; mode?: string;
      };
      if (!raw?.trim()) return NextResponse.json({ ok: false, error: 'Paste the price rows first.' }, { status: 400 });
      const { variants } = parsePriceMatrix(raw);
      if (!variants.length) return NextResponse.json({ ok: false, error: 'No rows could be read from that paste.' }, { status: 400 });

      let svcId = serviceId;
      if (!svcId) {
        if (!newServiceName?.trim() || !treatmentSlug?.trim()) return NextResponse.json({ ok: false, error: 'Name the service and pick a treatment to link it to.' }, { status: 400 });
        const slug = newServiceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
        const order = await db.service.count();
        const created = await db.service.create({ data: { slug: `${slug}-${Date.now().toString(36).slice(-4)}`, treatmentSlug, name: newServiceName.slice(0, 120), category: category === 'dentistry' ? 'dentistry' : 'aesthetics', order } });
        svcId = created.id;
      }
      if (mode === 'replace') await db.serviceVariant.deleteMany({ where: { serviceId: svcId } });
      const startOrder = mode === 'replace' ? 0 : await db.serviceVariant.count({ where: { serviceId: svcId } });
      await db.serviceVariant.createMany({
        data: variants.map((v, i) => ({
          serviceId: svcId!, name: v.name.slice(0, 120), durationMin: Math.max(5, v.durationMin),
          pricePence: Math.max(0, v.pricePence), courses: v.courses.length ? v.courses : undefined, order: startOrder + i,
        })),
      });
      await logAudit({ action: 'SERVICE_PRICES_BULK', actor: session.email, actorRole: session.role, summary: `Imported ${variants.length} variant(s) into a service (${mode === 'replace' ? 'replaced' : 'appended'})` });
      return NextResponse.json({ ok: true, imported: variants.length, serviceId: svcId });
    }

    // ── Offers ──
    case 'createOffer': {
      if (!body.name) return NextResponse.json({ ok: false, error: 'Name the offer.' }, { status: 400 });
      const scope = ['ALL', 'SERVICE', 'VARIANT'].includes(body.scope) ? body.scope : 'ALL';
      await db.serviceOffer.create({
        data: {
          name: String(body.name).slice(0, 120), scope,
          serviceId: scope === 'SERVICE' ? body.serviceId || null : null,
          variantId: scope === 'VARIANT' ? body.variantId || null : null,
          percentOff: body.percentOff ? Math.min(100, Math.max(1, num(body.percentOff) ?? 0)) : null,
          amountOffPence: body.amountOffPence ? Math.max(1, num(body.amountOffPence) ?? 0) : null,
          startAt: body.startAt ? new Date(body.startAt) : null,
          endAt: body.endAt ? new Date(body.endAt + 'T23:59:59') : null,
          promoted: body.promoted !== false,
          createdBy: session.email,
        },
      });
      return ok();
    }
    case 'updateOffer': {
      if (!body.id) return bad();
      await db.serviceOffer.update({ where: { id: body.id }, data: { ...(typeof body.active === 'boolean' ? { active: body.active } : {}), ...(typeof body.promoted === 'boolean' ? { promoted: body.promoted } : {}) } });
      return ok();
    }
    case 'removeOffer': {
      if (!body.id) return bad();
      await db.serviceOffer.delete({ where: { id: body.id } });
      return ok();
    }
  }
  return NextResponse.json({ ok: false, error: 'Unknown op' }, { status: 400 });
}

const ok = () => NextResponse.json({ ok: true });
const bad = () => NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
