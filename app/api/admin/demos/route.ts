import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// BLD-539: staff authoring for "spot the mistake" demo videos. settings.manage.
//   createDemo { courseId, title, videoUrl } · updateDemo { id, title, description, active }
//   deleteDemo { id } · reorderDemos { ids }
//   addMistake { videoId, atSec, label, windowSec } · updateMistake { id, atSec, windowSec, label } · deleteMistake { id }
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('settings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const sec = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0; };
  const { db } = await import('@/lib/db');
  const { currentTenantId } = await import('@/lib/tenant');
  const ok = (extra: object = {}) => NextResponse.json({ ok: true, ...extra });
  const bad = (e = 'Bad request') => NextResponse.json({ ok: false, error: e }, { status: 400 });

  switch (b.op) {
    case 'createDemo': {
      if (!b.courseId || !str(b.videoUrl)) return bad('Missing course or video.');
      const tenantId = await currentTenantId();
      const order = await db.demoVideo.count({ where: { courseId: String(b.courseId) } });
      const d = await db.demoVideo.create({ data: { tenantId, courseId: String(b.courseId), title: str(b.title).slice(0, 160) || 'New demo', description: str(b.description).slice(0, 2000) || null, videoUrl: str(b.videoUrl).slice(0, 1000), durationSec: b.durationSec != null ? Math.round(Number(b.durationSec)) || null : null, order } });
      return ok({ id: d.id });
    }
    case 'updateDemo': {
      if (!b.id) return bad();
      await db.demoVideo.update({ where: { id: String(b.id) }, data: { title: str(b.title).slice(0, 160) || 'Demo', description: str(b.description).slice(0, 2000) || null, captionsUrl: str(b.captionsUrl).slice(0, 1000) || null, active: b.active === undefined ? true : !!b.active } });
      return ok();
    }
    case 'deleteDemo': { if (!b.id) return bad(); await db.demoVideo.delete({ where: { id: String(b.id) } }); return ok(); }
    case 'reorderDemos': {
      if (!Array.isArray(b.ids)) return bad();
      await Promise.all((b.ids as string[]).map((id, i) => db.demoVideo.update({ where: { id }, data: { order: i } }).catch(() => {})));
      return ok();
    }
    case 'addMistake': {
      if (!b.videoId || !str(b.label).trim()) return bad('Missing video or label.');
      const tenantId = await currentTenantId();
      const m = await db.demoMistake.create({ data: { tenantId, videoId: String(b.videoId), atSec: sec(b.atSec), windowSec: b.windowSec != null ? Math.max(0.5, Math.min(15, sec(b.windowSec))) : 3, label: str(b.label).slice(0, 200) } });
      return ok({ id: m.id });
    }
    case 'updateMistake': {
      if (!b.id) return bad();
      await db.demoMistake.update({ where: { id: String(b.id) }, data: { atSec: sec(b.atSec), windowSec: Math.max(0.5, Math.min(15, sec(b.windowSec) || 3)), label: str(b.label).slice(0, 200) } });
      return ok();
    }
    case 'deleteMistake': { if (!b.id) return bad(); await db.demoMistake.delete({ where: { id: String(b.id) } }); return ok(); }
  }
  return bad('Unknown op');
}
