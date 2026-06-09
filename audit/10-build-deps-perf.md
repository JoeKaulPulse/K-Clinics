# Build / Deps / Perf / Serverless Audit

_Auditor area: build pipeline, dependencies, configuration, performance, serverless correctness._
_Repo: `/home/user/K-Clinics` — Next.js 15 App Router on Vercel + Prisma + TypeScript._
_Date: 2026-06-09. Read-only audit; no source modified._

## Summary

The build/deploy posture is **substantially better than the brief implied**. The two scariest items called out in the scope have already been hardened in code: the destructive `--accept-data-loss` flag has been removed from the build-time schema push, and the reference-data seeds **no longer run on every deploy** (they are gated behind `SEED_ON_BUILD=true`). Security headers are strong and comprehensive (full CSP, HSTS preload, COOP/CORP, Permissions-Policy). TypeScript/ESLint errors are **not** suppressed during builds, a typecheck CI gate exists, the Prisma client is a well-engineered serverless singleton routed through the Accelerate pooler, `after()` is used correctly for background work, and cron functions are auth-gated with explicit `maxDuration`.

The remaining real risks are concentrated in one place: **the production build still runs a live schema sync (`prisma db push`) against the production database during `prebuild`, and fails the build if the DB is unreachable**. That couples deploy success to DB liveness and lets the build mutate production schema. This is the top finding. Everything else is medium/low: 4 moderate npm-audit vulns (all rooted in a single `postcss` advisory bundled inside `next`), a latent `sleep`-before-definition bug in the migrations branch of `db-sync.mjs`, broad use of `force-dynamic` on some public marketing pages, and `dangerouslyAllowSVG` (mitigated by a sandboxing image CSP).

## Severity counts

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High     | 1 |
| Medium   | 4 |
| Low      | 4 |
| Info     | 3 |
| **Total**| **12** |

## Findings

### [HIGH] Build-time schema sync mutates the production DB and couples deploy success to DB liveness
- **Location**: `package.json:11` (`prebuild`) → `scripts/db-sync.mjs:130-155` (the `prisma db push` loop) and `:77-78` / `:151-155` (fatal exit).
- **Issue**: `prebuild` runs `node scripts/db-sync.mjs`, which — in the default mode (`USE_MIGRATIONS` unset) — runs `npx prisma db push` against the live production Postgres at **build time** on every Vercel deploy. If the live schema differs from `prisma/schema.prisma`, the build pushes the change into production. If the database is unreachable after retries, the script calls `process.exit(1)` and **fails the entire build/deploy** (`db-sync.mjs:151-155`).
- **Impact**: (1) Deploys can fail purely because the DB is briefly suspended/over connection-cap, even for code-only changes — availability of *deploys* now depends on availability of the *DB*. (2) Schema mutations happen during the build window rather than as a reviewed migration step, so an unintended `schema.prisma` edit ships to prod schema automatically. (3) Build needs a privileged direct `postgres://` connection string present in the build environment (secret exposure surface during build). Mitigants already in place: `--accept-data-loss` is intentionally omitted (destructive changes fail rather than silently drop data — see `db-sync.mjs:133-137`), there is a fast no-op pre-check via `migrate diff` (`:94-118`), generous connection-pressure backoff, and the safer `USE_MIGRATIONS=true` path (`migrate deploy`, `:59-79`) is implemented and documented. So the danger is "build mutates prod schema + build fails if DB down", **not** silent data loss.
- **Recommendation**: Move schema changes out of `prebuild`. Either (a) flip to the already-built safe path by setting `USE_MIGRATIONS=true` and committing a baseline migration (the script and `db-sync.mjs:23-29` document exactly how), and run `prisma migrate deploy` as a **separate deploy step / release command** rather than inside the asset build; or (b) at minimum, decouple it so a DB outage degrades to "deploy new code, schema unchanged" instead of a hard build failure. Builds should not require a write-capable production DB credential.
  ```js
  // package.json:11
  "prebuild": "node scripts/check-backlog-quotes.mjs && node scripts/gen-image-manifest.mjs && node scripts/db-sync.mjs && node scripts/run-seeds.mjs",
  // db-sync.mjs:151-155
  console.error('[db-sync] FATAL: could not sync the schema after retries. Failing the build ...');
  process.exit(1);
  ```

### [MEDIUM] Four moderate npm-audit vulnerabilities (all from one `postcss` XSS advisory bundled in `next`)
- **Location**: `package.json` deps `next` (`:42`), `@vercel/speed-insights` (`:25`), `geist` (`:30`); transitive `postcss` at `node_modules/next/node_modules/postcss`.
- **Issue**: `npm audit --json` reports 4 moderate, 0 high, 0 critical. The single root cause is **`postcss <8.5.10` — GHSA-qx2v-qp2m-jg93, "XSS via unescaped `</style>` in CSS stringify output" (CWE-79, CVSS 6.1)** — vendored *inside* the installed `next` package. That makes `next` flagged, which cascades to its peers `@vercel/speed-insights` and `geist`. The top-level `postcss` devDependency (`package.json:74`, `^8.5.15`) is already patched; only Next's bundled copy is stale.
- **Impact**: The advisory only bites if attacker-controlled CSS is run through PostCSS stringify and emitted into a page — not a typical exploit path for this app's build-time CSS. Low practical risk, but it keeps `npm audit` red and the only offered fix is a **semver-major** Next bump (to a 16.x preview), which `audit fix --force` would apply destructively.
- **Recommendation**: Do **not** run `npm audit fix --force` (it would jump Next to a 16 preview). Instead wait for / pin a patched Next 15.x that bundles `postcss >=8.5.10`, or add an `overrides` entry to force the nested `postcss` to a patched version, then re-run `npm audit` to confirm all four clear. Track but accept as low practical risk in the interim.

### [MEDIUM] `db-sync.mjs` migrations path references `sleep()` before it is defined (latent ReferenceError on retry)
- **Location**: `scripts/db-sync.mjs:74` uses `sleep(wait)`, but `sleep` is declared at `scripts/db-sync.mjs:82` (`const sleep = (s) => …`).
- **Issue**: In the `USE_MIGRATIONS=true` branch (lines 59-79), the retry path calls `sleep(wait)` at line 74. Because `sleep` is a `const` declared later at line 82, it is in the temporal dead zone within that branch — calling it throws `ReferenceError: Cannot access 'sleep' before initialization`. The happy path (first `migrate deploy` succeeds) never hits it, which is why it has gone unnoticed, but the **first transient failure** under the recommended safe migration mode would crash the retry logic instead of backing off.
- **Impact**: The migration retry/backoff — the exact resilience this script exists to provide — is broken in the mode the file itself recommends for production. A momentary connection blip would surface as an uncaught error rather than a retry.
- **Recommendation**: Hoist the `sleep` definition (and the `env` const) above the `USE_MIGRATIONS` block so both branches share it. One-line move; no behavior change to the happy path.
  ```js
  // db-sync.mjs:74 (inside USE_MIGRATIONS branch)
  if (attempt < ATTEMPTS) { ... sleep(wait); }   // sleep used here
  // db-sync.mjs:82 (defined only AFTER the branch)
  const sleep = (s) => { try { execSync(`sleep ${s}`); } catch { } };
  ```

### [MEDIUM] `force-dynamic` applied to public marketing pages that could be cached/ISR
- **Location**: e.g. `app/(marketing)/journal/page.tsx:1`, `app/(marketing)/journal/[slug]/page.tsx`, `app/(marketing)/treatment-finder/page.tsx`, `app/(marketing)/refer-a-friend/page.tsx`, `app/(marketing)/shop/page.tsx:10`, `app/(marketing)/shop/[slug]/page.tsx:10`, `app/(marketing)/academy/page.tsx:18`. (162 files export `force-dynamic` overall; the vast majority — `/admin`, `/account`, `/api`, token routes — are correct.)
- **Issue**: Several **public, largely-static marketing pages** opt into `export const dynamic = 'force-dynamic'`, forcing a server render (and usually a DB hit) on every visit with no caching. The CMS data behind some of these is already wrapped in `unstable_cache` with sensible TTLs (`lib/pages.ts:28` revalidate 300, `lib/site-config.ts:89` revalidate 3600, `lib/treatment-content.ts:48`), so the page-level `force-dynamic` partly negates that caching layer for anonymous traffic.
- **Impact**: Higher serverless invocation count, more Prisma/Accelerate load, slower TTFB and worse Core Web Vitals on marketing pages that rarely change — the opposite of what a premium-brand marketing site wants. Not a correctness bug; a cost/latency one.
- **Recommendation**: For genuinely public pages with no per-request personalization, prefer `export const revalidate = <seconds>` (ISR) — as already done well on `app/(marketing)/pricing/page.tsx:17` and `app/sitemap.ts:9` — instead of `force-dynamic`. Audit each marketing `force-dynamic` and keep it only where the page truly reads per-request cookies (e.g. the personalization segment) or live availability/finance.

### [MEDIUM] `dangerouslyAllowSVG` enabled for `next/image`
- **Location**: `next.config.mjs:70-72`.
- **Issue**: `images.dangerouslyAllowSVG: true` allows SVGs to pass through the image pipeline (used for brand logo/icons). SVGs can carry embedded scripts.
- **Impact**: If an SVG from an untrusted source were ever served via `next/image`, it could execute script in the image context. The risk is **well mitigated here**: a dedicated image CSP is set (`contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;"`, `next.config.mjs:72`) and `contentDispositionType: 'inline'`, which neutralizes scripting for served images. Residual risk only if images ever come from user/remote SVG uploads.
- **Recommendation**: Keep the sandboxing image CSP (good). Ensure SVGs rendered through `next/image` are only first-party/static assets, never user-uploaded; if user SVG uploads exist elsewhere, serve them as downloads or rasterize them, not via this allow-SVG path.

### [LOW] Almost all dependencies use caret ranges; only `react`/`react-dom` are pinned
- **Location**: `package.json:20-73` (36 caret ranges); pinned exact: `react` `19.0.0` (`:47`), `react-dom` `19.0.0` (`:48`).
- **Issue**: Production deps like `next ^15.5.19`, `stripe ^17.5.0`, `@prisma/client ^6.3.1`, `jose ^5.9.6`, `zod ^3.24.1` use `^`. A fresh `npm install` (without a lockfile) could float to newer minors.
- **Impact**: Low in practice — a committed `package-lock.json` exists and CI uses `npm ci` (`.github/workflows/typecheck.yml`, `deploy.yml`), so builds are reproducible. Risk is mostly that ad-hoc `npm install` could change the tree.
- **Recommendation**: Keep relying on `npm ci` + the committed lockfile (already the case). Optionally pin security-sensitive packages (`next`, `stripe`, `jose`, `@prisma/client`) to exact versions and bump deliberately via Dependabot/Renovate.

### [LOW] `healthcheck.mjs` passes the cron secret as a URL query parameter
- **Location**: `scripts/healthcheck.mjs:44` — `?secret=${encodeURIComponent(secret)}` in addition to the `Authorization: Bearer` header.
- **Issue**: Secrets in URLs land in access logs, proxies, and browser/CDN history. It also sends the secret in the `authorization` header (good), so the query param is redundant.
- **Impact**: Minor secret-leakage surface, and only for an operator-run post-deploy health tool (not in the request/build path). Server side likely accepts either form for convenience.
- **Recommendation**: Send the secret only via the `Authorization` header; drop the `?secret=` query parameter.

### [LOW] Edge middleware performs a network `fetch` to an internal API on (cache-miss) public requests
- **Location**: `middleware.ts:20-27` (`loadRedirects` → `fetch(`${origin}/api/redirects`)`), invoked from `matchRedirect` (`:28-39`) on every non-app public request.
- **Issue**: Middleware runs on the Edge for every matched request and, on a cold/expired cache, makes an HTTP round-trip to `/api/redirects` (which itself hits the DB). On a warm instance it is cached in module memory for 60s (`:21`), and the route is itself cached `s-maxage=60` (`app/api/redirects/route.ts:15`).
- **Impact**: Adds a one-per-minute-per-edge-instance subrequest and DB query; worst case (many cold edge instances) is a brief stampede on `/api/redirects`. Generally well-amortized and failure-tolerant (`catch` keeps stale cache, `:25`). API-area paths are correctly excluded (`:31`) so it never recurses.
- **Recommendation**: Acceptable as-is. If redirect volume is low, consider shipping the redirect map at build time or via an Edge Config/KV read to avoid the per-instance subrequest entirely.

### [LOW] `Permissions-Policy` allows `camera=(self)` and `payment=(self)` site-wide
- **Location**: `next.config.mjs:34`.
- **Issue**: `camera=(self)` is granted to the whole origin (needed for the kiosk photo capture), and `payment=(self)` for Stripe. Microphone and geolocation are correctly disabled (`()`).
- **Impact**: Minimal — these are the app's own features. Worth noting only because camera is enabled origin-wide rather than scoped to the kiosk route.
- **Recommendation**: Fine to keep. If tighter scoping is desired, the kiosk camera permission could be narrowed via a route-specific header, but origin-level `self` is reasonable.

### [INFO] Build pipeline is otherwise correctly hardened — no `ignoreBuildErrors` / `ignoreDuringBuilds`
- **Location**: `next.config.mjs` (no `typescript.ignoreBuildErrors`, no `eslint.ignoreDuringBuilds`); `.github/workflows/typecheck.yml` runs `prisma generate` + `tsc --noEmit` on every PR and `main`.
- **Issue / Impact**: Positive finding. TS and ESLint errors will fail the build (the only matches for these flags are inside `node_modules/next/...`, i.e. the schema defaults). A pre-build guard (`scripts/check-backlog-quotes.mjs`) and a CI typecheck gate catch syntax errors before deploy. No action needed.

### [INFO] Reference-data seeds are no longer run on every deploy (gated behind `SEED_ON_BUILD`)
- **Location**: `scripts/run-seeds.mjs:10-13` — exits immediately unless `SEED_ON_BUILD === 'true'`.
- **Issue / Impact**: Positive finding that directly addresses a brief concern. Although `run-seeds.mjs` is in `prebuild` (`package.json:11`), it is a no-op by default, so deploys do **not** re-run rooms/services/catalogue/academy/LMS seeds against production (avoiding both data overwrite and the connection-pressure that previously crashed deploys). Seeds are idempotent top-ups and run deliberately. No action needed; just be aware that setting `SEED_ON_BUILD=true` for a deploy will execute them at build time.

### [INFO] Prisma client, `after()` background work, cron `maxDuration`, and serverless connection caps are correct
- **Location**: `lib/db.ts` (singleton + Accelerate pooler + serverless `connection_limit=1`, `:51-85`); `app/api/kiosk/sessions/[token]/photo/route.ts:1,76` and `app/qr/[code]/route.ts:2,26` (`after()` from `next/server`); `vercel.json:18-23` (`maxDuration` 300/60); cron routes auth-gated (`app/api/cron/daily/route.ts:10-17`, `maxDuration = 300` at `:6`).
- **Issue / Impact**: Positive findings. (1) The DB client is a global singleton, prefers the pooled `prisma+postgres://` Accelerate URL, and forces a tiny per-instance pool with short timeouts on raw `postgres://` to avoid exhausting the DB cap under horizontal scaling. (2) Fire-and-forget background work was migrated to `after(() => …)`, which keeps the function alive until completion (e.g. kiosk analysis). (3) Long crons/exports declare `maxDuration`. (4) Cron endpoints require a `CRON_SECRET` bearer token and refuse to run unprotected. Edge middleware imports only edge-safe helpers (`lib/auth-edge.ts` uses `jose`, no `bcryptjs`/Node APIs), so there is no Edge↔Node runtime mismatch. No action needed.

## Dependency vulnerabilities

`npm audit --json` (read-only): **4 moderate, 0 high, 0 critical** across 563 deps. All four trace to one advisory in `postcss` bundled inside `next`.

| Package | Severity | Direct? | Advisory | Fix offered |
|---------|----------|---------|----------|-------------|
| `postcss` (nested in `next`) | moderate | no | **GHSA-qx2v-qp2m-jg93** — XSS via unescaped `</style>` in CSS stringify output (CWE-79, CVSS 6.1); affects `<8.5.10` | patched in `next` upgrade |
| `next` | moderate | yes | flagged via its bundled `postcss`; effects cascade to `@vercel/speed-insights`, `geist` | `next@16.3.0-preview.0` (**semver-major** — do not auto-apply) |
| `@vercel/speed-insights` | moderate | yes | flagged via `next` peer | downgrade `1.0.4` (semver-major) |
| `geist` | moderate | yes | flagged via `next` peer | downgrade `1.0.0` (semver-major) |

Note: every offered "fix" is semver-major (Next 16 preview, or downgrading the two peers). **Do not run `npm audit fix --force`.** Prefer pinning a patched Next 15.x or an `overrides` entry forcing nested `postcss >=8.5.10`. The top-level `postcss` devDependency (`^8.5.15`) is already safe.

## Security headers checklist

Source: `next.config.mjs:12-40` (applied to `/(.*)` on the hosted/Vercel build via `headers()`; **not** applied on the GitHub Pages static export, which has no server — acceptable since Pages is a manual demo only).

| Header | Present | Notes |
|--------|---------|-------|
| Content-Security-Policy | ✅ | Full allowlist for Stripe/Turnstile/YouTube/Maps/Fonts/Vercel Blob (`:12-26`). Uses `'unsafe-inline'` for script-src and style-src (`:20-21`) — a known weakening; nonces/hashes would be stronger. Can be disabled via `CSP_DISABLED=true` (escape hatch, `:29`). |
| Strict-Transport-Security | ✅ | `max-age=63072000; includeSubDomains; preload` (`:30`). |
| X-Content-Type-Options | ✅ | `nosniff` (`:31`). |
| X-Frame-Options | ✅ | `DENY` (`:32`), plus `frame-ancestors 'none'` in CSP. |
| Referrer-Policy | ✅ | `strict-origin-when-cross-origin` (`:33`). |
| Permissions-Policy | ✅ | `camera=(self), microphone=(), geolocation=(), payment=(self), interest-cohort=()` (`:34`). See LOW finding on `camera`/`payment` scope. |
| Cross-Origin-Opener-Policy | ✅ | `same-origin` (`:35`). |
| Cross-Origin-Resource-Policy | ✅ | `same-origin` (`:36`). |
| X-DNS-Prefetch-Control | ✅ | `on` (`:37`). |
| Cross-Origin-Embedder-Policy | ⚠️ Absent | Not set (would likely break Stripe/YouTube embeds if forced to `require-corp`) — acceptable omission. |
| `X-Powered-By` removed | ✅ | `poweredByHeader: false` (`:57`). |
| Open CORS (`Access-Control-Allow-Origin: *`) | ✅ None | No wildcard CORS header configured anywhere. |
| Image `remotePatterns` too permissive | ✅ N/A | No `images.remotePatterns`/`domains` defined; app serves local/unoptimized images, so no remote-loader SSRF surface. `dangerouslyAllowSVG` is set but sandboxed (see MEDIUM). |

Overall: **security headers are comprehensive and well-configured** — the only notable softening is `'unsafe-inline'` in the CSP script/style directives.

## Files reviewed

- `package.json` — scripts (`prebuild`, `postinstall`), dependency ranges, `engines`.
- `next.config.mjs` — security headers, CSP, redirects, image config, GH Pages static-export branch.
- `vercel.json` — regions, crons, function `maxDuration`.
- `tsconfig.json` — strict mode on, `skipLibCheck`, paths.
- `middleware.ts` — matcher scope, edge redirect cache + `fetch`, auth/2FA redirects, attribution/segment cookies.
- `prisma.config.ts` — env loading, schema path, seed command.
- `scripts/db-sync.mjs` — build-time schema sync (`db push` / `migrate deploy`), retry/backoff, fatal-on-failure.
- `scripts/run-seeds.mjs` — `SEED_ON_BUILD` gate.
- `scripts/safe-migrate.mjs` — local interactive migration helper (not in build path).
- `scripts/gen-image-manifest.mjs`, `scripts/check-backlog-quotes.mjs` — pure FS / lint prebuild steps.
- `scripts/healthcheck.mjs`, `scripts/visual-qa.mjs` — standalone operator tools (not in build path).
- `lib/db.ts` — Prisma singleton, Accelerate pooler, serverless connection caps, `withDbRetry`.
- `lib/auth-edge.ts`, `lib/attribution.ts`, `lib/personalize.ts` — edge-safe middleware deps (no Node APIs).
- `lib/pages.ts`, `lib/site-config.ts`, `lib/treatment-content.ts` — `unstable_cache` usage (TTL + tags).
- `app/api/redirects/route.ts` — middleware-consumed redirect map (cached).
- `app/api/cron/daily/route.ts` — cron auth + `maxDuration`.
- `app/api/kiosk/sessions/[token]/photo/route.ts`, `app/qr/[code]/route.ts` — `after()` background work.
- `.github/workflows/typecheck.yml`, `deploy.yml` — CI typecheck gate; GH Pages static-export build.
- Repo-wide greps: `revalidate` / `dynamic` / `runtime` / `fetchCache` / `maxDuration` (162 `force-dynamic` files enumerated), `after(` / `unstable_cache` / `cacheStrategy` / `withAccelerate`, `ignoreBuildErrors` / `ignoreDuringBuilds`, `remotePatterns` / `domains`.
- `npm audit --json` (read-only).
