import 'server-only';
import { SignJWT, jwtVerify } from 'jose';

// WebAuthn (passkey) step-up for the full data export. Platform authenticators
// only (Face ID / Touch ID / Windows Hello), user-verification required.

export function rp(req: Request): { rpID: string; origin: string; rpName: string; secure: boolean } {
  const url = new URL(req.url);
  return { rpID: url.hostname, origin: `${url.protocol}//${url.host}`, rpName: 'K Clinics', secure: url.protocol === 'https:' };
}

function secret(): Uint8Array {
  const s = process.env.ADMIN_JWT_SECRET;
  if (!s) throw new Error('ADMIN_JWT_SECRET required');
  return new TextEncoder().encode(s);
}

export const CHALLENGE_COOKIE = 'kc_wa_chal';
export const UNLOCK_COOKIE = 'kc_export_unlock';

/** Short-lived token proving a fresh passkey step-up for `sub`. */
export async function signUnlock(sub: string): Promise<string> {
  return new SignJWT({ purpose: 'export' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime('3m')
    .sign(secret());
}

export async function verifyUnlock(token: string | undefined, sub: string): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.purpose === 'export' && payload.sub === sub;
  } catch {
    return false;
  }
}
