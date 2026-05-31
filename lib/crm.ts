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
