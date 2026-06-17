import 'server-only';
import { cache } from 'react';
import { SignJWT } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { effectivePermissions } from '@/lib/permissions';
import {
  SESSION_COOKIE as COOKIE,
  CLIENT_SESSION_COOKIE as CLIENT_COOKIE,
  ACADEMY_SESSION_COOKIE as ACADEMY_COOKIE,
  ADMIN_AUDIENCE,
  CLIENT_AUDIENCE,
  ACADEMY_AUDIENCE,
  adminSecret as secret,
  clientSecret,
  academySecret,
  verifyToken,
  verifyClientToken,
  verifyAcademyToken,
  type Session,
  type ClientSession,
  type AcademySession,
} from '@/lib/auth-edge';

// Re-export the Edge-safe primitives so existing `@/lib/auth` imports keep working.
export { SESSION_COOKIE, CLIENT_SESSION_COOKIE, ACADEMY_SESSION_COOKIE } from '@/lib/auth-edge';
export { verifyToken, verifyClientToken, verifyAcademyToken };
export type { Session, ClientSession, AcademySession };

/** Staff/admin/practitioner roles that may access the CRM. */
export const STAFF_ROLES = ['OWNER', 'ADMIN', 'PRACTITIONER', 'FRONT_DESK', 'STAFF'];
/** Roles permitted to view clinical (health-assessment) data. */
export const CLINICAL_ROLES = ['OWNER', 'ADMIN', 'PRACTITIONER'];
export const canViewClinical = (role?: string) => !!role && CLINICAL_ROLES.includes(role);

/** Owner/Admin only — clinic configuration such as room layout & equipment placement. */
export const ADMIN_ROLES = ['OWNER', 'ADMIN'];
export const sessionIsAdmin = (session: Session | null | undefined): boolean => !!session && ADMIN_ROLES.includes(session.role);

/** Does the current session hold a given fine-grained permission? */
export function sessionCan(session: Session | null | undefined, key: string): boolean {
  if (!session) return false;
  if (session.role === 'OWNER') return true;
  return effectivePermissions({ role: session.role, permGrant: session.grant, permRevoke: session.revoke }).has(key);
}

/** Guard for server components / route handlers — returns the session or null. */
export async function requirePermission(key: string): Promise<Session | null> {
  const session = await getSession();
  return sessionCan(session, key) ? session : null;
}

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 11);
}
export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

// Staff sessions: 12h absolute lifetime (JWT exp); the cookie carries a shorter
// idle window that middleware slides on each request, so an unattended session
// expires while an active one is kept alive (up to the 12h cap).
export const ADMIN_ABSOLUTE_TTL = '12h';
export const ADMIN_IDLE_SEC = 60 * 60 * 2; // 2h idle

export async function createSession(payload: Session) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ADMIN_ABSOLUTE_TTL)
    .setAudience(ADMIN_AUDIENCE)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_IDLE_SEC,
  });
}

export async function destroySession() {
  (await cookies()).set(COOKIE, '', { path: '/', maxAge: 0 });
}

// Authoritative session check: verify the JWT, then confirm the account is
// still active and the token's revocation epoch matches the DB (so deactivation
// and "sign out everywhere" take effect immediately). Memoised per request.
export const getSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  const session = await verifyToken(token);
  if (!session) return null;
  try {
    const { db } = await import('@/lib/db');
    const u = await db.adminUser.findUnique({ where: { id: session.sub }, select: { active: true, sessionEpoch: true } });
    if (!u || u.active === false) return null;
    if ((session.epoch ?? 0) !== (u.sessionEpoch ?? 0)) return null;
  } catch {
    // BLD-345: fail closed on DB unreachable — a deactivated account must not
    // remain authenticated during an outage. Active sessions will be re-verified
    // on the next request once the DB recovers.
    return null;
  }
  return session;
});

// ── Client portal sessions (separate cookie + secret) ───────────────────────
export async function createClientSession(payload: ClientSession) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .setAudience(CLIENT_AUDIENCE)
    .sign(clientSecret());
  (await cookies()).set(CLIENT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroyClientSession() {
  (await cookies()).set(CLIENT_COOKIE, '', { path: '/', maxAge: 0 });
}

export async function getClientSession(): Promise<ClientSession | null> {
  const token = (await cookies()).get(CLIENT_COOKIE)?.value;
  const session = await verifyClientToken(token);
  if (!session) return null;
  // BLD-161: validate the token's epoch against the client's current
  // sessionEpoch so a password reset (or future "sign out everywhere") revokes
  // outstanding portal JWTs immediately. BLD-345: if the DB is unreachable we
  // fail closed (return null) rather than trusting the signed claims, so a
  // revoked session can't survive an outage. Mirrors getSession.
  try {
    const { db } = await import('@/lib/db');
    const c = await db.client.findUnique({ where: { id: session.sub }, select: { sessionEpoch: true } });
    if (!c) return null;
    if ((session.epoch ?? 0) !== (c.sessionEpoch ?? 0)) return null;
  } catch {
    // BLD-345: fail closed on DB unreachable — mirrors the admin session fix.
    return null;
  }
  return session;
}

// ── Academy (trainee) portal sessions (separate cookie + secret) ────────────
export async function createAcademySession(payload: AcademySession) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .setAudience(ACADEMY_AUDIENCE)
    .sign(academySecret());
  (await cookies()).set(ACADEMY_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroyAcademySession() {
  (await cookies()).set(ACADEMY_COOKIE, '', { path: '/', maxAge: 0 });
}

export async function getAcademySession(): Promise<AcademySession | null> {
  const token = (await cookies()).get(ACADEMY_COOKIE)?.value;
  const session = await verifyAcademyToken(token);
  if (!session) return null;
  // BLD-421: validate the token epoch against the student's current sessionEpoch so a
  // password reset / sign-out-everywhere revokes outstanding academy JWTs immediately.
  // Fail closed on a DB outage (don't trust the signed claims). Mirrors getSession/getClientSession.
  try {
    const { db } = await import('@/lib/db');
    const s = await db.academyStudent.findUnique({ where: { id: session.sub }, select: { sessionEpoch: true } });
    if (!s) return null;
    if ((session.epoch ?? 0) !== (s.sessionEpoch ?? 0)) return null;
  } catch {
    return null;
  }
  return session;
}

/** The list of permission keys for the current session (for nav gating). */
export async function sessionPermissions(): Promise<string[]> {
  const session = await getSession();
  if (!session) return [];
  return [...effectivePermissions({ role: session.role, permGrant: session.grant, permRevoke: session.revoke })];
}
