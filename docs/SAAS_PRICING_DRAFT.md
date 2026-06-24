# ClinicOS — pricing draft (BLD-47)

> **Draft for the owner to edit.** Every figure here is an assumption, not a quote.
> The platform plan defers pricing until COGS is modelled (ADR-012, decision #5).
> This document supplies a first COGS estimate and a tier proposal so those numbers
> can be replaced with real ones and signed off. British English. Not financial advice.

## 1. What drives cost (pooled multi-tenancy)

ClinicOS runs pooled: one shared schema with `tenantId` + RLS, so most infrastructure
is shared and the marginal cost of one more tenant is low. Costs split into:

- **Fixed platform cost** — runs whether there are 10 tenants or 500: hosting
  (Vercel), database (Neon Postgres), object storage baseline, error/observability,
  domains, and the security/compliance overhead.
- **Per-tenant marginal cost** — database rows and compute share, a small storage
  share, and transactional email.
- **Pass-through usage** — SMS, payment processing (Stripe), and storage above an
  included allowance. These are billed on top and should be priced pass-through-plus,
  so they never erode margin.

## 2. COGS estimate (replace with real figures)

Assumptions (monthly, ex VAT, GBP), to be validated against real invoices:

| Fixed platform cost | Low | High |
| --- | --- | --- |
| Hosting (Vercel Pro → scale) | £150 | £1,200 |
| Database (Neon, pooled, branches) | £100 | £800 |
| Object storage baseline | £20 | £150 |
| Observability + error tracking | £50 | £300 |
| Email base (Resend) | £20 | £100 |
| Domains, misc | £30 | £100 |
| **Fixed total** | **£370** | **£2,650** |

Per-tenant marginal (excluding pass-through SMS/Stripe): **£4–£10 / tenant / month**.

Blended COGS per tenant at scale (fixed amortised + marginal):

| Tenants | Fixed share / tenant | + Marginal | **COGS / tenant / mo** |
| --- | --- | --- | --- |
| 10 | £37–£90 | £4–£10 | **~£40–£100** |
| 100 | £4–£27 | £4–£10 | **~£8–£37** |
| 500 | £1–£5 | £4–£10 | **~£5–£15** |

Takeaway: COGS per tenant falls sharply with scale; the model is margin-positive
from a low tenant count once tiers are above ~£100/mo. Silo/Enterprise tenants carry
dedicated infra and must be priced to cover it separately.

## 3. Market reference

Incumbents (Pabau, Phorest, Fresha, Zenoti, Aesthetics Pro) typically charge per seat
or per location with add-on creep, commonly in the **£100–£300+ / location / month**
range before SMS and extras. The plan's wedge is transparent tiers with lower total
cost of ownership (§2 of the platform plan). Pricing below should undercut headline
TCO while protecting margin.

## 4. Proposed tiers (DRAFT amounts)

Tier names follow the plan (Solo / Clinic / Chain / Enterprise). Entitlement and
metering are tier-agnostic config (ADR-012), so amounts can change without code.

| Tier | For | Included | **Draft price / mo (ex VAT)** |
| --- | --- | --- | --- |
| **Solo** | 1 practitioner, 1 location | Core booking, CRM, payments, 1 staff seat, fair-use email | **£59** |
| **Clinic** | 1 location, multiple staff | Everything in Solo + up to ~8 seats, academy/LMS, marketing tools, reporting | **£179** |
| **Chain** | Multiple locations | Everything in Clinic + multi-location, role views, priority support; **+ £79 / extra location** | **£399** |
| **Enterprise** | Large/group, white-label, silo | Dedicated isolation, white-label public site, SSO, SLA, custom DPA | **From £999 (custom)** |

Usage add-ons (all tiers, pass-through-plus):

- **SMS:** cost + ~20% margin, billed per message or in bundles.
- **Payment processing:** Stripe fees passed through; optional platform fee on volume.
- **Storage:** an allowance per tier (e.g. 25 / 100 / 500 GB), then per-GB overage.
- **White-label public site:** included in Enterprise; optional add-on for Chain.

## 5. Indicative gross margin (at the draft prices)

Using a mid COGS of ~£18 / tenant / mo (≈100-tenant point), excluding pass-through:

| Tier | Price | COGS (mid) | **Gross margin** |
| --- | --- | --- | --- |
| Solo | £59 | ~£18 | ~70% |
| Clinic | £179 | ~£18 | ~90% |
| Chain | £399 | ~£25 (heavier use) | ~94% |

Validate gross margin at each tier against real COGS before GA (plan §14).

## 6. Owner decisions needed

1. Confirm or replace the fixed-cost figures in §2 with real invoices.
2. Confirm the tier amounts in §4 (or set your own).
3. Confirm the per-extra-location price for Chain.
4. Confirm the SMS/storage allowances and overage rates.
5. Decide whether white-label is Chain add-on or Enterprise-only.

Once these are set, the plan can be baselined (see SAAS_PLAN_SUMMARY.md, BLD-46) and
the tiers wired as entitlement config.
