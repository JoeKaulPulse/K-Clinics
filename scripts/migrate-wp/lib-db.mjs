// Prisma client construction for the importers — Prisma 7 removed the bare
// `new PrismaClient()` path (the WASM client engine REQUIRES a driver
// `adapter`), so this mirrors lib/db.ts: a direct pg connection via the
// PrismaPg adapter. Works both in-process inside the deployed app (bundled)
// and standalone on a laptop (node_modules).

export async function openDb() {
  const { PrismaClient } = await import('@prisma/client');

  const direct = [
    process.env.POSTGRES_PRISMA_URL, // pooled, postgres:// (PgBouncer)
    process.env.POSTGRES_URL,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.DATABASE_URL,
  ].filter(Boolean).find((u) => /^postgres(ql)?:\/\//.test(u));
  if (!direct) throw new Error('No database URL configured (DATABASE_URL / POSTGRES_URL).');
  const { Pool } = await import('pg');
  const { PrismaPg } = await import('@prisma/adapter-pg');
  // The import runs queries sequentially — one connection is enough and stays
  // well clear of the managed Postgres connection cap.
  const pool = new Pool({ connectionString: direct, max: 1, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 15_000 });
  return new PrismaClient({ adapter: new PrismaPg(pool), log: ['error'] });
}
