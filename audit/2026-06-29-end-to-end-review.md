# End-to-end security review — 2026-06-29

A fresh full-product review of every entry point a remote attacker can reach:
the three auth realms (staff `/admin`, client `/account`, academy `/academy`),
all public and authenticated API routes, payments/finance, PII/GDPR handling,
injection/XSS/SSRF surfaces, security headers and dependencies. Findings that the
2026-06-09 audit already closed (clinical-field encryption, erasure coverage,
cross-portal JWT confusion, deactivated-client persistence, both passkey
mediums, failed-login recording) were verified fixed and are not re-listed.

All open findings below are filed on the Build board under the **Security audit
(June 2026)** project (`api/build/queue`, deduped by title). Severity, location
(`file:line`) and a concrete fix accompany each.

## Access-control gating consistency (the specific brief)

Object-level authorization is **consistent and correct** across the client and
academy portals: every state-changing route takes the identity from the session
(`getCurrentClient`/`getCurrentStudent`/`getSession`) and re-verifies foreign
keys against it; admin-side academy/LMS routes all gate on a real permission via
`requirePermission`. The residual gaps are a small number of
read-vs-write/page-vs-API mismatches, not broad holes:

- Consultation **notes write** gates on `consultations.view` instead of
  `.manage`, so a view-only `STAFF` role can write clinical notes (M1).
- The `workspace` admin **page** has no server gate — it relies on middleware
  only; its APIs are correctly gated, so the impact is UI-only (L2).
- Academy **exercise grading** is the lone academy route that skips the
  enrolment check, leaking cross-course answer keys (L1).
- Cookie-authed mutations rely on `SameSite=Lax` alone — no CSRF/Origin check
  (M2), the one systemic gating weakness.

## Findings

### High

- **H1 — Gift-card claim has no rate limit (voucher code brute-force).**
  `app/api/account/gift-card/claim/route.ts:9`; codes are 32-bit
  (`lib/gift-vouchers.ts:13-16`). Any signed-in account can spray guesses to
  claim active cards (≤£500). Fix: `enforceRateLimit(req,'gift-card-claim',5,600)`
  and lengthen `genCode` entropy.
- **H2 — `shop/checkout` is unauthenticated with no rate limit.**
  `app/api/shop/checkout/route.ts:9`. Public POST creates Orders + Stripe
  PaymentIntents and validates gift-card codes — anonymous brute-force +
  resource spam. Fix: `enforceRateLimit(req,'shop-checkout',8,600)` first.
- **H3 — Call recordings/transcripts gated only by `calls.view`, unaudited.**
  `app/api/admin/calls/route.ts:11,48`. Transcripts hold special-category health
  content; a non-clinical front-desk role reads Art. 9 data it is denied on the
  client page, and no audit event fires. Fix: require `clients.clinical.view`
  and emit `ASSESSMENT_VIEWED` on transcript decrypt.
- **H4 — Staff role/permission grants & revokes are not audited.**
  `app/api/admin/staff/route.ts:99-125`. Privilege changes only bump
  `sessionEpoch`; no `logAudit`. Fix: emit a dedicated audit event with
  actor/target/before-after on any security-relevant change.

### Medium

- **M1 — Consultation notes write gated on `consultations.view` not `.manage`.**
  `app/api/admin/consultations/[id]/notes/route.ts:32`.
- **M2 — No CSRF/Origin/`Sec-Fetch-Site` check on cookie-authed mutations.**
  `lib/auth.ts:76` (Lax) + all admin/account/academy POSTs. Fix: enforce
  `Sec-Fetch-Site: same-origin` (or an Origin allow-list) in a shared wrapper.
- **M3 — `gift-vouchers/create` no rate limit + unbounded `amountPence`.**
  `app/api/gift-vouchers/create/route.ts:8,28`. Fix: rate-limit + schema
  `.max(VOUCHER_MAX)`.
- **M4 — `booking/confirm` confirms any `bookingId` without ownership scoping.**
  `app/api/booking/confirm/route.ts:13-30`. Bounded by the SetupIntent check but
  allows booking-ID probing. Fix: scope to `getCurrentClient()` + rate-limit.
- **M5 — SAR export returns decrypted call transcripts regardless of the
  clinical gate.** `app/api/admin/clients/[id]/export/route.ts:31,44,74`. Move
  `callRecords` decryption inside the `clients.clinical.view` branch.
- **M6 — No explicit AI-processing consent for facial-image analysis.**
  `lib/ai-consultation.ts:207` (`consentAt:new Date()`). Capture a versioned
  affirmative consent like `marketingConsentFields`.
- **M7 — Welcome-discount double-apply via concurrent bookings.**
  `booking/start:223` + `booking/create:187-191`. Fix: conditional `updateMany`
  CAS on `status:ACTIVE`.
- **M8 — Global CSP keeps `script-src 'unsafe-inline'` on public pages.**
  `next.config.mjs:26`. (Admin is already strict/nonce-based.) Move static
  marketing pages to hashed/nonced inline or external scripts.
- **M9 — Session JWT secret derived from weak input without a length floor.**
  `lib/auth-edge.ts:40-46`. Fix: refuse to boot on a short/weak secret in prod.

### Low

- **L1 — Academy exercise grading skips the enrolment check (answer-key leak).**
  `lib/exercises.ts:115`. Add `studentCanAccess(studentId,e.courseId)`.
- **L2 — `workspace` admin page has no server-side permission gate.**
  `app/admin/workspace/page.tsx:10`.
- **L3 — Google SSO callback issues a full session without the 2FA-enrolment
  gate.** `app/api/admin/oauth/google/callback/route.ts:42`.
- **L4 — `kiosk/events` public sink has no rate limit (storage DoS).**
  `app/api/kiosk/events/route.ts:10-17`.
- **L5 — Kiosk results claim has no rate limit (account/discount mint).**
  `app/api/kiosk/results/[id]/claim/route.ts:9-13`.
- **L6 — `follow-up` submission has no rate limit.** `app/api/follow-up/route.ts:9-15`.
- **L7 — Consult upserts a Client by email, overwriting existing fields.**
  `app/api/consult/route.ts:50-70`. Only fill empty fields on update.
- **L8 — Kiosk photo upload returns the raw Blob error to an anonymous user.**
  `app/api/kiosk/sessions/[token]/photo/route.ts:60`.
- **L9 — Stripe webhook has no event-id dedup (replay/double-process).**
  `app/api/stripe/webhook/route.ts:16-26`.
- **L10 — Rate limits fail open under store outage (finance PIN/promo).**
  `lib/security/rate-limit.ts:42-44`.
- **L11 — SCA link embeds the PaymentIntent `client_secret` in the URL.**
  `lib/booking-actions.ts:164`.
- **L12 — Consult clinic-notify email embeds raw medical free-text.**
  `app/api/consult/route.ts:124`; `lib/email.ts:280`.
- **L13 — `fromNumber` + IP/UA retained indefinitely, no retention sweep.**
  `lib/yay.ts:182-194`; `HealthAssessment.submittedIp`, `SecurityEvent.ip`,
  `SignedConsent.ip`.
- **L14 — `emitAssessmentView` audit writes still fail silently.**
  `lib/health-assessments.ts:11-20` (the main `logAudit` now logs failures).
- **L15 — `dangerouslyAllowSVG` serves Blob-origin SVG (isolated-origin XSS).**
  `next.config.mjs:141-148`.
- **L16 — Unescaped href in a notification template.** `lib/notifications.ts:105`.
- **L17 — `tmplManual` firstName unescaped.** `lib/client-loyalty.ts:274,277`.
- **L18 — `style-src 'unsafe-inline'` in the strict admin CSP.** `middleware.ts:39`.
- **L19 — `connect/img/media-src` wildcard `https:`.** `next.config.mjs:18,23,31`.
- **L20 — Admin `script-src https:` legacy fallback weakens `strict-dynamic`.**
  `middleware.ts:40`.
- **L21 — COEP not set (no cross-origin isolation).**
- **L22 — `jwtVerify` has no explicit `algorithms` allow-list.**
  `lib/auth-edge.ts:69,79,99`.
- **L23 — Edge middleware is signature-only; revocation/`portalActive` only
  enforced in the DB-backed `getSession`.** `middleware.ts:156`.

## Verified clean (no finding)

`npm audit` 0 vulnerabilities; cookies `httpOnly`+`secure`+`lax`; all login
realms use `loginGate` (per-email + per-IP lockout), breached-password checks and
enumeration-safe responses; `clientIp` uses the unspoofable platform header /
last XFF hop; cron routes constant-time `CRON_SECRET`; Stripe/Svix webhooks
verify signatures; academy uploads authorise inside `onBeforeGenerateToken` with
type/size caps and random suffixes; no mass-assignment (routes field-pick into
Prisma); HTML sanitizer wired into journal/CMS/editor; SSRF guarded;
open-redirect validated; no raw SQL (all Prisma/parameterised). `track/heatmap`
and `track/replay` now consent-gated + rate-limited; `admin/media` SVG removed;
`shop/checkout` no longer trusts a client-supplied `clientId`.

## A note on "MAC address tracking"

The brief asked for IP **and MAC** address tracking. A device's MAC address is a
link-layer identifier that is replaced at the first router hop and never reaches a
remote server — no website can see or log it. The strongest per-device signal a
server can capture is the **User-Agent** (browser/OS fingerprint), which we
already store on every `SecurityEvent`. The new **Admin → Security → IP & device
activity** page therefore tracks by IP, shows the device (User-Agent) column, and
lets staff block suspicious IPs. Enforcement: the edge middleware denies blocked
IPs all page requests; `loginGate` and `enforceRateLimit` deny them every login
and throttled endpoint.
