import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';
import { PERMISSION_KEYS } from '@/lib/permissions';

export const runtime = 'nodejs';

// Create or update a staff member, including role and per-user permission
// overrides. Requires the `staff.manage` permission.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });

  const { requirePermission, hashPassword } = await import('@/lib/auth');
  const actor = await requirePermission('staff.manage');
  if (!actor) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { id, email, name, role, password, grant, revoke, active } = body as {
    id?: string;
    email?: string;
    name?: string;
    role?: string;
    password?: string;
    grant?: string[];
    revoke?: string[];
    active?: boolean;
  };

  const validRole = ['OWNER', 'ADMIN', 'PRACTITIONER', 'FRONT_DESK', 'STAFF'];
  const clean = (arr?: string[]) => (arr ?? []).filter((k) => PERMISSION_KEYS.includes(k));

  const { db } = await import('@/lib/db');

  // Update existing
  if (id) {
    const target = await db.adminUser.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 });
    // Only an OWNER may modify another OWNER (protect the top role).
    if (target.role === 'OWNER' && actor.role !== 'OWNER') {
      return NextResponse.json({ ok: false, error: 'Only an owner can modify an owner.' }, { status: 403 });
    }
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (role && validRole.includes(role) && actor.role === 'OWNER') {
      data.role = role as 'OWNER' | 'ADMIN' | 'PRACTITIONER' | 'FRONT_DESK' | 'STAFF';
    }
    if (grant) data.permGrant = clean(grant);
    if (revoke) data.permRevoke = clean(revoke);
    if (typeof active === 'boolean') data.active = active;
    if (password) data.passwordHash = await hashPassword(password);
    const updated = await db.adminUser.update({ where: { id }, data });
    return NextResponse.json({ ok: true, id: updated.id });
  }

  // Create new
  if (!email || !password || !role) {
    return NextResponse.json({ ok: false, error: 'Email, role and a temporary password are required.' }, { status: 422 });
  }
  if (!validRole.includes(role)) return NextResponse.json({ ok: false, error: 'Invalid role.' }, { status: 422 });
  // Only an OWNER may create another OWNER.
  if (role === 'OWNER' && actor.role !== 'OWNER') {
    return NextResponse.json({ ok: false, error: 'Only an owner can create an owner.' }, { status: 403 });
  }
  const exists = await db.adminUser.findUnique({ where: { email: email.toLowerCase() } });
  if (exists) return NextResponse.json({ ok: false, error: 'A staff member with that email already exists.' }, { status: 409 });

  const created = await db.adminUser.create({
    data: {
      email: email.toLowerCase(),
      name: name || null,
      role: role as 'OWNER' | 'ADMIN' | 'PRACTITIONER' | 'FRONT_DESK' | 'STAFF',
      passwordHash: await hashPassword(password),
      permGrant: clean(grant),
      permRevoke: clean(revoke),
      createdBy: actor.email,
    },
  });
  return NextResponse.json({ ok: true, id: created.id });
}
