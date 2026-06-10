import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// ── Database client ──────────────────────────────────────────────────────────
// Prisma Postgres is meant to be reached through Prisma's connection *pooler*
// (the prisma+postgres:// address). Going through the pooler means the whole
// serverless fleet shares a small managed pool of real connections, instead of
// every function instance opening its own direct connection — which is what was
// exhausting the underlying Postgres's low connection cap (booking/admin pages
// erroring under traffic + deploys at the same time).
//
// Prisma 7 removed `datasources` from the PrismaClient constructor and also
// dropped the old binary/library engine — the only engine is now the WASM
// "client" engine, which REQUIRES either `accelerateUrl` or an `adapter`.
// The adapter approach uses pg's Pool, which is lazy (connects on first query,
// not at construction time) so builds without a DATABASE_URL still succeed.
//
// Migrations are deliberately the *other* way round — scripts/db-sync.mjs always
// uses a direct postgres:// URL — so schema syncs never compete with live
// traffic for the pooled connections.

/** A pooled Prisma Accelerate URL, if one is configured. */
function resolvePooledUrl(): string | undefined {
  const candidates = [
    process.env.PRISMA_DATABASE_URL,   // Prisma Postgres / Accelerate (preferred)
    process.env.ACCELERATE_URL,
    process.env.DATABASE_URL,          // may itself be a prisma+postgres:// URL
    process.env.POSTGRES_URL,
  ].filter(Boolean) as string[];
  return candidates.find((u) => /^prisma(\+postgres)?:\/\//.test(u));
}

/** A direct postgres:// connection, used only when no pooled URL is configured. */
function resolveDirectUrl(): string | undefined {
  const candidates = [
    process.env.POSTGRES_PRISMA_URL,   // pooled, postgres:// (PgBouncer)
    process.env.POSTGRES_URL,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.DATABASE_URL,
  ].filter(Boolean) as string[];
  return candidates.find((u) => /^postgres(ql)?:\/\//.test(u)) ?? undefined;
}

const log = process.env.NODE_ENV === 'development' ? (['warn', 'error'] as const) : (['error'] as const);

function makeClient() {
  const pooled = resolvePooledUrl();
  if (pooled) {
    // Route every runtime query through the Accelerate pooler.
    return new PrismaClient({ accelerateUrl: pooled, log: [...log] }).$extends(withAccelerate());
  }

  // Direct connection path: use the pg driver adapter. pg's Pool is lazy —
  // it does not connect until the first query, so this is safe to construct
  // even when no DATABASE_URL is configured (e.g. during static builds or CI
  // without a database). It will fail at query time, not at import time.
  //
  // pg + PrismaPg are static imports (bundled via transpilePackages in
  // next.config.mjs). The previous dynamic require()s were invisible to
  // Turbopack's tracer and broke in the deployed lambda.
  const direct = resolveDirectUrl();
  const onServerless = Boolean(process.env.VERCEL) || process.env.NODE_ENV === 'production';
  const pool = new Pool({
    ...(direct ? { connectionString: direct } : {}),
    ...(onServerless ? { max: 1, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 15_000 } : {}),
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter, log: [...log] });
}

// The Accelerate-extended client is a structural superset of PrismaClient for
// every call this codebase makes (model delegates, $transaction, $queryRaw), so
// we expose it as PrismaClient to keep the rest of the app unchanged.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db: PrismaClient = globalForPrisma.prisma ?? (makeClient() as unknown as PrismaClient);

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;

/** Run a DB read with a couple of quick retries, to ride out transient blips —
 *  a serverless cold start, a momentary connection spike, or the managed
 *  Postgres briefly resuming from idle. Keeps user-facing pages (e.g. booking)
 *  from degrading to a "call us" fallback over a single hiccup. Only meant for
 *  idempotent reads; do NOT wrap writes (a retry could double-apply). */
export async function withDbRetry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 150): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, baseDelayMs * (i + 1)));
    }
  }
  throw lastErr;
}
