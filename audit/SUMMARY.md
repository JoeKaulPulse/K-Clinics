# K-Clinics Codebase Audit — Consolidated Summary

**Date:** 2026-06-09 · **Branch:** `claude/sleepy-cori-5b7c8i`
**Method:** 10 parallel area audits (read-only); every finding backed by `file:line`. Per-area detail in the numbered reports; this file is the cross-area rollup, deduped and ranked.

> ⚠️ This is a static review. Nothing here was exploited and no source was modified. Treat the Critical/High items as "verify against your threat model, then fix" — several are confirmed by code reading, a few are marked needs-verification in their detail report.

## Severity tally

| # | Area | Crit | High | Med | Low | Info |
|---|------|:----:|:----:|:---:|:---:|:----:|
| 01 | Auth & authorization | 0 | 2 | 4 | 4 | 3 |
| 02 | Payments & finance | 0 | 1 | 3 | 4 | 3 |
| 03 | API validation & authz | 0 | 0 | 1 | 4 | 3 |
| 04 | Data layer & Prisma | **1** | 4 | 7 | 5 | 3 |
| 05 | AI / kiosk / chat | 0 | 0 | 4 | 4 | 3 |
| 06 | PII / GDPR / health data | **2** | 5 | 6 | 4 | 3 |
| 07 | Secrets & integrations | 0 | 2 | 2 | 3 | 3 |
| 08 | Frontend XSS / replay | 0 | 2 | 2 | 3 | 3 |
| 09 | Email & notifications | 0 | 1 | 4 | 4 | 3 |
| 10 | Build / deps / perf | 0 | 1 | 4 | 4 | 3 |
| | **TOTAL** | **3** | **18** | **37** | **39** | **30** |

127 findings total. The risk concentrates in **data-at-rest protection, GDPR data-subject handling, missing HTML sanitization, and a handful of concurrency races** — not in the API/auth surface, which reviewed strongly.

---

## 🔴 Critical (3) — fix first

**C1 · Booking double-booking race** — `app/api/booking/create/route.ts:65,106` (`lib/availability.ts:331-369`)
Slot allocation has no transaction, row lock, or unique constraint, so two concurrent requests can book the same slot/room/staff. Operational and clinical-integrity impact. *(area 04)*
→ Add a DB unique constraint on the slot key **and** wrap allocation in a `Serializable` transaction (the money/points/stock paths already do this — follow that pattern).

**C2 · Right-to-erasure leaves health & personal data behind** — `app/admin/actions.ts:28-48`
`eraseClientData` pseudonymises only the `Client` row and deletes interactions; **consultations, encrypted health assessments, signed consents, before-photos, AI analyses, email metadata and call transcripts all remain.** UK GDPR Art. 17 exposure. *(area 06)*
→ Extend erasure to every table holding the client's personal/health data (or document a lawful retention exemption per category).
→ **✅ REMEDIATED (2026-06-12).** `eraseClientData` (`app/admin/actions.ts:31-82`) now runs one atomic cross-model `$transaction`: pseudonymises the `Client` row; strips special-category free-text from the financially-retained `Booking`/`Consultation` rows; and hard-deletes `Interaction`, `ConsultationNote` (added this pass), `HealthAssessment`, `BeforePhoto`, `AiAnalysis` (→ cascades to `AiAnalysisImage`), `SignedConsent`, `Review`, `NpsResponse`, `FollowUp`, `EmailEvent`, `AppointmentSession`, and scrubs `CallRecord` transcripts/recordings. Every special-category table named in this finding is now covered. *Residual (Medium, tracked separately): a broader Art. 17 sweep should also reach non-special-category personal data on `Referral`, `ChatConversation`/`ChatMessage`, `WaitlistEntry` and the legacy `Appointment` model.*

**C3 · Special-category health data stored in plaintext** — `prisma/schema.prisma:274,311,425,498` (`Client.allergies`/`medicalFlag`, `Consultation.medicalNotes`/`concerns`/`message`, `Booking.allergyNote`)
Sits **outside** the existing AES-256-GCM encrypted store, so a DB-read compromise exposes medical data directly. GDPR Art. 9. *(area 06, corroborated by area 04 High)*
→ Move these columns behind the existing keyring (the infra already exists and is sound — see C-note below).
→ **✅ REMEDIATED (2026-06-12).** `lib/clinical-crypto.ts` (`encClinical`/`decClinical`) routes all six fields through the existing keyring: encrypt-at-write at every entry point (`/api/admin/medical-flag`, `/api/booking/start`, `/api/consult`, the client edit + note actions) and tolerant decrypt-at-read (passes through legacy plaintext, so no flag-day) in the `lib/crm-data.ts` access layer and every direct read site. A one-time backfill (`lib/clinical-crypto-backfill.ts` + `/api/admin/maintenance/backfill-clinical-encryption`) upgrades historic rows. The final missed read-site — the live appointment-session canvas showing `medicalFlag` raw to clinicians (`app/admin/bookings/[id]/session/page.tsx`) — was closed this pass. No-FK/no-`@unique` changes, so the additive-only deploy gate is unaffected.

---

## 🟠 High (18) — grouped by theme

### Data-at-rest & secrets
- **Google Calendar refresh token stored plaintext** — `prisma/schema.prisma:857` (written `lib/google-calendar.ts:62`). *Independently found by areas 07 and 04.* Integration is currently parked (`GOOGLE_INTEGRATION_ENABLED=false`) so nothing is written today, but the live path is plaintext the moment it's enabled. → Encrypt before enabling.

### Authentication & session
- **Cross-portal JWT confusion** — `lib/auth-edge.ts:49-56,79-86`. Client/academy secrets fall back to `ADMIN_JWT_SECRET` and tokens carry no `aud`/`typ` claim, so identical-shape client/academy tokens are interchangeable. → Separate secrets per portal + add and verify `aud`/`typ`. *(01)*
- **Deactivated clients keep portal access until token expiry** — `lib/client-auth.ts:283-287`. `getCurrentClient` never rechecks `portalActive` (admin/academy paths do). → Re-check active status on each request. *(01)*

### Authorization / CSRF on integrations
- **Google Calendar OAuth callback has no CSRF state nonce** — `app/api/admin/gcal/callback/route.ts:15-20` (uses bare `staffId`). → Add a signed state nonce. *(07)*

### Concurrency / financial integrity
- **Gift-card double-spend across concurrent orders** — `app/api/shop/checkout/route.ts:41-46` / `lib/shop.ts:74-79`. Balance is read & reserved but only decremented later in `finalizeOrder`, so parallel checkouts each "reserve" the full balance. → Reserve/decrement atomically at checkout. *(02)*
- **Inventory stock-movement TOCTOU** — `app/api/admin/inventory/route.ts:83-99`. Negative-stock guard sits outside the transaction. → Move the guard inside the `$transaction`. *(04)*

### Stored XSS (shared root cause: no HTML sanitizer in the repo)
- **Raw-HTML Journal block renders unsanitized on the public site** — `lib/blocks.ts:107` → `app/(marketing)/journal/[slug]/page.tsx:73`. *(08)*
- **Imported WordPress HTML rendered unsanitized** — `lib/blocks.ts:171` → `lib/blog.ts:56`. *(08)*
→ One fix for both: sanitize raw-HTML blocks at render with DOMPurify/`sanitize-html` (allowlist).

### GDPR / health-data governance
- **No audit record when clinical data is decrypted for routine viewing** — `app/admin/clients/[id]/page.tsx:62-72`. `ASSESSMENT_VIEWED` is logged only on SAR export, not when a clinician opens a client and `formatAssessment` decrypts their history. → Log on view. *(06)*
- **Marketing consent has no timestamp / version / source / lawful basis** — `prisma/schema.prisma:275`, `app/admin/actions.ts:136-142`. `marketingOptIn` is a bare boolean a staff member can flip with no proof (PECR / Art. 7 demonstrability). → Capture consent evidence. *(06)*
- **Unauthenticated, consent-unverified session-replay ingest** — `app/api/track/replay/route.ts:11-39`. Accepts rrweb batches from anyone, no auth/consent/rate-limit; masking is client-side only. → Gate on consent + auth + rate-limit. *(06; replay PII gap corroborated by 08, rate-limit by 03)*

### Email
- **Client name/email injected into marketing & automation email HTML without escaping** — `lib/email-builder.ts:34-45` + `lib/email-campaigns.ts:50-52` + `lib/automations.ts:47,87,116`. HTML/link injection → in-domain phishing. → HTML-escape all interpolated values. *(09)*

### Build / deploy
- **Build-time `prisma db push` mutates the production DB** and fails the deploy if the DB is unreachable — `package.json:11` → `scripts/db-sync.mjs:130-155`. *Independently found by areas 10 and 04.* → Switch to versioned `prisma migrate deploy`; don't mutate prod schema from `prebuild`.

*(Remaining High items are detailed in the per-area reports.)*

---

## 🟡 Medium (37) — recurring patterns

- **AI calls lack timeouts/retries** — only the kiosk path uses an `AbortController`; consultation/marketing have none, and no Claude call has retry/backoff, so a transient 429/529 fails the request (`lib/ai-consultation.ts:197`, `lib/ai-marketing.ts:23`, `lib/chat-ai.ts:122`, `lib/kiosk-ai.ts:66`). *(05)*
- **Health/biometric data + PII sent to Anthropic** with consent enforced & data encrypted, but the consent copy doesn't name Anthropic / US transfer and the 30-day-deletion promise needs an enforced job. *(05/06)*
- **Send-abuse surface** — campaign send + `test` op have no rate limit/cap and can send to arbitrary addresses unlogged; SMS has no cost cap and a reminder loop can re-fire on per-booking error (`app/api/admin/marketing/email/send/route.ts`, `lib/sms.ts:11-35`). *(09)*
- **Unsubscribe** uses a long-lived token as sole credential; GET mutates state, no rotation/audit (`app/api/unsubscribe/route.ts`). *(09)*
- **No CSRF tokens on cookie-auth POSTs** (disable-2FA, signOutEverywhere, staff edits, profile) — only `SameSite=Lax` defends them (`lib/auth.ts:69-75`). *(01)*
- **Passkey gaps** — login bypasses the 2FA-enrolment gate; registration is gated to "any signed-in staff" despite OWNER-only intent (`app/api/admin/passkey-login/verify/route.ts:50`, `.../passkey/register-options/route.ts:11`). *(01)*
- **SVG accepted into the public media library** (stored-XSS vector) and `dangerouslyAllowSVG` on `next/image` (`app/api/admin/media/route.ts:9`, `next.config.mjs:70`). *(03/10)*
- **Webhook/confirm gaps** — gift *packages* never finalised by the webhook backstop; `shop/confirm` never asserts `pi.amount_received` equals the total; cash-reserve balances settable with no audit log (`app/api/stripe/webhook/route.ts:41`, `app/api/shop/confirm/route.ts:18`, `app/api/admin/cashflow/route.ts:65`). *(02)*
- **Schema integrity** — 7 medium data-model issues (missing indexes/constraints, cascade behavior); see `04-data-prisma.md` "Schema hotspots".
- **Perf** — `force-dynamic` on cacheable public marketing pages negates `unstable_cache` (journal, shop, treatment-finder, academy). *(10)*
- **Concrete bug** — `scripts/db-sync.mjs:74` calls `sleep()` before it's defined (TDZ `ReferenceError`), breaking retry/backoff in safe-migration mode. *(10)*
- **Functional bug** — marketing OAuth tokens persisted in the wrong shape (`conn.tokens.access` is undefined) and never refreshed, so `lib/ad-spend.ts:35` reads nothing. *(07)*

---

## Cross-corroborated findings (higher confidence)

Issues independently surfaced by more than one agent:

| Finding | Reported by | Severity |
|---|---|---|
| Plaintext special-category health PII (`schema.prisma`) | 06 (Crit) + 04 (High) | Critical |
| Google refresh token plaintext (`schema.prisma:857`) | 07 + 04 | High |
| Build-time `prisma db push` mutating prod | 10 + 04 | High |
| Unauth / unmasked rrweb replay ingest | 06 + 08 + 03 | High/Med |

---

## Systemic root causes (fixing these closes many findings)

1. **No HTML sanitizer in the codebase** → both XSS Highs + the SVG/editor Mediums. Add one allowlist sanitizer at every raw-HTML render sink.
2. **Sensitive data stored beside, not inside, the (sound) encrypted keyring** → health PII + OAuth tokens. The crypto core (AES-256-GCM + HMAC keyring, CSPRNG, correct webhook signature verification) is genuinely strong — the gap is *coverage*, not *design*.
3. **Reservation/decrement split across request boundaries without a lock** → booking and gift-card races. Standardise on the existing `Serializable` transaction pattern.
4. **Consent/erasure modelled as flags rather than evidenced events** → GDPR Highs. Model consent and erasure as audited, versioned records.
5. **Build pipeline performs runtime DB mutation** → deploy fragility. Separate schema migration from build.

---

## What's already strong (verified, not assumed)

- **API/auth surface** — of 33 mutation/ID routes deep-read, **0 lacked a required auth check**; no true mass-assignment; no raw SQL anywhere (SQLi surface nil). *(03/04)*
- **Payment core** — server-authoritative pricing throughout, correct Stripe webhook signature verification on the raw body, atomic idempotency guards on order/booking/voucher finalisation, permission-gated finance mutations. *(02)*
- **Crypto** — AES-256-GCM keyring + HMAC, CSPRNG everywhere, no secrets in `NEXT_PUBLIC_`, **no hardcoded secrets committed** (all matches were `.env.example`/doc placeholders). *(07)*
- **Security headers** — full set present (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP, CORP). *(10)*
- **AI output handling** — model output rendered as React text, recommendations validated against the real catalogue; no XSS/SQLi/redirect sink from model output. *(05)*
- **rrweb** — `maskAllInputs`, consent-gated, excludes `/admin` `/account` `/book` `/booking`; cards are Stripe-iframe safe (one gap: `/shop/checkout` text). *(08)*

---

## Suggested remediation order

1. **C1–C3** (booking race, erasure completeness, encrypt health columns) — legal + integrity.
2. **XSS Highs** — one sanitizer fixes both Journal + WP-import sinks.
3. **Auth Highs** — split portal JWT secrets + add `aud`/`typ`; re-check `portalActive`.
4. **Finance/data races** — gift-card reservation, inventory TOCTOU.
5. **Integrations** — encrypt Google token + add OAuth state *before* enabling that integration; fix the marketing-OAuth token-shape bug.
6. **Email/replay abuse** — escape email HTML, rate-limit sends, gate the replay endpoint.
7. **Build pipeline** — move to `prisma migrate deploy`; fix the `db-sync.mjs` `sleep` TDZ bug.
8. Work the Medium backlog per-area.

See `README.md` for the area index and each `NN-*.md` for full detail with code excerpts.
