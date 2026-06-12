# Secrets & Integrations Audit

_Area: Secrets handling, cryptography, and third-party integrations._
_Scope: `lib/crypto.ts`, `lib/key-rotation.ts`, OAuth/integration libs, calendar/finance/SMS integrations, `next.config.mjs`, `vercel.json`, `middleware.ts`, plus a whole-repo sweep for committed secrets, `NEXT_PUBLIC_` exposure, SSRF, and token logging._
_Date: 2026-06-09 · Auditor: application-security review (read-only)._

## Summary

The cryptographic core is **strong**. `lib/crypto.ts` implements AES-256-GCM with per-record random 96-bit IVs, a versioned keyring for rotation, a separate HMAC-SHA256 binding ciphertext to record metadata (tamper-evidence across records), and timing-safe verification. Key rotation (`lib/key-rotation.ts`) is idempotent, isolates per-record failures, and never makes old data unreadable. All token/secret generation uses CSPRNGs (`crypto.randomBytes` / `randomUUID` / `getRandomValues`) — no `Math.random` is used for anything security-sensitive. **No hardcoded secrets, API keys, or private keys are committed** anywhere in source, config, scripts, seeds, or Prisma; every match was a documented placeholder (`sk_live_xxx`, etc.) in `.env.example` / `docs/`. `.env` and `*.pem` are gitignored.

Webhooks are well-built: Stripe (signature `constructEvent`), yay.com (timing-safe token compare + rate-limit on failure), and Resend / Resend-Inbound (Svix HMAC, **fail-closed in production**). OAuth state/CSRF is correctly enforced for Xero, TrueLayer, and Google-Business via the timing-safe `lib/oauth-state.ts`.

The notable gaps are: (1) the staff **Google Calendar refresh token is stored in plaintext** on `AdminUser.googleRefreshToken` (every other long-lived token — TOTP secret, `ExternalConnection.tokensEnc` — is encrypted via the keyring); (2) the **Google Calendar OAuth callback has no CSRF state nonce** (it reuses the bare `staffId` as `state`); (3) the **marketing OAuth callback** uses a non-constant-time state comparison, a single shared (non-per-provider) cookie name, and persists the **raw provider token JSON in the wrong shape**, so marketing tokens are unusable/never refreshed. None of these expose a secret to the browser.

## Severity counts

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High     | 2 |
| Medium   | 2 |
| Low      | 3 |
| Info     | 3 |
| **Total**| **10** |

**Hardcoded secret committed to the repo: NONE FOUND.**

## Findings

### [HIGH] Staff Google Calendar refresh token stored in plaintext at rest
- **Location:** `prisma/schema.prisma:857` (`googleRefreshToken String?`); written plaintext at `lib/google-calendar.ts:62`; read plaintext at `lib/google-calendar.ts:86-89`, `lib/integrations.ts:61`.
- **Issue:** Unlike `ExternalConnection.tokensEnc` (AES-256-GCM, `lib/oauth-connections.ts:11`) and `AdminUser.totpSecret` (encrypted via the keyring, `lib/security/twofa.ts:30`), the Google OAuth **refresh** token is persisted in cleartext:
  ```ts
  // lib/google-calendar.ts:62
  await db.adminUser.update({ where: { id: staffId }, data: { googleRefreshToken: data.refresh_token, googleCalendarId: 'primary' } });
  ```
  A refresh token is a long-lived credential (no expiry) granting `calendar.readonly` to the clinician's personal Google account.
- **Impact:** Any read access to the database (backup leak, SQL injection elsewhere, compromised DB credential, or an over-broad admin export) yields usable, long-lived Google tokens for every connected clinician — a lateral-movement / privacy escalation into staff Google accounts. This is exactly the threat the keyring was built to neutralise, but this column bypasses it.
- **Recommendation:** Encrypt with `encryptJson` on write and `decryptJson` on read (mirror `twofa.ts`), or migrate Google Calendar onto the existing `ExternalConnection` store so it inherits at-rest encryption + the rotation sweep. Document the field as encrypted in the schema. (Mitigating factor: the integration is currently "parked" via `GOOGLE_INTEGRATION_ENABLED=false`, `lib/google-calendar.ts:24-26`, so no tokens are written today — but the live code path stores plaintext the moment it is enabled.)

### [HIGH] Google Calendar OAuth callback has no CSRF state nonce
- **Location:** `app/api/admin/gcal/callback/route.ts:15-20`; URL minted at `lib/google-calendar.ts:31-43` (`state: staffId`); initiation `app/api/admin/gcal/connect/route.ts:18-25`.
- **Issue:** Every other OAuth callback consumes a random, cookie-bound, timing-safe state (`consumeOAuthState`, used by Xero `xero/callback/route.ts:17`, TrueLayer `truelayer/callback/route.ts:17`, Google-Business `google-business/callback/route.ts:17`). The gcal flow instead puts the bare `staffId` in `state` and only checks `sessionCan(session,'schedule.manage') || state === session?.sub` — there is no unguessable nonce and no cookie binding:
  ```ts
  const state = url.searchParams.get('state'); // staffId the token will attach to
  if (!code || !state || !(sessionCan(session, 'schedule.manage') || state === session?.sub)) { ... }
  const ok = await exchangeCodeForStaff(code, state);
  ```
- **Impact:** OAuth CSRF / login-CSRF. An attacker who can get an authenticated `schedule.manage` admin to hit a crafted callback URL (with the attacker's own Google authorization `code` and a victim `staffId`) can bind the **attacker's** Google Calendar to a staff record — corrupting availability (injecting/withholding busy blocks) for that clinician. `staffId` values are not secret (cuid, enumerable across the admin UI). The bare `staffId` doubling as both routing data and CSRF token provides no protection.
- **Recommendation:** Use `newOAuthState('gcal')` / `attachOAuthState` / `consumeOAuthState` like the other callbacks, and carry `staffId` either inside the signed state value or in a separate httpOnly cookie set at connect time. (Severity-reduced because the integration is parked and the connect route is gated to `schedule.manage`, but the missing CSRF token is a real defect.)

### [MEDIUM] Marketing OAuth callback: non-constant-time state check + shared (non-per-provider) state cookie
- **Location:** `app/api/admin/marketing/oauth/callback/route.ts:23-25`; cookie set in `app/api/admin/marketing/connect/route.ts:19-22`.
- **Issue:** State is validated with a plain string comparison rather than a timing-safe one, and a single fixed cookie name `kc_oauth_state` is shared across all four providers (Google/Meta/TikTok/Mailchimp) instead of the per-key `kc_oauth_state_<key>` scheme in `lib/oauth-state.ts`:
  ```ts
  if (jar.get('kc_oauth_state')?.value !== state) return to(`error=${providerId}_bad_state`);
  ```
- **Impact:** (a) `!==` on the state is a (minor) timing side-channel — the dedicated `lib/oauth-state.ts` helper exists precisely to avoid this and is bypassed here. (b) The shared cookie name means starting one provider's flow overwrites another's pending state, and the callback never re-checks that the returned `provider` matches the provider the state was minted for — so a state issued for provider A is accepted on a callback claiming provider B. Combined with the bare `${p.id}.${uuid}` state, provider binding is weak.
- **Recommendation:** Reuse `lib/oauth-state.ts` (per-provider cookie key = provider id, `timingSafeEqual`), and assert the state prefix matches `providerId` before exchanging the code.

### [MEDIUM] Marketing OAuth tokens persisted in the wrong shape — unencrypted-shape mismatch breaks refresh & reads
- **Location:** `app/api/admin/marketing/oauth/callback/route.ts:41-44`; consumed at `lib/ad-spend.ts:34-35,70,94`; type at `lib/oauth-connections.ts:8`.
- **Issue:** The callback stores the **raw provider JSON** (`{ access_token, refresh_token, expires_in, ... }`) directly:
  ```ts
  const tokens = await res.json();
  await saveConnection(p.id, tokens, null, p.name);
  ```
  but `Tokens` is `{ access, refresh?, expiresAt }` and every consumer reads `conn.tokens.access` (e.g. `lib/ad-spend.ts:35 const token = conn.tokens.access;`). The stored object has no `access` key, so `conn.tokens.access` is `undefined`. Marketing providers also never call `validAccessToken`, so they are never refreshed, and `expiresAt` is absent.
- **Impact:** Functional/token-handling defect: Meta/Google marketing spend calls authenticate with an `undefined` bearer (fail), and stored long-lived refresh tokens are orphaned with no refresh path. Not a confidentiality leak — `saveConnection` still `encryptJson`s the blob at rest — but it is broken token handling and means stale credentials accumulate encrypted-but-unusable. Note the unmapped `expires_in` also defeats proactive rotation.
- **Recommendation:** Map the provider response into the `Tokens` shape (`{ access: d.access_token, refresh: d.refresh_token, expiresAt: d.expires_in ? Date.now()+d.expires_in*1000 : null }`) as the Xero/TrueLayer/Google-Business libs already do, and route reads through `validAccessToken` with a per-provider refresh function.

### [LOW] `hashIp` salt falls back to a hardcoded constant, and references a different env name (`ENCRYPTION_KEY`)
- **Location:** `lib/kiosk.ts:27-31`.
- **Issue:** `const salt = process.env.KIOSK_IP_SALT || process.env.ENCRYPTION_KEY || 'k-clinics-kiosk';` — if neither env var is set, a **publicly known constant** salts the SHA-256 IP hash. It also reads `ENCRYPTION_KEY`, which is not the keyring's `HEALTH_ENCRYPTION_KEY` and appears nowhere in `.env.example`, so it is effectively always unset.
- **Impact:** With a static, source-visible salt, the IP hashes are reversible by brute force over the ~4.3B IPv4 space (a rainbow table is trivial), defeating the "we never store raw IPs" anti-abuse privacy goal. Low impact — IPs are coarse anti-abuse counters, not PII tied to identities — but it weakens the stated privacy posture.
- **Recommendation:** Require a real per-deployment secret salt (fail or warn loudly if unset in production), and use a consistent env name (e.g. `KIOSK_IP_SALT` only, derived from the keyring if desired).

### [LOW] Webhook handlers log provider error bodies (low risk of token spillage)
- **Location:** `app/api/admin/marketing/oauth/callback/route.ts:40` (`console.error('[marketing-oauth]', p.id, res.status, await res.text())`); also `[marketing-oauth] exchange failed` at line 51.
- **Issue:** On a failed token exchange the raw provider response body is logged. OAuth token endpoints normally return only error JSON on failure (no tokens), so this is unlikely to leak a secret, but logging unbounded third-party response bodies is a latent risk if a provider ever echoes request parameters (which can include the `code`).
- **Impact:** Low — failure-path only, no token in a standard OAuth error body. Worth tightening given logs may ship to third-party aggregators.
- **Recommendation:** Truncate and log only `res.status` + a short, known error field; never log full bodies from credential endpoints. (Positive: no handler logs `access_token`/`client_secret`/`Bearer` values — the repo-wide grep for token logging found none.)

### [LOW] CSP allows `'unsafe-inline'` for `script-src` (out of strict scope, but weakens secret/XSS posture)
- **Location:** `next.config.mjs:21` (`script-src 'self' 'unsafe-inline' ...`).
- **Issue:** `'unsafe-inline'` in `script-src` removes XSS defence-in-depth. Relevant here because the only client-exposed "secrets" (Stripe publishable key, Turnstile site key — both designed to be public) are fine, but an XSS via inline script could exfiltrate session cookies / CSRF the OAuth connect flows above.
- **Impact:** Low for *secret confidentiality* (no real secrets are in the bundle — verified below), but it amplifies the OAuth-CSRF findings.
- **Recommendation:** Move to nonce/hash-based CSP for inline scripts when feasible. (Noting only because it interacts with the OAuth findings; full CSP review belongs to the headers/XSS work-stream.)

### [INFO] `NEXT_PUBLIC_*` surface reviewed — no secret exposed to the browser
- **Location:** repo-wide grep (`lib/stripe-client.ts:5`, `lib/booking-mode.ts:11`, `app/api/admin/login/route.ts:40`, `next.config.mjs:64`, `components/layout/WhatsAppButton.tsx:6`, et al.).
- **Issue/Finding:** Every `NEXT_PUBLIC_` value is legitimately public: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (publishable by design), `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (site key, public), `NEXT_PUBLIC_BASE_PATH`, `NEXT_PUBLIC_WHATSAPP`, `NEXT_PUBLIC_CRM_ENABLED`. No `*_SECRET`, `STRIPE_SECRET_KEY`, `*_CLIENT_SECRET`, JWT/HMAC/encryption key, or webhook secret is ever prefixed `NEXT_PUBLIC_` or otherwise inlined into client code. `next.config.mjs env:` only exposes `NEXT_PUBLIC_BASE_PATH`.
- **Recommendation:** None — documented as a clean result.

### [INFO] No hardcoded secrets / private keys committed
- **Location:** whole-repo sweep (`.env.example`, `docs/*.md`, `scripts/*.mjs`, `prisma/seed.mjs`, `prisma/schema.prisma`).
- **Issue/Finding:** Greps for `BEGIN PRIVATE KEY`, live Stripe/AWS/Google/GitHub/SendGrid/Resend key formats, and `password|secret|apiKey|token = "<long string>"` returned only placeholders (`sk_live_xxx`, `re_xxxxxxxxxxxx`, `generate-a-long-random-string`, `change-me-now`) in `.env.example`/docs. `prisma/seed.mjs:10` requires `SEED_ADMIN_PASSWORD` from env with no default (bcrypt cost 11); WP staff migration generates random passwords (`scripts/migrate-wp/migrate-staff.mjs:60`). `.gitignore` excludes `.env`, `.env*.local`, and `*.pem`.
- **Recommendation:** None — documented as a clean result.

### [INFO] Crypto core and key rotation reviewed — sound
- **Location:** `lib/crypto.ts`, `lib/key-rotation.ts`, `lib/oauth-state.ts`, `lib/security/totp.ts`, `lib/security/twofa.ts`.
- **Issue/Finding:** AES-256-GCM with a fresh 12-byte random IV per encryption (`crypto.ts:98`); GCM auth tag set and verified on decrypt (`crypto.ts:101,120`); no ECB/CBC/static-IV/deprecated cipher. Separate HMAC-SHA256 binds ciphertext to canonicalised record metadata and is checked with `timingSafeEqual` against the whole HMAC ring (`crypto.ts:128-146`). Keyring tags each blob with an 8-char key id and decrypts by trying the tagged key first then the ring, so adding a new active key never breaks old data; rotation env contract is documented (`crypto.ts:14-27`). Dev-only deterministic fallback throws in production (`crypto.ts:50`). The rotation sweep is idempotent, batched, gated to when retired keys are present (`key-rotation.ts:83-85`), recomputes the integrity HMAC for health records (`key-rotation.ts:51-53`), and isolates per-record failures (`key-rotation.ts:44`). All randomness is CSPRNG. Minor nit (not a vuln): `crypto.ts:32` derives `keyId` from `sha256(key)[:8]` — an 8-hex-char id has a small collision chance across many rotations; on collision the wrong key is merely tried first and decrypt still falls through the ring, so correctness holds.
- **Recommendation:** None required; optionally widen the key id or persist it alongside the key for very long rotation histories.

## Integration inventory

| Integration | Secret storage | SSRF / authz notes |
|---|---|---|
| **Xero** (OAuth2) | `ExternalConnection.tokensEnc` — AES-256-GCM via keyring (`oauth-connections.ts:11`) | State CSRF enforced (`xero/callback:17`, timing-safe). Fixed hosts `login.xero.com` / `identity.xero.com` / `api.xero.com`. `validAccessToken` refresh. Connect gated to `settings.manage`. Sound. |
| **TrueLayer** (Open Banking OAuth2) | `ExternalConnection.tokensEnc` — encrypted | State CSRF enforced (`truelayer/callback:17`). Fixed hosts `auth.truelayer.com` / `api.truelayer.com`. `validAccessToken` refresh. Connect gated to `settings.manage`. Sound. |
| **Google Business Profile** (OAuth2) | `ExternalConnection.tokensEnc` — encrypted | State CSRF enforced (`google-business/callback:17`). Fixed Google hosts. Refresh preserves stored refresh token (`google-business.ts:129-133`). Sound. |
| **Google Calendar (staff)** (OAuth2) | **PLAINTEXT** `AdminUser.googleRefreshToken` (schema:857) | **No CSRF state nonce** (callback uses bare `staffId`). Fixed Google hosts. Currently parked (`GOOGLE_INTEGRATION_ENABLED`). **2 findings (HIGH).** |
| **Marketing: Google/Meta/TikTok/Mailchimp** (OAuth2) | `ExternalConnection.tokensEnc` — encrypted, but **wrong shape** (raw provider JSON) | Non-timing-safe state check + shared cookie (MEDIUM). Token shape mismatch breaks reads/refresh (MEDIUM). Auth URLs/scopes static (`marketing-connections.ts`). |
| **GitHub** (PAT) | `ExternalConnection.tokensEnc` — encrypted (`build-board.ts:738`) | Repo validated by strict `owner/name` regex (`build-board.ts:727`); URL built from fixed `api.github.com` base — no SSRF. Token cleaned of paste artefacts. Sound. |
| **Stripe** | `STRIPE_SECRET_KEY` (server env); `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (public by design) | Webhook signature verified via `constructEvent` + `STRIPE_WEBHOOK_SECRET` (`stripe/webhook:17`). No token at rest. Sound. |
| **yay.com telephony** (inbound webhook) | `YAY_WEBHOOK_SECRET` (server env) | Token accepted from query/header/body, **timing-safe** compared (`yay/route.ts:16-18,38`), rate-limited on failure. Sound. |
| **Resend (email + inbound)** | `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `RESEND_INBOUND_SECRET` (server env) | Svix HMAC-SHA256 verification, **fail-closed in production** (`webhooks/resend:26-30`, `webhooks/chat-inbound:42-46`). Sound. |
| **Twilio SMS** | `TWILIO_AUTH_TOKEN` (server env) | Basic-auth to fixed `api.twilio.com`; 8s timeout. Dummy mode logs only truncated body, no creds (`sms.ts:15`). Sound. |
| **Hostinger CalDAV** | `HOSTINGER_CALDAV_PASS` (server env, Basic auth header) | URL is **operator-supplied env**, not tenant/user input (`hostinger-calendar.ts:14-20`) — not an SSRF vector. Sound. |
| **IndexNow** | `INDEXNOW_KEY` (server env) | Fixed host `api.indexnow.org`; URLs derived from `site.url`, not user input (`indexnow.ts:14-23`). Sound. |
| **DeepL / Google Translate / Places / Google Ads** | server env keys (`DEEPL_API_KEY`, `GOOGLE_TRANSLATE_KEY`, `GOOGLE_PLACES_API_KEY`, `GOOGLE_ADS_DEVELOPER_TOKEN`) | Fixed API hosts, keys server-side only (`reviews-aggregate.ts:74`, `ad-spend.ts`). Sound. |
| **Vercel Blob / Upstash Redis** | `BLOB_READ_WRITE_TOKEN`, `UPSTASH_REDIS_REST_TOKEN` (server env) | Managed-service tokens, server-side only. Sound. |
| **Admin/Client sessions, Cron, Health encryption** | `ADMIN_JWT_SECRET`, `CLIENT_JWT_SECRET`, `CRON_SECRET`, `HEALTH_ENCRYPTION_KEY(S)`, `HEALTH_HMAC_KEY(S)` (server env) | Keyring-backed at-rest encryption (`crypto.ts`); TOTP secret encrypted, recovery codes/PIN bcrypt-hashed. Sound. |

## Files reviewed

- `lib/crypto.ts`
- `lib/key-rotation.ts`
- `lib/integrations.ts`
- `lib/marketing-connections.ts`
- `lib/oauth-connections.ts`
- `lib/oauth-state.ts`
- `lib/google-calendar.ts`
- `lib/google-business.ts`
- `lib/hostinger-calendar.ts`
- `lib/truelayer.ts`
- `lib/xero.ts`
- `lib/indexnow.ts`
- `lib/sms.ts`
- `lib/kiosk.ts`
- `lib/qr.ts`
- `lib/ad-spend.ts`
- `lib/reviews-aggregate.ts`
- `lib/build-board.ts` (GitHub connector / token storage)
- `lib/security/twofa.ts`, `lib/security/totp.ts` (token-at-rest comparison)
- `app/api/admin/marketing/connect/route.ts`
- `app/api/admin/marketing/oauth/callback/route.ts`
- `app/api/admin/integrations/xero/connect/route.ts`, `.../xero/callback/route.ts`
- `app/api/admin/integrations/truelayer/callback/route.ts`
- `app/api/admin/integrations/google-business/callback/route.ts`
- `app/api/admin/gcal/connect/route.ts`, `.../gcal/callback/route.ts`
- `app/api/integrations/yay/route.ts`
- `app/api/stripe/webhook/route.ts`
- `app/api/webhooks/resend/route.ts`
- `app/api/webhooks/chat-inbound/route.ts`
- `app/api/account/forgot-password/route.ts` (log-spillage check)
- `next.config.mjs`, `vercel.json`, `middleware.ts`
- `prisma/schema.prisma` (`AdminUser`, `ExternalConnection`), `prisma/seed.mjs`
- `.env.example`, `.gitignore`
- Whole-repo greps: `process.env`, `NEXT_PUBLIC_`, `apiKey`/`secret`/`token`/`password`/`Bearer`, `BEGIN PRIVATE KEY`, live key formats (Stripe/AWS/Google/GitHub/SendGrid/Resend), `Math.random`, CSPRNG usage, `console.*` token logging, user-supplied-URL `fetch` (SSRF).

---

## Addendum — API-connections review & live health monitoring (2026-06-12, BLD-278)

_Scope: every outbound API integration (versions, auth, token lifecycle, timeouts) plus a live probe of all 192 `app/api/**` routes on production._

### Endpoint sweep (production)

GET-probed all 192 routes on https://kclinics.co.uk with dummy params: **zero 5xx**. Distribution: 140×405 (POST-only), 19×403 + 9×401 (auth-gated), 7×404 (dummy IDs), 5×307 (OAuth redirects), 2×400, 10×200. The unauthenticated 200s (`/api/admin/badges`, `/api/admin/notifications`, `/api/admin/whoami`, `/api/account/me`) return empty/boolean payloads only — no data exposure.

### Broken connections found & FIXED (this review)

| Severity | Finding | Fix |
|---|---|---|
| HIGH | **Meta Graph API pinned to v19.0 — sunset 21 May 2026.** Ad-spend sync (`lib/ad-spend.ts`), Conversions API (`lib/conversions.ts`) and the Meta OAuth dialog/token URLs (`lib/marketing-connections.ts`) were all calling a retired version; every failure is swallowed to `[]`, so it broke silently. | Bumped to v23.0 (sunset ~May 2027), centralised as `META_GRAPH_VERSION` in `lib/ad-spend.ts`. |
| HIGH | **Google Ads API pinned to v17 — sunset 4 Jun 2025** (verified live: v17–v19 now 404). Spend sync dead for a year, silently. | Bumped to v22 (`GOOGLE_ADS_API_VERSION`). |
| HIGH | **Google Ads calls never refreshed the OAuth access token** (1-hour lifetime, used raw) — sync failed after the first hour even on a live API version. | Added `refreshGoogleTokens()` + `validAccessToken()` wiring in `lib/ad-spend.ts`. |
| HIGH | **Marketing OAuth callback persisted the raw provider token JSON** (`{access_token,…}`, TikTok's nested under `data`) while every consumer reads `tokens.access` — so Meta/Google/TikTok connections never produced a usable token (also flagged in the 2026-06-09 findings above — now resolved). | Callback normalises to `{access, refresh, expiresAt}`; `lib/oauth-connections.ts getConnection()` tolerantly maps legacy raw rows so existing connections work without reconnecting. |
| LOW | Missing fetch timeouts: CalDAV PUT/DELETE (`lib/hostinger-calendar.ts`), IndexNow submit, GitHub mirror POST/PATCH (`lib/build-board.ts`), GA4 + Meta conversion sends. | `AbortSignal.timeout(8–10s)` added to all. |

### Verified healthy (no action)

Stripe (SDK pinned `2026-05-27.dahlia`, 20s timeout + 3 retries, webhook signature on raw body), Resend (SDK v6), Twilio (stable 2010-04-01 API), Anthropic (current model IDs `claude-haiku-4-5-20251001` / `claude-sonnet-4-6`), Xero/TrueLayer (10s timeouts, encrypted tokens, 60s-early refresh), Google Business Profile (v4 reviews API still live), DeepL/Google Translate, yay.com webhook (timing-safe compare), HIBP, Open-Meteo, IndexNow key. TikTok Business API v1.3 remains current.

### Logged as follow-ups (open)

- **BLD-279** — Resend/chat-inbound webhooks fail open outside production (unsigned payloads processed in dev/preview).
- **BLD-280** — Mailchimp connection is a stub (empty scopes, no API usage) — implement or hide.
- **BLD-281** — `sendEmail()` has no explicit timeout on the Resend SDK call.

### New standing control — /admin/api-health (BLD-278)

`lib/api-health.ts` + `/admin/api-health` (perm `platform.status`): a traffic-light page where **every light is a real, read-only API call** made server-side at view time — Stripe balance, Resend domain list, Anthropic models, Twilio account, DeepL usage, Xero/TrueLayer OAuth-refresh + read, Meta/TikTok stored-token checks, Google Ads refresh grant, GA4 `/debug/mp/collect` (validates without recording), CalDAV OPTIONS, Upstash `PING`, Vercel Blob list, GitHub repo read, cron heartbeats, public `/api/health`, IndexNow key match, HIBP, Open-Meteo. A retired API version or revoked key now turns a light red within one page view instead of failing silently; `GET /api/admin/api-health` also accepts the `CRON_SECRET` bearer for external uptime monitors. Reports persist to `Setting('api_health_last')` with per-check "light held since" tracking.
