import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

// Manage bookable rooms/equipment. Requires schedule.manage.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('schedule.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');

  if (body.op === 'remove') {
    if (!body.id) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
    await db.resource.delete({ where: { id: body.id } });
    return NextResponse.json({ ok: true });
  }

  if (body.op === 'toggle') {
    if (!body.id) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
    await db.resource.update({ where: { id: body.id }, data: { active: !!body.active } });
    return NextResponse.json({ ok: true });
  }

  // Create or update.
  const { id, name, slug, kind, capacity, locationId, floor, tags } = body as { id?: string; name?: string; slug?: string; kind?: string; capacity?: number; locationId?: string | null; floor?: string; tags?: string[] | string };
  if (!name?.trim()) return NextResponse.json({ ok: false, error: 'A name is required.' }, { status: 400 });
  const isRoom = kind === 'ROOM';
  const tagList = (Array.isArray(tags) ? tags : String(tags || '').split(',')).map((t) => t.trim().toLowerCase()).filter(Boolean);
  const data = {
    name: String(name).slice(0, 80),
    slug: slug?.trim() ? slugify(slug) : slugify(name),
    kind: isRoom ? 'ROOM' as const : 'EQUIPMENT' as const,
    // Rooms are single-occupancy; equipment can have >1 unit.
    capacity: isRoom ? 1 : Math.max(1, Math.round(Number(capacity) || 1)),
    tags: isRoom ? tagList : [],
    floor: floor?.trim() || null,
    locationId: locationId || null,
  };
  if (id) await db.resource.update({ where: { id }, data });
  else await db.resource.create({ data });
  return NextResponse.json({ ok: true });
}
