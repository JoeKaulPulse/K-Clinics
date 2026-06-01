import 'server-only';
import { db } from '@/lib/db';

// Fixed-window rate limiter. Prefers Upstash Redis (REST, no SDK) when
// configured; otherwise falls back to a Postgres-backed counter so protection
// works on day one with no extra infrastructure.

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
export const redisConfigured = Boolean(REDIS_URL && REDIS_TOKEN);

export type RateResult = { allowed: boolean; count: number; limit: number; retryAfterSec: number };

async function redisCmd(args: (string | number)[]): Promise<unknown> {
  const res = await fetch(`${REDIS_URL}/${args.map((a) => encodeURIComponent(String(a))).join('/')}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`redis ${res.status}`);
  const j = await res.json();
  return j.result;
}

/** Count one hit for `key` within a `windowSec` window and report whether the
 *  caller is within `limit`. Fails open on store errors (never blocks a real
 *  user because the limiter is down). */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<RateResult> {
  if (redisConfigured) {
    try {
      const rkey = `rl:${key}`;
      const count = Number(await redisCmd(['INCR', rkey]));
      if (count === 1) await redisCmd(['EXPIRE', rkey, windowSec]);
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
  } catch {
    return { allowed: true, count: 0, limit, retryAfterSec: windowSec };
  }
}
