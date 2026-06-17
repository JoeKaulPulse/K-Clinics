import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);

// Manage vacancies + applications. Requires settings.manage.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('settings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');
  const ok = () => NextResponse.json({ ok: true });
  const bad = () => NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });

  switch (body.op) {
    case 'upsert': {
      const b = body as Record<string, unknown>;
      if (!b.title) return bad();
      const data = {
        title: String(b.title).slice(0, 120),
        department: (b.department as string)?.trim() || null,
        location: (b.location as string)?.trim() || null,
        type: (b.type as string)?.trim() || null,
        summary: (b.summary as string)?.slice(0, 300) || null,
        description: (b.description as string) || null,
        active: b.active === undefined ? true : !!b.active,
      };
      if (b.id) await db.vacancy.update({ where: { id: String(b.id) }, data });
      else {
        const { currentTenantId } = await import('@/lib/tenant');
        const order = await db.vacancy.count();
        await db.vacancy.create({ data: { ...data, tenantId: await currentTenantId(), slug: `${slugify(data.title)}-${Date.now().toString(36).slice(-4)}`, order, createdBy: session.email } });
      }
      return ok();
    }
    case 'toggle': {
      if (!body.id) return bad();
      await db.vacancy.update({ where: { id: body.id }, data: { active: !!body.active } });
      return ok();
    }
    case 'remove': {
      if (!body.id) return bad();
      await db.vacancy.delete({ where: { id: body.id } });
      return ok();
    }
    case 'appStatus': {
      if (!body.id || !body.status) return bad();
      const valid = ['NEW', 'REVIEWING', 'INTERVIEW', 'OFFERED', 'REJECTED', 'HIRED'];
      if (!valid.includes(body.status)) return bad();
      await db.jobApplication.update({ where: { id: body.id }, data: { status: body.status } });
      return ok();
    }
    case 'removeApp': {
      if (!body.id) return bad();
      await db.jobApplication.delete({ where: { id: body.id } });
      return ok();
    }
  }
  return NextResponse.json({ ok: false, error: 'Unknown op' }, { status: 400 });
}
