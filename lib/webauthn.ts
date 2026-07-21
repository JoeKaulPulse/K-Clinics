import 'server-only';
import { SignJWT, jwtVerify } from 'jose';

// WebAuthn (passkey) step-up for high-risk actions. Platform authenticators
// only (Face ID / Touch ID / Windows Hello), user-verification required.
// The same flow gates several operations, distinguished by `purpose` so an
// unlock minted for one action can't be replayed to authorise another.

export const STEP_UP_PURPOSES = ['export', 'rotate-keys', 'finance'] as const;
export type StepUpPurpose = (typeof STEP_UP_PURPOSES)[number];

// How long a fresh step-up stays valid, per purpose. Financial viewing gets a
// 30-min window so admins aren't re-prompted on every page; the rest are tight.
const UNLOCK_TTL: Partial<Record<StepUpPurpose, string>> = { finance: '30m' };

export function isStepUpPurpose(v: unknown): v is StepUpPurpose {
  return typeof v === 'string' && (STEP_UP_PURPOSES as readonly string[]).includes(v);
}

// PRJ-918.11 (owner-approved 20 Jul): the RP ID and accepted origins are
// PINNED to the canonical site domain. The old derivation trusted the request
// Host header, so a spoofed/forwarded Host could steer the ceremony's expected
// origin. In production the request URL is now ignored entirely; localhost is
// honoured only outside production builds so local development keeps working.
const CANONICAL_SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://kclinics.co.uk').replace(/\/$/, '');

export function rp(req: Request): { rpID: string; origin: string; origins: string[]; rpName: string; secure: boolean } {
  const url = new URL(req.url);
  const isLocalDev = process.env.NODE_ENV !== 'production' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  if (isLocalDev) {
    const origin = `${url.protocol}//${url.host}`;
    return { rpID: url.hostname, origin, origins: [origin], rpName: 'K Clinics', secure: url.protocol === 'https:' };
  }
  const canon = new URL(CANONICAL_SITE);
  // Use the registrable domain (strip a leading `www.`) as the rpID so a passkey
  // created on the apex works on `www` and vice-versa — otherwise iOS can't find
  // the local passkey for the current host and falls back to the cross-device
  // "use a passkey" sheet instead of Face ID. Assertions are accepted from either
  // origin.
  const rpID = canon.hostname.replace(/^www\./, '');
  const origin = `${canon.protocol}//${canon.host}`;
  const origins = Array.from(new Set([origin, `${canon.protocol}//${rpID}`, `${canon.protocol}//www.${rpID}`]));
  return { rpID, origin, origins, rpName: 'K Clinics', secure: canon.protocol === 'https:' };
}

function secret(): Uint8Array {
  const s = process.env.ADMIN_JWT_SECRET;
  if (!s) throw new Error('ADMIN_JWT_SECRET required');
  return new TextEncoder().encode(s);
}

export const CHALLENGE_COOKIE = 'kc_wa_chal';
export const LOGIN_CHALLENGE_COOKIE = 'kc_wa_login';

/** Per-purpose unlock cookie so each step-up token is isolated. */
export function unlockCookie(purpose: StepUpPurpose): string {
  return `kc_su_${purpose}`;
}

/** Short-lived token proving a fresh passkey step-up for `sub` + `purpose`. */
export async function signUnlock(sub: string, purpose: StepUpPurpose = 'export'): Promise<string> {
  return new SignJWT({ purpose })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(UNLOCK_TTL[purpose] || '3m')
    .sign(secret());
}

export async function verifyUnlock(token: string | undefined, sub: string, purpose: StepUpPurpose = 'export'): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.purpose === purpose && payload.sub === sub;
  } catch {
    return false;
  }
}
