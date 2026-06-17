import 'server-only';
import { db } from '@/lib/db';
import { rateLimit } from '@/lib/security/rate-limit';

// Brute-force protection + auth telemetry. Source of truth is the Postgres
// SecurityEvent log (also powers the admin Security centre); a Redis fast
// counter is layered on for per-IP burst limiting when configured.

const WINDOW_SEC = 15 * 60;            // sliding window for failure counting
const ACCOUNT_LOCK = 5;                // failures per email in window → locked
const IP_LOCK = 20;                    // failures per IP in window → throttled
const CAPTCHA_AFTER = 3;               // failures → require a CAPTCHA challenge
export type Portal = 'admin' | 'client' | 'academy';

export function clientIp(req: Request): string {
  // Prefer the platform-set headers: on Vercel x-vercel-forwarded-for / x-real-ip are
  // stamped by the edge and can't be spoofed past the proxy. The raw X-Forwarded-For is
  // client-controllable on its left (an attacker prepends fake IPs to dodge per-IP rate
  // limiting / lockout), so if only XFF is present use the LAST hop — the proxy-appended
  // real client — not the first. (BLD-416)
  const platform = req.headers.get('x-vercel-forwarded-for') || req.headers.get('x-real-ip');
  if (platform) return platform.split(',').pop()!.trim();
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return 'unknown';
}

export async function recordSecurity(type: string, portal: Portal, identifier?: string | null, req?: Request, meta?: object) {
  try {
    await db.securityEvent.create({
      data: {
        type, portal,
        identifier: identifier?.toLowerCase() || null,
        ip: req ? clientIp(req) : null,
        userAgent: req?.headers.get('user-agent')?.slice(0, 300) || null,
        meta: meta as object | undefined,
      },
    });
  } catch { /* telemetry must never break auth */ }
}

async function failsSince(where: object): Promise<number> {
  const windowStart = new Date(Date.now() - WINDOW_SEC * 1000);
  // Ignore failures that predate a manual UNLOCK for this subject.
  const lastUnlock = await db.securityEvent.findFirst({ where: { ...where, type: 'UNLOCK' }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }).catch(() => null);
  const since = lastUnlock && lastUnlock.createdAt > windowStart ? lastUnlock.createdAt : windowStart;
  return db.securityEvent.count({ where: { ...where, type: 'LOGIN_FAIL', createdAt: { gte: since } } }).catch(() => 0);
}

export type LoginGate = { blocked: boolean; requireCaptcha: boolean; retryAfterSec: number };

/** Decide whether this login attempt may proceed, before checking the password. */
export async function loginGate(identifier: string, req: Request): Promise<LoginGate> {
  const ip = clientIp(req);
  // Per-IP burst limit (fast path via Redis when configured): 30 / minute.
  const burst = await rateLimit(`login:${ip}`, 30, 60);
  const [acct, ipFails] = await Promise.all([
    failsSince({ identifier: identifier.toLowerCase() }),
    ip !== 'unknown' ? failsSince({ ip }) : Promise.resolve(0),
  ]);
  const blocked = !burst.allowed || acct >= ACCOUNT_LOCK || ipFails >= IP_LOCK;
  const requireCaptcha = acct >= CAPTCHA_AFTER || ipFails >= CAPTCHA_AFTER;
  return { blocked, requireCaptcha, retryAfterSec: WINDOW_SEC };
}

/** Record the outcome of a login attempt (and a LOCKOUT marker on the boundary). */
export async function recordLogin(portal: Portal, identifier: string, success: boolean, req: Request, meta?: object) {
  await recordSecurity(success ? 'LOGIN_OK' : 'LOGIN_FAIL', portal, identifier, req, meta);
  if (!success) {
    const acct = await failsSince({ identifier: identifier.toLowerCase() });
    if (acct >= ACCOUNT_LOCK) await recordSecurity('LOCKOUT', portal, identifier, req);
  }
}

/** Clear the lockout for an email and/or IP (admin action). */
export async function unlock(opts: { identifier?: string; ip?: string }, portal: Portal = 'admin') {
  if (opts.identifier) await recordSecurity('UNLOCK', portal, opts.identifier);
  if (opts.ip) await db.securityEvent.create({ data: { type: 'UNLOCK', portal, ip: opts.ip } }).catch(() => {});
}

/** Per-IP rate limit for a sensitive endpoint. Returns true if allowed.
 *  Records a RATE_LIMITED event when the limit is hit. */
export async function enforceRateLimit(req: Request, scope: string, limit: number, windowSec: number, portal: Portal = 'client'): Promise<boolean> {
  const ip = clientIp(req);
  const r = await rateLimit(`${scope}:${ip}`, limit, windowSec);
  if (!r.allowed) await recordSecurity('RATE_LIMITED', portal, null, req, { scope });
  return r.allowed;
}

// ── Cloudflare Turnstile ─────────────────────────────────────────────────────
export const turnstileConfigured = Boolean(process.env.TURNSTILE_SECRET_KEY);

export async function verifyTurnstile(token: string | undefined, req: Request): Promise<boolean> {
  if (!turnstileConfigured) {
    // BLD-344: fail closed in production so a missing key doesn't silently
    // disable bot protection. In dev/test allow through so login still works.
    if (process.env.NODE_ENV === 'production') {
      console.error('[turnstile] TURNSTILE_SECRET_KEY is not set — CAPTCHA challenge will be rejected until the key is configured.');
      return false;
    }
    return true;
  }
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY!, response: token, remoteip: clientIp(req) });
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const j = await res.json();
    return Boolean(j.success);
  } catch {
    return false;
  }
}
