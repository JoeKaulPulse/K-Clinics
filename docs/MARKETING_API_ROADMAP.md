# Marketing API utilisation — roadmap

> **Status:** planning / ranked roadmap (BLD card companion). Grounded in a read-only
> audit of the live code on 2026-06-13. British English. Nothing here is built yet.
>
> **The one-line problem:** ad *spend* is pulled IN (Google/Meta/TikTok → `MarketingCampaign.spendPence`,
> daily cron) and first-party booking attribution works, but the connections are otherwise
> one-directional and half-used: the platforms' own read APIs are scoped-but-never-called,
> our audience segments are never pushed back to the ad platforms, and the conversion
> feedback loop that trains ad bidding is incomplete. We're paying for OAuth scopes we don't use.

## What's already live (build on this, don't rebuild)

| Capability | Evidence |
| --- | --- |
| Google/Meta/TikTok OAuth + token refresh | `lib/marketing-connections.ts`, `lib/oauth-connections.ts` |
| Ad-spend sync (all 3 platforms), daily | `lib/ad-spend.ts`, `app/api/cron/daily/route.ts:60` → `MarketingCampaign.spendPence` |
| Browser pixels: GA4, Google Ads, Meta (all live) | `components/marketing/TrackingScripts.tsx` |
| Server-side GA4 `purchase` + `refund` | `lib/conversions.ts:49-74` (wired into both charge paths + refunds) |
| Server-side Meta CAPI `Purchase` | `lib/conversions.ts:76-92` (Purchase **only**) |
| First-touch attribution → revenue/ROI | `Booking.attrib*` (`prisma/schema.prisma:607-613`), `lib/marketing.ts`, Performance + Campaigns dashboards |
| Rule-based audience segments | `lib/segments.ts`, `app/admin/marketing/audiences/page.tsx` (sized, **never synced out**) |

## The dormant capabilities, ranked

Ranked by **impact ÷ effort**. Effort: **S** ≈ ½–1 day, **M** ≈ 2–4 days, **L** ≈ 1 week+.
"New scope" flags where a connection must be re-authorised (and may need platform App Review).

### Tier 1 — Close the conversion feedback loop (best ROI; mostly extends existing code)
This is where unused capability turns directly into lower cost-per-booking: the ad platforms bid smarter when we feed them more of the funnel and the *value* of each booking.

**1. Meta CAPI full-funnel events** · Impact: High · Effort: **S–M** · No new scope
`lib/conversions.ts` sends only `Purchase` server-side. The browser already fires `Lead` (`ConsultForm.tsx:68`), `InitiateCheckout` (`BookingFlow.tsx:146`) and a non-standard `Schedule` (`BookingFlow.tsx:521`) — but ad-blockers and iOS drop a large share of browser events. Add `sendLead()` / `sendInitiateCheckout()` (and map `Schedule`→a standard event) to the CAPI, deduped with the browser via `event_id` (same pattern as Purchase). **Unlocks:** Meta's bid algorithm learns the *whole* funnel, ad-blocker-proof. Best impact:effort on the board — do first.

**2. Google Ads offline conversion upload (value-based)** · Impact: High · Effort: **M** · scope present
`sendPurchase()` reports to GA4 but **nothing reports the booking back to Google Ads**, so Smart Bidding optimises blind to value. Add `googleAdsConversion()` uploading the booking value (in micros) via the Ads API. **Dependencies (real):** (a) capture the **GCLID** on the landing page — we capture `attribSource/Medium/Campaign/Landing` but not `gclid` yet, so this needs a small capture step added to the booking funnel + a `Booking.gclid` column; (b) a configured "Booking" conversion action in Google Ads; (c) `GOOGLE_ADS_DEVELOPER_TOKEN` (already used for spend sync). **Unlocks:** Smart Bidding optimises for high-value bookings, not raw lead count.

### Tier 2 — Activate warm audiences (direct CPA win)
**3. Meta Custom + Lookalike Audience sync** · Impact: High · Effort: **M** · ⚠ **New scope**
Segments exist (`lib/segments.ts`: lapsed clients, by tier/source/treatment) but are never pushed anywhere. Sync them as hashed-email/phone **Custom Audiences** to Meta and seed **Lookalikes**. **Dependency (important):** current Meta scope is `ads_read` — creating audiences needs **`ads_management`**, i.e. re-authorise + likely **Meta App Review**. **Unlocks:** retarget lapsed clients and prospect via lookalikes — typically the single biggest CPA reduction lever for a clinic.

### Tier 3 — Unify reporting (turn on the dormant read APIs)
The Performance dashboard is blind to everything except our own bookings; these two make it a real cross-channel view. Visibility, not direct revenue — but it's what stops spend going to the wrong channel.

**4. GA4 Data API → Performance dashboard** · Impact: Medium · Effort: **M** · scope present
`analytics.readonly` is granted (`lib/marketing-connections.ts:37`) but **no code calls the GA4 Data API**. Pull 90-day sessions/conversions by source/device/geography and show **ROAS = ad spend vs GA4-attributed conversions** beside the current first-party ROI in `app/admin/marketing/performance`.

**5. Search Console → SEO/Performance** · Impact: Medium · Effort: **M** · scope present
`webmasters.readonly` is granted but unused — organic search is invisible. Pull top queries / impressions / CTR / landing pages and surface them on `app/admin/seo` (alongside the audit) and Performance. **Unlocks:** see which organic terms convert, and the true organic-vs-paid split.

### Tier 4 — Quick wins & low priority
**6. "View in platform" deep links** · Impact: Low · Effort: **S** · no API
Add per-provider links to the native Google Ads / Meta / TikTok dashboards on `app/admin/marketing/connections`. Zero API, pure UX.

**7. TikTok audience insights / Meta page insights** · Impact: Low · Effort: M
Scopes (`user.info.basic`, `pages_read_engagement`) are requested but unused. Low revenue impact — defer until the above are done.

## Recommended sequence

1. **#1 Meta CAPI full-funnel** (S–M, no scope change) — fastest signal improvement.
2. **#2 Google Ads offline value** (M) — start the GCLID capture now (it's a prerequisite and trivial to add early).
3. **#3 Meta audiences** (M) — kick off the `ads_management` scope + App Review in parallel (lead time).
4. **#4 + #5 reporting** (M each) — GA4 Data API then Search Console into the dashboards.
5. **#6 deep links** (S) — drop in whenever; **#7** deferred.

## Cross-cutting dependencies to decide up front
- **GCLID capture** (`Booking.gclid`, additive column) — prerequisite for #2; add early.
- **Meta `ads_management` scope + App Review** — lead-time item for #3; begin before building.
- **Per-tenant note:** all of the above is single-tenant (K Clinics) today; under the ClinicOS plan these become per-tenant connections — keep credential/segment access tenant-scoped when that lands (see `docs/PLATFORM_SAAS_PLAN.md`).
