import path from 'node:path';
import type { PrismaConfig } from 'prisma';

// Prisma configuration (replaces the deprecated `package.json#prisma` block).
// Seeding is run manually via `npm run db:seed`; deploys use `prisma db push`
// through scripts/db-sync.mjs.
export default {
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    seed: 'node prisma/seed.mjs',
  },
} satisfies PrismaConfig;
