import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { crmEnabled } from '@/lib/crm';
import { GLOBALS_TAG } from '@/lib/global-sections';
import { PAGES_TAG } from '@/lib/pages';
import { sectionDef } from '@/lib/sections';

export const runtime = 'nodejs';

// Reusable (global) sections. Requires settings.manage.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('settings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
  const editor = (session as { email?: string }).email ?? null;

  const body = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');
  const refresh = () => { revalidateTag(GLOBALS_TAG, {}); revalidateTag(PAGES_TAG, {}); };

  if (body.op === 'create') {
    const def = sectionDef(String(body.type));
    if (!def) return NextResponse.json({ ok: false, error: 'Unknown section type.' }, { status: 400 });
    const g = await db.globalSection.create({ data: { name: String(body.name || def.label).slice(0, 120), type: def.type, data: JSON.parse(JSON.stringify(def.defaults)), updatedBy: editor } });
    return NextResponse.json({ ok: true, id: g.id });
  }

  if (!body.id) return NextResponse.json({ ok: false, error: 'No id.' }, { status: 400 });

  if (body.op === 'save') {
    const data = body.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : {};
    await db.globalSection.update({ where: { id: body.id }, data: { name: body.name !== undefined ? String(body.name).slice(0, 120) : undefined, data, updatedBy: editor } });
    refresh();
    return NextResponse.json({ ok: true });
  }

  if (body.op === 'delete') {
    await db.globalSection.delete({ where: { id: body.id } }).catch(() => {});
    refresh();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: 'Unknown operation.' }, { status: 400 });
}
