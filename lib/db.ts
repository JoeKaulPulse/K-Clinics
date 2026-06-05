import { PrismaClient } from '@prisma/client';

// Resolve a usable direct postgres:// connection at runtime. Vercel's Postgres
// integration may set DATABASE_URL to a Prisma Accelerate URL
// (prisma+postgres://) which the standard client can't use directly — so we
// prefer a real postgres:// URL from the other vars the integration provides.
function resolveDbUrl(): string | undefined {
  const candidates = [
    process.env.POSTGRES_PRISMA_URL,       // pooled, postgres:// (ideal for serverless)
    process.env.POSTGRES_URL,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.DATABASE_URL,
  ].filter(Boolean) as string[];
  return candidates.find((u) => /^postgres(ql)?:\/\//.test(u)) ?? process.env.DATABASE_URL;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const url = resolveDbUrl();

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(url ? { datasources: { db: { url } } } : {}),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

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
