# ClinicOS — platform plan, one-page summary for sign-off (BLD-46)

> A short summary of `docs/PLATFORM_SAAS_PLAN.md` for owner sign-off. Signing baselines
> the plan; it does not commit spend (the data-protection pack spend is held under
> BLD-304, and pricing is a separate sign-off under BLD-47). British English.

## What we are doing

Extract the working K Clinics product into a multi-tenant SaaS ("ClinicOS") that
other clinics can license. We are not rewriting — we are adding a tenancy layer to a
product already proven daily by a live clinic.

## How it is built

- **Pooled multi-tenancy:** one shared database with a `tenantId` column and
  Row-Level Security as the backstop. Lowest cost per tenant, with a hard isolation
  guarantee. Enterprise tenants can be given dedicated ("silo") isolation on demand.
  (ADR-003 / ADR-015.)
- **Tenant isolation rings (in progress):** tenant column + constraints and query
  scoping are merged; RLS is staged behind an off-by-default flag and enabled only
  after rehearsal on a database branch (the highest-risk step — see BLD-489/301).
- **Go-to-market:** lead with a named product brand, offer white-label as a premium
  tier (ADR-009).
- **Tiers:** Solo / Clinic / Chain / Enterprise, with usage components (SMS, storage,
  payment volume, seats). Entitlement/metering is tier-agnostic config, so prices are
  set without code changes (ADR-012).

## Commercial shape

- **Costs:** pooled tenancy keeps cost per tenant low and falling with scale; usage is
  pass-through-plus. COGS draft + tier proposal: `docs/SAAS_PRICING_DRAFT.md` (BLD-47).
- **Compliance gate before the first external clinic:** DPA/MSA, ROPA, DPIA,
  sub-processor register, Cyber Essentials, insurance. Draft pack exists (BLD-304,
  PR #1084); spend held until clinic #1 is real.
- **Certifications, phased:** Cyber Essentials → NHS DSPT → ISO 27001 → SOC 2
  (ADR-011).

## What sign-off means

Approving this baselines the architecture and go-to-market decisions above so build
work can proceed against them. It does **not** by itself:

- release legal/insurance spend (BLD-304 holds that), or
- fix prices (BLD-47 is a separate sign-off), or
- enable RLS on production (that is a gated, rehearsed deploy step).

## Open items still needing the owner

| Item | Board ref | Needs |
| --- | --- | --- |
| Pricing tiers & amounts | BLD-47 | Confirm/replace draft figures |
| Data-protection pack + pilot budget | BLD-304 | Approve docs; confirm held spend |
| RLS rollout | BLD-489 / BLD-301 | A Neon branch DATABASE_URL to rehearse against |
| Client data migration | BLD-17 | A sample export from the old system |

## Sign-off

- [ ] Architecture (pooled + RLS, silo on demand) — approved
- [ ] Go-to-market (named brand + white-label tier) — approved
- [ ] Tier structure (Solo/Clinic/Chain/Enterprise + usage) — approved
- [ ] Certification order (CE → DSPT → ISO 27001 → SOC 2) — approved

Owner: ______________________   Date: ____________
