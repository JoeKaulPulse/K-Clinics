// Is the CRM (DB + email + admin + client portal) available?
//
// On the static GitHub Pages demo there is no server or database, so this is
// false and forms fall back to a friendly preview. On a real server (Vercel)
// the CRM is enabled whenever a database is connected — we infer this from
// DATABASE_URL so it "just works" once Postgres is attached, without depending
// on a separate flag being set perfectly (and NEXT_PUBLIC_* flags are inlined at
// build time, so a late-added flag wouldn't take effect without a rebuild).
//
// `DATABASE_URL` is server-only (never inlined into client bundles), so on the
// client this safely falls back to the public flag.
export const crmEnabled =
  process.env.NEXT_PUBLIC_CRM_ENABLED === 'true' ||
  process.env.CRM_ENABLED === 'true' ||
  Boolean(process.env.DATABASE_URL);

// True whenever a real Postgres is attached (any of the supported URL vars),
// regardless of NODE_ENV. Used to fail closed on unsigned webhooks on EVERY
// environment that can write to a database — including Vercel previews — not
// just production (BLD-279).
export const hasDatabase = Boolean(
  process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.PRISMA_DATABASE_URL ||
    process.env.DATABASE_URL_UNPOOLED,
);
