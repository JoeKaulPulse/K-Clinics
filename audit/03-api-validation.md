# API Validation & Authorization Audit

## Summary

Scope: `app/api/**` — 172 `route.ts` files (Next.js 15 App Router, Prisma, TypeScript), focusing on mutation handlers (POST/PUT/PATCH/DELETE) and routes accepting IDs/tokens/params.

**Validation-coverage stat:** only **16 of 172 routes (9.3%)** import `zod`. However, this number *understates* the true input-validation posture: the codebase has a strong, consistent manual-coercion convention — small helpers such as `str(v, n)`, `clean(s, n)`, `String(x).slice(0, n)`, `Math.max/min/round(Number(x))`, and explicit `switch (op)` dispatch — applied across the non-zod routes. Mutating routes overwhelmingly construct a **locally field-picked `data` object** before any `prisma.create/update`, so the many `{ ...data }` spreads found by grep are over already-sanitised objects, **not** raw `req.json()` bodies. I found **no true mass-assignment** (no route spreads an unvalidated request body straight into Prisma `data:`).

Authorization is similarly strong. **Important architectural note:** `middleware.ts` (line 109) matcher **excludes `/api`** (`(?!api|...)`), so middleware does *not* gate API routes — the `/admin` *page* UI is protected but the underlying `/api/admin/*` handlers are not gated by middleware. Each handler must therefore self-authorize. In practice they do: of the admin route files, **only `admin/login`, `admin/logout`, `admin/passkey-login/options`, `admin/passkey-login/verify`** lack an auth-helper reference (all are unauthenticated-by-design login/logout endpoints). Every other admin route calls `getSession()` / `requirePermission(<key>)` / `sessionCan()`. IDOR is consistently defended: token-gated public routes use unguessable cuids/manage-tokens, and client/student/staff routes pass the session id into lib functions that re-check ownership (e.g. `redeemPointsOnBooking` checks `b.clientId !== clientId`; `completeLesson` checks `studentCanAccess`; `account/assessment` re-verifies booking ownership before linking).

**Sampling approach:** Enumerated all 172 routes and categorised them (auth, payments/financial, admin CRUD, client/PII, file upload, public token-gated, webhooks, cron, tracking, AI/chat). Grepped for `req.json`, `...body`/`...data`, `prisma.*.create/update`, `findUnique({ where: { id`, the auth helpers, `enforceRateLimit`, and error-leak patterns. **Deep-read 33 representative high-risk routes** (listed under *Files reviewed*), prioritising payments, admin financial mutations, client-data writes, file uploads, exports, `[id]`/`[token]` routes, webhooks, AI/chat, and tracking. Verified ownership scoping inside the relevant `lib/*` helpers.

**Overall posture: strong.** The findings below are predominantly Low/Informational hardening items, not exploitable auth/validation holes. No Critical or High issues were identified in the sampled set.

## Severity counts

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 1 |
| Low | 4 |
| Informational | 3 |
| **Total** | **8** |

## Findings

### [MEDIUM] SVG accepted into the public media library (stored-XSS vector)

**Location:** `app/api/admin/media/route.ts:9` (`OK_MIME = /^image\/(png|jpe?g|webp|gif|avif|svg\+xml)$/i`), used at line 40; stored with `access: 'public'` at line 51.

**Issue:** The media-upload MIME allow-list permits `image/svg+xml`. SVG is an active-content format (can contain `<script>`, `onload`, `<foreignObject>`). The file is stored on Vercel Blob with public access and its URL is surfaced through the media library for embedding across the marketing site / emails. The sibling uploaders correctly exclude SVG — `admin/build/upload/route.ts:9` and `kiosk/sessions/[token]/photo/route.ts:10` use raster-only allow-lists — so this is an inconsistency, not a deliberate policy. Also note the MIME is taken from the client-supplied `file.type` and is not content-sniffed.

**Impact:** A staff member with `settings.manage` (or anyone who obtains such a session) can upload a malicious SVG. Vercel Blob serves from a separate origin (`*.public.blob.vercel-storage.com`), which mitigates *same-origin* script execution against the app; however, if any surface renders the SVG inline (`<svg>` injected into the DOM rather than `<img src>`), or if a future CSP/hosting change serves blobs same-origin, this becomes stored XSS. Requires an authenticated, fairly-privileged actor, hence Medium not High.

**Recommendation:** Drop `svg\+xml` from `OK_MIME` (match the raster-only allow-lists used by the other uploaders). If SVG support is genuinely required, sanitise server-side (e.g. DOMPurify/`svgo` strip-scripts) and/or force `Content-Disposition: attachment` and a restrictive `Content-Type`. Consider magic-byte sniffing rather than trusting `file.type`.

```ts
// app/api/admin/media/route.ts:9
const OK_MIME = /^image\/(png|jpe?g|webp|gif|avif|svg\+xml)$/i;  // ← remove svg+xml
```

### [LOW] Raw provider/exception messages returned to clients (systemic)

**Location (11 routes):**
- `app/api/shop/checkout/route.ts:77` — `error: (e as Error).message` (Stripe PaymentIntent error → unauthenticated shopper)
- `app/api/kiosk/sessions/[token]/photo/route.ts:60` — `(e as Error)?.message` (Blob error → unauthenticated visitor)
- `app/api/admin/media/route.ts:59`, `app/api/admin/build/upload/route.ts:30`, `app/api/admin/build/blob-token/route.ts:36`, `app/api/admin/pos/route.ts:83`, `app/api/admin/pages/route.ts`, `app/api/admin/security/route.ts`, `app/api/admin/security/passkey/register-verify/route.ts`, `app/api/admin/security/passkey/auth-verify/route.ts`, `app/api/admin/passkey-login/verify/route.ts` — `(e as Error)?.message` to the caller.

**Issue:** These handlers surface the raw `Error.message` from downstream SDKs (Stripe, Vercel Blob, WebAuthn) directly in the JSON response. Most are admin/auth-gated (lower exposure), but `shop/checkout` and `kiosk/.../photo` are **public/unauthenticated**, so Stripe/Blob internal error strings reach anonymous users.

**Impact:** Information disclosure — provider error text can reveal configuration details, account/resource identifiers, or internal state, aiding reconnaissance. Low severity (no direct compromise; messages are SDK-level, not stack traces).

**Recommendation:** Return a fixed, friendly message to the client and `console.error` the detail server-side — the pattern already used correctly by `booking/create:164–165`, `consult:110–111`, and the Stripe webhook. Prioritise the two public routes (`shop/checkout:77`, `kiosk/.../photo:60`).

### [LOW] Public tracking write-endpoints lack a per-IP rate limit

**Location:** `app/api/track/heatmap/route.ts:10` (POST) and `app/api/track/replay/route.ts:11` (POST). Compare `app/api/chat/route.ts:13`, `nps/route.ts:10`, `consult/route.ts:30`, which all call `enforceRateLimit`.

**Issue:** Both endpoints are public, unauthenticated, and write rows to Postgres (`heatmapEvent.createMany`, `replayChunk.create` / `replaySession.upsert`). They enforce **per-request batch caps** (heatmap ≤30 events/req; replay ≤200 events/req, ≤20,000 events/session) but **no per-IP throttle** on request *frequency*. A scripted client can POST in a tight loop — each request bypasses the session-event cap by minting a fresh `sessionKey` (replay) or simply reposting (heatmap).

**Impact:** Storage-exhaustion / DB-bloat DoS and analytics-data pollution from a single source. No auth or data-exposure impact. Low.

**Recommendation:** Add `enforceRateLimit(req, 'track-heatmap'|'track-replay', <limit>, <window>)` mirroring the other public endpoints, and/or cap distinct `sessionKey`s per IP per window (as `kiosk/sessions/route.ts:9–10` does for kiosk sessions).

### [LOW] `shop/checkout` trusts client-supplied `clientId` for order attribution

**Location:** `app/api/shop/checkout/route.ts:50` — `clientId: body.clientId || null`.

**Issue:** Guest checkout writes whatever `clientId` the request supplies onto the `Order`, with no check that the value matches the signed-in client (the route never reads `getClientSession()`). Pricing itself is safe — `validateCart` re-prices server-side and the gift-card balance is validated against the DB — so this is purely an attribution/data-integrity issue, not a price-tampering one.

**Impact:** A caller can attach an order (with its retail spend / loyalty implications) to an arbitrary client id, or scrape valid ids. Low — no payment or PII exposure; the order PII (name/email/address) is still the attacker's own input.

**Recommendation:** Ignore `body.clientId` and derive it from `getClientSession()` when present (`session.sub`), else `null`. Don't accept a client-controlled foreign key for ownership/attribution.

### [LOW] `gift-vouchers/create` has no rate limit and an unbounded `amountPence` in its schema

**Location:** `app/api/gift-vouchers/create/route.ts:8` (`amountPence: z.number().int().positive()` — no `.max()`); no `enforceRateLimit` in the handler.

**Issue:** The route is public and creates a Stripe PaymentIntent per call. The zod schema allows any positive integer amount. (The amount *is* clamped downstream — `lib/gift-vouchers.ts:8` `VOUCHER_MAX = 50000` and the `VOUCHER_MIN..VOUCHER_MAX` check at line 50 — so an out-of-range amount is rejected before charging, making this defence-in-depth rather than an exploitable flaw.) The missing rate limit is the more material gap: every other public form route (`consult`, `newsletter`, `dentistry-interest`, `careers/apply`, `academy/apply`) throttles per IP, but voucher creation does not, so PaymentIntent-creation spam is unthrottled.

**Impact:** Low — abusive creation of pending vouchers / Stripe PaymentIntents (resource churn, Stripe-side noise). No financial loss (amount capped, payment still required).

**Recommendation:** Add `enforceRateLimit(req, 'gift-voucher-create', 5, 600)` and bound the schema with `.max(VOUCHER_MAX)` so validation fails fast and stays consistent with the business rule.

### [INFO] Middleware does not gate `/api` — handler self-authorization is the only line of defence

**Location:** `middleware.ts:106–110` (`matcher: ['/((?!api|...).*)']`).

**Issue:** The matcher deliberately excludes `/api`, so the JWT/role checks in middleware apply to *pages* only. Admin API authorization depends entirely on each handler calling `requirePermission`/`getSession`. Today this holds across the sampled admin routes, but it is a fragile invariant: a new admin route that forgets the check would be **fully unauthenticated and reachable directly** (the protected `/admin` page UI gives a false sense of safety). This is informational because no current gap was found.

**Recommendation:** Add a defence-in-depth guard for `/api/admin/*` — e.g. a thin wrapper/helper that every admin handler must use, a lightweight `instrumentation`/route-group layout check, or a CI lint asserting each `app/api/admin/**/route.ts` references an auth helper. Document the convention so it survives contributor turnover.

### [INFO] `admin/pos` `op:'status'` and similar staff reads fetch any object by id without scoping

**Location:** `app/api/admin/pos/route.ts:20–24` (looks up any `order` by `body.orderId`). Pattern also appears in other staff `op:'get'` branches (e.g. `admin/suppliers/route.ts:26–34`).

**Issue:** These are gated by an appropriate permission (`pos.use`, `suppliers.view`) but, once authorized, fetch *any* record by id with no further tenant/scope restriction. For a single-clinic deployment this is correct (staff may legitimately see any order/supplier). Flagged only so it is a conscious decision: there is no per-object scoping beyond the role check.

**Impact:** None in the current single-tenant model. Would matter if the app ever became multi-clinic/multi-tenant.

**Recommendation:** No change needed now. If multi-tenancy is introduced, add a tenant predicate to these `findUnique` lookups.

### [INFO] Honeypot / anti-bot and rate-limit conventions are good — keep them mandatory on new public routes

**Location:** e.g. `consult/route.ts:26`, `newsletter/route.ts:18`, `academy/apply/route.ts:23`, `booking/create/route.ts:28` (`company` honeypot + `enforceRateLimit`).

**Issue / Note:** Public form/submission routes consistently pair a `company` honeypot with `enforceRateLimit`, HTML-escape user input in outbound emails (`academy/apply:60–62`), and use timing-safe comparison for webhook secrets (`integrations/yay/route.ts:16–19`, `build/queue/route.ts:14–21`). The two gaps are noted above (tracking endpoints; voucher creation). Recommend codifying "public mutation route ⇒ rate-limit + honeypot (where a form) + no raw error leak" as a review checklist item.

## Coverage table

| Category | Routes sampled (deep-read) | Auth | Input validation | Rate limit | Key gaps found |
|---|---|---|---|---|---|
| Payments / financial | `booking/create`, `booking/cancel`, `shop/checkout`, `admin/pos`, `gift-vouchers/create`, `admin/finance/unlock`, `admin/discount`, `stripe/webhook` | Strong (zod + RL on booking/create; PIN+RL+timing-safe on finance/unlock; sig-verify on webhook) | Strong (server-authoritative re-pricing everywhere) | Mostly yes | `shop/checkout` trusts `clientId` & leaks Stripe error (Low); `gift-vouchers/create` no RL + unbounded amount in schema (Low) |
| Admin CRUD | `admin/rewards/catalogue`, `admin/posts`, `admin/suppliers`, `admin/media`, `admin/build/upload`, `admin/build/blob-token` | Strong (`requirePermission(<key>)` on all) | Strong (field-picked `data`; no mass-assignment) | n/a (gated) | SVG in media allow-list (Medium); raw error leak (Low) |
| Client / PII | `account/profile`, `account/me`, `account/assessment`, `account/rewards/redeem`, `account/calendar/[token]`, `admin/clients/[id]/export`, `admin/consultations/[id]/notes` | Strong (session-scoped; SAR export gated by `clients.export` + clinical sub-gate + audit) | Strong (zod on profile/assessment; ownership re-checked in lib) | n/a | None material; IDOR explicitly defended (`assessment` booking-ownership; loyalty `clientId` check) |
| File upload | `admin/media`, `admin/build/upload`, `admin/build/blob-token`, `kiosk/sessions/[token]/photo` | Strong | Size + MIME caps on all | Custom per-IP on kiosk | SVG (Medium); error leak (Low) |
| Public token-gated | `chat`, `consent/sign`, `review/submit`, `nps`, `follow-up`, `kiosk/results/[id]`, `kiosk/results/[id]/share`, `gallery/[id]/[side]` | Token = auth (unguessable cuids) | Manual coercion + length caps | Yes on most (chat/nps/review/share) | None material |
| Public forms | `consult`, `newsletter`, `dentistry-interest`, `academy/apply`, `promo/validate` | n/a / optional session | zod or manual + honeypot | Yes (all) | None |
| Webhooks / cron | `stripe/webhook`, `integrations/yay`, `cron/dispatch`, `build/queue` | Sig-verify / `CRON_SECRET` / `BOARD_QUEUE_TOKEN` (timing-safe) | n/a | yay throttles auth-fails | None |
| AI / chat | `ai-consultation/analyze`, `chat` | Account-gated (AI) / token (chat) | zod (AI) | Per-IP + per-client (AI), per-IP (chat) | None |
| Tracking | `track/heatmap`, `track/replay`, `kiosk/sessions`, `kiosk/sessions/[token]/photo` | Public (consent-gated client-side) | Clamps + per-batch caps | kiosk yes; heatmap/replay NO | No per-IP RL on heatmap/replay (Low) |
| Auth endpoints | `account`/`academy` login, `admin/login` path, `admin/finance/unlock` | n/a (login) | zod (login schemas) | `loginGate` + per-portal RL (academy/admin/client) | None |

**Quantified:** Of the **33 mutation/ID routes deep-read**, **0 lacked a required auth check**, **0 exhibited true mass-assignment**, **2 public write routes lacked a per-IP rate limit** (`track/heatmap`, `track/replay`), **1 public payment route lacked a rate limit** (`gift-vouchers/create`), **2 public routes leaked raw provider errors** (`shop/checkout`, `kiosk/.../photo`), and **1 file uploader accepts SVG**.

## Files reviewed

Deep-read (33):
`middleware.ts`, `lib/auth.ts`, `lib/auth-edge.ts`, `lib/security/guard.ts`, `lib/security/rate-limit.ts`, `lib/validation.ts` (schema inventory), `lib/gift-vouchers.ts` (amount-cap verify), `lib/lms.ts` + `lib/client-loyalty.ts` (ownership-scoping verify),
`app/api/booking/create/route.ts`, `app/api/booking/cancel/route.ts`, `app/api/shop/checkout/route.ts`, `app/api/admin/pos/route.ts`, `app/api/gift-vouchers/create/route.ts`, `app/api/admin/finance/unlock/route.ts`, `app/api/admin/discount/route.ts`, `app/api/stripe/webhook/route.ts`,
`app/api/admin/rewards/catalogue/route.ts`, `app/api/admin/posts/route.ts`, `app/api/admin/suppliers/route.ts`, `app/api/admin/media/route.ts`, `app/api/admin/build/upload/route.ts`, `app/api/admin/build/blob-token/route.ts`,
`app/api/admin/clients/[id]/export/route.ts`, `app/api/admin/consultations/[id]/notes/route.ts`, `app/api/admin/bookings/before-photo/[id]/route.ts`, `app/api/account/profile/route.ts`, `app/api/account/me/route.ts`, `app/api/account/assessment/route.ts`, `app/api/account/rewards/redeem/route.ts`, `app/api/account/calendar/[token]/route.ts`,
`app/api/gallery/[id]/[side]/route.ts`, `app/api/kiosk/results/[id]/route.ts`, `app/api/kiosk/results/[id]/share/route.ts`, `app/api/kiosk/sessions/route.ts`, `app/api/kiosk/sessions/[token]/photo/route.ts`,
`app/api/chat/route.ts`, `app/api/ai-consultation/analyze/route.ts`, `app/api/cron/dispatch/route.ts`, `app/api/build/queue/route.ts`, `app/api/integrations/yay/route.ts`,
`app/api/consult/route.ts`, `app/api/follow-up/route.ts`, `app/api/nps/route.ts`, `app/api/newsletter/route.ts`, `app/api/dentistry-interest/route.ts`, `app/api/review/submit/route.ts`, `app/api/search/route.ts`, `app/api/promo/validate/route.ts`, `app/api/consent/sign/route.ts`, `app/api/academy/account/login/route.ts`, `app/api/academy/lesson/route.ts`, `app/api/academy/apply/route.ts`, `app/api/track/heatmap/route.ts`, `app/api/track/replay/route.ts`.

Enumerated + categorised (all 172) via `find`, plus systematic greps for `zod`, `req.json`, `...body`/`...data`, `prisma.*.create/update`, `findUnique({ where:{ id`, auth helpers, `enforceRateLimit`, and `(e as Error).message`.
