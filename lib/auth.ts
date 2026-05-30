import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

const COOKIE = 'kc_admin';
const CLIENT_COOKIE = 'kc_client';
const secret = () => {
  const s = process.env.ADMIN_JWT_SECRET;
  if (!s) {
    // Never run with a guessable secret in production.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ADMIN_JWT_SECRET is required in production.');
    }
    return new TextEncoder().encode('dev-insecure-secret-change-me');
  }
  return new TextEncoder().encode(s);
};
const clientSecret = () => {
  const s = process.env.CLIENT_JWT_SECRET || process.env.ADMIN_JWT_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CLIENT_JWT_SECRET is required in production.');
    }
    return new TextEncoder().encode('dev-insecure-client-secret-change-me');
  }
  return new TextEncoder().encode(s);
};

export type Session = { sub: string; email: string; name?: string; role: string };
export type ClientSession = { sub: string; email: string; firstName: string };

/** Staff/admin/practitioner roles that may access the CRM. */
export const STAFF_ROLES = ['OWNER', 'ADMIN', 'PRACTITIONER', 'FRONT_DESK', 'STAFF'];
/** Roles permitted to view clinical (health-assessment) data. */
export const CLINICAL_ROLES = ['OWNER', 'ADMIN', 'PRACTITIONER'];
export const canViewClinical = (role?: string) => !!role && CLINICAL_ROLES.includes(role);

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
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

/** Edge-safe verification (used by middleware) given a raw token string. */
export async function verifyToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as Session;
  } catch {
    return null;
  }
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
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, clientSecret());
    return payload as unknown as ClientSession;
  } catch {
    return null;
  }
}

export async function verifyClientToken(token: string | undefined): Promise<ClientSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, clientSecret());
    return payload as unknown as ClientSession;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = COOKIE;
export const CLIENT_SESSION_COOKIE = CLIENT_COOKIE;
