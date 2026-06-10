import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

// Prisma 7 stops auto-loading .env once a config file is present, so load the
// standard Next.js env files ourselves (most-specific first; dotenv never
// overrides a var already set in the real environment, e.g. on Vercel).
for (const f of ['.env.production.local', '.env.local', '.env.production', '.env']) {
  if (fs.existsSync(f)) dotenv.config({ path: f });
}

// Prisma configuration. The `datasource.url` here is used by Prisma CLI
// commands (db push, migrate deploy, introspect) — db-sync.mjs injects
// DATABASE_URL before calling the CLI, so this resolves to the direct URL.
// Runtime connections are managed separately in lib/db.ts.
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    seed: 'node prisma/seed.mjs',
  },
});
