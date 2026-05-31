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
