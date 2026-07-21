# K-Clinics — Product Confluence & Roadmap

**Purpose:** the single map of everything we have built, are building, and plan to build — the basis for an internal product wiki ("confluence") and the source of truth for "coming soon" marketing. **Date:** 2026-06-18.

**Companion documents** (this is the index):
- `01-product-ip-inventory.md` — exhaustive surface-by-surface inventory + integrations + IP.
- `03-roadmap-coming-soon.md` — Now/Next/Later detail + public "coming soon" blurbs.
- `02-marketing-content-compliance.md` — how each product is (and isn't) marketed.
- `VALUATION.md` — codebase & IP valuation.
- `KClinics-Website-Audit-Ratings.pdf` — the website ratings report.

**Maturity legend:** 🟢 Shipped (live) · 🟡 Partial (core live, capabilities in build) · 🔵 In progress · ⚪ Planned.

---

## 1. Product map (the board)

| # | Product / surface | Status | One-liner | Marketed publicly? |
| --- | --- | --- | --- | --- |
| 1 | **Marketing website** | 🟢 | 51-page premium site, live CRM pricing, full SEO | n/a |
| 2 | **Booking engine** | 🟢 | First-party card-on-file booking (Stripe SetupIntent), multi-resource availability, waitlist | Yes (`/book`) |
| 3 | **Client portal** (`/account`) | 🟢 | Logged-in loyalty / health / invoices / rewards hub + GDPR self-export | Weak — login only |
| 4 | **Admin CRM** (`/admin`) | 🟢 | 98-page clinic operating system; role-shaped dashboards; real-time ops board | Internal |
| 5 | **K Academy LMS** | 🟢 | Native LMS: courses, lessons, quizzes, exam bank, gamification, certificates, **government funding** engine | **Under-marketed** (flat nav) |
| 6 | **AI Skin & Smile kiosk** | 🟡 | Storefront QR → guided selfie → Claude skin/smile score + plan + reward; v2 live-session in build | **Not marketed at all** |
| 7 | **AI consultation** ("Get My Plan") | 🟢 | Account-gated photo → plan bound to the live priced catalogue (encrypted findings) | Thin (`/ai-consultation`) |
| 8 | **E-commerce + POS** | 🟢 | Skincare storefront + in-clinic card terminal + gift cards | Partly (footer) |
| 9 | **Contractor portal** | 🟢 | Privilege-isolated on-site check-in (no client/clinical data) | Internal |
| 10 | **In-clinic / live surfaces** | 🟢 | Room displays, client phone companion, e-sign consent, NPS, review, QR | Internal |
| 11 | **Marketing automation suite** | 🟡 | Campaigns, attribution/ROI, A/B, audiences, session replay + heatmaps, ad-spend sync, CAPI Purchase | Internal |
| 12 | **ClinicOS** (multi-tenant SaaS) | 🔵 | Productise the platform for other clinics; white-label tier | Not yet |
| 13 | **Native mobile apps** | ⚪ | **Does not exist** — mobile = PWA + passkeys + chromeless phone surfaces. *Do not tease native apps.* | — |

---

## 2. Roadmap — Now / Next / Later

(Condensed from `03-roadmap-coming-soon.md`; cite that doc for evidence.)

**NOW — built/live or finishing:** online booking + card-on-file · encrypted CRM/clinical records · the Skin & Smile QR kiosk (5/7 shipped) · admin UX + WCAG-AA overhaul (BLD-226) · role-based "My Day" dashboards · K Academy LMS + funding · design-your-own gift cards · three live AI features · membership/loyalty · finance controls + Xero · BNPL for courses · the build/roadmap board · status page.

**NEXT — building/queued:** ClinicOS Academy multi-tenancy (Rings 0–1c merged; RLS Ring 1d behind `ACADEMY_RLS`) · in-session photo capture · editable treatments + auto-duration · academy cohort management · academy portal security parity · full-funnel Meta CAPI · in-dashboard bookkeeping/MTD via Xero · kiosk v2.1 (seasonal/multi-location) · the data-protection pack (the legal gate before licensing).

**LATER — planned / owner-gated:** full ClinicOS multi-tenant SaaS + white-label (7 phases, 9–15 months, **blocked on owner sign-off**) · marketing audience sync + unified reporting · cosmetic dentistry launch (waiting list live) · consent-gated voice recording/transcription · academy government funding go-live · franchise model · CE→DSPT→ISO 27001→SOC 2 ladder · SaaS pricing tiers.

---

## 3. "Coming soon" — consumer-safe marketing shortlist

Curated, jargon-free, **no dates we can't commit to**. These are the stories to tease on `/roadmap`, the homepage and email. (The public `/roadmap` is currently near-empty/stale — it only shows board items manually flagged `isPublic`; the fix is **curation, not code**.)

1. **AI Skin & Smile Scan** — snap a photo, get a personalised score and treatment plan in seconds.
2. **In-clinic Skin & Smile kiosk** — scan in store, discover your glow, share for a welcome offer.
3. **Cosmetic dentistry at KClinics** — join the waiting list (already framed on `/dentistry`).
4. **Design-your-own gift cards** — personalised, now with posted physical cards.
5. **K Academy with flexible funding** — accredited training, monthly finance, eligibility self-check.
6. **Membership & rewards**, **faster online booking**, **instant live help** — round out the list.

> Caveats from the research: ClinicOS is **further along than its planning doc** (tenancy foundation shipped; RLS cutover + legal pack remain) — but it is a **B2B** story, not consumer "coming soon." And again: **no native app** — market the installable Academy PWA as "add to home screen", never an "app store" app.

---

## 4. How to keep this board alive

- Treat this file + the three companion docs as the wiki seed. Each product links to its code surface and its build-board refs (`TSK/BLD/PRJ`).
- New work already carries a stable ref (`lib/task-refs.ts`); cite it here when a roadmap item moves Now→Next→Later.
- Public "coming soon" should be driven by curating `isPublic` board items (admin → build board), so marketing and engineering share one source.
