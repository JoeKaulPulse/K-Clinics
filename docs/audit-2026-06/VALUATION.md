# K-Clinics — Codebase & IP valuation (indicative)

**Date:** 2026-06-18 · **Prepared by:** Claude Code · **For:** Joe Kaul
**Scope (as requested):** the value of **what has been built — the codebase and intellectual property — “as is.”** This deliberately **excludes** the operating clinic business: trading revenue/EBITDA, the client base, brand goodwill, the physical premises, staff, and regulatory licences. Those would raise an enterprise valuation materially above the figures here.

> This is an **indicative, methodology-based estimate** to support internal planning and conversations — not a formal/audited valuation or fairness opinion. Figures are ranges with stated assumptions.

---

## 1. What is being valued

A single, production, end-to-end-typed Next.js 16 / Prisma 7 platform (verified metrics, `docs/audit-2026-06/01-product-ip-inventory.md`):

| Asset | Measure |
| --- | --- |
| Application code | **~110,000 LOC** TypeScript/TSX (+11k scripts) |
| Data model | **128 Prisma models**, 51 enums (3,526-line schema) |
| API surface | **225 API routes** |
| Admin CRM | **98 pages** |
| Public site | **51 marketing pages** |
| Live customer-facing surfaces | **9** (marketing, booking, client portal, admin CRM, Academy LMS, AI kiosk, e-commerce/POS, contractor portal, in-clinic/live surfaces) |
| Integrations | **25+** (Stripe, Klarna/Clearpay, Resend, Anthropic Claude, Google Workspace/Calendar/Business/Ads, Meta, TikTok, Xero, TrueLayer, Twilio, yay.com VoIP, …) |
| Standing self-audit | **10 area reports, 127 findings** (3 critical, all remediated) |
| Strategic optionality | **ClinicOS** multi-tenant SaaS seam — partly shipped |

Quality signals that protect the value: typed end-to-end with a hard `tsc` commit gate, CI tenant-isolation + backlog guards, AES-256-GCM clinical encryption, server-authoritative payments with verified Stripe webhooks, no raw SQL, full security-header set, and a mature standing audit suite.

---

## 2. Method 1 — Replacement / cost-to-rebuild (primary)

This asks: *what would it cost to rebuild this to the same standard?* It is the most defensible basis for a bespoke codebase asset.

**2a. Bottom-up (effort).** Productive, fully-loaded output for production SaaS (including design, review, test, PM, rework) is realistically **~25–45 finished LOC per engineer-day**. At ~110k LOC:

- 110,000 ÷ 35 ≈ **3,140 engineer-days ≈ ~14 engineer-years.**
- Blended UK senior cost **£550–£750/day** (contract) → **£1.73M–£2.36M**; or at **£110k–£140k** fully-loaded salary/year for 14 years-of-effort → **£1.5M–£2.0M**.

**2b. COCOMO II (sanity check).** Organic-mode effort ≈ 2.94 × KLOC^1.05 = 2.94 × 110^1.05 ≈ **~410 person-months** nominal. Modern framework/AI-assisted productivity multipliers pull the realistic figure well below nominal; applying a 0.45–0.6 adjustment → **~185–245 person-months ≈ 15–20 person-years**, consistent with 2a at the upper end.

**Replacement-cost range (codebase only): ~£1.5M – £2.4M.**
Note this *understates* value because it prices the typing-out of code, not the **design decisions, domain modelling and integration know-how** already solved.

---

## 3. Method 2 — Proprietary IP premium

Several components are genuine, defensible IP that a buyer could not simply commission cheaply because the hard part is the design, not the code volume:

| IP asset | Why it carries premium |
| --- | --- |
| **AI skin/smile kiosk pipeline** | Tuned Claude prompts, Haiku→Sonnet confidence escalation, age backstop, bounding-box annotations, ephemeral-photo privacy model, phone↔display live-session state machine, cost-engineered to 2–4p/session |
| **Catalogue-bound AI consultation** | Recommendations bound to the live priced, margin-positive catalogue; findings encrypted (special-category) |
| **Native Academy LMS** | Lesson player, gamification, VTCT/Ofqual exam bank, government-funding eligibility engine, certificates — a product in its own right |
| **First-party deferred-charge booking engine** | SetupIntent-hold model + multi-resource availability; removes Treatwell/Fresha dependency and fees |
| **Multi-tenant platform seam (ClinicOS)** | Query-scoping + CI isolation guard + per-tenant uniqueness already shipped — a credible path to SaaS |
| **Clinical-data encryption keyring & audit suite** | AES-256-GCM versioned keyring; 10-report standing audit — compliance-grade foundations |

Indicative IP premium over raw replacement cost: **+15–35%**, reflecting that these are differentiated and partly de-risked (working in production).

**Methods 1+2 combined (codebase + IP, as-is): ~£1.8M – £3.2M.**

---

## 4. Method 3 — Strategic optionality (ClinicOS SaaS) — *upside, not booked value*

`docs/PLATFORM_SAAS_PLAN.md` lays out productising the monolith into **ClinicOS**, a multi-tenant SaaS for aesthetic/dental clinics (vs Pabau/Phorest/Fresha/Zenoti). The tenant-scoping seam is **partly shipped** (Rings 0–1c merged; RLS authored). Vertical clinic SaaS commands high revenue multiples (often 5–10× ARR for healthy growth). This is **real but speculative** option value contingent on extraction, compliance (CE→DSPT→ISO 27001), and a first external tenant — so it is **not** included in the as-is figure above. It is the reason the asset could be worth a multiple of its build cost if the SaaS path is executed.

---

## 5. Headline

| Basis | Indicative value |
| --- | --- |
| Replacement cost (code only) | **£1.5M – £2.4M** |
| + Proprietary IP premium (as-is asset) | **£1.8M – £3.2M** |
| ClinicOS SaaS optionality | Upside multiple — excluded from as-is; unlocked by extraction + first tenant |

**As-is codebase & IP: an indicative ~£1.8M–£3.2M**, with the midpoint (~£2.4M) the most reasonable single planning figure. The operating business, brand, clients and the SaaS option sit **on top** of this.

### What would move the number
- **Up:** ship ClinicOS to a first paying external tenant; complete compliance certifications (CE/DSPT/ISO); connect the dormant integrations; demonstrate ARR.
- **Down (risk discounts):** the open audit items (booking/gift-card concurrency races, HTML-sanitisation coverage), key-person/documentation dependency, and the marketing-site compliance exposures in `docs/audit-2026-06/02-marketing-content-compliance.md` (fix these and the discount disappears).

*Indicative only; not a formal valuation. Metrics verified by direct inspection on 2026-06-18.*
