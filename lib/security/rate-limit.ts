import 'server-only';
import { Redis } from '@upstash/redis';
import { db } from '@/lib/db';

// Fixed-window rate limiter. Prefers Upstash Redis (via the official SDK,
// Redis.fromEnv) when configured; otherwise falls back to a Postgres-backed
// counter so protection works on day one with no extra infrastructure.

export const redisConfigured = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

// Lazy singleton — Redis.fromEnv() reads UPSTASH_REDIS_REST_URL/TOKEN and would
// throw if they're absent, so only construct it when configured.
let redis: Redis | null = null;
function getRedis(): Redis | null {
  if (!redisConfigured) return null;
  if (!redis) redis = Redis.fromEnv();
  return redis;
}

export type RateResult = { allowed: boolean; count: number; limit: number; retryAfterSec: number };

/** Count one hit for `key` within a `windowSec` window and report whether the
 *  caller is within `limit`. By default fails open on store errors so a limiter
 *  outage never blocks legitimate traffic. Pass `failClosed: true` for
 *  high-sensitivity scopes (finance PIN, promo validate) where a store outage
 *  must not silently disable throttling. */
export async function rateLimit(key: string, limit: number, windowSec: number, opts?: { failClosed?: boolean }): Promise<RateResult> {
  const r = getRedis();
  if (r) {
    try {
      const rkey = `rl:${key}`;
      const count = await r.incr(rkey);
      if (count === 1) await r.expire(rkey, windowSec);
      return { allowed: count <= limit, count, limit, retryAfterSec: windowSec };
    } catch {
      /* fall through to DB */
    }
  }
  try {
    const since = new Date(Date.now() - windowSec * 1000);
    const count = await db.securityEvent.count({ where: { type: 'RATE_HIT', identifier: key, createdAt: { gte: since } } });
    await db.securityEvent.create({ data: { type: 'RATE_HIT', portal: 'rl', identifier: key } });
    return { allowed: count + 1 <= limit, count: count + 1, limit, retryAfterSec: windowSec };
  } catch (err) {
    if (opts?.failClosed) {
      console.error('[rate-limit] store unavailable — failing closed for sensitive scope:', key, (err as Error)?.message);
      return { allowed: false, count: 0, limit, retryAfterSec: windowSec };
    }
    return { allowed: true, count: 0, limit, retryAfterSec: windowSec };
  }
}
