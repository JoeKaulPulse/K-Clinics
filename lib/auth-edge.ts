// Edge-safe authentication primitives. Contains ONLY what can run in the Edge
// Runtime (middleware): jose-based JWT verify + cookie names + session types.
// No bcrypt, no next/headers, no `server-only` — so importing this into
// middleware never drags Node-only code (bcryptjs) into the Edge bundle.
import { jwtVerify } from 'jose';

export const SESSION_COOKIE = 'kc_admin';
export const CLIENT_SESSION_COOKIE = 'kc_client';
export const ACADEMY_SESSION_COOKIE = 'kc_academy';

// Audience claim per portal. Set on sign (lib/auth.ts) and REQUIRED on verify
// below, so a token minted for one portal can never authenticate on another —
// even if CLIENT/ACADEMY/ADMIN JWT secrets are accidentally set to the same
// value. This is the real isolation boundary; distinct secrets are belt-and-braces.
export const ADMIN_AUDIENCE = 'kc-admin';
export const CLIENT_AUDIENCE = 'kc-client';
export const ACADEMY_AUDIENCE = 'kc-academy';

export type Session = {
  sub: string;
  email: string;
  name?: string;
  role: string;
  /** Per-user permission overrides, captured at login for fast checks. */
  grant?: string[];
  revoke?: string[];
  /** Set when 2FA is required for this role but not yet enrolled — the user is
   *  signed in only far enough to complete setup (gated in middleware). */
  needsSetup?: boolean;
  /** Session-revocation epoch, validated against the DB in getSession(). */
  epoch?: number;
};
export type ClientSession = { sub: string; email: string; firstName: string; epoch?: number };
export type AcademySession = { sub: string; email: string; firstName: string; epoch?: number };

// HS256 requires a key of at least 256 bits (32 bytes); `jose` rejects shorter
// secrets at sign time. Normalise any configured secret to >=32 bytes by
// repeating its bytes — deterministic, sync and edge-safe. A proper-length
// secret passes through byte-for-byte, so this is fully backward-compatible.
export const toKey = (s: string): Uint8Array => {
  const bytes = new TextEncoder().encode(s);
  if (bytes.length >= 32) return bytes;
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = bytes[i % bytes.length];
  return out;
};

export const adminSecret = (): Uint8Array => {
  const s = process.env.ADMIN_JWT_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === 'production') throw new Error('ADMIN_JWT_SECRET is required in production.');
    return toKey('dev-insecure-secret-change-me');
  }
  // BLD-705: warn when the secret is below 32 characters (256 bits) in production.
  if (process.env.NODE_ENV === 'production' && s.length < 32) {
    console.error('[auth] ADMIN_JWT_SECRET is too short — use at least 32 characters in production');
    try { const Sentry = require('@sentry/nextjs'); Sentry.captureMessage('ADMIN_JWT_SECRET is too short', 'error'); } catch { /* Sentry not configured */ }
  }
  return toKey(s);
};

export const clientSecret = (): Uint8Array => {
  const s = process.env.CLIENT_JWT_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === 'production') throw new Error('CLIENT_JWT_SECRET is required in production.');
    return toKey('dev-insecure-client-secret-change-me');
  }
  return toKey(s);
};

export async function verifyToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, adminSecret(), { audience: ADMIN_AUDIENCE });
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

export async function verifyClientToken(token: string | undefined): Promise<ClientSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, clientSecret(), { audience: CLIENT_AUDIENCE });
    return payload as unknown as ClientSession;
  } catch {
    return null;
  }
}

// Academy (trainee) portal — separate from the clinic client portal.
export const academySecret = (): Uint8Array => {
  const s = process.env.ACADEMY_JWT_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === 'production') throw new Error('ACADEMY_JWT_SECRET is required in production.');
    return toKey('dev-insecure-academy-secret-change-me');
  }
  return toKey(s);
};

export async function verifyAcademyToken(token: string | undefined): Promise<AcademySession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, academySecret(), { audience: ACADEMY_AUDIENCE });
    return payload as unknown as AcademySession;
  } catch {
    return null;
  }
}
