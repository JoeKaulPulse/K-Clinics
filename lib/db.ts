import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

// ── Database client ──────────────────────────────────────────────────────────
// Prisma Postgres is meant to be reached through Prisma's connection *pooler*
// (the prisma+postgres:// address). Going through the pooler means the whole
// serverless fleet shares a small managed pool of real connections, instead of
// every function instance opening its own direct connection — which is what was
// exhausting the underlying Postgres's low connection cap (booking/admin pages
// erroring under traffic + deploys at the same time).
//
// So: if a pooled prisma+postgres:// URL is available we use it (via the
// Accelerate client extension). Otherwise we fall back to a direct postgres://
// connection (previous behaviour) so nothing breaks if the pooled URL isn't set.
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

/**
 * Cap how many connections each serverless instance opens on a *direct*
 * postgres:// connection. Vercel scales horizontally, so without this every
 * concurrent function instance opens Prisma's default pool (num_cpus*2+1),
 * which exhausts the database's connection limit and 500s pages/deploys. On
 * serverless we force a tiny per-instance pool + short timeouts; locally we keep
 * Prisma's defaults. Only applied to raw postgres:// URLs — the Accelerate
 * `prisma+postgres://` pooler manages connections itself and is left untouched.
 */
function withServerlessParams(url: string): string {
  const onServerless = Boolean(process.env.VERCEL) || process.env.NODE_ENV === 'production';
  if (!onServerless) return url;
  try {
    const u = new URL(url);
    if (!u.searchParams.has('connection_limit')) u.searchParams.set('connection_limit', '1');
    if (!u.searchParams.has('pool_timeout')) u.searchParams.set('pool_timeout', '15');
    if (!u.searchParams.has('connect_timeout')) u.searchParams.set('connect_timeout', '10');
    return u.toString();
  } catch {
    return url; // unparseable (shouldn't happen) — use as-is rather than break boot
  }
}

const log = process.env.NODE_ENV === 'development' ? (['warn', 'error'] as const) : (['error'] as const);

function makeClient() {
  const pooled = resolvePooledUrl();
  if (pooled) {
    // Route every runtime query through the Accelerate pooler.
    return new PrismaClient({ datasources: { db: { url: pooled } }, log: [...log] }).$extends(withAccelerate());
  }
  const direct = resolveDirectUrl();
  const url = direct ? withServerlessParams(direct) : undefined;
  return new PrismaClient({ ...(url ? { datasources: { db: { url } } } : {}), log: [...log] });
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
