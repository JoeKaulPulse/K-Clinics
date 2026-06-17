# K Clinics → ClinicOS — Platform Decomposition & Multi‑Tenant SaaS Plan

> **Status:** DRAFT for review · **Mode:** planning only — *nothing in this document is to be executed without explicit sign‑off* · **Version:** 0.3 (phase‑1 scoping addendum appended 2026‑06‑12, BLD‑35; leadership decisions logged in §17, 2026‑06‑08) · **Owner:** Joe Kaul / engineering leadership
>
> This is the canonical reference for evolving the K Clinics monolith into a containerised, independently‑deployable, **multi‑tenant platform that K Clinics will operate for itself and licence to other clinics.** It is deliberately conservative: the live booking environment and its revenue must never be put at risk by this programme.

---

## 0. How to read this document

- **§1–§3** set the vision, the commercial product, and the non‑negotiables.
- **§4–§6** are the operational heart: how we work in parallel without touching live, and how we treat the one production database safely.
- **§7–§10** are the architecture (multi‑tenancy, services, infra, security/compliance).
- **§11–§16** are execution: roadmap, validation/stress‑testing, risk register, cost, decisions (ADRs), KPIs.
- **§17–§18** are open questions and the *only* immediate, low‑risk actions proposed.

A change is not "planned" here until it has: a rollback, a data‑loss assessment, and a validation gate. Where a decision is made, it is logged as an ADR (§15) with the alternatives considered.

---

## 1. Executive summary

K Clinics runs a single Next.js application on Vercel backed by one managed Postgres. It works, but every change rebuilds and redeploys the **whole** product, the blast radius of any fault is the entire business, and we have already seen monolith‑scale incidents (deploy herds exhausting the database's connection cap).

We will evolve it, **incrementally and without downtime**, into:

1. **A modular, containerised platform** where each capability ("tool") — booking, payments, CRM/clinical, commerce, marketing, learning, content — is its own independently‑deployable service in its own isolated namespace, communicating over secure, versioned contracts and an event bus, with global controls (identity, RBAC, settings, audit, observability) kept central.
2. **A multi‑tenant SaaS product — working name "ClinicOS"** — that other clinics licence. K Clinics is **tenant #1 and the reference customer**. This is positioned at the top of the requirements, not bolted on: every architectural decision below is tested against "does this work for 1 clinic and for 500 clinics?"

**Why this is the right bet:** the clinic‑management market (Pabau, Phorest, Fresha, Aesthetics Pro, Zenoti, etc.) is large but the incumbents are widely criticised for clunky UX, weak security posture, inconsistent reliability, rigid workflows, and aggressive pricing/lock‑in. K Clinics already has a product that is **better on UX, security (encrypted clinical data, passkeys, audit), and breadth** than much of the field. Productising it is a credible, high‑margin expansion with a built‑in anchor tenant proving it daily.

**Guardrail above all else:** the live K Clinics site keeps serving bookings throughout. The programme runs in a **separate environment** and only ever touches production through the existing, disciplined deploy process.

---

## 2. Commercial strategy & product vision (top of the plan)

### 2.1 The product
**ClinicOS** — an all‑in‑one operating system for aesthetic, skin, and dental clinics: online booking + deposits, CRM with encrypted clinical records and consent, scheduling/rooms, inventory with batch traceability, marketing/automations, e‑commerce + POS, loyalty/membership, an academy/LMS, and a white‑label public website — sold as a managed SaaS.

### 2.2 Positioning (how we beat incumbents)
| Vector | Incumbent weakness | ClinicOS promise | How the architecture delivers it |
|---|---|---|---|
| **Quality / UX** | Dated, fragmented admin; poor mobile | One coherent, fast, modern UX | Unified shell + design system; per‑tool teams ship polish fast |
| **Security** | Weak isolation; PHI handling questioned | Encrypted clinical data, passkeys, audit, tenant isolation, certifications | Dedicated clinical zone, zero‑trust mesh, field‑level encryption, SOC2/ISO27001 path (§10) |
| **Consistency / reliability** | Outages, slow support | Per‑tool blast‑radius isolation, SLOs, status page | Namespaced services, canary deploys, observability (§9) |
| **Adaptability** | Rigid; expensive customisation | Per‑tenant feature flags, branding, workflow config, API/webhooks | Multi‑tenant config service + public API (§7) |
| **Price** | High per‑seat + add‑on creep | Transparent, lower TCO | Pooled multi‑tenancy → low COGS/tenant (§14) |

### 2.3 Target customers & GTM (for architecture sizing only)
- **Beachhead:** UK single‑site aesthetic/skin clinics (K Clinics' own peer group), then small chains (2–10 sites), then dental.
- **Licensing model (drives multi‑tenant requirements):** SaaS subscription tiers (Solo / Clinic / Chain / Enterprise) + usage components (SMS, storage, payment volume) + optional white‑label public site. Enterprise tier may require **dedicated/"silo" isolation** (see §7.2) — the architecture must support pooled *and* silo tenants.
- **Commercial non‑functionals this imposes:** self‑serve tenant onboarding, per‑tenant billing/metering, per‑tenant data export & deletion (offboarding without lock‑in — a selling point), 99.9%+ SLA, UK/EU data residency, sub‑processor transparency.

### 2.4 Build‑vs‑buy framing
We are **not** rewriting; we are **extracting** an already‑working product and adding a tenancy layer. The commercial value is high and the incremental cost is bounded because the domain logic already exists and is battle‑tested by a live clinic.

---

## 3. Guiding principles & non‑negotiables

1. **Live revenue is sacred.** No programme activity may degrade live booking, payments, or admin. Live keeps deploying via the current rules.
2. **No data loss, ever.** Every schema or data operation is reversible or backed by a tested restore. Destructive migrations are forbidden on the shared production database (§6).
3. **Multi‑tenant by construction.** Every service is tenant‑aware from its first commit; tenancy is never retrofitted.
4. **Tenant isolation is a security boundary**, especially for clinical/PHI data — assume a breach of one tenant must not reach another.
5. **Incremental & reversible.** Strangler‑fig extraction; each step independently valuable and independently revertable. No big‑bang cutover.
6. **Contracts before code.** Service seams (APIs + events) are designed, versioned, and contract‑tested before extraction.
7. **Global controls never lost.** Identity/RBAC, settings/feature‑flags, audit, and observability stay centralised and authoritative across all tools and tenants.
8. **Best‑in‑class, commercially sound.** Prefer managed services over self‑hosting control planes; optimise for COGS/tenant and team operability, not novelty.
9. **Everything observable & documented.** Tracing across tools; decisions captured as ADRs.

---

## 4. The dual‑track operating model (formalising the three rules)

While the platform is built, **every requested change to the site follows a strict dual‑track discipline** so the live product improves *and* the new platform stays in lock‑step.

**Rule 1 — Ship to live first.** The change is implemented against the current codebase and deployed to production following the **established sequencing rules**: develop on a feature branch → PR → build green (`tsc` + `next build`) → merge **one change at a time** → confirm the production deploy is green before the next merge (the `db-sync` resilience fix that rides out migration‑connection pressure remains in force).

**Rule 2 — Mirror into the new product.** The same change is reflected in the new, restructured codebase (the modular/containerised version) and verified to work there, structured to benefit from the cluster setup (clean module boundaries, tenant‑aware, talks via contracts/events rather than cross‑domain imports).

**Rule 3 — One database, honoured by both.** Both environments point at the **live production database** as the single source of truth (and any associated read‑replica/pooled image cluster). There is **no data fork.** This is powerful (no divergence) and dangerous (two app versions, one datastore) — §6 defines exactly how we make it safe.

**Mechanics that keep the two tracks from diverging:**
- **Shared domain core.** During Phase 0 the business logic is moved into framework‑agnostic domain packages (a monorepo). Both the live Next.js app and the new platform consume the *same* domain packages, so a fix is written once and surfaces in both. This is the key to making "do it twice" actually be "do it once, deploy two ways."
- **Mirror checklist on every PR.** A PR template field: *"Reflected in platform track? [link]"*. Definition‑of‑done includes both tracks building green.
- **Parity tests.** A contract/snapshot suite asserts the two tracks produce identical outputs for the same inputs against the same DB (read‑only) until the new platform is ready to take writes.

> **Stress test of Rule 3:** Two codebases writing to one production DB concurrently is the single highest‑risk idea in this plan. It is only safe if (a) the new platform is **read‑only against production until cutover**, or (b) both tracks are **schema‑compatible at all times** via expand‑contract migrations and feature flags. We adopt **both** as belt‑and‑braces — see §6.3. Until the new platform has passed isolation, load, and DR validation (§12), it **must not write** to the production database; it reads (via a replica where possible) and writes only to a disposable shadow schema.

---

## 5. Environment & DNS strategy

### 5.1 Environments
| Env | Purpose | Hosting | Database | Writes to prod data? |
|---|---|---|---|---|
| **Live (current)** | Real customers & revenue | Vercel (existing project) | Prisma Postgres (prod) | Yes (as today) |
| **Platform‑staging** | Build & validate the new architecture | **New Vercel project** + (later) managed K8s cluster | Read‑replica / Postgres **branch** of prod; shadow schema for writes | **No** (read‑only on prod until cutover) |
| **Platform‑prod (future)** | The new live, post‑cutover | Managed K8s (+ gateway/CDN) | Prod Postgres (becomes the cluster's primary) | Yes (after cutover) |
| **Tenant sandbox** | Demo/eval tenants for sales & QA | Platform‑staging cluster | Isolated seed data (never prod) | No |

**A new, isolated Vercel project** is created for the platform track (separate env vars, separate domains e.g. `platform.kclinics.internal` / preview URLs). It must **not** share Vercel project settings, cron, or webhooks with live. This satisfies "do not interfere with the live environment or its hosting infrastructure."

### 5.2 DNS & cutover (designed now, executed much later)
- Keep production DNS on the live environment throughout the build.
- Pre‑cutover: lower DNS **TTL** (e.g. to 60s) days ahead; pre‑warm the new platform; run it in production‑shadow mode (mirrored read traffic) to validate at real load.
- **Cutover = a DNS repoint** (blue/green at the edge): switch the apex/`www` and `book`/app hostnames to the new platform behind the gateway/CDN. **Stripe webhooks, OAuth redirect URIs (Xero/Google/TrueLayer), email links, and passkey `rpID`** must be migrated/aliased *before* cutover (we just hardened `rpID` to the registrable domain, which helps).
- **Instant rollback:** repoint DNS back to live. Because the database is shared and the new platform was schema‑compatible (§6), rollback loses nothing. Keep the old environment hot for a defined bake period (e.g. 2–4 weeks) before decommission.
- **Cutover is gated** behind every check in §12 passing, including a full DR drill and a security/pen test.

### 5.3 Hosting decision (ADR‑002)
Today's Vercel simplicity is a strength. The platform target is **managed Kubernetes** (for namespaced tenant/tool isolation, network policy, mesh, and portability — important for enterprise/silo customers who may demand specific regions or even on‑prem). The public marketing/booking frontend may remain on a Vercel‑like edge or move to the cluster's CDN; this is decided per §8.5. We explicitly accept the trade: **Vercel zero‑ops → cluster control + multi‑tenant isolation + portability**, and we de‑risk it with fully managed K8s/DB/mesh rather than self‑hosting control planes.

---

## 6. Database strategy & data‑loss prevention (the highest‑risk area)

### 6.1 Principle
The live Postgres remains the **single source of truth**. We do **not** fork it. We protect it with the strongest possible guardrails because two app generations and (eventually) many tenants depend on it.

### 6.2 Tenancy data model (decided in §7.2): **pooled with a `tenant_id` discriminator + Postgres Row‑Level Security (RLS)**, schema‑per‑bounded‑context, with **silo (separate DB) available for enterprise/clinical‑sensitive tenants.** Every table gains a non‑null `tenant_id`; every query is tenant‑scoped; RLS is the backstop so an application bug cannot cross tenants. K Clinics' existing data is migrated as **tenant #1** (a backfill, not a destructive change).

### 6.3 Safe coexistence of two app generations on one DB — **Expand / Migrate / Contract**
All schema evolution uses the **expand‑contract (parallel change)** pattern so old and new code are *always* compatible:
1. **Expand:** add new columns/tables/`tenant_id` as **nullable/defaulted, additive only**. Never rename/drop in place.
2. **Backfill** in batches, online, idempotent, resumable; verified by row‑count and checksum.
3. **Migrate** readers/writers behind **feature flags**, dual‑writing if needed.
4. **Contract:** only after *both* tracks no longer use the old shape, and after a backup, drop the old column — as its own, reversible step.

**Hard rules on the shared production DB:**
- **No destructive DDL** (`DROP`, destructive `ALTER`, `db push --accept-data-loss`) against prod. The platform track's risky/destructive experiments run only against a **Postgres branch or disposable copy**, never prod. (Note: today's `scripts/db-sync.mjs` uses `prisma db push --accept-data-loss`; for the platform we move to **versioned, reviewed migrations** — ADR‑004 — and forbid data‑loss flags in any prod path.)
- **New platform is read‑only on prod until cutover.** Its writes target a **shadow schema** until validation passes.
- **Migration connection discipline** stays (single migration runner; the resilient pre‑check; no concurrent deploy herds).

### 6.4 Backup, DR & data‑loss prevention
- **Continuous backups + point‑in‑time recovery (PITR)** on the managed Postgres; **tested restores on a schedule** (a backup you haven't restored isn't a backup).
- **Pre‑migration snapshots** before any expand/contract step, with the snapshot id recorded in the migration's runbook.
- **Logical, encrypted exports** retained off‑platform (we already have a full tenant data export — generalise it per‑tenant for both DR and customer offboarding).
- **RPO/RTO targets** defined per data class (clinical PHI: RPO ≤ 5 min, RTO ≤ 1 h) and proven by **DR drills** (§12).
- **Data‑loss kill‑switches:** migrations run with statement timeouts, batch caps, and an abort‑on‑drift guard.

### 6.5 Connection management
Continue routing runtime through the **pooler** (Accelerate / `PRISMA_DATABASE_URL`); the cluster adds its own pooling (e.g. PgBouncer/per‑service pools) so that fan‑out across many services and tenants cannot exhaust the primary — the failure mode we already hit, now designed out.

---

## 7. Multi‑tenancy architecture

### 7.1 Tenant context
A **`tenant_id`** is resolved at the edge (from hostname/subdomain/custom domain, or token claim) and propagated through the gateway into every service call and event as a signed claim. No service trusts a client‑supplied tenant id; it comes from the authenticated context. Every datastore access is tenant‑scoped; **RLS** enforces it at the database even if application code forgets.

### 7.2 Isolation model (ADR‑003): **pool by default, silo on demand**
- **Pooled** (shared schema + `tenant_id` + RLS): lowest COGS, fastest onboarding — the default for Solo/Clinic/Chain tiers.
- **Bridge** (schema‑per‑tenant) for tenants needing stronger separation without full silo.
- **Silo** (dedicated DB/namespace, optionally dedicated region/cluster) for Enterprise or regulatory cases. The clinical/PHI service is architected so a tenant can be promoted pool→silo **without code change** (only deployment topology differs).

### 7.3 Tenant‑aware platform concerns
- **Identity & RBAC:** users belong to a tenant; roles/permissions (your existing `bookings.charge`, `settings.manage`, …) are evaluated **within tenant scope**; platform‑staff "break‑glass" cross‑tenant access is separately audited.
- **Configuration & feature flags:** per‑tenant settings (your `lib/settings` generalised), feature entitlements by plan, and **white‑label branding** (logo, palette, domain, email sender) — already partly present (brand/site/pages) and a strong differentiator.
- **Billing & metering:** subscription + usage (SMS, storage, payment volume, seats) metered per tenant; integrates with Stripe Billing; dunning, plan limits, and entitlement enforcement.
- **Onboarding & offboarding:** self‑serve tenant provisioning (seed catalogue/rooms/templates — we already have idempotent seeds), and **clean export + hard delete** on exit (anti‑lock‑in as a sales point and a GDPR requirement).
- **Noisy‑neighbour protection:** per‑tenant rate limits and resource quotas at the gateway and mesh.

### 7.4 Tenant data‑leakage prevention (a top risk, §13)
RLS + tenant‑scoped repositories + **automated isolation tests** (every endpoint fuzzed cross‑tenant in CI) + query‑time tenant assertions + per‑tenant encryption keys for the most sensitive clinical fields (envelope encryption, KMS‑managed).

---

## 8. Target system architecture

### 8.1 Bounded contexts ("tools" / namespaces)
Derived from the current domains (admin sections + `lib/*` + API routes):

| Tool | Owns | Sensitivity | Extraction order |
|---|---|---|---|
| **Identity & Access** (platform) | auth (admin/client/academy), passkeys, sessions, **tenant‑scoped RBAC** | High | Early (foundation) |
| **Content/CMS & Public Site** | pages, blocks, brand, SEO, media, marketing site, white‑label | Low | **First extraction** (low coupling) |
| **Learning** | Academy/LMS, careers | Low | Early |
| **Marketing & Comms** | campaigns, audiences, email/SMS, automations, reviews, **notifications hub** | Medium | Mid |
| **Commerce** | shop, products, orders, POS, gift vouchers | Medium (payments) | Mid |
| **Loyalty & Membership** | rewards, points, promos/discounts, referrals | Low‑Med | Mid (mostly event‑driven) |
| **Booking & Scheduling** | availability, slots, rooms/resources, calendar, time‑off | High (revenue) | Later |
| **Payments & Billing** | Stripe, charges, SCA recovery, invoices, cashflow, Xero/TrueLayer | **Critical** | Late |
| **CRM & Clinical** | clients, consultations, **PHI/consent/before‑photos**, notes | **Critical (PHI)** | **Last** (highest care) |

### 8.2 Platform / shared services (the global controls)
API Gateway/BFF · Identity & RBAC (policy via OPA/OpenFGA) · **Event bus** (NATS JetStream or Kafka/Redpanda) · Settings/Feature‑flags · **Audit** (append‑only, tenant‑aware) · Notifications · **Observability** (OpenTelemetry traces, Prometheus/Grafana, central logs) · Billing/Metering · Tenant Management/Onboarding.

### 8.3 Inter‑service communication
- **Sync:** REST/gRPC via gateway + **service mesh mTLS**; versioned OpenAPI/protobuf contracts; **consumer‑driven contract tests (Pact)** gate merges.
- **Async (the cross‑tool workflows):** events + **sagas** with compensation. The treatment lifecycle — already a best‑effort chain in the code — becomes durable:
  `Booking.TreatmentCompleted → Payments.charge → PaymentCharged → {Loyalty.award, Marketing.requestReview, Analytics.recordSale}`. Handlers are **idempotent** (the `chargedAt`‑style guard, formalised) and retried.

### 8.4 Data per service
- Start with **schema‑per‑context inside the one prod Postgres**; forbid cross‑schema joins in app code (access other domains via API/events).
- **Cross‑domain dashboards** (e.g. the admin overview that aggregates ~13 tables) move to a **reporting/read‑model service** fed by events (CQRS‑lite) — never live cross‑service joins.
- **Physically separate DBs** only where justified first: **CRM/Clinical** (PHI isolation/silo) and **Payments**.

### 8.5 Frontend strategy (preserve the single‑product feel)
- **Phase A (recommended start):** keep **one Admin shell + one public/booking frontend** acting as a **BFF** over the tool APIs. Global nav, auth, RBAC gating, white‑label theming live here → one coherent product; backends deploy independently. Multi‑tenant theming is applied at this layer.
- **Phase B (only if the frontend build becomes the bottleneck):** **micro‑frontends** (Module Federation) per tool into the shell. Powerful, heavy — deferred until proven necessary.

---

## 9. Platform & infrastructure

- **Managed Kubernetes** (EKS/GKE/AKS) · **namespace‑per‑tool** and tenant tiering; `NetworkPolicy` default‑deny.
- **Service mesh** (Linkerd — operational simplicity) for mTLS, retries, traffic shaping, golden‑signal metrics.
- **GitOps** (Argo CD/Flux) + **Helm/Kustomize**: each tool has its **own pipeline, image, chart**; a commit to a tool's path builds/deploys **only that tool** — the per‑tool production push the business wants, and the fix for "rebuild the whole product."
- **Progressive delivery:** canary/blue‑green per tool (Argo Rollouts) with automatic rollback on SLO breach.
- **IaC** (Terraform), signed images + SBOM, **secrets** via External Secrets/Vault + KMS (replacing Vercel env vars; clinical keys in managed KMS).
- **Edge/CDN + WAF** in front of the gateway; per‑tenant custom domains + TLS automation.

---

## 10. Security, privacy & compliance (a product feature, not overhead)

Selling to clinics handling **UK special‑category (health) data** makes this a core capability and a differentiator:
- **Certifications roadmap:** Cyber Essentials (quick), **NHS DSPT**, **ISO 27001**, then **SOC 2 Type II** as we scale — directly sellable trust signals incumbents under‑deliver.
- **Clinical/PHI zone:** dedicated namespace + (silo) DB, deny‑by‑default network policy, **field‑level/envelope encryption** (extend current `HEALTH_ENCRYPTION_KEY` to per‑tenant keys), strict audit, least‑privilege service identity.
- **Zero‑trust:** mTLS everywhere; every call carries a verified tenant+user token; gateway enforces RBAC; services re‑check (defence in depth).
- **Privacy/GDPR:** lawful basis, retention schedules, DSAR/export & **right‑to‑erasure** per tenant, **sub‑processor register** (Stripe, email/SMS, host) with DPAs, **UK/EU data residency** (we're in `lhr1` today — keep UK by default, region‑pin for enterprise).
- **Assurance:** annual + pre‑cutover **penetration test**, continuous dependency/secret scanning, tenant‑isolation test suite, incident response runbook & status page.

---

## 11. Migration roadmap & implementation forecast

Strangler‑fig; each phase independently valuable, each with explicit **entry/exit gates** and rollback. Forecast assumes a small senior team + platform/DevOps capability; treat as planning ranges, not commitments.

| Phase | Goal | Key exit gate | Indicative window |
|---|---|---|---|
| **0 — Modularise in place** | Monorepo (Turborepo/Nx) + remote caching + **affected‑only builds**; enforce module boundaries; extract framework‑agnostic **domain packages** shared by both tracks; **no infra change** | Live build cost per change ↓ ≥50%; boundary lint green; live unaffected | 4–8 wks |
| **1 — Platform foundation** | New Vercel project + managed K8s, gateway, **Identity/RBAC**, event bus, observability, GitOps, secrets; **containerise the monolith** and run it in‑cluster (still one workload); read‑only on prod DB | Monolith serves in‑cluster from a replica; tracing end‑to‑end; DR drill #1 passes | 6–10 wks |
| **2 — Tenancy layer** | `tenant_id` + **RLS** (expand‑only); backfill K Clinics as tenant #1; tenant context at the edge; billing/metering skeleton; tenant‑isolation test suite | Isolation tests pass; K Clinics runs as a tenant in staging with **zero data change** in prod | 6–10 wks |
| **3 — First service extraction** | Extract **Content/CMS** (or Learning) behind the gateway; prove contracts, events, deploy, rollback, per‑tool pipeline | One tool deploys to staging independently; contract tests gate; parity vs monolith | 4–6 wks |
| **4 — Extract by value/coupling** | Marketing → Commerce → Loyalty → Booking; **Payments & CRM/Clinical last** | Each tool: own pipeline, SLOs, isolation, parity, rollback | 4–8 wks **each**, parallelisable |
| **5 — Cutover** | Shadow at real load → DNS repoint (blue/green) → bake → decommission monolith; split clinical/payments DBs where justified | All §12 gates incl. pen test + DR drill; instant‑rollback proven | 4–8 wks |
| **6 — Commercial launch** | Self‑serve onboarding, plans/entitlements, white‑label, status page, support; first external pilot tenant | Pilot clinic live on pooled tenancy; SLA instrumented | parallel from Phase 2 |

**Total:** a 9–15 month programme, **front‑loaded with value** — Phase 0 alone fixes the stated compute pain with zero infra risk, and the live site is untouched until the gated cutover.

---

## 12. Validation & stress‑testing strategy

No phase advances without its gate. Validation is layered:
- **Contract tests (Pact)** — providers can't break consumers; gates every merge.
- **Parity tests** — new platform vs monolith produce identical results for identical inputs against the same (read‑only) data, until cutover.
- **Load & soak tests** — model peak booking + many tenants; specifically **re‑create the connection‑exhaustion incident** to prove the pooling design defeats it.
- **Tenant‑isolation tests** — automated cross‑tenant access attempts on every endpoint; RLS verified; fail the build on any leak.
- **Chaos engineering** — kill pods/services, inject latency/DB failover; verify graceful degradation (the "call us" booking fallback must survive).
- **DR drills** — scheduled restore‑from‑backup and region/failover exercises against RPO/RTO targets.
- **Security testing** — SAST/DAST, dependency & secret scanning, pre‑cutover **penetration test**, and a tenant‑isolation pen test.
- **Migration rehearsals** — every expand/contract step rehearsed on a prod **branch/snapshot** with row‑count + checksum verification before it goes near prod.

---

## 13. Risk register (live document)

| # | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R1 | **Data loss** during migration/tenancy backfill | Low | **Critical** | Expand‑contract only; pre‑step snapshots + tested PITR; batch/idempotent backfills with checksums; no destructive DDL on prod (§6) | Eng lead |
| R2 | **Two apps, one DB** corrupt/contend | Med | **Critical** | New platform **read‑only on prod until cutover**; schema‑compatible at all times; shadow‑schema writes; migration connection discipline (§4, §6.3) | Eng lead |
| R3 | **Cross‑tenant data leakage** (PHI) | Med | **Critical** | RLS backstop + tenant‑scoped repos + CI isolation fuzzing + per‑tenant encryption (§7.4) | Security |
| R4 | **DNS cutover failure** / broken webhooks/OAuth | Med | High | Low TTL, blue/green, pre‑migrated Stripe/OAuth/rpID, shadow at load, instant DNS rollback, hot old env (§5.2) | Eng lead |
| R5 | **Live interference** from programme work | Low | **Critical** | Separate Vercel project + cluster; no shared prod infra/cron/webhooks; live deploys via existing sequencing only (§4, §5) | All |
| R6 | **Distributed‑systems failure modes** new to the team | High | High | Observability *before* splitting; sagas + idempotency; chaos drills; managed infra; extract gradually (§9, §12) | Platform |
| R7 | **Operational overload** (running K8s/mesh/DB) | Med | High | Managed offerings only; GitOps; platform team or partner; don't self‑host control planes | Platform |
| R8 | **Scope creep / never‑finishing migration** | High | High | Strangler with a hard rule: no new features in the monolith for an extracted domain; phase gates; the two‑track discipline keeps live moving | PM |
| R9 | **Compliance gap** blocks SaaS sales | Med | High | Certifications roadmap started in Phase 1; DPAs; data residency; pen tests (§10) | Security/legal |
| R10 | **Cost overrun** (infra + build) | Med | Med | COGS/tenant modelled (§14); start pooled; reserved capacity; FinOps dashboards | Finance/Eng |
| R11 | **Contract drift between the two tracks** | Med | Med | Shared domain packages; mirror‑checklist in PR template; parity tests (§4) | Eng |

---

## 14. Cost & unit economics (commercial soundness)

- **One‑time build:** the programme (team + infra setup + certifications + pen tests). Bounded because logic is reused, not rewritten.
- **Run cost / COGS per tenant:** pooled tenancy keeps marginal cost low (shared compute/DB); usage components (SMS, storage, payment volume) are pass‑through‑plus. Model COGS at 10 / 100 / 500 tenants; silo tenants priced to cover dedicated infra.
- **Pricing to beat incumbents:** transparent tiers undercutting per‑seat + add‑on‑creep models, with **lower TCO** as the headline. Validate gross margin ≥ target at each tier before GA.
- **FinOps:** per‑tool and per‑tenant cost attribution (namespace/labels) from day one so pricing stays grounded in real unit costs.

---

## 15. Decision log (ADRs)

> Each ADR: decision · rationale · alternatives considered · status.

- **ADR‑001 — Strangler‑fig, not rewrite.** Extract incrementally behind contracts. *Alt:* big‑bang microservices rewrite (rejected: highest risk to live & runway). **Accepted.**
- **ADR‑002 — Managed Kubernetes on GCP (`europe‑west2`/London) as the platform target.** GKE for namespaced isolation + portability; Cloud SQL/AlloyDB for Postgres; Google KMS for keys; UK data residency. *Alt:* AWS/EKS (widest ecosystem), Azure/AKS (NHS alignment), stay on Vercel serverless (rejected for multi‑tenant isolation/portability). **Accepted** (cloud + in‑house team now confirmed — decisions #1, #2).
- **ADR‑003 — Pooled multi‑tenancy + RLS by default; silo on demand.** Best COGS with a hard security backstop; enterprise path preserved. *Alt:* silo‑only (too costly), pool‑only (blocks enterprise). **Accepted.**
- **ADR‑004 — Versioned, reviewed migrations + expand/contract; ban data‑loss flags on prod.** Replaces `prisma db push --accept-data-loss` in any prod path. *Alt:* keep `db push` (rejected: unsafe for shared prod DB & many tenants). **Accepted.**
- **ADR‑005 — New platform is read‑only on prod until a gated cutover.** Eliminates the dual‑write corruption risk during the build. *Alt:* dual‑write from the start (rejected: R2). **Accepted.**
- **ADR‑006 — Unified frontend/BFF first; micro‑frontends only if justified.** Preserve single‑product UX cheaply. *Alt:* micro‑frontends now (deferred: complexity). **Accepted.**
- **ADR‑007 — Monorepo + shared domain packages power both tracks.** A fix is written once and deploys two ways. *Alt:* two divergent repos (rejected: R11). **Accepted.**
- **ADR‑008 — Build platform/SRE capability in‑house.** A licensed, certified product needs durable platform ownership. *Alt:* outsource/managed‑platform vendor (faster start, less control), hybrid (rejected for the product ambition). **Accepted** (decision #2).
- **ADR‑009 — Dual go‑to‑market: named product brand + white‑label tier.** Lead with a brand; offer white‑label as a premium tier. Public site & theming must support full per‑tenant white‑label from the tenancy layer. *Alt:* brand‑only or white‑label‑only (both narrower). **Accepted** (decision #3).
- **ADR‑010 — Conservative cutover: ~4‑week bake, hot old environment, instant DNS rollback.** Lowest risk to live revenue. *Alt:* moderate/aggressive bake (rejected given revenue sensitivity). **Accepted** (decision #4).
- **ADR‑011 — Phased certifications: Cyber Essentials → NHS DSPT → ISO 27001 → SOC 2.** Cost‑spread, UK‑health‑first. *Alt:* fast‑track ISO 27001 (higher upfront), minimum‑only (limits sales). **Accepted** (decision #6).
- **ADR‑012 — Tier‑agnostic entitlement/metering; pricing deferred to COGS.** Build flags/metering so tiers are pure configuration; set tiers/prices after modelling COGS at 10/100/500 tenants. *Alt:* lock tiers now (rejected: pricing unfounded without unit economics). **Accepted** (decision #5).
- **ADR‑013 — Bootstrapped pace, funded from clinic revenue; Phase 0 value first.** Protect cash; deliberate, incremental delivery; revisit external investment once a pilot tenant is live. *Alt:* funded programme / raise‑first (deferred). **Accepted** (decision #7).

---

## 16. Success metrics / KPIs

**Engineering:** build minutes per change ↓; deploy frequency ↑; **blast radius** (routes/services affected per deploy) ↓; DORA (change‑failure rate, MTTR); per‑tool SLOs met; **zero** cross‑tenant isolation test failures; DR drill RPO/RTO met.
**Commercial:** time‑to‑onboard a new tenant; gross margin per tier; first external pilot live; churn/expansion once selling; security questionnaire pass rate vs incumbents.
**Safety (programme):** **zero** live‑environment incidents attributable to the programme; **zero** production data‑loss events.

---

## 17. Leadership decisions (logged)

Captured 2026‑06‑08 (J. Kaul). These are now baseline; downstream sections/ADRs updated accordingly.

| # | Question | **Decision** | Implication |
|---|---|---|---|
| 1 | Cloud & region for cluster + prod DB primary | **GCP — London (`europe‑west2`)**, GKE | UK data residency met; standardise on GKE + Cloud SQL/AlloyDB for Postgres + Google KMS. → ADR‑002 |
| 2 | DevOps/SRE capability | **Hire in‑house** | Build lasting platform/SRE capability (suits a product to be licensed & certified); budget a permanent role. → ADR‑008; strengthens R6/R7 mitigation |
| 3 | Product branding | **Both — named brand + white‑label tier** | Lead with a product brand; white‑label as a premium tier. Public‑site/theming must support full white‑label from the tenancy layer. → ADR‑009; expands §2, §7.3, §8.5 |
| 4 | Cutover risk appetite | **Conservative — long (~4‑wk) bake + instant rollback** | Keep old env hot ~4 wks; shadow at load; instant DNS rollback. Matches §5.2. → ADR‑010 |
| 5 | Tenancy tiers & pricing | **Defer — decide after the COGS model** | Design entitlement/metering to be tier‑agnostic and configurable; lock tiers/prices once COGS at 10/100/500 tenants is modelled (§14). → ADR‑012 |
| 6 | Certification priority/order | **Phased: Cyber Essentials → NHS DSPT → ISO 27001 → SOC 2** | Cost‑spread; matches §10. CE first (quick win), DSPT for UK health, ISO 27001 as we scale, SOC 2 for larger buyers. → ADR‑011 |
| 7 | Funding & pace | **Bootstrapped alongside the clinic** | Fund from clinic revenue; incremental, **Phase 0 value first**; protect cash. Pace is deliberate, not aggressive. → ADR‑013; reinforces R8/R10 |

**Still to finalise (deliberately deferred):** pricing tiers & amounts (after COGS, decision #5); whether to raise investment later (revisit once a pilot tenant is live).

---

## 18. Proposed immediate next steps (low‑risk, still planning/prep — execute only on sign‑off)

1. **Approve this document** as the programme's baseline (§17 decisions now logged; only final sign‑off remains).
2. **Phase 0 spike (no infra, no live impact):** stand up a Turborepo skeleton in a branch, move *one* domain (e.g. Learning) into a shared package behind a clean boundary, and demonstrate **affected‑only builds** — proving the build‑cost win and the dual‑track shared‑core model. Live remains on the current build.
3. **Draft the bounded‑context & event catalogue** (the contracts) so the seams are agreed before any infra spend.
4. **Commission the commercial model** (COGS at 10/100/500 tenants; tier pricing vs named incumbents).
5. **Start the compliance roadmap** (Cyber Essentials first; data‑map for tenancy).

> Nothing in §18 touches the live environment, its hosting, or its database writes. Each item produces a document or an isolated spike branch for review.

---

---

## Phase 1 scoping (v0.3 addendum — BLD-35)

> **Status:** scoping deliverable for BLD-35 · planning only — nothing here is to be built without the §17-style sign-off in 5.2 below · extends plan v0.2; ADR/risk numbering continues from §15/§13. Evidence below is from direct inspection of `prisma/schema.prisma` (117 models), `lib/platform-status.ts`, `lib/secrets.ts`, `lib/auth-edge.ts` and the `app/` route tree on 2026-06-12.

### 1. Extraction candidate ranking

Scoring: **coupling** = hard Prisma relations (`@relation` FKs) from the context's models into core identity/booking models (`Client`, `AdminUser`, `Booking`, `Location`, `Resource`); soft string references (no FK) noted separately. **Revenue criticality** = proximity to live booking/payment flow (highest risk). **Licensing value** = credibility as a standalone, separately sellable ClinicOS module.

| Rank | Context | Models | Hard FKs into core | Revenue criticality | Standalone licensing value | Verdict |
|---|---|---|---|---|---|---|
| **1** | **Academy / Learning** (+careers) | 13 (`AcademyStudent`, `Course`, `CourseModule`, `Lesson`, `Quiz`, `QuizQuestion`, `LessonProgress`, `QuizAttempt`, `LiveClass`, `Cohort`, `Enrolment`; `Vacancy`, `JobApplication`) | **0** | **None** — no Stripe code anywhere under `app/api/academy` or `lib/academy*`; `Enrolment.paidPence` is recorded manually | **High** — a sellable LMS for clinics that run training academies | **Extract first** |
| 2 | Content / CMS & public site | ~14 (`Page`, `PageRevision`, `GlobalSection`, `SiteConfig`, `SiteConfigRevision`, `Post`, `TreatmentContent`, `MediaAsset`, `PageSeo`, `Redirect`, `QrCode`, `QrScan`, `AbTest`, `AbVariant`) | **0** (soft slug refs only: `TreatmentContent.slug`, `GalleryItem.treatmentSlug`, `Post.related[]`) | **Medium-high by adjacency** — it *renders the booking funnel* (`app/(marketing)`, SEO, redirects); a regression hits conversion on kclinics.co.uk | Medium — white-label sites are a tier feature (ADR-009), not a standalone product | Runner-up |
| 3 | Kiosk | 3 (`KioskSession`, `KioskResult`, `KioskEvent`) | **0** (claim flow writes only `KioskResult.claimCode`; `Device.roomId` is a soft string to `Resource`) | None | Low alone — lead-gen gadget; bundle into Marketing or ship as a demo module | Cheap, but not worth a seam of its own |
| 4 | Commerce | 8 (`Product`, `Order`, `OrderItem`, `GiftVoucher`, `StockItem`, `StockMovement`, `Supplier`, `DayClose`) | 2 (`DayClose.locationId` → `Location`; `Supplier.calls` ← CRM `CallRecord`); soft: `Order.clientId`, `GiftVoucher.claimedByClientId`, `StockMovement.bookingId` | **High** — live card revenue through the *same* Stripe account (`Order.stripePaymentIntentId`, `GiftVoucher.stripePaymentIntentId`); `DayClose` reconciles booking charges + paid orders together | Medium | Mid-programme (per §8.1) |
| 5 | Marketing / comms | ~17 | **≥8 FK edges**: `EmailEvent.clientId`, `Review` → `Client`+`Booking`+`AdminUser`, `Referral` → `Client` (×2), `DiscountClaim.clientId`, `ClientPoints.clientId`, `NpsResponse.clientId`, `MarketingCampaign.bookings` | Medium (consent/PECR risk, not direct revenue) | Medium-high, but inseparable from CRM identity | After commerce |
| 6 | Booking & scheduling | ~16 | **Hub** — `Booking` alone holds 10 relations (`Client`, `AdminUser` practitioner, `Location`, `Resource[]`, `MarketingCampaign`, `AuditEvent`, `Review`, `BookingItem`, `FollowUp`, `AppointmentSession`) plus inline Stripe (`stripeSetupIntentId`, `chargePaymentIntentId`) and Xero (`xeroInvoiceId`) fields | **Critical** | High, but only as the core product | Late (per §8.1) |
| 7 | CRM / clinical | ~17 | **Hub of hubs** — `Client` carries 17 back-relations spanning every domain; clinical PHI lives *on the booking row* (`Booking.clinicalNoteEnc`, `Booking.sopChecklistEnc`) | **Critical (PHI)** | High, but last by design | Last (per §8.1) |

**Recommendation (proposed ADR-014): extract Academy/Learning first; Content/CMS is the runner-up.** Plan v0.2 left this open (§11 Phase 3: "Content/CMS (or Learning)"); the schema evidence resolves it:

1. **Zero schema coupling, verified.** Every Learning FK is internal to the cluster; `AcademyStudent` is a *separate identity* with its own `passwordHash` and portal — no relation to `Client` or `AdminUser`. App-layer touchpoints are minimal and clean: `lib/academy-auth.ts` borrows session helpers from `lib/auth` (own `ACADEMY_JWT_SECRET` + own `aud` claim), plus `crmEnabled` gating and notification email (`ACADEMY_NOTIFY_EMAIL`).
2. **Zero live-revenue risk.** No payment code; if the extracted academy falls over, bookings and the shop are untouched — the only first extraction with a genuinely empty blast radius.
3. **Real standalone licensing value.** Aesthetics clinics commonly run training academies; "ClinicOS Academy" is sellable to a pilot tenant *before* the booking core is multi-tenant — earliest possible commercial validation, consistent with ADR-013 (bootstrapped, value first).
4. **Continuity.** §18.2 already nominated Learning as the Phase-0 domain-package spike; extraction continues the same seam rather than opening a second one.

Content/CMS is runner-up rather than first despite equally clean schema coupling because it *is* the public face of the live booking funnel — extracting it moves SEO, redirects and the booking entry pages, which violates the spirit of "live revenue never at risk" for a first attempt. Kiosk should be folded into whichever module hosts lead-gen rather than ranked as a seam.

### 2. Tenancy model decision

**Decision (proposed ADR-015, confirming ADR-003 against this codebase): shared database + `tenantId` column, pooled, with RLS as the backstop — not schema-per-tenant, not DB-per-tenant.**

| Option | Why it fails *here* |
|---|---|
| Schema-per-tenant | Prisma 7's `multiSchema` is **static** (schemas listed in the datasource at generate time); per-request schema switching needs a `PrismaClient` per tenant → a connection pool per tenant per warm lambda on Vercel — re-creating the connection-cap incident §1 cites, by design. |
| DB-per-tenant | Worse on serverless (client + pool per DB), and `scripts/db-sync.mjs` would have to run `prisma db push` N times per deploy — N chances to trip the additive-only gate. Neon branches are a dev/audit tool (see `DATABASE_URL` guidance in CLAUDE.md), not fleet management. |
| **Shared DB + `tenantId`** | One `PrismaClient`, one Accelerate pool (`PRISMA_DATABASE_URL`, already preferred by `lib/platform-status.ts`); adding **nullable** `tenantId` columns is additive and passes the deploy gate; lowest COGS per §14. |

**The one hard constraint this codebase adds:** the deploy gate refuses new `@unique` on existing tables (CLAUDE.md; `lib/task-refs.ts` exists because of it). Tenancy eventually needs per-tenant uniqueness — today `Client.email`, `AcademyStudent.email`, `Service.slug`, `Page.path`, `Product.slug` are *globally* unique, which is wrong the moment tenant #2 arrives, and `@@unique([tenantId, email])` cannot be added through `db push`. **Therefore the tenancy phase is the trigger to flip the platform track to versioned migrations (`USE_MIGRATIONS=true`) — exactly what ADR-004 already mandates.** Until that flip, any interim uniqueness follows the structural pattern in `lib/task-refs.ts` (sequences + lock-serialised allocation + self-healing dedupe).

**Migration path for tenant #1 (K Clinics), all expand-only per §6.3:**
1. Add a `Tenant` model and **nullable** `tenantId String?` to every tenant-owned table (additive; `db push`-safe; no new `@unique`).
2. Backfill every row to the K Clinics tenant id — batched, idempotent, checksum-verified (§6.3 step 2). Zero behaviour change; live code ignores the column.
3. Scope reads/writes via a Prisma client extension (`$extends` query hooks injecting `tenantId` from the resolved tenant context, per §7.1) in the platform track only.
4. Flip the platform track to versioned migrations (ADR-004), then add `NOT NULL`, composite per-tenant uniques, and **RLS policies** as reviewed SQL. Note the pooler caveat: the RLS tenant GUC (`SET LOCAL app.tenant_id`) must be set per-transaction through Accelerate/PgBouncer, so tenant-scoped work wraps in `$transaction`.
5. Singletons become per-tenant rows: `SiteConfig` (`id = "singleton"`), `Setting` (global `key` PK) and `ManagedSecret` (`name` is the `@id`) all need a tenant dimension — see R15/R19.

### 3. Cost estimate — 3-tenant pilot (monthly)

Assumptions: pooled tenancy on the existing topology (Vercel + managed Postgres behind Accelerate, London/`lhr1`); pilot volumes per tenant ≤1,000 bookings/mo, ≤15k emails, ~500 SMS (opt-in fraction, `Client.smsReminders`), AI capped via the existing `AI_MONTHLY_CAP`; Stripe fees excluded (pass-through on each tenant's own account, see R14); GBP, rounded, mid-2026 list prices — to be firmed up in the §14 COGS model.

| Line | Service (as wired today) | Est. £/mo |
|---|---|---|
| Compute/hosting | Vercel Pro, 2 seats + modest usage overage | 32–50 |
| Database | Managed Postgres (Neon/Prisma Postgres) + Accelerate pooling | 15–40 |
| Rate limiting | Upstash Redis, pay-as-you-go (`UPSTASH_REDIS_REST_URL`) | 0–8 |
| File storage | Vercel Blob (`BLOB_READ_WRITE_TOKEN`) — media library + kiosk photos (auto-purged) | ~5 |
| Email | Resend Pro tier (~50k emails) covers all 3 tenants | ~16 |
| SMS | Twilio UK ~£0.04/msg × ~1,500 | ~60 |
| AI | Anthropic (chat assistant, kiosk AI, marketing copy) ~£10–25/tenant | 30–75 |
| **Total** | | **~£160–250** |

Read: fixed platform cost ≈ £70–100; the rest is per-tenant usage (SMS + AI dominate) that ADR-012's metering should pass through. Marginal cost ≈ **£55–80/tenant/mo** — comfortably inside a £150–300/mo licence, supporting §2.2's lower-TCO positioning. A silo tenant adds its own DB (~£15–40) + Blob store.

### 4. Migration risk register (append to §13; numbering continues from R11)

| # | Risk | L | I | Mitigation |
|---|---|---|---|---|
| R12 | **Cross-tenant data isolation** — no `tenantId` exists on any of the 117 models; one missed `where` clause leaks another clinic's data | High (pre-RLS) | Critical | Backfill + client-extension scoping + RLS backstop + CI isolation fuzzing (§7.4) before any tenant #2 row exists |
| R13 | **Auth/session audience confusion** — `lib/auth-edge.ts:98` falls back `ACADEMY_JWT_SECRET → CLIENT_JWT_SECRET → ADMIN_JWT_SECRET` (one signing key across portals); passkey `rpID` is bound to the registrable domain, so per-tenant custom domains fracture WebAuthn | Med | High | Mandatory distinct secrets per audience+tenant at provisioning; keep `aud` claims (already present); per-tenant `rpID` registered at domain onboarding (§5.2) |
| R14 | **Stripe account separation** — single `STRIPE_SECRET_KEY` (env-only by design in `lib/secrets.ts`), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` baked into the browser bundle at build time, and one webhook at `app/api/stripe/webhook` with one `STRIPE_WEBHOOK_SECRET` | High | Critical | Per-tenant Stripe accounts; publishable key moves to runtime tenant config (not build env); webhook route resolves tenant from account id and verifies per-tenant signing secrets |
| R15 | **Env/secret scoping** — `ManagedSecret.name` is the `@id` (no tenant column), so one global row per key; `lib/secrets.ts` resolves with a process-wide 30s cache → tenant B would send email/SMS/AI on tenant A's credentials | High | Critical | Additive `tenantId` on `ManagedSecret` + tenant-keyed cache before any second tenant; per-tenant `EMAIL_FROM`/`TWILIO_FROM` entries |
| R16 | **File-storage isolation** — one Blob store; `MediaAsset` has no tenant dimension; Blob URLs are public-by-obscurity. (Clinical images are safer: `BeforePhoto.dataEnc` and `GalleryItem` bytes live encrypted/in-DB) | Med | High | Tenant-prefixed Blob pathnames + tenant column on `MediaAsset`; per-tenant store for silo tier; keep clinical images in-DB encrypted |
| R17 | **Cron fan-out** — `app/api/cron/{daily,dispatch,kiosk-cleanup}` are single-tenant singletons (last-run in `Setting` keys `cron_daily_last`/`cron_dispatch_last`); naive per-tenant loops will overrun serverless limits and Vercel cron is per-project | Med | Med | Runner iterates tenants with per-tenant time-boxing, checkpoints and per-tenant last-run keys; move to queue-fanned jobs at >10 tenants (§8.2 event bus) |
| R18 | **GDPR/clinical data** — one global `HEALTH_ENCRYPTION_KEY` for all tenants' PHI; DSAR/export/erasure are clinic-wide today; licensing makes K Clinics a *processor* for other controllers | Med | Critical | Per-tenant envelope keys (KMS) per §7.4/§10; per-tenant export/erasure (generalise the existing full export, §6.4); DPA + sub-processor register before the first external tenant |
| R19 | **Brand/theme per tenant** — `SiteConfig` is a singleton row (`id = "singleton"`), defaults in `lib/site.ts`, one verified Resend sending domain; ADR-009 promises full white-label | High | Med | Per-tenant `SiteConfig` rows resolved by hostname (§7.1); per-tenant sender-domain verification at onboarding; theming applied in the BFF shell (§8.5) |

### 5. Go/no-go checkpoint

**5.1 Questions the owner must answer before any build starts** (log answers in §17):

1. **Stripe topology:** does each licensed clinic hold its **own Stripe account** (we never touch their money flow; simplest compliance) or do we platform the payments (Stripe Connect — revenue share but heavier obligations)? Determines R14's mitigation and the Payments seam.
2. **First module & first customer:** is **Academy** confirmed as the first extraction (ADR-014), and can we name **one pilot clinic** with a letter of intent to license it? (No pilot demand → re-rank toward Content/CMS for internal value only.)
3. **Data roles & compliance:** is the controller/processor split, DPA template and sub-processor register (R18) commissioned now, and does Cyber Essentials (ADR-011) start in parallel with phase 1?
4. **Migration regime:** is flipping the platform track to versioned migrations (`USE_MIGRATIONS=true`, ADR-004) approved as a hard precondition of the tenancy backfill — accepting that the live track keeps additive-only `db push` until cutover?
5. **Budget envelope:** are the pilot run-rate (~£200/mo, §3), the in-house platform hire (ADR-008) and one-off compliance/pen-test costs confirmed as affordable within bootstrapped funding (ADR-013)?

**5.2 Definition of phase-1 "done":**

- This addendum is reviewed and merged into `docs/PLATFORM_SAAS_PLAN.md` as v0.3; ADR-014 (first extraction = Academy) and ADR-015 (pooled `tenantId` tenancy, migration-regime trigger) are logged in §15; R12–R19 merged into §13.
- All five questions in 5.1 are answered and recorded in §17.
- The §3 cost table is accepted as the input to the §14 COGS model (decision #5 remains deferred until that model exists at 10/100/500 tenants).
- **No code, schema or infrastructure has changed** — `npx tsc --noEmit` clean, zero deploys attributable to BLD-35 — and the next step (the Phase-0 Learning domain-package spike, §18.2) has a named owner and a start date.

*Done when: the owner signs off v0.3, and BLD-35 moves to Shipped with this section linked.*

---

## Phase 1 decisions + Academy extraction design (v0.4 addendum — BLD-35)

> Owner go/no-go answered 13 Jun. Four decisions locked; ADRs updated; the Academy
> extraction design (Phase 0 spike) follows. Still planning — Ring 0 below is the first
> thing to build, on sign-off of the task list.

### Decisions now accepted (update §15)
- **ADR-014 — First extraction = Academy/Learning. ACCEPTED** (was proposed in v0.3). Zero hard FKs into core, no card code, sellable standalone; earliest commercial validation.
- **ADR-015 — Tenancy = shared DB + nullable `tenantId`, pooled, RLS backstop. ACCEPTED.** Not schema- or DB-per-tenant (both break on Prisma static multi-schema + Vercel connection caps).
- **ADR-016 — Payments = each licensed clinic uses its OWN Stripe account; we never touch their funds. ACCEPTED.** No Stripe Connect. Note: Academy takes no card today (`Enrolment.paidPence` is staff-entered), so this ADR bites at the booking/commerce seam, not Academy.
- **ADR-004 — Migration regime = versioned migrations for the platform track. CONFIRMED approved.** `USE_MIGRATIONS=true` on the platform track; the live track keeps additive `db push` until cutover, so production is unaffected now.

§17 rows added: 8 first-module = Academy (→ADR-014); 9 tenancy = pooled `tenantId` (→ADR-015); 10 payments = own Stripe (→ADR-016); 11 migrations flip approved (→ADR-004).

### Academy extraction design (Phase 0)

Grounded in a full map of the context (file:line verified).

**The boundary is clean.** 13 Prisma models with **zero foreign keys into core** (`Client`/`AdminUser`/`Booking`/`Location`): `AcademyStudent`, `Course`, `CourseModule`, `Lesson`, `Quiz`, `QuizQuestion`, `LessonProgress`, `QuizAttempt`, `LiveClass`, `Cohort`, `Enrolment` (+ careers `Vacancy`, `JobApplication`). `Cohort.location` is free text, not a `Location` FK. Identity is already separate (`ACADEMY_JWT_SECRET`, `kc-academy` aud, `kc_academy` cookie). No Stripe, no Blob, no AI. So the only ties to the monolith are **infrastructure, not data**.

**The only couplings (ranked, with how to sever):**
1. Shared Postgres + single `PrismaClient` (`lib/db.ts`) — the real one. Sever via `tenantId` now; injectable client at Ring 2.
2. Shared `hashPassword`/`verifyPassword` (`lib/auth.ts`) — keep shared (common crypto util), or copy into the module at extraction. Low.
3. Dev-only JWT-secret fallback (`lib/auth-edge.ts:98`: `ACADEMY_JWT_SECRET → CLIENT → ADMIN`) — must become mandatory per tenant; drop the fallback on the platform track.
4. Shared `lib/email`, `crmEnabled` gate, rate-limit guard, `AdminShell` — keep as the platform's common services (the point of monolith-as-tenant-1).

**Approach — strangler-fig in three rings.**

*Ring 0 — make Academy tenant-aware, non-breaking, no code/data move (build first):*
- Add a `Tenant` model + nullable `tenantId String?` to all 13 Academy tables (additive, `db push`-safe). Backfill every row to the K Clinics tenant id (expand-only, §6.3). Live code ignores the column.
- Resolve the current tenant from the request (host/subdomain → `Tenant`, or a tenant claim in the academy JWT) and scope **every** Academy query (`where: { tenantId }`) through the thin data layer (`lib/lms.ts`, `lib/academy.ts`, `lib/academy-auth.ts` → `findFirst({ email, tenantId })`).
- Zero behaviour change for K Clinics (single tenant).

*Ring 1 — the migrations flip + per-tenant uniqueness (needs ADR-004):*
- `@@unique([tenantId, email])` on `AcademyStudent` (email is globally unique today — wrong for tenant #2); `@@unique([tenantId, slug])` on `Course`; same for `Cohort` etc. These cannot go through `db push`, hence the flip.
- `NOT NULL` on `tenantId` once backfilled. RLS policies on the Academy tables as reviewed SQL (tenant GUC set per-transaction through the pooler).

*Ring 2 — extract to a deployable module (when a pilot tenant signs):*
- Move Academy into a domain package with an explicit interface: db **injected** not imported; JWT secret from tenant config not the env fallback; email via the platform notification service.
- Repo topology: domain-package-in-monorepo first (cheapest), separate service later.
- Per-tenant config (sender domain, JWT secret, theme) from the `Tenant` record, not globals.

**Out of scope for Phase 0:** public multi-tenant sign-up, billing/metering, white-label theming, separate deployment. Phase 0 = Academy is tenant-aware, runs as tenant #1 with a clean data boundary, ready to onboard tenant #2 behind a flag.

**Sequenced tasks (the spike):**
1. `Tenant` model + `tenantId String?` on the 13 Academy tables (additive); backfill K Clinics.
2. Tenant resolver (host/JWT → `tenantId`) + scope every Academy query through it; CI isolation-fuzz test.
3. Flip the platform track to versioned migrations; add `@@unique([tenantId, …])`, `NOT NULL`, RLS as reviewed SQL.
4. Drop the JWT-secret fallback on the platform track; per-tenant secret source (needs `tenantId` on `ManagedSecret`, R15).
5. Injectable db client for the Academy package (interface seam); no behaviour change.
6. Onboarding behind a flag: create a test tenant #2, verify isolation end-to-end.

**Risk callouts:** R12 (isolation) is the headline — every Academy query tenant-scoped before tenant #2 exists, RLS as backstop. R13 — keep the `kc-academy` aud, drop the secret fallback. R15 — `ManagedSecret` needs an additive `tenantId` before the module holds per-tenant secrets.

### Next decision round (doesn't block the Phase 0 spike)
1. **Pilot clinic** — can we name one with a letter of intent to license ClinicOS Academy? (go/no-go Q2)
2. **Data-protection pack** — commission the DPA template + sub-processor register now? (Q3 / R18)
3. **Budget** — confirm the ~£200/mo pilot run-rate + the platform hire + one-off compliance/pen-test costs. (Q5)
4. **Repo topology (Ring 2)** — domain-package-in-monorepo first, or a separate service from the start?
5. **Academy fees** — when a tenant wants to charge for courses, own-Stripe (ADR-016) or keep manual `paidPence` for the pilot?

*Done when: this addendum is merged as v0.4, ADR-016 + §17 rows logged, and the Phase 0 task list is on the board under BLD-35.*

**Status (13 Jun):** v0.4 merged; Ring 0.1 (Tenant model + `tenantId` across the Academy tables + self-healing cron backfill) merged to `main`.

**Status (17 Jun) — Ring 0.2 (BLD-300) built.** Every Academy query is now tenant-scoped centrally, with zero behaviour change for the single live tenant:
- **Tenant resolver** (`lib/tenant.ts`): `currentTenantId()` returns the K Clinics default via a single-tenant fast path (no request introspection while only one tenant exists); once a second tenant is onboarded it resolves by request host (custom domain / subdomain → `Tenant`), falling back to the default. A per-tenant JWT claim stays a Ring 2 refinement.
- **Central scoping** (`lib/db.ts` + `lib/tenant-scope.ts`): a Prisma `$extends` query hook injects `tenantId` into the `where` of every Academy read/bulk-write and stamps it onto creates — applied as the outermost extension so Accelerate's cache stays tenant-partitioned. Non-Academy models short-circuit (no tenant lookup, untouched). The injected filter (`tenantId = X OR tenantId IS NULL`) tolerates rows the backfill has not yet stamped, so single-tenant reads are unchanged; rows stamped for a real second tenant are never NULL, so isolation between tenants holds. By-unique ops (`findUnique`/`update`/`delete`) are left for the Ring 1 RLS backstop; email lookups in `lib/academy-auth.ts` moved to `findFirst` so they are scoped.
- **CI isolation guard** (`scripts/test-tenant-isolation.ts`, wired into the typecheck workflow): runs with no DB; fails the build if the scoped-model set drifts from the schema's `tenantId` columns, if a read stops being scoped or a create stops being stamped, or if one tenant's filter matches another tenant's rows.

Ring 1 (BLD-301) next: flip the platform track to versioned migrations, add `@@unique([tenantId, …])`, `NOT NULL` on `tenantId`, and RLS policies as reviewed SQL.

---

*End of plan v0.4 — a living document. All subsequent decisions append to §15 (ADRs) and update §13 (risks).*
