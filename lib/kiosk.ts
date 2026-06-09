import 'server-only';
import { createHash, randomBytes } from 'crypto';
import { db } from '@/lib/db';
import { analyzeKioskPhoto } from '@/lib/kiosk-ai';

// ── Shared kiosk helpers ─────────────────────────────────────────────────────
// Token/slug generation, IP hashing (no raw IPs stored), funnel event logging,
// and the fire-and-forget "analyse photo → save result" sequence.

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const SAFE = 'abcdefghijkmnpqrstuvwxyz23456789'; // unambiguous, URL-safe

export const SESSION_TTL = SESSION_TTL_MS;

/** A short, URL-safe, unambiguous token/slug. */
export function randomToken(len = 10): string {
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += SAFE[bytes[i] % SAFE.length];
  return out;
}

/** 8-char share slug. */
export const randomShareSlug = () => randomToken(8);

/** Hash a client IP so we never store the raw address (anti-abuse counting only). */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const salt = process.env.KIOSK_IP_SALT || process.env.ENCRYPTION_KEY || 'k-clinics-kiosk';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

/** Best-effort client IP from proxy headers. */
export function clientIp(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip');
}

/** Log a funnel event. Never throws. */
export async function logKioskEvent(event: string, sessionId?: string | null, ipHash?: string | null): Promise<void> {
  try {
    await db.kioskEvent.create({ data: { event, sessionId: sessionId || null, ipHash: ipHash || null } });
  } catch { /* analytics is best-effort */ }
}

export const sessionExpiry = () => new Date(Date.now() + SESSION_TTL_MS);

/**
 * Fire-and-forget: run the AI analysis for a session's photo and persist a
 * KioskResult, flipping the session to ANALYZED. Safe to call without awaiting;
 * never throws. Logs an `analyzed` event on success.
 */
export async function runKioskAnalysis(sessionId: string): Promise<void> {
  try {
    const session = await db.kioskSession.findUnique({ where: { id: sessionId } });
    if (!session?.photoUrl) return;
    // Don't re-analyse if a result already exists.
    const existing = await db.kioskResult.findUnique({ where: { sessionId } });
    if (existing) return;

    const result = await analyzeKioskPhoto(session.photoUrl);
    if (!result) {
      await db.kioskSession.update({ where: { id: session.id }, data: { status: 'ANALYSIS_FAILED' } }).catch(() => {});
      return;
    }

    await db.kioskResult.create({
      data: {
        sessionId: session.id,
        headline: result.headline,
        skinScore: result.skinScore,
        smileScore: result.smileScore,
        insights: result.insights,
        treatments: result.treatments,
        photoUrl: session.photoUrl,
        shareSlug: randomShareSlug(),
      },
    });
    await db.kioskSession.update({ where: { id: session.id }, data: { status: 'ANALYZED' } });
    await logKioskEvent('analyzed', session.id, session.ipHash);
  } catch (e) {
    console.error('[kiosk] analysis save failed:', (e as Error)?.message);
  }
}
