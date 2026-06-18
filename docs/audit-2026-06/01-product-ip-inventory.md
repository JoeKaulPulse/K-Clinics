# K-Clinics — Product & IP Inventory

**Prepared for:** Board / Confluence + codebase valuation
**Date:** 2026-06-18 · **Scope:** Read-only audit of the live codebase at `kclinics.co.uk`
**Stack:** Next.js 16 (App Router, React 19) · Prisma 7 · PostgreSQL · TypeScript (end-to-end typed) · Vercel
**Method:** Direct inspection of `prisma/schema.prisma`, `app/`, `lib/`, `components/`, `docs/`, `audit/`. Every claim is grounded in a file path or doc.

---

## 0. Headline numbers

| Metric | Value | Source |
| --- | --- | --- |
| Total application code (TS/TSX/MJS, `app`+`components`+`lib`+`hooks`+`scripts`) | **~110,000 LOC** | `find … | wc -l` |
| — `app/` (routes, pages, API) | 30,910 LOC | |
| — `components/` (UI) | 36,623 LOC across **306 `.tsx`** in **35 domains** | `components/` |
| — `lib/` (business logic) | 30,995 LOC across **178 `.ts` modules** | `lib/` |
| — `scripts/` (build, seed, QA, migration) | 11,252 LOC | `scripts/` |
| Prisma models | **128** (+ 51 enums), 3,526-line schema | `prisma/schema.prisma` |
| API routes (`route.ts`) | **225** across 33 top-level groups | `app/api/` |
| Admin pages (`page.tsx`) | **98** across ~68 sections | `app/admin/` |
| Marketing pages | **51** | `app/(marketing)/` |
| Client-portal pages | 13 | `app/account/` |
| Academy pages | 19 | `app/academy/` (public + admin) |
| Total `page.tsx` | 175 | `app/` |
| Standing security/quality audit findings | **127** (3 critical — all remediated, 18 high) | `audit/SUMMARY.md` |
| Build backlog items authored | ~270 | `lib/build-backlog.ts` |

The product is a single Next.js monolith that already operates **nine distinct customer-facing surfaces** plus a deep admin/CRM, an LMS, an AI kiosk, and a multi-tenant SaaS seam. It is the reference tenant ("tenant #1") for a planned platform, **ClinicOS**.

---

## 1. Product surfaces

Maturity key: **Shipped** = live in production · **Partial** = core shipped, capabilities dormant/in-build · **Planned** = designed, not built.

### 1.1 Marketing site — `app/(marketing)` · **Shipped**
**Purpose:** Premium public web presence (aesthetics + aesthetic dentistry, Islington). Replaces a WordPress/agency site with a first-party, CRM-driven, SEO-optimised property.

**Key features**
- 51 pages: home, `/treatments` (40+ treatments) + dynamic `/[slug]` detail, `/dentistry`, `/packages`, `/treatment-finder`, `/book` funnel (`/booking/card`, `/booking/pay`, `/booking/manage`), `/shop` storefront, `/academy/*` public pages, `/about`, `/team`, `/careers`, `/journal` blog, `/reviews`, `/gallery`, `/membership`, `/refer-a-friend`, `/offers`, `/finance`, `/gift-vouchers`, `/contact`, `/faq`, `/roadmap`, `/info/[slug]`, `/search`.
- ISR (hourly revalidate) so live CRM pricing/offers surface on static pages.
- Per-page Open Graph image generation (`app/og/route.tsx`, 1-year immutable cache, brand-mark rendered server-side).
- Structured data (FAQ, breadcrumb, aggregate rating, item lists), `sitemap.ts`, `robots.ts`, `llms.txt`, `indexnow`.
- Bilingual (en/uk) via `lib/i18n.ts`; gender-aware treatment filtering.

**Data models:** `Page`, `GlobalSection`, `PageRevision`, `TreatmentContent`, `MediaAsset`, `SiteConfig`, `Post` (blog), `PageSeo`, `GalleryItem`, plus reads of `Service`/`ServiceVariant`/`ServiceOffer`.
**Integrations:** GA4, Google Ads + Meta pixels, Vercel Speed Insights, Sentry.

### 1.2 Booking engine — `app/(marketing)/book` + `app/api/booking` · **Shipped**
**Purpose:** First-party slot-based booking with card-on-file, replacing Treatwell/Fresha. See `docs/BOOKING_ARCHITECTURE.md`.

**Key features**
- Deferred-charge model: Stripe **SetupIntent** holds a card at booking (no charge); a **PaymentIntent** charges off-session only on delivery or late-cancel. SCA recovery handled.
- Availability engine (`lib/availability.ts`): clinician schedules, competencies, room/equipment resources, lunch breaks, buffer/turnover minutes, time-off, clinic closures, multi-location — collision-aware.
- Self-service token links: cancel (24h fee window), reschedule (max 3 free, 48h), `manageToken`.
- Loyalty point redemption (capped at 50%), line-item upsells/add-ons, BNPL course pre-payment via Stripe Checkout (Klarna/Clearpay).
- Cancellation waitlist with time-boxed one-click claim.
- Google Calendar mirror of bookings onto clinician Workspace calendars (best-effort).

**Data models:** `Booking`, `BookingItem`, `AppointmentSession`, `Service`/`ServiceVariant`/`ServiceOffer`, `Resource`, `RoomPrep`, `RoomClosure`, `Location`, `StaffSchedule`, `StaffTimeOff`, `ClinicClosure`, `WaitlistEntry`, `AuditEvent`.
**Integrations:** Stripe (live), Google Calendar (built; gated `GOOGLE_INTEGRATION_ENABLED`).
**Note (audit):** booking-slot allocation race C1 flagged in `audit/SUMMARY.md` — fix is a serializable transaction; the money/points/stock paths already use that pattern.

### 1.3 Client portal — `app/account` · **Shipped**
**Purpose:** Authenticated client hub (the "logged-in" experience competitors lack).

**Key features**
- Dashboard (upcoming booking, loyalty balance, offers, history, recommendations), `/appointments`, `/assessments/[key]` (versioned health questionnaires), `/rewards` (loyalty + referral + membership), `/invoices`, `/gift-cards`, `/aftercare`, `/profile`, auth (`/login`, `/signup`, `/forgot-password`, `/reset`).
- Own-account JWT auth (`lib/client-auth.ts`), `sessionEpoch` revocation, GDPR self-export (`lib/data-export.ts`), bilingual.

**Data models:** `Client`, `HealthAssessment`, `QuestionnaireVersion`, `ClientPoints`, `Referral`, `MembershipTier`, `GiftVoucher`, `FollowUp`, `AiAnalysis`.
**Integrations:** Stripe, Resend.

### 1.4 Admin CRM — `app/admin` · **Shipped** (the largest surface)
**Purpose:** Full clinic operating system: the staff/owner cockpit. 98 pages, role-shaped dashboards (`AdminUser.preferredDashboardView` — Owner/Admin/Clinician/Reception/Developer/Contractor views).

**Capability clusters** (each is a sub-app):
- **Bookings & calendar/scheduling:** `bookings`, `calendar` (per-clinician day grid), `schedule` (shift templates, breaks, closures), `my-day`, `waitlist`. Real-time arrival-prep + room board.
- **CRM/clients:** `clients` (search, lifecycle, duplicate/name review), `consultations` pipeline, `journal`, `activity` (audit log), `calls` (yay.com VoIP call log + transcripts).
- **Clinical & consent:** `health-forms`, `consent` (+ `consent/cert/[id]` certificates), `sops`, `services` (+ SEO content editor).
- **Finance:** `cashflow` (forecast + reserves), `finance/controls` (refund window, VAT, min-margin), `finance/unlock` (PIN gate), `reports` (+ `reports/sessions`), `pos`, `orders`, `products`, `discounts`, `gift-vouchers`, `membership`, `rewards`.
- **Marketing & growth:** `marketing` hub — `campaigns`, `performance` (attribution/ROI), `audiences`, `email` (+ composer, templates), `ab` (A/B), `insights` (heatmaps + session replay), `connections` (Google/Meta/TikTok OAuth); plus `brand`, `seo`, `qr`, `redirects`, `automations`, `nps`, `promotions`, `reviews`.
- **Inventory & ops:** `inventory` (batch/expiry), `reorder`, `suppliers`, `facility`, `locations`, `devices`, `day-close` (+ reports).
- **Team:** `staff` (roles, permission grant/revoke, Google SSO, public profiles), `time-off`, `contractors`, `careers`.
- **Academy management:** see 1.5.
- **Platform/dev:** `build` (kanban work board), `api-health`, `status`, `go-live`, `security`, `settings`, `integrations`, CMS (`pages`, `blocks`, `site`, `media`, `gallery`).

**Notable IP:** real-time owner dashboard (live clock/weather/UV, clock-in pill, arrival-prep checklist, room board, 12+ attention cards), PIN-gated finance, session-replay + heatmaps (rrweb), AI marketing assistant, GitHub-synced build board.
**Data models:** the bulk of the 128 — `AdminUser`, `WebAuthnCredential`, `TimeEntry`, `StaffPoints`/`Reward`/`RewardRedemption`, `CashflowEntry`/`CashReserve`, `Supplier`, `CallRecord`, `Setting`, `ManagedSecret`, `AuditEvent`, `SecurityEvent`, and all operational models.

### 1.5 Academy LMS — `app/academy` + `app/admin/academy` · **Shipped** (native LMS), VTCT exam admin in-clinic
**Purpose:** Premium clinician-training sub-brand (Harley-Academy style); Ofqual/VTCT-regulated + CPD. A **native LMS** replacing external Thinkific theory.

**Key features**
- Course catalogue (`Course` → `CourseModule` → `Lesson`), authored bite-size lesson player (`steps`, `minSeconds` dwell gates, key points, objectives, study tips, citations, PDFs incl. view-only).
- Quizzes (`Quiz`/`QuizQuestion`, pass marks, attempts) + standalone exam practice bank (`ExamQuestion`, `PastPaper`, `PracticeAttempt`).
- Homework submission + tutor review (`HomeworkSubmission`, Vercel Blob files).
- Gamification: XP ledger (`PointEvent`), badges (`StudentBadge`), streaks (`DailyActivity`), leaderboard.
- Cohorts/enrolments (`Cohort`, `Enrolment`), live classes (`LiveClass`, Google Meet), completion certificates (`/academy/learn/[slug]/certificate`).
- Funding self-check + applications (`FundingApplication`) — government routes (Advanced Learner Loans, Adult Skills Fund, Islington/IACL, LLE) per `docs/ACADEMY_FUNDING_STRATEGY.md`.
- Separate trainee identity (`AcademyStudent`, `StudentPasskey`; `kc-academy` JWT audience, distinct cookie).

**Data models (the ClinicOS-tenanted set):** `AcademyStudent`, `Course`, `CourseModule`, `Lesson`, `HomeworkSubmission`, `Quiz`, `QuizQuestion`, `LessonProgress`, `QuizAttempt`, `ExamQuestion`, `PastPaper`, `PracticeAttempt`, `PointEvent`, `StudentBadge`, `DailyActivity`, `LiveClass`, `Cohort`, `Enrolment`, `FundingApplication`, `Vacancy`, `JobApplication`, `StudentPasskey` (22 tables, all carry `tenantId`).
**Integrations:** Clearpay/BNPL (course finance), Google Meet (live classes), Vercel Blob, Resend.

### 1.6 AI Kiosk skin-analysis — `app/kiosk` + `lib/kiosk-ai.ts` / `lib/kiosk-live.ts` · **Partial** (v1 shipped; v2 live-session in build, PRJ-1)
**Purpose:** "Skin & Smile" storefront QR campaign. A storefront display shows a QR; a passer-by scans on their phone, takes a guided selfie sequence, gets a fun (deliberately **non-clinical**) AI skin & smile rating with annotations, shares it, and claims a reward.

**Key features**
- Phone ↔ display live session: stage machine (`idle→paired→consent→posing→countdown→captured→analyzing→reveal→shared→done`), live mirror frame (≤120KB JPEG data-URL), multi-pose capture (max 4).
- AI: **Anthropic Claude** — Haiku (`claude-haiku-4-5-20251001`) for v1, Sonnet (`claude-sonnet-4-6`) for v2 multi-image analysis. Returns JSON: age backstop (`clearlyOver21`), headline, skinScore, smileScore, observations (with tight bounding boxes + confidence), treatments, first-person share caption. Per-session AI budget target 2–4p.
- Privacy-first: anonymous-until-signup; photos ephemeral (purged on age-decline / expiry / 30-day cron `app/api/cron/kiosk-cleanup`); best photo never shown on the public share page; capability-secret-secured live feed.
- Reward loop: single-use discount code on share-to-claim.

**Data models:** `KioskSession`, `KioskResult`, `KioskEvent`, `Device` (DISPLAY/KIOSK), `DiscountClaim`.
**Contract doc:** `docs/KIOSK_V2_CONTRACT.md`.

### 1.7 E-commerce / shop — `app/(marketing)/shop` + `app/admin/products|orders|pos` · **Shipped**
**Purpose:** Retail product storefront (skincare) + in-clinic POS, distinct from clinical consumables.
**Key features:** catalogue (`Product`, status/age-restriction/inventory), cart + checkout (Stripe), ship-or-collect fulfilment, gift-card redemption at checkout, order management, POS card-terminal routing (`lib/terminal.ts`, `Device` TERMINAL — Tyl by NatWest), `pos-paid` phone confirmation page.
**Data models:** `Product`, `Order`, `OrderItem`, `GiftVoucher`, `PromoCode`/`PromoRedemption`, `Device`.
**Integrations:** Stripe (incl. terminal), Vercel Blob.

### 1.8 Contractor portal — `app/contractor` · **Shipped**
**Purpose:** On-site contractor self-check-in at reception (NOT an admin account). Deliberately isolated from `AdminUser` so the public endpoint never creates a privileged account; capability-secret session, no login.
**Key features:** name search / self-register (feature-flagged `contractor_checkin_enabled`), live on-site view (assigned tasks + facility docs + visit timer + check-out). Strictly **no client/clinical/financial data**.
**Data models:** `Contractor`, `ContractorVisit`, `ContractorTask`, `FacilityDoc`, `TimeEntry`. (Role: `CONTRACTOR`, PRJ-63.)

### 1.9 Kiosk / room displays & live-visit surfaces — standalone routes · **Shipped**
A family of token-secured, chromeless surfaces driving in-clinic hardware and client touchpoints:
- `app/live/[token]` — client's phone companion during a visit (stage, elapsed time, "who you're with"); BLD-138.
- `app/room-display/[token]` — wall-mounted treatment-room screen (current/next appt, 20s auto-refresh, iiyama panels); BLD-225.
- `app/sign/[token]` — legally-binding consent e-signature (markdown→HTML, acknowledgements, audit-logged).
- `app/follow-up/[token]` — post-treatment questionnaire (auto-creates a staff task on a reported concern).
- `app/nps/[token]` — one-click NPS (0–10).
- `app/review/[token]` — review capture + Google Business funnel.
- `app/qr/[code]` — dynamic QR redirect with scan analytics (device/geo, non-blocking).
- `app/pos-paid` — Stripe-checkout confirmation for POS/BNPL.

**Data models:** `AppointmentSession`, `Device`, `ConsentTemplate`/`ConsentRequest`/`SignedConsent`, `FollowUp`, `NpsResponse`, `Review`/`GoogleReview`, `QrCode`/`QrScan`, `Redirect`.

---

## 2. Platform / in-progress / planned

### 2.1 ClinicOS — multi-tenant SaaS (the strategic upside)
**Source:** `docs/PLATFORM_SAAS_PLAN.md` (v0.4, 64KB, BLD-35) + `lib/tenant.ts`, `lib/tenant-scope.ts`, `lib/db.ts`.

**Vision:** Productise the working K-Clinics monolith into **ClinicOS** — an all-in-one operating system for aesthetic/skin/dental clinics, sold as managed multi-tenant SaaS, with K-Clinics as **tenant #1 and reference customer**. Positioned against Pabau/Phorest/Fresha/Zenoti/AestheticsPro on UX, security (encrypted clinical data, passkeys, audit), breadth, and price. Dual GTM: named brand + white-label tier (ADR-009). Bootstrapped, Phase-0-value-first (ADR-013).

**Architecture (decided, planning):** strangler-fig extraction into bounded-context "tools" on managed Kubernetes/GCP London (ADR-002); pooled multi-tenancy with `tenant_id` + Postgres **RLS** backstop, silo-on-demand for enterprise (ADR-003); versioned migrations + expand/contract, ban data-loss flags on the platform track (ADR-004); per-clinic **own-Stripe** (no Connect, ADR-016); Academy extracted first (zero hard FKs into core, no card code — ADR-014). 9–15 month, 7-phase roadmap (§11).

**Maturity — precise current state (the seam is partly *shipped*, not just planned):**
- **Ring 0.1 (shipped):** `Tenant` model + `tenantId` across all 22 Academy tables; backfilled to the K-Clinics tenant.
- **Ring 0.2 / tenant query-scoping (shipped, BLD-300):** `currentTenantId()` resolver (`lib/tenant.ts`) with a single-tenant fast path (byte-for-byte unchanged live) that branches on request host once a 2nd tenant exists; a Prisma `$extends` hook (`lib/db.ts` + `lib/tenant-scope.ts`) injects `tenantId` into every Academy read/bulk-write and stamps creates; **CI isolation guard** (`scripts/test-tenant-isolation.ts`) wired into typecheck, fails the build on scope drift or cross-tenant match.
- **Ring 1a–1c (shipped):** migrations-regime flip (`USE_MIGRATIONS=true`, `prisma/migrations/0_init`); per-tenant composite uniques (`@@unique([tenantId, email/slug])`) replacing global uniques; `tenantId` made **NOT NULL** on all 22 Academy tables (self-backfilling migration). Live booking/admin schema untouched throughout.
- **Ring 1d / RLS (authored, not applied):** reviewed SQL under `prisma/platform-migrations/ring1/` (`0002_academy_rls.sql`) installs a `tenant_isolation` policy per table gated on a per-transaction `app.tenant_id` GUC — **deferred pending GUC plumbing + a Neon-branch rehearsal.**
- **Ring 2 (planned):** extract Academy to a deployable domain package (injected db, per-tenant secrets/theme), onboard a pilot tenant behind a flag.

**Plain-English status:** *Academy tenant-isolation Stage 1 complete — query-scoping seam shipped and CI-guarded, tenant columns NOT NULL with per-tenant uniqueness; RLS database backstop authored but not yet applied; service extraction and external onboarding not started.* No production data forked; live site unchanged.

### 2.2 Compliance roadmap (gates the SaaS)
`docs/COMPLIANCE_ROADMAP.md`. M0 (single clinic) **done**: ICO registration (ZC153001), special-category encryption at rest, GDPR erasure/export, cookie consent, replay masking. M1 (first licensed clinic): DPA + sub-processor register + DPIA + Cyber Essentials + per-tenant isolation/keys/Stripe — **planned**. M2 pen-test, M3 ISO 27001 — planned. Certification order CE → NHS DSPT → ISO 27001 → SOC 2 (ADR-011).

### 2.3 Marketing API activation
`docs/MARKETING_API_ROADMAP.md`. **Live:** OAuth + token refresh (Google/Meta/TikTok), daily ad-spend sync, GA4/Ads/Meta pixels, server-side GA4 purchase/refund + Meta CAPI Purchase, first-touch attribution, rule-based audience segments. **Dormant/planned:** full-funnel Meta CAPI, Google Ads offline-conversion upload (GCLID column added), Meta custom/lookalike audience sync (needs `ads_management` + app review), GA4 Data API + Search Console read dashboards.

### 2.4 Notifications hub
`docs/NOTIFICATIONS.md` — 4-phase redesign. Foundation **shipped** (`StaffNotification` with category/priority/groupKey, `AdminUser.notifPrefs`, `PushSubscription`, web push present). Wider matrix wiring across all tools and full web-push rollout in progress.

### 2.5 Mobile apps
No native mobile app codebase exists. The strategy is **PWA / mobile-web**: `app/manifest.ts`, passkeys (Face ID/Touch ID) for both staff (`WebAuthnCredential`) and trainees (`StudentPasskey`), and chromeless phone-first surfaces (kiosk, live, room-display). Treat "mobile apps" as **mobile-web, shipped; native apps not planned in code.**

### 2.6 Other roadmap items (`docs/projects/`)
Role-based dashboard views (shipped — see 1.4), academy-portal parity, accessibility AA, in-session voice recording (planned).

---

## 3. Integrations register

| Integration | Purpose | Where used | Status |
| --- | --- | --- | --- |
| **PostgreSQL** (Neon/Prisma Postgres) | System of record (128 models) | everywhere (`lib/db.ts`) | Live (required) |
| **Vercel** | Hosting, serverless, cron, edge | platform | Live (required) |
| **Vercel Blob** | Photo/PDF/file storage | kiosk, homework, build attachments, media | Live |
| **Stripe** | Card-on-file holds, off-session charges, Checkout, POS terminal, refunds | booking, shop, POS, academy BNPL (`lib/stripe.ts`, `lib/terminal.ts`) | Live (core) |
| **Klarna / Clearpay (BNPL via Stripe)** | Course/treatment instalments | booking course pre-pay, academy finance (`lib/funding.ts`) | Live |
| **Resend** | Transactional + campaign email | all email (`lib/email.ts`, 924 LOC) | Live |
| **Anthropic Claude API** | AI kiosk analysis, "Get My Plan" consultation, live chat agent, marketing-copy + SEO assistant | `lib/kiosk-ai.ts`, `lib/ai-consultation.ts`, `lib/chat-ai.ts`, `lib/ai-marketing.ts` | Live (Haiku) / Partial (Sonnet v2) |
| **yay.com (VoIP)** | Inbound/outbound call records, recordings, transcripts, caller-ID match | `lib/yay.ts`, `app/admin/calls`, `CallRecord` | Live |
| **Google Workspace SSO (OIDC)** | Staff "Sign in with Google", domain provisioning | `lib/google-sso.ts` | Live |
| **Google Calendar** | Two-way clinician busy-sync + booking mirror | `lib/google-calendar.ts` | Built, gated (`GOOGLE_INTEGRATION_ENABLED`) |
| **Google Business Profile / Places** | Import + reply to reviews, public star rating, "share on Google" | `lib/google-business.ts`, reviews | Built, credential-gated |
| **GA4** | Web analytics + server-side purchase/refund events | marketing, `lib/ga4-data.ts` | Live (pixel+events); Data API dormant |
| **Google Ads** | Spend sync + offline conversion (GCLID) | `lib/ad-spend.ts`, `lib/google-ads-conversions.ts` | Partial (spend live; offline upload planned) |
| **Meta Ads / CAPI** | Spend sync, Purchase CAPI, audiences | `lib/ad-spend.ts`, `lib/meta-audiences.ts` | Partial |
| **TikTok Ads** | Spend sync | `lib/ad-spend.ts` | Partial |
| **Google Search Console** | SEO impressions/CTR/position | `lib/search-console.ts` | Connected, dashboard dormant |
| **Xero** | Sales invoice/credit-note push, supplier/cash reads | `lib/xero.ts` (335 LOC) | Built, credential-gated |
| **TrueLayer (open banking)** | Live bank feed for cashflow | `lib/truelayer.ts` | Built, credential-gated |
| **Twilio** | SMS reminders/review requests | `lib/sms.ts` | Built, falls back to no-op |
| **Upstash Redis** | Rate limiting (Postgres fallback) | `lib/rate-limit.ts` | Live |
| **Cloudflare Turnstile** | CAPTCHA on auth | security guard | Live |
| **Sentry** | Error monitoring | `sentry.*.config.ts`, `instrumentation*` | Live |
| **GitHub** | Build-board ↔ issue bridge | `lib/github-app.ts`, `app/admin/build` | Live |
| **DeepL / Google Translate** | Auto-translate CRM/site content | `lib/translate.ts` | Optional, credential-gated |
| **Headless WordPress** | Optional editable content import | `lib/blog.ts` | Optional |
| **web-push (VAPID)** | Staff browser push | `lib/push.ts`, `PushSubscription` | Live |

Design pattern across all optional integrations: **inert-until-credentialed** — buttons/flows render disabled and the feature degrades gracefully if env vars are absent (`docs/INTEGRATIONS.md`). 25+ integrations total; ~10 live-core, the rest built-and-gated or partial.

---

## 4. Valuation inputs

### 4.1 Hard metrics

| Input | Value |
| --- | --- |
| Total application LOC | ~110,000 (98,608 TS/TSX in app+components+lib+hooks; +11,252 scripts) |
| Prisma models / enums | 128 / 51 |
| API routes | 225 |
| Admin pages | 98 · Marketing pages 51 · Account 13 · Academy 19 |
| UI components | 306 `.tsx` across 35 domains |
| Business-logic modules | 178 `.ts` in `lib/` (largest: `lib/build-backlog.ts` 1,525; `lib/build-board.ts` 1,149; `lib/email.ts` 924; `lib/treatments.ts` 852) |
| Cron jobs | `daily`, `dispatch`, `kiosk-cleanup` (`app/api/cron`) |
| Standing audit reports | 10 area reports + summary in `audit/` (127 findings) |

### 4.2 Prisma models by domain (128 total)

| Domain | Models | Examples |
| --- | --- | --- |
| Booking & scheduling | ~15 | `Booking`, `BookingItem`, `AppointmentSession`, `Appointment`, `Resource`, `RoomPrep`, `RoomClosure`, `Location`, `StaffSchedule`, `StaffTimeOff`, `ClinicClosure`, `WaitlistEntry`, `DayClose` |
| CRM / clients / loyalty | ~14 | `Client`, `Consultation`, `ConsultationNote`, `Interaction`, `ClientPoints`, `Referral`, `MembershipTier`, `DiscountClaim`, `Supplier`, `CallRecord`, `NpsResponse`, `Review`, `GoogleReview` |
| Clinical & consent | ~8 | `HealthAssessment`, `QuestionnaireVersion`, `FormQuestion`, `TreatmentSop`, `ConsentTemplate`, `ConsentRequest`, `SignedConsent`, `BeforePhoto` |
| Payments / finance | ~6 | `CashflowEntry`, `CashReserve`, `Order`, `OrderItem`, `GiftVoucher`, `PromoCode`/`PromoRedemption` |
| Catalogue / commerce | ~6 | `Service`, `ServiceVariant`, `ServiceOffer`, `Product`, `StockItem`, `StockMovement` |
| Marketing / CRM-comms | ~13 | `MarketingCampaign`, `Campaign`, `EmailEvent`, `EmailLinkClick`, `EmailTemplate`, `Segment`, `AbTest`/`AbVariant`, `ReplaySession`/`ReplayChunk`, `HeatmapEvent`, `QrCode`/`QrScan`, `Redirect`, `PageSeo` |
| Academy / LMS | 22 | `AcademyStudent`, `Course`, `CourseModule`, `Lesson`, `Quiz`, `QuizQuestion`, `LessonProgress`, `QuizAttempt`, `HomeworkSubmission`, `ExamQuestion`, `PastPaper`, `PracticeAttempt`, `PointEvent`, `StudentBadge`, `DailyActivity`, `LiveClass`, `Cohort`, `Enrolment`, `FundingApplication`, `Vacancy`, `JobApplication`, `StudentPasskey` |
| Staff / team / gamification | ~9 | `AdminUser`, `WebAuthnCredential`, `TimeEntry`, `StaffPoints`, `Reward`, `RewardRedemption`, `Contractor`, `ContractorVisit`, `ContractorTask`, `FacilityDoc` |
| AI features | ~5 | `AiAnalysis`, `AiAnalysisImage`, `KioskSession`, `KioskResult`, `KioskEvent` |
| CMS / content | ~9 | `Page`, `GlobalSection`, `PageRevision`, `TreatmentContent`, `MediaAsset`, `SiteConfig`, `SiteConfigRevision`, `Post`, `GalleryItem` |
| Platform / ops / audit | ~12 | `Tenant`, `Setting`, `ManagedSecret`, `ExternalConnection`, `AuditEvent`, `SecurityEvent`, `Device`, `MaintenanceWindow`, `StaffNotification`, `PushSubscription`, `ChatConversation`/`ChatMessage` |
| Build/work tracking | ~5 | `BuildItem`, `BuildProject`, `BuildDependency`, `BuildSubtask`, `BuildEvent`, `Task`, `FollowUp` |

### 4.3 Notable proprietary IP

1. **AI kiosk skin/smile analysis pipeline** (`lib/kiosk-ai.ts`, `lib/kiosk-live.ts`, `app/kiosk`): proprietary prompts, Haiku→Sonnet confidence escalation, age backstop, bounding-box annotations with confidence gating, deliberately non-clinical/body-positive tone, ephemeral-photo privacy model, phone↔display live-session state machine. Budget-engineered (2–4p/session).
2. **AI "Get My Plan" consultation** (`lib/ai-consultation.ts`): account-gated photo analysis → treatment plan **bound to the live priced catalogue** (every recommendation is a real, margin-positive item), findings **encrypted** (special-category), monthly cap, confidence-based escalation.
3. **Native LMS + certificates + exam bank** (academy domain, 22 models): authored micro-lesson player, gamification (XP/badges/streaks/leaderboard), homework review, VTCT/Ofqual exam practice, government-funding eligibility engine.
4. **First-party deferred-charge booking engine** (`lib/availability.ts`, `lib/booking-actions.ts`): SetupIntent-hold model, multi-resource availability (clinician/room/equipment/buffer/closure/multi-location), waitlist, BNPL course pre-pay — independent of Treatwell/Fresha.
5. **Multi-tenant platform seam** (`lib/tenant.ts`, `lib/tenant-scope.ts`, `prisma/platform-migrations/`): central tenant query-scoping with a CI isolation guard; the credible, partly-shipped path to a SaaS product.
6. **Build/task board with stable refs** (`lib/task-refs.ts`, `lib/build-board.ts`, `lib/build-backlog.ts`): immutable `TSK-`/`BLD-`/`PRJ-` reference scheme with dot-nesting, race-free allocation via Postgres sequences, self-healing dedupe, GitHub bridge — end-to-end traceability from idea → commit → audit.
7. **Clinical-data encryption keyring** (`lib/crypto.ts`, `lib/clinical-crypto.ts`): AES-256-GCM + HMAC-SHA256, versioned keyring with rotation, per-record IVs, legacy-plaintext-tolerant decrypt.
8. **Brand/design system** (`components/brand`, `app/globals.css` `@theme`, `docs/BRAND_GUIDELINES.md`): enforced palette, Fraunces/Geist type, monogram marks rendered (never typeset), checked in every audit; server-rendered OG image factory.
9. **Real-time operations layer**: live appointment session + room-display + client-phone companion, room-prep board, session replay + heatmaps, day-close reconciliation.

### 4.4 Engineering-quality notes (qualitative)

- **Typed end-to-end:** TypeScript throughout; `npx tsc --noEmit` is a hard commit gate (CLAUDE.md). CI isolation/backlog-quote tests gate builds.
- **Security posture (per `audit/SUMMARY.md`, 127 findings):** the **API/auth surface reviewed strongly** — of 33 mutation/ID routes deep-read, 0 lacked required auth; no raw SQL anywhere (SQLi surface nil); no mass-assignment. Payment core server-authoritative with verified Stripe webhook signatures and atomic idempotency. Crypto core (AES-256-GCM keyring, CSPRNG, no committed secrets) is sound. Full security-header set present. The 3 criticals (booking race, GDPR-erasure completeness, plaintext health columns) are **remediated** (erasure and clinical-encryption fixes landed 2026-06-12). Residual risk concentrates in HTML-sanitisation coverage and a few concurrency races — coverage gaps, not design flaws.
- **Defensive deploy discipline:** non-destructive `prisma db push` gate (`scripts/db-sync.mjs`), no `@unique` on existing tables (structural uniqueness instead), additive-only schema, expand/contract for the platform track.
- **Standing audit suite:** `audit/` holds 10 area reports (auth, payments, API, data, AI, PII/GDPR, secrets, XSS, email, deps/perf) + booking-flow assessment — an unusually mature self-audit for a clinic platform, fed into the `BLD-` triage queue.
- **Observability & QA:** Sentry, Speed Insights, a Playwright visual-QA harness (`scripts/visual-qa.mjs`), a live healthcheck (`scripts/healthcheck.mjs`), and a token-authed build queue.

---

## 5. Maturity summary table

| Product | Maturity | Notable strength | Gap |
| --- | --- | --- | --- |
| Marketing site | Shipped | 51 pages, ISR live-pricing, full SEO/structured-data, server OG factory | `force-dynamic` negates cache on some pages (perf, audit area 10) |
| Booking engine | Shipped | Deferred-charge SetupIntent model, multi-resource availability, waitlist, BNPL | Slot-allocation race C1 (fix = serializable txn) |
| Client portal | Shipped | Logged-in loyalty/health/invoices hub competitors lack; GDPR self-export | Broader Art. 17 sweep on ancillary models |
| Admin CRM | Shipped | 98 pages, role-shaped dashboards, real-time ops board, PIN-gated finance | Some integrations credential-gated, not yet connected |
| Academy LMS | Shipped | Native LMS + gamification + VTCT exam bank + funding engine; tenant-ready | Government-funding routes (loans/ASF) operational, not enrolled yet |
| AI Kiosk | Partial | Claude Haiku/Sonnet pipeline, privacy-first ephemeral photos, annotations | v2 live-session in build (PRJ-1); Sonnet path partial |
| E-commerce / POS | Shipped | Storefront + card-terminal POS + gift cards + collect/ship | Gift-card double-spend race (audit area 02) |
| Contractor portal | Shipped | Privilege-isolated public check-in; strict data scoping | Feature-flag-gated; narrow scope by design |
| Kiosk/room/live surfaces | Shipped | Token-secured hardware + client touchpoints (live, room-display, sign, NPS, review) | — |
| **ClinicOS (platform)** | Partial / Planned | Academy tenant-scoping seam shipped + CI-guarded, `tenantId` NOT NULL, per-tenant uniques | RLS DB backstop authored-not-applied; service extraction + onboarding not started |
| Marketing API loop | Partial | Spend sync + pixels + CAPI Purchase + attribution live | Full-funnel CAPI, Ads offline upload, audience sync dormant |
| Notifications hub | Partial | Foundation shipped (category/priority/prefs/push) | Full matrix wiring + web-push rollout in progress |
| Compliance (SaaS) | Planned (M0 done) | ICO-registered, encryption, GDPR erasure/export shipped | DPA, per-tenant isolation/keys, Cyber Essentials, pen-test pending |
| Mobile (native apps) | Not planned in code | PWA + passkeys + chromeless phone surfaces cover mobile | No native iOS/Android codebase |

---

*Prepared read-only. Models/route/page counts verified by direct file inspection on 2026-06-18. AI model IDs verified in `lib/*.ts`. ClinicOS ring status verified against `docs/PLATFORM_SAAS_PLAN.md` v0.4 and `lib/tenant.ts`/`lib/tenant-scope.ts`.*
