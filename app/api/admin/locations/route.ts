import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'location';

// Manage clinic locations. Requires settings.manage (owner/admin level).
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('settings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');

  if (body.op === 'create') {
    const { name, addressLine, city, postcode, phone, email, color } = body as Record<string, string | undefined>;
    if (!name?.trim()) return NextResponse.json({ ok: false, error: 'A name is required.' }, { status: 400 });
    // Ensure a unique slug.
    let slug = slugify(name);
    let n = 1;
    while (await db.location.findUnique({ where: { slug } })) slug = `${slugify(name)}-${++n}`;
    const max = await db.location.aggregate({ _max: { sortOrder: true } });
    const isFirst = (await db.location.count()) === 0;
    await db.location.create({
      data: {
        name: name.trim(), slug,
        addressLine: addressLine?.trim() || null, city: city?.trim() || null, postcode: postcode?.trim() || null,
        phone: phone?.trim() || null, email: email?.trim() || null, color: color?.trim() || '#a98a6d',
        isPrimary: isFirst, sortOrder: (max._max.sortOrder ?? 0) + 1,
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.op === 'update') {
    const { id, name, addressLine, city, postcode, phone, email, color, active } = body as Record<string, string | boolean | undefined>;
    if (!id) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
    await db.location.update({
      where: { id: id as string },
      data: {
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(addressLine !== undefined ? { addressLine: String(addressLine).trim() || null } : {}),
        ...(city !== undefined ? { city: String(city).trim() || null } : {}),
        ...(postcode !== undefined ? { postcode: String(postcode).trim() || null } : {}),
        ...(phone !== undefined ? { phone: String(phone).trim() || null } : {}),
        ...(email !== undefined ? { email: String(email).trim() || null } : {}),
        ...(color !== undefined ? { color: String(color).trim() || null } : {}),
        ...(typeof active === 'boolean' ? { active } : {}),
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.op === 'setPrimary') {
    const { id } = body as { id?: string };
    if (!id) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
    await db.$transaction([
      db.location.updateMany({ data: { isPrimary: false } }),
      db.location.update({ where: { id }, data: { isPrimary: true, active: true } }),
    ]);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: 'Unknown op' }, { status: 400 });
}
