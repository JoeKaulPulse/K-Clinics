import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import type { PrismaConfig } from 'prisma';

// Prisma 6 stops auto-loading .env once a config file is present, so load the
// standard Next.js env files ourselves (most-specific first; dotenv never
// overrides a var already set in the real environment, e.g. on Vercel).
for (const f of ['.env.production.local', '.env.local', '.env.production', '.env']) {
  if (fs.existsSync(f)) dotenv.config({ path: f });
}

// Prisma configuration (replaces the deprecated `package.json#prisma` block).
// Seeding is run manually via `npm run db:seed`; deploys use `prisma db push`
// through scripts/db-sync.mjs.
export default {
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    seed: 'node prisma/seed.mjs',
  },
} satisfies PrismaConfig;
