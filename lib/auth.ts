import 'server-only';
import { SignJWT } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { effectivePermissions } from '@/lib/permissions';
import {
  SESSION_COOKIE as COOKIE,
  CLIENT_SESSION_COOKIE as CLIENT_COOKIE,
  ACADEMY_SESSION_COOKIE as ACADEMY_COOKIE,
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

export async function createSession(payload: Session) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  (await cookies()).set(COOKIE, '', { path: '/', maxAge: 0 });
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  return verifyToken(token);
}

// ── Client portal sessions (separate cookie + secret) ───────────────────────
export async function createClientSession(payload: ClientSession) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(clientSecret());
  (await cookies()).set(CLIENT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroyClientSession() {
  (await cookies()).set(CLIENT_COOKIE, '', { path: '/', maxAge: 0 });
}

export async function getClientSession(): Promise<ClientSession | null> {
  const token = (await cookies()).get(CLIENT_COOKIE)?.value;
  return verifyClientToken(token);
}

// ── Academy (trainee) portal sessions (separate cookie + secret) ────────────
export async function createAcademySession(payload: AcademySession) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(academySecret());
  (await cookies()).set(ACADEMY_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroyAcademySession() {
  (await cookies()).set(ACADEMY_COOKIE, '', { path: '/', maxAge: 0 });
}

export async function getAcademySession(): Promise<AcademySession | null> {
  const token = (await cookies()).get(ACADEMY_COOKIE)?.value;
  return verifyAcademyToken(token);
}

/** The list of permission keys for the current session (for nav gating). */
export async function sessionPermissions(): Promise<string[]> {
  const session = await getSession();
  if (!session) return [];
  return [...effectivePermissions({ role: session.role, permGrant: session.grant, permRevoke: session.revoke })];
}
