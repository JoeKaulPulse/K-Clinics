import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// BLD-535: staff authoring for interactive exercises. Requires settings.manage.
//   create { courseId, type } · update { id, title, type, instructions, imageUrl, config, active }
//   delete { id } · reorder { ids }
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('settings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const { db } = await import('@/lib/db');
  const { currentTenantId } = await import('@/lib/tenant');
  const { normaliseConfig } = await import('@/lib/exercises');
  const ok = (extra: object = {}) => NextResponse.json({ ok: true, ...extra });
  const bad = (e = 'Bad request') => NextResponse.json({ ok: false, error: e }, { status: 400 });
  const TYPES = new Set(['HOTSPOT', 'MATCH', 'ORDER', 'LABEL', 'TYPEIN']);

  switch (b.op) {
    case 'create': {
      if (!b.courseId) return bad('Missing course.');
      const type = TYPES.has(str(b.type)) ? str(b.type) : 'MATCH';
      const tenantId = await currentTenantId();
      const order = await db.interactiveExercise.count({ where: { courseId: String(b.courseId) } });
      const e = await db.interactiveExercise.create({ data: { tenantId, courseId: String(b.courseId), title: str(b.title).slice(0, 160) || 'New exercise', type, config: {}, order } });
      return ok({ id: e.id });
    }
    case 'update': {
      if (!b.id) return bad();
      const existing = await db.interactiveExercise.findUnique({ where: { id: String(b.id) }, select: { type: true } });
      if (!existing) return bad('Not found.');
      const type = TYPES.has(str(b.type)) ? str(b.type) : existing.type;
      const config = normaliseConfig(type, b.config);
      await db.interactiveExercise.update({
        where: { id: String(b.id) },
        data: {
          title: str(b.title).slice(0, 160) || 'Exercise', type, instructions: str(b.instructions).slice(0, 2000) || null,
          imageUrl: str(b.imageUrl).slice(0, 1000) || null, config: config as object, active: b.active === undefined ? true : !!b.active,
        },
      });
      return ok();
    }
    case 'delete': { if (!b.id) return bad(); await db.interactiveExercise.delete({ where: { id: String(b.id) } }); return ok(); }
    case 'reorder': {
      if (!Array.isArray(b.ids)) return bad();
      await Promise.all((b.ids as string[]).map((id, i) => db.interactiveExercise.update({ where: { id }, data: { order: i } }).catch(() => {})));
      return ok();
    }
  }
  return bad('Unknown op');
}
