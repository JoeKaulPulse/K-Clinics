import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Manage audience segments + live size preview. Requires campaigns.view (read/
// count) and campaigns.send/settings.manage for mutations.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = (await requirePermission('campaigns.view')) || (await requirePermission('settings.manage'));
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
  const canManage = (await requirePermission('campaigns.send')) || (await requirePermission('settings.manage'));

  const body = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');
  const { countSegment } = await import('@/lib/segments');
  const ok = (d: object = {}) => NextResponse.json({ ok: true, ...d });
  const bad = (e = 'Bad request') => NextResponse.json({ ok: false, error: e }, { status: 400 });

  const cleanRules = (r: Record<string, unknown> = {}) => ({
    gender: r.gender ? String(r.gender).slice(0, 24) : undefined,
    source: r.source ? String(r.source).slice(0, 40) : undefined,
    tag: r.tag ? String(r.tag).slice(0, 40) : undefined,
    lapsedDays: r.lapsedDays ? Math.max(0, Math.round(Number(r.lapsedDays))) : undefined,
    optInOnly: r.optInOnly === true,
    visited: (['any', 'visited', 'never'].includes(String(r.visited)) ? String(r.visited) : undefined) as 'any' | 'visited' | 'never' | undefined,
  });

  switch (body.op) {
    case 'count': {
      const count = await countSegment(cleanRules(body.rules));
      return ok({ count });
    }
    case 'create': {
      if (!canManage) return bad('Not permitted.');
      const name = String(body.name ?? '').trim().slice(0, 120);
      if (!name) return bad('Name required.');
      const s = await db.segment.create({ data: { name, description: body.description ? String(body.description).slice(0, 300) : null, rules: cleanRules(body.rules), createdBy: session.email } });
      revalidatePath('/admin/marketing/audiences');
      return ok({ id: s.id });
    }
    case 'update': {
      if (!canManage) return bad('Not permitted.');
      if (!body.id) return bad();
      const data: Record<string, unknown> = {};
      if (body.name !== undefined) data.name = String(body.name).slice(0, 120);
      if (body.description !== undefined) data.description = body.description ? String(body.description).slice(0, 300) : null;
      if (body.rules !== undefined) data.rules = cleanRules(body.rules);
      await db.segment.update({ where: { id: body.id }, data });
      revalidatePath('/admin/marketing/audiences');
      return ok();
    }
    case 'remove': {
      if (!canManage) return bad('Not permitted.');
      if (!body.id) return bad();
      await db.segment.delete({ where: { id: body.id } }).catch(() => {});
      revalidatePath('/admin/marketing/audiences');
      return ok();
    }
    case 'syncMeta': {
      if (!canManage) return bad('Not permitted.');
      if (!body.id) return bad();
      const { syncSegmentToMeta } = await import('@/lib/meta-audiences');
      const r = await syncSegmentToMeta(String(body.id));
      if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 400 });
      const { logAudit } = await import('@/lib/audit');
      await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: `Synced segment to a Meta Custom Audience (${r.count} contacts uploaded)` });
      revalidatePath('/admin/marketing/audiences');
      return ok({ audienceId: r.audienceId, count: r.count });
    }
    default:
      return bad('Unknown operation');
  }
}
