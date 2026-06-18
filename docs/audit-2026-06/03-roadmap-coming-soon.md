# Roadmap & "Coming Soon" — what K Clinics has built, is building, and plans

> Audit 2026-06-18. Read-only review of the codebase, the standing planning docs,
> and the live Build board (`GET /api/build/queue`). Purpose: feed a product
> roadmap and "coming soon" marketing. British English; no dates we can't commit
> to. Every claim is cited to a file, doc, flag or board ref.

## How to read this

Three sources were cross-checked, because the public `/roadmap` page is badly out
of step with reality:

1. **The live Build board** (`/api/build/queue`, 2026-06-18): 23 actionable items,
   0 blocked, **415 awaiting sign-off** (shipped work the owner hasn't formally
   closed). The huge sign-off pile means most of the platform is *built*, not
   pending — the roadmap's "now" tier is largely a question of finishing, polishing
   and licensing, not first-build.
2. **The seeded backlog** `lib/build-backlog.ts` (1,526 lines) — the canonical
   record of shipped + planned work, with PR links and decision notes.
3. **The planning docs** — `docs/PLATFORM_SAAS_PLAN.md` (ClinicOS, v0.3),
   `docs/COMPLIANCE_ROADMAP.md`, `docs/MARKETING_API_ROADMAP.md`,
   `docs/ACADEMY_FUNDING_STRATEGY.md`, and `docs/projects/*`.

Board theme summary (so we don't dump raw): the 23 actionable items split into
(a) **admin UX polish** (BLD-226 dashboard/UX overhaul, in progress — accessibility
contrast, tabular figures, motion), (b) **clinic operations gaps reported by staff**
(BLD-479 in-session photo upload, BLD-480 editable treatments + auto-duration,
BLD-484 academy cohort management, BLD-482 onboarding-email send failure), (c) the
**Skin & Smile QR kiosk** campaign (mostly shipped, two owner-gated pieces left),
(d) **ClinicOS multi-tenancy hardening** (BLD-302/304 — Academy JWT secret split,
data-protection pack), and (e) **standing programmes** (BLD-311 academy content
authoring). Recent comments are dominated by the autonomous build routine reporting
shipped slices and asking the owner to steer subjective polish.

---

## 1. Now / Next / Later roadmap

### NOW — built and live, or shipping this cycle (finish, polish, switch on)

| Item | One-line | Maturity evidence | Sequencing |
|---|---|---|---|
| **Online booking + deposits + card-on-file** | Public booking funnel with slot hold, Stripe SetupIntent, SCA recovery, phone-booking flow for staff | Core product; `components/booking/BookingFlow.tsx`, phone flow shipped PR #383 (backlog) | Live |
| **Encrypted CRM + clinical records** | Clients, consultations, before-photos, consent e-sign, encrypted special-category data | `lib/clinical-crypto.ts`; COMPLIANCE_ROADMAP M0 "essentially done"; erasure + at-rest encryption closed 12 Jun | Live |
| **Skin & Smile storefront QR kiosk** | Scan a QR → AI skin/smile rating → shareable card → create account → claim a 15% share-to-claim discount | 5 of 7 subtasks SHIPPED (PR #449); `lib/kiosk-ai.ts`, `/kiosk/*`. Remaining 2 owner-gated (PRJ-1.14, BLD-137) | Now — finish |
| **Admin UX / accessibility overhaul** | Award-standard admin: AA contrast, tabular figures, tasteful motion, layout polish | BLD-226 IN_PROGRESS (board); WCAG AA pass `docs/projects/accessibility-aa.md` S3–S5 shipped | Now — in progress |
| **Role-based dashboards (My Day)** | Each user type lands on a job-shaped dashboard; owner can switch views | Components shipped: `ClinicianView.tsx`, `DeveloperView.tsx`, `ReceptionistView.tsx`, `ContractorTasks.tsx`, `ClockInOut.tsx`, `rooms/ArrivalsBoard.tsx`; spec `docs/projects/role-based-views.md` | Now — late stage |
| **K Academy (LMS) + funding capture** | Courses, lessons, quizzes, certificates, live classes; public `/academy/funding` eligibility self-check + application pipeline | `lib/academy-content.ts`; funding page + `FundingApplication` model (PR #825 / BLD-343); `docs/ACADEMY_FUNDING_STRATEGY.md` | Live; content growing (BLD-311 standing task) |
| **Gift cards studio (digital + physical)** | Design a gift card, guest checkout, scheduled delivery, optional posted physical card | Gifts epic all SHIPPED (PRs #365–#395) | Live |
| **AI features (3 live)** | "Get My Plan" AI consultation (K Vision), live-chat AI agent, AI marketing copy generator | `lib/ai-consultation.ts`, `lib/chat-ai.ts`, `lib/ai-marketing.ts` (Claude Haiku, owner-reviewed) | Live |
| **Membership / loyalty** | Membership tiers, points, rewards, referrals | `app/(marketing)/membership/page.tsx`, `app/admin/membership/page.tsx`; rewards/loyalty managers | Live |
| **Finance controls + Xero (read + write)** | Refund window, VAT config, profitability-by-service, finance step-up (passkey/PIN); push sales+refunds to Xero | VAT PRs #384/#390; finance unlock #372/#394; Xero sales push PR #491 (OFF until account codes set) | Live; Xero write owner-gated |
| **BNPL for academy courses** | Staff issue a Klarna/Clearpay hosted-checkout link for the full course fee | `components/admin/BnplPaymentButton.tsx` (BLD-399/409) | Live |
| **Build board + public roadmap engine** | Kanban, GitHub bridge, dependencies, projects, ref scheme, autonomous build routine, `/roadmap` page | `lib/build-board.ts`, `lib/build-backlog.ts`, `app/(marketing)/roadmap/page.tsx` | Live |
| **System status / health page** | Traffic-light health across DB, security, integrations, cron, bounded contexts | `lib/platform-status.ts`; PR #339 | Live |

### NEXT — actively building or queued, near-term

| Item | One-line | Maturity evidence | Sequencing |
|---|---|---|---|
| **ClinicOS Academy tenancy (Ring 1)** | Make the Academy module truly multi-tenant: per-tenant uniqueness, `tenantId NOT NULL`, RLS database backstop | Rings 0.1, 0.2, 1a, 1b, 1c **merged**; Ring 1d (RLS) in progress — `prisma/platform-migrations/ring1/README.md`, `RLS_ROLLOUT.md`; `ACADEMY_RLS` flag (OFF), `lib/tenant.ts`, `lib/tenant-tx.ts` | Building now; RLS needs Neon-branch enable + owner role provisioning |
| **In-session photo capture** | Take/upload photos inside the Live Appointment Session without leaving the workflow | BLD-479 (board, TRIAGE, staff-reported) | Next |
| **Editable treatments + auto-duration** | Remove a mistakenly-added treatment; auto-extend appointment time when a treatment is added | BLD-480 (board, TRIAGE) | Next |
| **Academy cohort management** | Create/manage student intakes; date-gated and scheduled lesson release per cohort | BLD-484 (board, TRIAGE); `Cohort`/`Enrolment` models exist | Next |
| **Academy portal security parity** | Session revocation, password reset, middleware gate, GDPR erasure for trainees (match the client portal) | `docs/projects/academy-portal-parity.md`, BLD-314 (planning) | Next |
| **Marketing conversion feedback loop** | Feed full-funnel events back to ad platforms so bidding optimises on booking *value* | `docs/MARKETING_API_ROADMAP.md` Tier 1: Meta CAPI full-funnel (S–M), Google Ads offline value (needs `Booking.gclid`) | Next — best ROI |
| **In-dashboard bookkeeping + MTD** | Run day-to-day books (payroll, supplier bills, receipt capture, MTD VAT) from admin via Xero | Backlog TRIAGE, owner-gated (`needs: OWNER`), V:E 9/10; builds on the shipped Xero push | Next — phased, large |
| **Kiosk v2.1** | Seasonal scene theming + multi-location sessions (per-site QR attribution) | BLD-137 IN_PROGRESS (board), owner approved both halves 12 Jun | Next |
| **Data-protection pack (processor readiness)** | DPA/MSA templates, ROPA, DPIA, sub-processor register, Cyber Essentials — the legal gate before licensing to any other clinic | BLD-304 IN_REVIEW (draft PR #1084, 7 docs under `docs/data-protection/`); `docs/COMPLIANCE_ROADMAP.md` M1 | Next — gates external tenants |

### LATER — planned, owner sign-off pending, or strategic

| Item | One-line | Maturity evidence | Sequencing |
|---|---|---|---|
| **ClinicOS full multi-tenant SaaS** | License the whole platform to other clinics; K Clinics is tenant #1; named brand + white-label tier | `docs/PLATFORM_SAAS_PLAN.md` v0.3; programme epic + Phases 0–6 in backlog (all TRIAGE, gated on "final sign-off" BLD task, BLOCKED needs OWNER). 9–15 month programme | Later — phased after sign-off |
| **Marketing audience sync** | Push first-party segments to Meta as Custom + Lookalike Audiences | MARKETING_API_ROADMAP Tier 2; needs Meta `ads_management` scope + App Review | Later |
| **Unified cross-channel reporting** | Pull GA4 Data API + Search Console into the Performance dashboard (ROAS, organic-vs-paid) | MARKETING_API_ROADMAP Tiers 3 (scopes already granted, unused) | Later |
| **Cosmetic dentistry launch** | New dentistry suite (veneers, whitening, implants); SEO-indexed waiting list live now | `app/(marketing)/dentistry/page.tsx` (`site.dentistryLive` flag = off; "coming soon" waiting list live) | Later — flag flip on launch |
| **Session voice recording + transcription** | Consent-gated audio recording of consultations, transcribed into the clinical record | `docs/projects/session-voice-recording.md` (BLD-142, design-first; no code until DPIA + processor + consent signed off) | Later — compliance-gated |
| **Academy government funding** | Advanced Learner Loans (L3/L4), Adult Skills Fund, Islington partnership, Lifelong Learning Entitlement (2027) | `docs/ACADEMY_FUNDING_STRATEGY.md`; site presents gov routes as "register interest" until approved (`lib/funding.ts`) | Later — 6–12 month approval runway |
| **Franchise / multi-clinic model** | Franchise enquiry pipeline live; ties to ClinicOS white-label | `components/franchise/FranchiseEnquiryForm.tsx` (lead capture into CRM) | Later |
| **Certifications ladder** | Cyber Essentials → NHS DSPT → ISO 27001 → SOC 2 Type II as sellable trust signals | COMPLIANCE_ROADMAP M1–M3 + Deferred; SaaS backlog task (TRIAGE) | Later — triggered by tenant demand |
| **SaaS pricing tiers** | Solo / Clinic / Chain / Enterprise + usage metering, set after COGS modelling | Backlog BLOCKED, `needs: OWNER`; ADR-012 (deferred deliberately) | Later |

---

## 2. Flagship in-progress products (deep-dive)

### 2a. ClinicOS — multi-tenant SaaS / white-label clinic platform

**The bet.** Productise the K Clinics monolith into a modular, multi-tenant SaaS
that K Clinics runs for itself (tenant #1) and licenses to other aesthetic/skin/
dental clinics. Positioned against Pabau, Phorest, Fresha, Zenoti, Aesthetics Pro
on UX, security (encrypted clinical data, passkeys, audit, tenant isolation) and
breadth. Canonical plan: `docs/PLATFORM_SAAS_PLAN.md` v0.3.

**Maturity — further along than the planning doc implies.** The plan reads as
"planning only, nothing executed without sign-off", but the tenancy *foundation*
has quietly shipped for the Academy module (the chosen first extraction, ADR-014):

- `Tenant` model + tenant resolver live — `lib/tenant.ts` (K Clinics = default
  tenant `kclinics`; single-tenant fast path keeps the live site byte-for-byte
  unchanged).
- Central query-scoping extension + CI cross-tenant isolation guard — Ring 0.2
  (BLD-300), **merged**.
- Migrations regime flipped on (versioned migrations, ADR-004) — Ring 1a, **merged**.
- Per-tenant uniqueness on Academy tables (`@@unique([tenantId, email/slug])`,
  global uniques dropped) — Ring 1b, **merged**
  (`prisma/migrations/20260617180000_academy_per_tenant_uniques/`).
- `tenantId NOT NULL` on Academy tables, self-backfilling — Ring 1c, **merged**
  (`prisma/migrations/20260617190000_academy_tenant_not_null/`).
- RLS database backstop — Ring 1d, **in progress**: policy SQL written
  (`0002_academy_rls.sql`), rehearsal harness passing on PG16, GUC plumbing shipped
  behind `ACADEMY_RLS` flag (OFF — prod no-op), live two-tenant isolation suite
  authored and validated, production cutover runbook dress-rehearsed.
- `lib/platform-status.ts` is already compartmentalised along the ClinicOS bounded
  contexts, so the status page maps onto the future per-cluster view.

**What remains.**
- *Ring 1d RLS to production*: enable RLS on a Neon branch, run the live isolation
  suite against it, confirm the role Accelerate connects as (must be non-owner /
  non-`BYPASSRLS`), then a flag-first prod cutover with a PITR snapshot. Needs a
  branch DB + owner role decisions (`RLS_ROLLOUT.md` step 3–5).
- *Per-tenant secrets / Stripe / encryption keys*: today `ManagedSecret` is one
  global row per key, one Stripe account, one `HEALTH_ENCRYPTION_KEY`
  (PLATFORM_SAAS_PLAN R14/R15/R18) — all must become tenant-scoped before tenant #2.
- *The legal gate (M1)*: DPA/MSA, ROPA, DPIA, sub-processor register, Cyber
  Essentials, insurance — in review now (BLD-304, draft PR #1084).
- *The rest of the programme*: Phases 0–6 (monorepo → K8s/GKE → tenancy → service
  extraction → cutover → commercial launch) are all TRIAGE and **gated on owner
  sign-off** of the plan (BLOCKED task, `needs: OWNER`). A 9–15 month programme,
  bootstrapped, Phase-0 value first.

**Verdict:** the *Academy-as-a-tenant* slice is near production-ready as a proof;
the full platform is a real, sequenced, owner-gated programme. White-label is a
confirmed product decision (ADR-009: named brand + white-label tier).

### 2b. Mobile apps

- **K Academy installable app (PWA):** live. `public/academy.webmanifest` +
  `public/academy-sw.js` (a deliberately transparent service worker — installable,
  no HTML caching yet; offline shell "can be layered on later"). This is the only
  app-shaped surface. **No native iOS/Android app, no React Native/Capacitor/Expo**
  anywhere in the repo.
- **Admin / Client mobile:** handled as responsive web, not separate apps. The
  admin has a dedicated mobile nav drawer (backlog: "Mobile admin nav" PR #303);
  role-based views are explicitly "mobile-first" for front-of-house/contractors on
  phones (`docs/projects/role-based-views.md` §8). No standalone client app.

**Verdict:** "mobile app" today = the installable Academy PWA. Anything more is not
planned in the codebase. *Do not tease a native app.*

### 2c. Marketing automation suite

- **Live:** Google/Meta/TikTok OAuth + token refresh, daily ad-spend sync,
  GA4/Meta/Google-Ads browser pixels, server-side GA4 purchase+refund and Meta CAPI
  *Purchase*, first-touch attribution → ROI, rule-based audience segments (sized),
  abandoned-booking + no-show recovery emails (default-OFF toggles), AI marketing
  copy generator (`lib/ai-marketing.ts`), live-chat AI agent, NPS/reviews,
  Google Business reviews. Evidence: `docs/MARKETING_API_ROADMAP.md` "what's already
  live" table.
- **In flight / next:** close the conversion feedback loop — Meta CAPI full-funnel
  (Lead/InitiateCheckout/Schedule), Google Ads offline value upload (needs a
  `Booking.gclid` capture). Then audience sync to Meta (Custom + Lookalike, needs
  `ads_management` scope + App Review), then GA4 Data API + Search Console into the
  Performance dashboard.

**Verdict:** the *plumbing* is largely built; the next wins are activating dormant
scopes and pushing data back out. Best-ROI item is Meta CAPI full-funnel.

### 2d. AI features

Three Claude-powered features are live, all cost-minimal (Haiku by default), all
owner-reviewed, none giving medical advice:

- **"Get My Plan" AI consultation (K Vision)** — `lib/ai-consultation.ts`. Photo →
  a phased, dated, in-budget treatment plan bound to the real priced catalogue
  (always bookable, margin-positive). Escalates to Sonnet only on low confidence.
- **Kiosk Skin & Smile AI rating** — `lib/kiosk-ai.ts`. The storefront campaign's
  friendly, non-clinical skin/smile score (reuses the K Vision pattern). Explicitly
  on the safe side of the medical-device line (COMPLIANCE_ROADMAP "deferred / MHRA").
- **Live-chat AI agent** — `lib/chat-ai.ts`. Answers visitor questions grounded in
  catalogue/prices/hours; hands to a human on anything clinical or complex.
- **AI marketing copy** — `lib/ai-marketing.ts`. Generates on-brand email/ad/
  landing/SEO copy from a brief; never auto-publishes or spends.

**What remains / guardrail:** AI features stay non-diagnostic by design. Any feature
that *interprets clinical data and recommends treatment* triggers an MHRA/UKCA
regulatory check before shipping (COMPLIANCE_ROADMAP rule). The voice-recording
transcription feature (2.d-adjacent) is design-only until a DPIA + processor choice
are signed off.

---

## 3. "Coming soon" marketing candidates (curated, public-safe)

Each is genuinely real, low-jargon, and carries no date we can't commit to. Tease
freely; the internal references are for our tracking only.

1. **AI skin & smile scan** — "Snap a photo and get your personalised skin and smile
   score in seconds — then a treatment plan built around your goals and budget."
   *(K Vision + kiosk AI; live/near-live.)*
2. **Storefront Skin & Smile kiosk** — "Walk past, scan, and discover your glow —
   share your result for an exclusive welcome offer." *(Kiosk campaign; finishing.)*
3. **Cosmetic dentistry, coming to KClinics** — "Veneers, whitening, bonding and
   implants — to the same meticulous standard as the rest of KClinics. Join the
   waiting list to be first in the chair." *(Already framed exactly this way on
   `/dentistry`.)*
4. **Design-your-own gift cards** — "Create a beautiful, personalised KClinics gift
   card — choose the design, message and delivery date. Now available as a posted
   physical card too." *(Live; great evergreen tease.)*
5. **K Academy — train with us, fund it flexibly** — "Accredited aesthetics training
   with monthly payment options, and government-funded routes on the way. Check your
   eligibility online." *(Funding self-check live; gov routes "register interest".)*
6. **Membership & rewards** — "Earn points on every visit and unlock member-only
   pricing and perks." *(Live.)*
7. **Smarter, faster booking** — "Book online in under a minute, save your card
   securely, and get gentle reminders — no phone tag." *(Live.)*
8. **Live help, instantly** — "Ask anything about treatments, prices or availability
   and get an answer straight away — with our team a tap away when you need them."
   *(Chat AI; live.)*

**Hold back from public teasing (internal/owner-gated or unbuilt):**
- ClinicOS / "platform for other clinics" / white-label / franchise — B2B, sign-off
  pending; not consumer marketing.
- Any "app" beyond the Academy PWA — no native app exists or is planned.
- Voice recording of consultations — compliance-gated, design only.
- Government funding as "available" — legally must stay "register interest" until
  each ESFA/GLA approval lands (ACADEMY_FUNDING_STRATEGY §11 honesty rule).
- Specific dentistry open dates, BNPL "buy now pay later" framed as consumer credit,
  or VAT/pricing claims that depend on registration not yet held.

---

## 4. Current public roadmap (`/roadmap`) gaps

`app/(marketing)/roadmap/page.tsx` renders only Build board items flagged
`isPublic = true` (`listPublicItems()` in `lib/build-board.ts`), split into "Coming
soon" (non-shipped) and "What's new" (shipped). The mechanism works, but:

1. **It's almost certainly near-empty.** Of ~415 awaiting-sign-off items and 23
   actionable, only items an admin manually toggled `isPublic` appear. Nothing in
   the audit suggests a curated public set exists — so the live page likely shows a
   thin or stale list ("Nothing public yet" is a coded fallback). The biggest gap is
   **curation**: the genuinely compelling, shipped, consumer-facing wins
   (gift-card studio, AI consultation, membership, faster booking, kiosk) are not
   surfaced because no one flagged them public.
2. **It mixes engineering noise with consumer value.** The board is full of internal
   items (CSP fixes, SSE refactors, Turbopack deploy bugs, tabular-figure sweeps).
   The public page has no filter to keep these out beyond the manual `isPublic`
   toggle — so curation must be deliberate, or the roadmap reads as a dev changelog.
3. **It omits the headline strategic stories** that *are* safe to tease: cosmetic
   dentistry (already has a polished `/dentistry` coming-soon page that the roadmap
   doesn't reference), the Skin & Smile kiosk, the Academy + funding, membership.
   These live elsewhere on the site but aren't on the roadmap.
4. **No mention of ClinicOS, franchise, or B2B** — correct for a *consumer* roadmap,
   but there's no B2B/"for clinics" surface anywhere, despite white-label being a
   confirmed product direction (ADR-009) and a live `FranchiseEnquiryForm`. If the
   owner wants to start warming B2B demand, that's a missing page, not a roadmap gap.
5. **ETA display risk.** The page shows `estCompleteAt` as "ETA Mon YYYY" when set.
   For consumer trust, only set ETAs we can hit — most "coming soon" items above
   should ship dateless.

**Recommended fix (no code in this audit):** curate ~6–8 consumer-facing shipped/
near-shipped items, set `isPublic = true` on them with friendly titles/detail, leave
ETAs blank, and link the `/dentistry` and kiosk stories in. That turns the roadmap
from an empty/dev-flavoured page into the "coming soon" marketing asset it's built to be.

---

## Sources

- Live board: `GET https://kclinics.co.uk/api/build/queue` (2026-06-18) — 23
  actionable, 0 blocked, 415 awaiting sign-off.
- `lib/build-backlog.ts`, `lib/build-board.ts`, `app/(marketing)/roadmap/page.tsx`
- `docs/PLATFORM_SAAS_PLAN.md` (v0.3), `docs/COMPLIANCE_ROADMAP.md`,
  `docs/MARKETING_API_ROADMAP.md`, `docs/ACADEMY_FUNDING_STRATEGY.md`
- `docs/projects/role-based-views.md`, `academy-portal-parity.md`,
  `session-voice-recording.md`, `accessibility-aa.md`
- ClinicOS tenancy code: `lib/tenant.ts`, `lib/tenant-tx.ts`, `lib/platform-status.ts`,
  `prisma/platform-migrations/ring1/*` (README, RLS_ROLLOUT, RLS_PROD_CUTOVER, 0002_academy_rls.sql),
  `prisma/migrations/20260617180000_academy_per_tenant_uniques/`,
  `prisma/migrations/20260617190000_academy_tenant_not_null/`
- AI: `lib/ai-consultation.ts`, `lib/kiosk-ai.ts`, `lib/chat-ai.ts`, `lib/ai-marketing.ts`
- Mobile: `public/academy.webmanifest`, `public/academy-sw.js`
- Other: `components/admin/BnplPaymentButton.tsx`, `app/(marketing)/dentistry/page.tsx`,
  `components/franchise/FranchiseEnquiryForm.tsx`, `app/(marketing)/membership/page.tsx`
