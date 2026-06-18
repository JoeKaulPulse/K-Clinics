# 02 · Marketing content & compliance audit

> **Scope:** the public marketing site under `app/(marketing)/` (≈50 routes), the
> nav/footer, SEO surfaces and the content-architecture split (code vs DB/CMS).
> Read-only. Live target: `https://kclinics.co.uk`. Date: 2026-06-18.
> **Question this answers:** does the business advertise everything it offers,
> accurately and compliantly?
>
> British English. This is a marketing/quality audit, not legal advice — the
> POM-advertising and financial-promotion flags must be confirmed by a
> CAP/ASA-literate adviser before relying on them.

## Headline

The site is well-built and content-rich on its core lines (treatments, pricing,
membership, reviews, gallery, journal). The **gaps are visibility, not absence**:
several substantial, fully-built products (Academy LMS, shop, BNPL, AI
consultation, gift vouchers, group/referral) exist but are under-surfaced in the
primary navigation. The owner's flag is correct in spirit but inverted in
detail: `/academy` is a **rich** page with per-course landing templates already
built — the problem is there is **no Academy dropdown and almost no internal
link path** to the funding/course pages, so the depth is invisible to users and
search engines.

The biggest compliance exposures are advertising-rule (not quality) issues:
**named promotion of a prescription-only medicine ("Botox"/anti-wrinkle)**,
**absolute "guarantee … painless / safe" wording** on several treatment pages,
and **financial-promotion wording ("0% / interest-free")** that triggers FCA
rules. Most of this copy is hard-coded in `lib/treatments.ts` /
`lib/treatments-imported.ts`, so fixes are code changes, not admin edits.

---

## 1 · Page inventory

All files under `/home/user/K-Clinics/app/(marketing)/`. Live URLs on
`https://kclinics.co.uk`. "Driven by" = where the copy actually comes from.

| Route | Live URL | Purpose | Advertises | Depth | Driven by |
| --- | --- | --- | --- | --- | --- |
| `page.tsx` | `/` | Homepage | Dual disciplines, featured treatments, packages, membership, AI plan, FAQ, location | rich | Mostly hard-coded; rating + "from" prices from DB |
| `about/page.tsx` | `/about` | Brand story | Mission, values, stats, Level 7 | adequate | Hard-coded; CMS override via `getPublishedPage('/about')` |
| `academy/page.tsx` | `/academy` | Academy landing | Accredited training (Ofqual/VTCT/CPD, L2–7), course grid, funding, equipment leasing | rich | Pillars hard-coded; **course grid DB-driven** (`listCourses`→`db.course`) |
| `academy/[slug]/page.tsx` | `/academy/{course}` | Per-course landing | Outcomes, format, fees, cohorts, apply form | rich | DB-driven; emits `courseLd` |
| `academy/funding/page.tsx` | `/academy/funding` | Course funding | 5 funding routes, eligibility wizard, finance worked example, FAQ | rich | `lib/funding` consts + hard-coded FAQ |
| `academy/leaderboard/page.tsx` | `/academy/leaderboard` | Gamified leaderboard (gated) | XP/badges/ranking | adequate (app) | DB-driven; student-gated |
| `academy/practice/page.tsx` | `/academy/practice` | Practice quizzes (gated) | Exam practice, past papers | adequate (app) | DB-driven; student-gated |
| `academy/portal/page.tsx` | `/academy/portal` | Trainee dashboard/login | Enrolments, progress, XP, calendar | rich (app, `noindex`) | DB-driven |
| `academy/learn/[slug]/page.tsx` | `/academy/learn/{course}` | Course player (gated) | Lesson experience | rich (app, `noindex`) | DB-driven |
| `academy/learn/[slug]/certificate/page.tsx` | … `/certificate` | Certificate render (gated) | — | thin (utility) | DB-driven |
| `academy/settings/page.tsx` | `/academy/settings` | Trainee settings (gated) | Sound, passkeys | thin (utility) | DB-driven |
| `academy/forgot-password`, `academy/reset` | … | Auth utilities | — | thin (utility) | Functional |
| `ai-consultation/page.tsx` | `/ai-consultation` | "Get My Plan" AI tool | AI skin/smile/hair photo analysis → bookable plan | adequate (tool, thin copy) | `KVision` component + settings |
| `book/page.tsx` | `/book` | Booking flow | Online booking, 15% first visit, card-on-file, free cancellation | rich | DB-driven (catalogue, offers) |
| `booking/manage` `pay` `card` | `/booking/*` | Booking utilities | Reschedule/pay/save card | thin (utility, `noindex`) | DB + Stripe |
| `careers/page.tsx` | `/careers` | Recruitment | Perks, live vacancies, application | adequate | DB vacancies; emits `JobPosting` |
| `clinics/page.tsx` | `/clinics` | Find us | Address, map, transport, accessibility | rich | Hard-coded; CMS override possible |
| `consultation/page.tsx` | `/consultation` | Book free consult | Complimentary consult, 15% off, dental anchor | adequate | Hard-coded; dentistry gated on `dentistryLive` |
| `contact/page.tsx` | `/contact` | Contact + find us | Address, hours, map, areas, enquiry form | rich | Hard-coded; CMS override possible |
| `dentistry/page.tsx` | `/dentistry` | Dentistry menu / coming-soon | Veneers, whitening, bonding, implants; register-interest when not live | rich | DB treatment cards; gated on `dentistryLive` |
| `faq/page.tsx` | `/faq` | FAQ | Grouped Q&A | adequate | Hard-coded (`lib/faqs`); emits `faqLd` |
| `finance/page.tsx` | `/finance` | Cost & finance | Transparent pricing, 0% options, Clearpay/Klarna BNPL | adequate | Hard-coded; CMS override possible |
| `gallery/page.tsx` | `/gallery` | Before/after | Consented client results + honest placeholder | adequate | DB (`getPublishedGallery`) + fallback |
| `gift-vouchers/page.tsx` | `/gift-vouchers` | Buy vouchers | £10–£500 e-vouchers, scheduled delivery, gift packages | rich | DB/settings + hard-coded steps |
| `gift/[code]/page.tsx` | `/gift/{code}` | View a gift card | Recipient view | thin (utility, `noindex`) | DB |
| `group-bookings/page.tsx` | `/group-bookings` | Group/party bookings | Birthdays, hen/bridal, corporate + form | adequate | Hard-coded + form |
| `info/[slug]/page.tsx` | `/info/{slug}` | Policy/info pages | Privacy, terms, complaints, accessibility, franchise, etc. | adequate (varies) | `lib/info-pages` data; CMS override possible |
| `journal/page.tsx` | `/journal` | Blog index | Expert guides | adequate | DB (`listBlogCards`) |
| `journal/[slug]/page.tsx` | `/journal/{slug}` | Blog article | Article + related treatments | rich | DB; emits `articleLd` |
| `membership/page.tsx` | `/membership` | Beauty Points loyalty | Earn/redeem points, referrals, leaderboard | rich | Loyalty rules + DB leaderboard; CMS override |
| `offers/page.tsx` | `/offers` | Offers hub | 15% first visit, free consult, referral, packages, points, vouchers | adequate | Hard-coded list (links out) |
| `packages/page.tsx` | `/packages` | Packages index | 4 curated programmes | adequate | Hard-coded (`lib/packages`) |
| `packages/[slug]/page.tsx` | `/packages/{slug}` | Single package | Inclusions, best-for, investment | rich | Hard-coded |
| `pricing/page.tsx` | `/pricing` | Price list | Full per-treatment + course pricing | rich | DB (`listServices`, `liveOffers`); emits `offerCatalogLd` |
| `preview/[id]/page.tsx` | `/preview/{id}` | Admin draft preview | Unpublished CMS page | thin (utility, `noindex`) | DB; auth-gated |
| `refer-a-friend/page.tsx` | `/refer-a-friend` | Referral programme | Give £25/get £25, 3-step | adequate | Hard-coded; client auth swaps CTA |
| `reviews/page.tsx` | `/reviews` | Testimonials | Verified 5★ reviews + aggregate | rich | DB (`getReviewAggregate`); emits `Review`/`aggregateRating` |
| `roadmap/page.tsx` | `/roadmap` | Public product roadmap | Shipped / coming next | adequate | DB (build board) |
| `search/page.tsx` | `/search` | Site search | Treatments/articles/pages | thin (utility, `noindex`) | DB index |
| `shop/page.tsx` | `/shop` | Product shop | Clinic-grade skincare grid | adequate (thin when empty) | DB (`activeProducts`); "coming soon" when empty |
| `shop/[slug]/page.tsx` | `/shop/{slug}` | Product detail | Single product, add-to-cart | adequate | DB; emits `productLd` |
| `shop/cart/page.tsx` | `/shop/cart` | Cart | Bag contents | thin (utility) | Client cart state |
| `shop/checkout/page.tsx` | `/shop/checkout` | Checkout | Checkout form | thin (utility, `noindex`) | Client form |
| `team/page.tsx` | `/team` | Team profiles | Clinicians, credentials, ratings | rich (when populated) | DB (`publicTeam`); fallback hard-coded |
| `treatment-finder/page.tsx` | `/treatment-finder` | Treatment quiz | Personalised suggestions | adequate (tool) | Client `TreatmentFinder` |
| `treatments/page.tsx` | `/treatments` | Aesthetics menu | Full aesthetic catalogue by category | rich | DB cards (`withCardOverrides`) |
| `[slug]/page.tsx` | `/{slug}` | Catch-all: treatment & CMS pages | Treatment landing pages OR admin CMS pages | rich | DB/content (`getMergedTreatment`, `getPublishedPage`); emits `serviceLd`/`faqLd` |
| `waitlist/claim/[token]/page.tsx` | `/waitlist/claim/{token}` | Waitlist slot claim | One-click claim → booking | thin (utility, `noindex`) | DB |

**Academy depth finding (owner's flag).** The premise — "a single thin
`/academy` page with no sub-navigation breakdown" — is **half right**:

- `/academy` is **rich, not thin** (`app/(marketing)/academy/page.tsx`): hero,
  accreditation strip, three pillars, a **DB-driven course grid**, a funding
  band, an equipment-leasing band, a closing CTA. Comparable to `/treatments`.
- **Per-course landing pages already exist** (`academy/[slug]/page.tsx`) —
  outcomes, format, fees, live cohort dates, apply form, `courseLd` schema.
  Whether any are *live* depends entirely on rows in `db.course`. If the Academy
  looks empty in production, the `Course` table is unpopulated, not the template
  missing.
- A whole **rich funding page** (`academy/funding/page.tsx`) exists too.
- **The real gap is sub-navigation and discoverability**, exactly as the owner
  intuited. `Academy` is a **flat nav link with no dropdown** (`lib/nav.ts`
  L88–91), so courses, funding, the portal and "why train here" are not exposed
  in the header. Almost the only off-Academy link in is a single footer entry
  "Academy Funding". See §2 and §3.

---

## 2 · Gap analysis — under-marketed offerings

"Built?" cross-references the products listed in the brief against what the
marketing surfaces.

| Offering | Built? | How it's marketed now | Gap | Recommended fix |
| --- | --- | --- | --- | --- |
| **Academy LMS** (courses, funding, certificates, leaderboard, practice) | Yes — full LMS + per-course templates | One flat `/academy` nav link; rich landing page + `/academy/funding`; courses depend on `db.course` rows | **No Academy dropdown; no course pages linked from header; funding page reachable only via one footer link; sub-pages absent from sitemap.** Depth invisible. | (a) Add an **Academy mega-menu** (Courses by level, Funding, Why train here, Apply, Portal login); (b) **populate `db.course`** so per-course pages render and enter the sitemap; (c) add `/academy/funding` to `app/sitemap.ts`; (d) cross-link courses from `/academy` and relevant treatment pages. |
| **AI skin-analysis kiosk** | Yes (in-clinic kiosk) | Not marketed on the public site at all (kiosk is `/kiosk`, `noindex`, internal) | The headline AI differentiator is invisible to web visitors | Add an "AI skin scan in clinic" section to `/ai-consultation` or homepage describing the in-clinic kiosk experience. |
| **AI consultation ("Get My Plan")** | Yes (`/ai-consultation`) | In primary nav as "Get My Plan"; page is a tool with thin marketing copy | Page sells the tool but under-explains the offer/benefit; no SEO body copy | Add explanatory copy + how-it-works + FAQ to `/ai-consultation` (currently mostly interactive, thin on indexable text). |
| **Client portal / account** | Yes | Footer "Patient Portal" → `/account`; AccountMenu in header | Adequate, low priority | None material. |
| **Membership / loyalty (Beauty Points)** | Yes (`/membership`, rich) | In "Clinic" dropdown + has its own page | Not in top-level nav; fine via dropdown | Optional: surface "Membership" higher. Low priority. |
| **Finance / BNPL (Klarna/Clearpay)** | Yes (`/finance`) | Footer "Cost & Finance" + "Buy Now, Pay Later"; not in header | **No header path to finance/BNPL**; a major conversion lever buried in footer | Add Finance/BNPL into a nav dropdown (e.g. under Pricing) and onto treatment pages near price. |
| **Gift vouchers** | Yes (`/gift-vouchers`, rich) | Footer only | No header path; seasonal revenue driver hidden | Surface in a dropdown and/or seasonal announcement bar (the bar exists, `announcement` config). |
| **E-commerce shop** | Yes (`/shop`) | Header "Shop" text link + footer | Adequate, but empty/coming-soon when no products | Populate `db.product`; keep the link. |
| **Group bookings** | Yes (`/group-bookings`) | Footer only | No header path | Acceptable in footer; consider a dropdown entry. |
| **Referrals (Give £25/Get £25)** | Yes (`/refer-a-friend`) | Footer + offers page + membership page | Adequately marketed | None material. |
| **Dentistry** | Built but **not live** (`dentistryLive=false`) | Full Dentistry mega-menu + `/dentistry` coming-soon, register-interest | Tagline + nav advertise a service not yet bookable (gated to "opening soon") | Keep the gating; ensure all dentistry CTAs route to register-interest, not booking, until a GDC dentist is in post (see §4). |
| **Journal / blog** | Yes (`/journal`) | In "Clinic" dropdown + footer | Adequate | None material. |
| **Treatments / packages / pricing / reviews / gallery** | Yes | Strong nav + rich pages | None material | — |
| **Public roadmap** | Yes (`/roadmap`) | **Not linked anywhere** in nav or footer | Orphan page (only via direct URL / sitemap-excluded) | Decide if public; if so, link from footer; if not, `noindex`. |

**Net:** five revenue/registration products are **built but under-surfaced** —
Academy (worst), Finance/BNPL, Gift vouchers, Group bookings, and the in-clinic
AI kiosk. All are reachable only from the footer (or not at all), never the
header.

---

## 3 · Navigation & information-architecture review

**Source of truth:** `lib/nav.ts` (defaults) merged with admin overrides via
`lib/site-config.ts`; rendered by `components/layout/Header.tsx` (desktop
mega-menu + mobile drawer) and `components/layout/Footer.tsx`. Nav is **editable
from the admin** ("Website tab"): `app/admin/site/page.tsx` →
`components/admin/SiteConfigEditor` → `components/admin/NavEditor.tsx` lets a
non-technical admin reorder/relabel primary + footer links without a deploy.

**Primary nav (header), `lib/nav.ts` L5–116:**

| Item | Has dropdown? | Notes |
| --- | --- | --- |
| Aesthetics → `/treatments` | Yes (3 columns + hover preview) | Strong. |
| Dentistry → `/dentistry` | Yes (3 columns) | Strong (but service not yet live). |
| Packages → `/packages` | No | Flat link. |
| Pricing → `/pricing` | No | Flat link. |
| **Academy → `/academy`** | **No** | **Flat link — this is the owner's gap.** No Courses/Funding/Portal sub-links. |
| Get My Plan → `/ai-consultation` | No | Flat link. |
| Clinic → `/about` | Yes (1 column, 9 links) | Catch-all: About, Team, Treatment Finder, Consultation, Membership, Reviews, Journal, FAQ, Contact. |

Plus a standalone **Shop** text link, search, account menu and Book Now button.

**Discoverability gaps:**
- **No Academy dropdown** — the single most impactful nav fix. Recommend an
  Academy mega-menu mirroring Aesthetics/Dentistry: a "Courses by level" column
  (driven by `db.course`), a "Funding & finance" column, a "Why train with us"
  column, and a Portal-login link.
- **Finance/BNPL, Gift vouchers, Group bookings, Offers** have **no header
  path** — footer-only. These are conversion/seasonal drivers.
- **`/roadmap`** is an **orphan** (no nav/footer link).

**Footer (`lib/nav.ts` L118–164):** three columns — Discover, Connect With Us,
Policies & Terms — plus NAP block, social, payment marks, cookie-settings link,
company-number line. Broad and well-populated. **One notable omission:** the
Policies column lists Terms, Website Privacy & Terms, Call Recording, CCTV,
Cancellations, Complaints, Health & Safety, Accessibility — but **not the actual
Privacy Policy** (`/info/privacy-policy`), which exists and is thorough. It's
only reachable via the cookie banner and signup/newsletter forms. Add it to the
footer (see §5).

---

## 4 · Claims register

Captures marketing claims that may need substantiation under ASA/CAP and, for
device/medical claims, MHRA. Most are **hard-coded** in `lib/treatments.ts` and
`lib/treatments-imported.ts` (and a few page files) — so fixes are code changes,
not admin edits. "Subst.?" = substantiated on-page.

| # | Claim (verbatim) | Location | Type | Subst.? | Needs source? | Suggested source |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | "Permanent hair reduction … retires the follicle for good" | `lib/treatments.ts` (laser-hair-removal) | medical/results | No | Yes | Device IFU/clinical data; align to CAP "permanent reduction" wording |
| 2 | "safe and effective across the full spectrum of skin types" | `lib/treatments.ts` (laser-hair-removal) | safety/efficacy | No | Yes | Device clearance for skin types I–VI |
| 3 | "Most clients see dramatic reduction within a course" | `lib/treatments.ts` | results | No | Yes | Internal outcome data or de-quantify |
| 4 | "reaches the SMAS — the same deep layer a surgeon addresses in a facelift … genuine lifting" | `lib/treatments.ts` (smas-hifu-lifting) | medical/results | No | Yes | HIFU clinical evidence; MHRA-sensitive surgery comparison |
| 5 | "results last around a year" / "collagen rebuilds over 8–12 weeks" | `lib/treatments.ts` (HIFU/RF) | results/statistic | No | Yes | Device/manufacturer data |
| 6 | "No surgery. No downtime." / "Zero downtime" (many pages) | `lib/treatments.ts` (recurring) | safety | No | Yes | Per-treatment basis; verify holds for all clients |
| 7 | "permanently reduce razor bumps and ingrown hairs" / "eliminates ingrown hairs" | `lib/treatments.ts` (LHR for men) | medical/results | No | Yes | Evidence for "permanently/eliminates" |
| 8 | **"Anti-Wrinkle (Botox)" promoted; "smooths dynamic wrinkles … prevents formation"** | `lib/treatments.ts` + `lib/treatments-imported.ts` (botox page, metaTitle "Botox in London") | **medical (POM)** | No | **Legal** | **CAP 12.12 prohibits advertising prescription-only medicines (botulinum toxin) to the public.** Flag for legal review. |
| 9 | "guarantee you reliable and painless root canal therapy" | `lib/treatments-imported.ts` (root-canal) | safety/guarantee | No | Yes | Remove absolute "guarantee … painless" |
| 10 | "guarantee a comfortable and painless experience throughout all time" | `lib/treatments-imported.ts` (tooth-extraction) | safety/guarantee | No | Yes | Remove absolute guarantee |
| 11 | "painless and scar-free way to remove permanent makeup" | `lib/treatments-imported.ts` | safety | No | Yes | Substantiate or soften |
| 12 | "safely and successfully gets rid of fungal nail infections" / "Effective Elimination of Fungus" | `lib/treatments-imported.ts` (fungal-nail) | medical | No | Yes | **Treats a medical condition** — clinical evidence + MHRA device basis |
| 13 | "fillers promote the synthesis of collagen … guaranteeing long-lasting results" | `lib/treatments-imported.ts` (dermal-fillers) | results/guarantee | No | Yes | Remove "guaranteeing"; substantiate collagen |
| 14 | "naturally breaks down fat cells … safe … long-lasting results" (Kybella) | `lib/treatments-imported.ts` | medical/safety | No | Yes | Product evidence |
| 15 | "Targets the structure of cellulite … drain retained fluid … detoxifies" / "removal of toxins" | `lib/treatments.ts` (body-contouring); `lib/treatments-imported.ts` (vacuum-massage) | medical | No | Yes | CAP scrutinises "detox/toxins" — remove or evidence |
| 16 | "CO2 laser stimulates collagen … improves comfort, dryness and intimate wellbeing" | `lib/treatments.ts` (intimate-rejuvenation) | medical | No | Yes | Clinical evidence; sensitive health claims |
| 17 | "Whitening … safe and far more effective than over-the-counter options" / "Enamel-safe" | `lib/treatments.ts` (teeth-whitening) | safety/comparative | No | Yes | Comparative claim vs OTC needs evidence |
| 18 | "veneers commonly last 10–15 years or more"; "implants … decades — often a lifetime" | `lib/treatments.ts` | results/statistic | No | Yes | Longevity evidence / typical-range basis |
| 19 | "Results lasting up to 12 months" (≈10 imported treatments) | `lib/treatments-imported.ts` (facts) | statistic/results | No | Yes | Per-treatment duration data |
| 20 | "The latest professional equipment for safe, lasting results" (≈30 treatments) | `lib/treatments-imported.ts` (boilerplate) | safety/efficacy | No | Yes | Substantiate or qualify the site-wide boilerplate |
| 21 | "most recent equipment … safe, efficient and long-lasting" | `app/(marketing)/about/page.tsx` | safety/superlative | No | Yes | Equipment recency + safety basis |
| 22 | "Level 7 — qualified, prescriber-led" / "prescriber on hand" | `app/(marketing)/page.tsx`; `about`; `components/home/TrustStrip.tsx` | accreditation | Partial | Yes | Practitioner Level 7 cert + prescriber registration on file |
| 23 | "Licensed — High-Risk Special Treatment Licence" | `components/home/TrustStrip.tsx` | accreditation | No | Yes | Local-authority HRST licence document |
| 24 | "qualified, registered clinicians … safe, artful results" | `app/(marketing)/team/page.tsx` | accreditation/safety | No | Yes | GMC/GDC registration per clinician |
| 25 | "40+ treatments" | `app/(marketing)/page.tsx`; `about` | statistic | Partial | Borderline | Verify count ≥40 in live menu |
| 26 | "Are your treatments safe? — Absolutely." | `lib/faqs.ts` | safety | No | Yes | Soften unqualified "Absolutely [safe]" to risk-balanced |
| 27 | "Free consultation · 15% off your first visit" | `components/home/Hero.tsx`; `consultation`; `offers`; `faqs.ts`; `app/llms.txt/route.ts` | price/offer | Partial | Yes | Publish 15% offer terms (qualifying spend, exclusions) |
| 28 | "0% interest-free options" / "Spread the cost, interest-free" / "no hidden fees, ever" | `app/(marketing)/finance/page.tsx` | price/guarantee | Partial (BNPL disclaimer present) | Yes | **FCA financial-promotion rules** — representative example + lender terms |
| 29 | "Accredited … Ofqual-regulated, VTCT and CPD-accredited, Level 2–7" | `app/(marketing)/academy/page.tsx`; `funding` | accreditation | Partial | Yes | VTCT/Ofqual/CPD certificates; don't claim routes still "getting approved" |
| 30 | "Clinically reviewed" (article byline) | `app/(marketing)/journal/[slug]/page.tsx` | medical/credibility | No | Yes | Record the named qualified reviewer per article |
| 31 | "Premier / premium Islington clinic"; "London's most considered clinic"; "Expert hands, an artist's eye" | `about`; `treatments`; `careers`; `team`; Hero (site-wide) | superlative | No | Mostly puffery | Acceptable as puffery; tie "expert/experienced" to verifiable credentials |
| 32 | Tagline "Aesthetics & Aesthetic Dentistry, Reimagined" while dentistry not bookable | `lib/site.ts` | superlative | No | Note | Mitigated by `dentistryLive` gating to "opening soon"; monitor "advertising a service you can't yet deliver" |

**Good practice already in place** (low risk, well-governed):
- Star ratings and review counts are **computed live from real CRM + Google
  reviews** (`lib/reviews-aggregate.ts`); the code refuses to hard-code or
  cherry-pick and renders nothing when there are no real reviews.
- The **gallery** uses a consented-only model with an explicit placeholder
  disclaimer ("not a record of individual results").
- **Dentistry booking is gated** behind `dentistryLive=false` to "opening soon".
- **BNPL and academy-funding disclaimers** are present on those pages.

---

## 5 · Compliance checklist

Legal/policy pages are **hard-coded** in `lib/info-pages.ts` and rendered at
`/info/{slug}` by `app/(marketing)/info/[slug]/page.tsx` (a published CMS layout
can override a route, but the default copy lives in code). Context:
`docs/COMPLIANCE_ROADMAP.md` (ICO reg ZC153001; the platform's own data posture
is sound at M0; CQC/MHRA explicitly out of scope for the current single-clinic).

| # | Item | Status | Where | Notes |
| --- | --- | --- | --- | --- |
| 1 | Privacy policy | present-adequate (content) / present-thin (discoverability) | `lib/info-pages.ts` (`privacy-policy`); `/info/privacy-policy` | Thorough (UK GDPR bases, Art. 9, sub-processors, transfers, retention, ICO route). **Not linked in the footer** — only via cookie banner / signup / newsletter. ICO number not shown (see #7). |
| 2 | Cookie / consent banner | present-adequate | `components/legal/CookieConsent.tsx`; re-open `components/legal/CookieSettingsLink.tsx` (footer) | Solid PECR/GDPR pattern: non-essential off by default, equal-weight reject, granular customise, choice gates analytics load. |
| 3 | GDPR / data-protection statement | present-adequate | Privacy policy + `cctv-policy`, `call-recording-privacy` | Controller named, UK GDPR + DPA 2018, lawful/special-category bases, erasure right. Backed by real engineering (encryption + erasure per roadmap). No standalone "GDPR statement" page (folded in — acceptable). |
| 4 | Terms & conditions | present-adequate | `lib/info-pages.ts` (`terms-conditions`, `website-privacy-terms`); footer-linked | Service T&Cs (18+, results/risk, liability, governing law) + website terms. |
| 5 | Medical disclaimers | present-adequate (AI/T&Cs) / **gap (per-treatment)** | AI: `components/ai/KVision.tsx`; kiosk: `lib/kiosk-ai.ts` ("NOT a medical assessment"); T&Cs "Results and risks" | AI flow requires a consent checkbox and states "not a medical diagnosis". **No per-treatment medical disclaimer** on individual injectable/treatment pages — disclaimers centralised in T&Cs/AI only. |
| 6 | Complaints procedure | present-adequate | `lib/info-pages.ts` (`complaints-procedure`); footer | Full process: 3-day acknowledgement, ~20-day response, escalation to GDC/GMC/NMC, ICO + Citizens Advice. |
| 7 | Regulatory registration display (CQC/GMC/GDC/Save Face/JCCP/ICO no.) | **present-thin → mostly missing** | see notes | **ICO ZC153001 not shown publicly** (only in `docs/COMPLIANCE_ROADMAP.md`); policy just says "registered with the ICO". CQC n/a per roadmap. **Save Face/JCCP not displayed** publicly. `components/home/TrustStrip.tsx` deliberately lists only HRST licence / Level 7 / prescriber and comments Save Face/CQC must not be listed until granted. **GMC/GDC clinician numbers are bracketed placeholders** in `lib/team.ts` (`[GMC reg.]` / `[GDC reg.]`). |
| 8 | Company registration number | present-adequate | `lib/site.ts` (`companyNumber: '17101088'`, `legalName: 'KCLINICS SKIN & LASER LIMITED'`); footer L135 | "© 2026 … Registered in England & Wales, company no. 17101088." Not VAT-registered (per code comment). |
| 9 | Full contact details (address/phone/email) | present-adequate, with **email inconsistency** | `lib/site.ts`; footer; contact page seed | NAP present (4 Charterhouse Buildings, Goswell Road, Clerkenwell, EC1M 7AN; 020 8050 0750). **Inconsistency:** site/footer use `support@kclinics.co.uk`, but every legal page in `lib/info-pages.ts` directs DSAR/complaints to `hello@kclinics.co.uk`. |

**Biggest compliance gaps:**
1. Privacy policy not linked in the footer (transparency/discoverability).
2. ICO registration number ZC153001 never shown publicly.
3. No public aesthetics-sector accreditation signal (Save Face/JCCP) — honestly
   omitted, but a gap in trust signal.
4. Placeholder clinician GMC/GDC numbers in `lib/team.ts`.
5. Two different contact emails for legal/DSAR correspondence
   (`support@` vs `hello@`).
6. No per-treatment medical disclaimer (AI/T&Cs disclaimers are good).

---

## 6 · Content-architecture map (code-driven vs DB/CMS-driven)

This determines which fixes are code changes versus admin-editable. The site has
a real **CMS layer**: `db.page` rows with published "sections" override any
marketing route via `getPublishedPage(path)` (`lib/pages.ts`), edited at
`/admin/pages` (`app/admin/pages/page.tsx`). Global config (site identity,
contact, hours, social, announcement bar **and the nav/footer**) is a single
`SiteConfig` row edited at `/admin/site` (`app/admin/site/page.tsx` →
`SiteConfigEditor` + `NavEditor`), read via `getSiteConfig()`
(`lib/site-config.ts`). Per-page SEO overrides live in a `PageSeo` table edited
at `/admin/seo` (`app/admin/seo/page.tsx`, with AI-written suggestions), merged
in `pageMeta()` (`lib/seo.tsx`).

| Surface / copy area | Code- or DB-driven | Where to edit |
| --- | --- | --- |
| Site identity, contact, hours, social, company no. | DB (SiteConfig) over code defaults | `/admin/site`; defaults `lib/site.ts` |
| **Primary nav + footer nav** (labels, links, dropdowns) | **DB (SiteConfig.nav) over code defaults** | `/admin/site` → NavEditor; defaults `lib/nav.ts` |
| Announcement bar | DB (SiteConfig.announcement) | `/admin/site` |
| Any marketing route's full layout | DB (published `Page` sections) overrides the coded page | `/admin/pages`; renderer `components/cms/SectionRenderer` |
| Per-page SEO (title/description/canonical/OG/noindex) | DB (PageSeo) over code defaults | `/admin/seo`; merged in `lib/seo.tsx` |
| Homepage hero/pillars/sections | **Code** (`app/(marketing)/page.tsx`, `components/home/*`) unless a CMS `/` page is published | Code, or publish a CMS home page |
| About / Finance / Clinics / Contact / Membership page bodies | Code default, **CMS override available** (`getPublishedPage`) | Code or `/admin/pages` |
| **Treatment efficacy copy** (the bulk of claim risk) | **Code** (`lib/treatments.ts`, `lib/treatments-imported.ts`) | Code; cards partly overridable (`withCardOverrides`, `lib/treatment-content.ts`) |
| Treatment **prices** | DB (`lib/services.ts` catalogue) | Admin catalogue |
| Packages | **Code** (`lib/packages.ts`) | Code |
| FAQs | **Code** (`lib/faqs.ts`) | Code |
| Academy landing pillars / accreditation strip | **Code** (`app/(marketing)/academy/page.tsx`) | Code |
| Academy **courses + per-course pages** | **DB** (`db.course`, `lib/academy.ts`) | Admin (Academy/course admin) |
| Academy funding routes | Code (`lib/funding`) + hard-coded FAQ | Code |
| Legal/info pages (privacy, terms, complaints, etc.) | **Code** (`lib/info-pages.ts`), CMS override available | Code or `/admin/pages` (publish `/info/{slug}`) |
| Reviews / ratings | DB, computed live (`lib/reviews-aggregate.ts`) | Auto from CRM/Google |
| Gallery | DB (`getPublishedGallery`) + coded fallback | Admin gallery |
| Team profiles | DB (`publicTeam`) + coded fallback (`lib/team.ts`) | CRM/admin |
| Shop products | DB (`activeProducts`) | Admin shop |
| Journal posts | DB (`getBlogPost`/`listBlogCards`) | Admin journal |
| Gift packages / vouchers | DB + settings | Admin |
| sitemap / robots / llms.txt | **Code** | Code |

**Practical consequence for fixes:**
- **Nav fixes (Academy dropdown, surfacing Finance/Gift vouchers) are
  admin-editable now** via `/admin/site` → NavEditor — no deploy needed. The
  Academy dropdown can be built in the admin today; only the *defaults* in
  `lib/nav.ts` are code.
- **Most claims fixes are code** (`lib/treatments*.ts`) — not admin-editable.
- **Per-course Academy pages need `db.course` populated** (admin/data task), not
  code.
- **Privacy-policy-in-footer** is a one-line nav edit (admin or `lib/nav.ts`).

---

## 7 · SEO surface notes

Overall the SEO foundation is **strong** — better than most clinic sites.

- **`generateMetadata` / `metadata`:** present on **every** marketing page
  except `app/(marketing)/shop/cart/page.tsx` (a client-side `noindex` utility —
  acceptable). All pages calling `pageMeta()` pass a `path`, so **canonical
  URLs are set everywhere** (`alternates.canonical`, `lib/seo.tsx` L45/L64),
  with admin override support.
- **Structured data (JSON-LD):** rich and broad via `lib/seo.tsx` builders —
  `organizationLd`, `websiteLd`, `serviceLd`, `faqLd`, `aggregateRatingLd`,
  `reviewLd`, `courseLd`, `offerCatalogLd`, `itemListLd`, `productLd`,
  `breadcrumbLd`, `articleLd`, `JsonLd`. Emitted across treatments, academy
  courses, pricing, reviews, journal, careers (`JobPosting`), shop products,
  FAQ, etc. Good coverage.
- **`app/sitemap.ts`:** comprehensive — static marketing paths + treatments +
  packages + info pages + articles + **DB academy courses** + **DB shop
  products** (ISR `revalidate=3600`, honest fixed `lastmod`). **Gaps:**
  `/academy/funding`, `/membership`'s siblings are mostly covered but
  **`/academy/funding` is indexable yet NOT in the sitemap**; `/roadmap` and
  `/treatment-finder`'s siblings are fine. Add `/academy/funding`.
- **`app/robots.ts`:** sensible disallow of `/admin`, `/kiosk`, `/account`,
  `/api/`, booking/portal/learn/search/cart/checkout/preview/waitlist. Public
  marketing is allowed. Sitemap + host declared. Correct.
- **`app/llms.txt/route.ts`:** present and good — machine-readable summary with
  treatments, dentistry, **Academy**, hours, key facts, FAQs. Honestly reflects
  `dentistryLive`. One of the better implementations.
- **Per-page titles/descriptions:** all present (driven by `pageMeta`/CMS
  fallback `pageMetaFromSections`). No page is missing a title/description.
- **`/admin/seo`** provides an audit + AI-suggestion workflow over `PageSeo`
  (`lib/seo-audit.ts`), so non-technical staff can tune any page's metadata.

**SEO fixes:**
1. Add `/academy/funding` to `app/sitemap.ts` (indexable but unlisted).
2. Once `db.course` is populated, per-course pages auto-enter the sitemap
   (already wired) — populate the table.
3. Decide on `/roadmap`: link it (footer) or `noindex` it (currently an orphan,
   excluded from sitemap, no internal links).

---

## Top 5 gaps (under-marketing)

1. **Academy has no sub-navigation.** The owner's flag is right: `Academy` is a
   flat header link (`lib/nav.ts` L88) with no dropdown, despite a rich landing
   page, a built per-course template (`academy/[slug]`), and a full funding
   page. Add an Academy mega-menu and **populate `db.course`** so per-course
   pages render and index. Also add `/academy/funding` to the sitemap.
2. **Finance / BNPL is footer-only** — a major conversion lever (Klarna/Clearpay,
   0% options) with no header path. Surface it in the nav and on treatment pages.
3. **Gift vouchers and group bookings are footer-only** — seasonal/revenue
   drivers invisible in the header.
4. **The in-clinic AI skin kiosk is not marketed on the public site at all** —
   the headline AI differentiator is invisible to web visitors.
5. **`/ai-consultation` and `/roadmap` are thin/orphaned** — "Get My Plan" is a
   tool with little indexable marketing copy; `/roadmap` is linked from nowhere.

## Top compliance risks

1. **Advertising a prescription-only medicine to the public.** "Anti-Wrinkle
   (Botox)" is named and promoted (dedicated page, metaTitle "Botox in London")
   in `lib/treatments.ts` / `lib/treatments-imported.ts`. CAP rule 12.12
   prohibits advertising POMs (botulinum toxin) to the public. **Highest
   priority — legal/CAP review.**
2. **Absolute "guarantee … painless / safe / scar-free" wording** on several
   (mostly imported dentistry/aesthetics) pages — hard to defend under CAP.
3. **Medical-condition and "detox/toxins" claims** (fungal nail, intimate
   health, cellulite, "removal of toxins") need clinical evidence and, for
   device claims, an MHRA medical-device basis.
4. **Financial-promotion wording** ("0% / interest-free") triggers FCA rules —
   verify representative-example requirements (a BNPL disclaimer exists).
5. **Unsubstantiated credential/accreditation claims** (Level 7, prescriber-led,
   HRST licensed, registered clinicians, Ofqual/VTCT-accredited) — all factual
   claims needing documentary proof on file; **clinician GMC/GDC numbers are
   still bracketed placeholders** in `lib/team.ts`. Plus the **privacy policy is
   not linked in the footer** and the **ICO number ZC153001 is never shown**.
