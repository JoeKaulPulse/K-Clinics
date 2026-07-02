import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';
import { PERMISSION_KEYS, effectivePermissions } from '@/lib/permissions';

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
  // Privilege-escalation clamp: a non-OWNER (e.g. a delegate granted
  // staff.manage) may only grant permissions they themselves hold, and never
  // the owner-only ones. OWNERs can grant anything.
  const OWNER_ONLY = ['staff.manage', 'security.manage', 'settings.manage'];
  const actorPerms = effectivePermissions({ role: actor.role, permGrant: actor.grant, permRevoke: actor.revoke });
  const clampGrant = (arr?: string[]) => clean(arr).filter((k) => actor.role === 'OWNER' || (actorPerms.has(k) && !OWNER_ONLY.includes(k)));

  const { db } = await import('@/lib/db');

  // Reset a staff member's 2FA (e.g. lost authenticator). They'll be prompted
  // to set it up again on next login if their role requires it.
  if (body.op === 'reset2fa') {
    if (!id) return NextResponse.json({ ok: false, error: 'Missing id.' }, { status: 400 });
    // Only an OWNER may strip an OWNER's second factor (this runs before the
    // generic owner-protection guard below, so check it here too).
    const t = await db.adminUser.findUnique({ where: { id }, select: { role: true } });
    if (t?.role === 'OWNER' && actor.role !== 'OWNER') return NextResponse.json({ ok: false, error: 'Only an owner can reset an owner’s 2FA.' }, { status: 403 });
    await db.adminUser.update({ where: { id }, data: { totpSecret: null, totpEnabledAt: null, recoveryCodes: [] } });
    const { logAudit } = await import('@/lib/audit');
    await logAudit({ action: 'NOTE_ADDED', actor: actor.email, actorRole: actor.role, summary: `Reset 2FA for staff ${id}` });
    return NextResponse.json({ ok: true, id });
  }

  // Public team-page profile update (single source of truth → /team).
  if (body.op === 'profile') {
    if (!id) return NextResponse.json({ ok: false, error: 'Missing id.' }, { status: 400 });
    const b = body as Record<string, unknown>;
    const num = (v: unknown) => (v === '' || v == null ? null : Math.max(0, Math.round(Number(v)) || 0));
    await db.adminUser.update({
      where: { id },
      data: {
        ...(typeof b.publicProfile === 'boolean' ? { publicProfile: b.publicProfile } : {}),
        ...(b.title !== undefined ? { title: (b.title as string)?.trim() || null } : {}),
        ...(b.photoUrl !== undefined ? { photoUrl: (b.photoUrl as string)?.trim() || null } : {}),
        ...(b.publicPhone !== undefined ? { publicPhone: (b.publicPhone as string)?.trim() || null } : {}),
        ...(b.bio !== undefined ? { bio: (b.bio as string)?.trim() || null } : {}),
        ...(b.credentials !== undefined ? { credentials: (b.credentials as string)?.trim() || null } : {}),
        ...(b.yearsExperience !== undefined ? { yearsExperience: num(b.yearsExperience) } : {}),
        ...(b.profileOrder !== undefined ? { profileOrder: num(b.profileOrder) ?? 0 } : {}),
      },
    });
    const { revalidatePath } = await import('next/cache');
    revalidatePath('/team');
    import('@/lib/indexnow').then((m) => m.indexNow(['/team'])).catch(() => {});
    return NextResponse.json({ ok: true, id });
  }

  // Update existing
  if (id) {
    const target = await db.adminUser.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 });
    // Only an OWNER may modify another OWNER (protect the top role).
    if (target.role === 'OWNER' && actor.role !== 'OWNER') {
      return NextResponse.json({ ok: false, error: 'Only an owner can modify an owner.' }, { status: 403 });
    }
    // Self-lockout guard: you can't switch off or change the role of your own
    // account from the staff console (do it from another admin if needed).
    const isSelf = target.email.toLowerCase() === actor.email.toLowerCase();
    if (isSelf && (active === false || (role && validRole.includes(role) && role !== target.role))) {
      return NextResponse.json({ ok: false, error: 'You can’t deactivate or change the role of your own account here.' }, { status: 400 });
    }
    // Never leave the clinic with zero active owners — block deactivating or
    // demoting the last one.
    if (target.role === 'OWNER' && (active === false || (role && validRole.includes(role) && role !== 'OWNER'))) {
      const otherActiveOwners = await db.adminUser.count({ where: { role: 'OWNER', active: true, id: { not: target.id } } });
      if (otherActiveOwners === 0) return NextResponse.json({ ok: false, error: 'This is the last active owner — add or promote another owner first.' }, { status: 400 });
    }
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (role && validRole.includes(role) && actor.role === 'OWNER') {
      data.role = role as 'OWNER' | 'ADMIN' | 'PRACTITIONER' | 'FRONT_DESK' | 'STAFF';
    }
    if (grant) data.permGrant = clampGrant(grant);
    if (revoke) data.permRevoke = clean(revoke);
    if (typeof active === 'boolean') data.active = active;
    if (password) data.passwordHash = await hashPassword(password);
    // Link (or clear) this account's Google sign-in. Lets an owner merge a
    // Workspace email that differs from the login email into the right record;
    // clearing it also unlinks any previously bound Google identity.
    if (typeof body.googleEmail === 'string') {
      const ge = body.googleEmail.trim().toLowerCase();
      if (!ge) {
        data.googleEmail = null;
        data.googleSub = null;
      } else {
        const clash = await db.adminUser.findFirst({ where: { id: { not: id }, OR: [{ googleEmail: ge }, { email: ge }] }, select: { id: true } });
        if (clash) return NextResponse.json({ ok: false, error: 'Another staff member already uses that Google email.' }, { status: 409 });
        data.googleEmail = ge;
      }
    }
    // Role/permission/password/active are baked into the target's session JWT.
    // Bump their revocation epoch so the change takes effect immediately —
    // otherwise a demoted user keeps elevated access until their token expires.
    const securityRelevant = 'role' in data || 'permGrant' in data || 'permRevoke' in data || 'passwordHash' in data || data.active === false;
    if (securityRelevant) data.sessionEpoch = { increment: 1 };
    const updated = await db.adminUser.update({ where: { id }, data });
    if (securityRelevant) {
      try {
        const { logAudit } = await import('@/lib/audit');
        const changes: Record<string, unknown> = {};
        if ('role' in data) changes.role = { before: target.role, after: data.role };
        if ('permGrant' in data) changes.permGrant = { before: target.permGrant, after: data.permGrant };
        if ('permRevoke' in data) changes.permRevoke = { before: target.permRevoke, after: data.permRevoke };
        if ('passwordHash' in data) changes.password = 'changed';
        if (data.active === false) changes.active = { before: target.active, after: false };
        await logAudit({ action: 'SETTINGS_UPDATED', actor: actor.email, actorRole: actor.role, summary: `Staff security change on ${target.email}: ${Object.keys(changes).join(', ')}`, meta: { targetId: id, targetEmail: target.email, changes } });
      } catch { /* non-fatal */ }
    }
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
      permGrant: clampGrant(grant),
      permRevoke: clean(revoke),
      createdBy: actor.email,
    },
  });

  // BLD-751: notify the new hire with their sign-in details, so credentials
  // don't have to be relayed out-of-band by whoever created the account.
  // Best-effort — a failed welcome email must not fail account creation.
  try {
    const { sendEmail, tmplStaffWelcome } = await import('@/lib/email');
    const base = process.env.NEXT_PUBLIC_SITE_URL || '';
    const res = await sendEmail({
      to: created.email,
      subject: 'Your K Clinics staff account',
      html: tmplStaffWelcome({ name: name || created.email, email: created.email, tempPassword: password, loginUrl: `${base}/admin/login` }),
    });
    await db.emailEvent.create({ data: { kind: 'MANUAL', to: created.email, subject: 'Staff account created', status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error } });
  } catch (e) {
    console.error('[admin/staff] welcome email failed (account still created):', (e as Error)?.message);
  }

  return NextResponse.json({ ok: true, id: created.id });
}
