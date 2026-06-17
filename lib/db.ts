import { PrismaClient } from '@prisma/client';
import type { PrismaPromise } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { isAcademyModel, applyTenantScope } from '@/lib/tenant-scope';

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

// ── ClinicOS multi-tenancy — Ring 0.2 (BLD-300) + Ring 1d RLS (BLD-301) ───────
// Scope every Academy query to the current tenant, centrally, instead of editing
// ~100 call sites (PLATFORM_SAAS_PLAN.md §6.3 step 3). The hook is applied as the
// OUTERMOST extension so it rewrites args before Accelerate computes its cache key
// (cache stays tenant-partitioned). Non-Academy models short-circuit immediately
// — no tenant lookup, no behaviour change for booking/CRM/etc. Single tenant
// today → currentTenantId() returns the default id and the injected filter
// matches every row, so the live site is unchanged. RLS is the Ring 1 backstop
// for by-id ops the hook intentionally leaves alone (see lib/tenant-scope.ts).
//
// Ring 1d (RLS) — gated on ACADEMY_RLS=1: in addition to the app-level filter,
// each Academy query sets the Postgres `app.tenant_id` GUC for its transaction, so
// the tenant_isolation policy (0002_academy_rls.sql) returns only this tenant's
// rows — the database backstop, including for the by-id ops the app filter leaves
// open. The flag stays OFF in prod until RLS is actually enabled on the tables
// (see prisma/platform-migrations/ring1/RLS_ROLLOUT.md); until then this branch is
// never taken and behaviour is byte-for-byte unchanged.
const ACADEMY_RLS = process.env.ACADEMY_RLS === '1';

const tenantExtension = {
  name: 'clinicos-tenant-scope',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }: { model: string; operation: string; args: unknown; query: (a: unknown) => Promise<unknown> }) {
        if (!isAcademyModel(model)) return query(args);
        const { currentTenantId } = await import('@/lib/tenant');
        const tenantId = await currentTenantId();
        const scoped = applyTenantScope(model, operation, args as Record<string, unknown> | undefined, tenantId);
        if (!ACADEMY_RLS) return query(scoped);
        // RLS path. The policy admits a row only when the connection has set
        // `app.tenant_id` for the current transaction, so batch [ set GUC, scoped
        // query ] into ONE transaction — both run on the same pooled connection.
        // Transaction-local (the `true` arg) is required under Accelerate/PgBouncer
        // connection multiplexing, where a session-level SET would leak a tenant id
        // into the next request. This is Prisma's documented RLS extension pattern:
        // `query(scoped)` is the terminal operation, so it neither re-enters this
        // hook nor sets the GUC twice. Invariant (verified, holds today): no Academy
        // query runs inside a caller's interactive $transaction, so this never nests.
        const [, result] = await db.$transaction([
          db.$executeRawUnsafe(`SELECT set_config('app.tenant_id', $1, true)`, tenantId),
          query(scoped) as PrismaPromise<unknown>,
        ]);
        return result;
      },
    },
  },
} as const;

// A client we can chain a second `$extends` onto without TS re-instantiating the
// (already deep) Accelerate-extended type — applying two extensions through the
// full generic signature trips TS2589 "excessively deep". The runtime object is
// unchanged; only the static type is widened for the second hop.
type Extendable = { $extends: (ext: unknown) => unknown };

function makeClient(): PrismaClient {
  const pooled = resolvePooledUrl();
  let base: Extendable;
  if (pooled) {
    // Route every runtime query through the Accelerate pooler.
    base = new PrismaClient({ accelerateUrl: pooled, log: [...log] }).$extends(withAccelerate()) as unknown as Extendable;
  } else {
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
    base = new PrismaClient({ adapter, log: [...log] }) as unknown as Extendable;
  }
  // Apply the tenant-scope hook last → outermost.
  return base.$extends(tenantExtension) as unknown as PrismaClient;
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
