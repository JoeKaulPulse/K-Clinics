import { timingSafeEqual } from 'node:crypto';

// Shared constant-time auth for the CRON_SECRET-protected routes (cron jobs,
// health probes, ops password-reset). A plain `===`/`!==` short-circuits on the
// first differing byte, leaking a timing oracle on a secret that also guards
// account/reset-password (which can set any client's password). Compare in
// constant time instead.

/** Constant-time equality for secret comparison (length-safe; never throws). */
export function safeEqual(provided: string, expected: string): boolean {
  if (!expected || provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** True when the request carries `Authorization: Bearer <CRON_SECRET>` (or the
 *  `x-cron-secret` header), compared in constant time. False if no secret is set. */
export function cronAuthorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const provided =
    (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '') ||
    req.headers.get('x-cron-secret') ||
    '';
  return safeEqual(provided, expected);
}
