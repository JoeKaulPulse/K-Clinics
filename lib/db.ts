import { PrismaClient } from '@prisma/client';
import type { PrismaPromise } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import { isAcademyModel, applyTenantScope } from '@/lib/tenant-scope';

// ── Database client ──────────────────────────────────────────────────────────
// Every serverless instance opening its own direct Postgres connection is what
// was exhausting the underlying Postgres's low connection cap (booking/admin
// pages erroring under traffic + deploys at the same time). Production avoids
// that by pointing DATABASE_URL/POSTGRES_PRISMA_URL at Neon's pooled endpoint
// (`…-pooler.…neon.tech`), so the whole serverless fleet shares a small managed
// pool of real connections instead of each instance opening its own.
//
// Prisma 7 removed `datasources` from the PrismaClient constructor and also
// dropped the old binary/library engine — the only engine is now the WASM
// "client" engine, which requires an `adapter`. This uses the pg driver
// adapter (`@prisma/adapter-pg`), whose Pool is lazy (connects on first query,
// not at construction time) so builds without a DATABASE_URL still succeed.
//
// Migrations are deliberately the *other* way round — scripts/db-sync.mjs always
// uses a direct postgres:// URL — so schema syncs never compete with live
// traffic for the pooled connections.

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
// OUTERMOST extension so it rewrites args before any other extension sees
// them. Non-Academy models short-circuit immediately — no tenant lookup, no
// behaviour change for booking/CRM/etc. Single tenant
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
        // Transaction-local (the `true` arg) is required under PgBouncer
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

// A client we can chain `$extends` onto without TS re-instantiating the full
// generic PrismaClient signature, which can trip TS2589 "excessively deep".
// The runtime object is unchanged; only the static type is widened.
type Extendable = { $extends: (ext: unknown) => unknown };

// BLD-1269: with no pooled URL configured we fall through to the direct-
// connection branch below — the "every serverless instance opens its own
// Postgres connection" shape that previously exhausted the connection cap
// under concurrent traffic + deploys (see comment above). Surface that in the
// logs at boot so a genuine misconfiguration is diagnosable.
//
// Deliberately a loud log line and NOT a throw. This module is imported at
// module scope by effectively every route, page and cron, so a throw here is
// an immediate site-wide 500 rather than a degraded-capacity warning — the
// same trade-off instrumentation.ts already makes for weak signing secrets
// ("not a throw: an outage would be worse than the warning"). Escalating a
// capacity risk into a total outage is the wrong direction.
//
// It also would have been a false alarm on the live configuration: today's
// deployment has no PRISMA_DATABASE_URL/ACCELERATE_URL and reaches Neon
// through its PgBouncer endpoint (`…-pooler.…neon.tech`, via
// POSTGRES_PRISMA_URL/DATABASE_URL) with a per-instance cap of max:1 below.
// That IS pooled — just at the database rather than by Prisma Accelerate — so
// it is not warned about here. Only a genuinely direct, unpooled endpoint is.
//
// The Next.js build phase is excluded (`next build` sets NODE_ENV=production
// and, on Vercel, VERCEL=1, but is not serving traffic) to keep build logs
// clean; this repo's CI/sandbox builds run with no database URL at all.
function warnIfUnpooledInProduction(pooled: string | undefined): void {
  if (pooled) return;
  if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) return;
  if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') return;
  const direct = resolveDirectUrl();
  // Neon's pooled endpoint, or any PgBouncer-style URL, is already pooled.
  if (direct && (/-pooler\./i.test(direct) || /[?&]pgbouncer=true/i.test(direct))) return;
  console.error(
    '[db] No pooled database URL configured (PRISMA_DATABASE_URL / ACCELERATE_URL / a prisma+postgres:// URL), ' +
    'and the direct URL in use is not a recognised pooler endpoint. Every serverless instance will open its own ' +
    'Postgres connection, which previously exhausted the connection cap under concurrent traffic + deploys — ' +
    'point the runtime at a pooled endpoint (BLD-1269).',
  );
}

function makeClient(): PrismaClient {
  // No pooled (Accelerate-style) URL is ever configured in this codebase
  // anymore — see warnIfUnpooledInProduction's own comment for why the direct
  // URL below (Neon's `-pooler` endpoint) already counts as pooled.
  warnIfUnpooledInProduction(undefined);
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
    // BLD-1642: with max:1 per serverless instance, one genuinely stuck query
    // (a lock wait, a runaway scan) would hold that instance's only connection
    // forever — every subsequent request on it queues behind a query that will
    // never finish. statement_timeout aborts it server-side; query_timeout is
    // the client-side backstop if the server itself is unresponsive.
    ...(onServerless ? { max: 1, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 15_000, statement_timeout: 25_000, query_timeout: 30_000 } : {}),
  });
  const adapter = new PrismaPg(pool);
  const base = new PrismaClient({ adapter, log: [...log] }) as unknown as Extendable;
  // Apply the tenant-scope hook last → outermost.
  return base.$extends(tenantExtension) as unknown as PrismaClient;
}

// The tenant-extended client is a structural superset of PrismaClient for
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
