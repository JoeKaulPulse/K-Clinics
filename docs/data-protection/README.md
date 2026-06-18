# K Clinics — data-protection pack

Reference: **BLD-304**. Status: **draft for owner review.**

This pack documents how K Clinics processes personal data on the platform at
`https://kclinics.co.uk`, grounded in the live system (Prisma schema, the
integration registry, the consent and erasure code). It is the working set of
records the clinic keeps to meet UK GDPR, the Data Protection Act 2018 and PECR.

> **Scope:** K Clinics as the **sole data controller** of its own clients,
> trainees and staff (the ClinicOS "M0" state). The separate
> `docs/COMPLIANCE_ROADMAP.md` covers the future case where K Clinics becomes a
> **processor** for other clinics on the platform — that is out of scope here.
>
> **This is internal documentation, not legal advice.** Items a solicitor or the
> owner must confirm are tagged **[OWNER TO CONFIRM: …]** throughout.

## What is in the pack

| File | Purpose |
| --- | --- |
| [`ROPA.md`](./ROPA.md) | Record of Processing Activities (UK GDPR Art. 30): every processing purpose, the data categories, lawful basis, recipients, retention and security measures. |
| [`processors.md`](./processors.md) | Processor and sub-processor inventory: each third party, what it receives, why, where it sits, and the link to its data-processing terms. |
| [`dpia.md`](./dpia.md) | Data Protection Impact Assessment (Art. 35) for the higher-risk processing — clinical records and before-photos, payments, and marketing/analytics tracking. |
| [`retention-schedule.md`](./retention-schedule.md) | How long each category of data is kept, and why. |
| [`breach-response.md`](./breach-response.md) | The personal-data breach procedure: detect, contain, assess, the 72-hour ICO notification test, and records. |
| [`subject-rights.md`](./subject-rights.md) | How access, erasure, rectification, portability and objection requests are handled, with the actual code paths. |

## Key facts (from the live system)

- **Controller:** K Clinics. ICO registration **ZC153001** (per
  `docs/COMPLIANCE_ROADMAP.md`). **[OWNER TO CONFIRM: registered controller legal
  name and trading address; confirm ZC153001 is current.]**
- **Data Protection Officer / contact:** **[OWNER TO CONFIRM: whether a DPO is
  required and, if so, who; otherwise the named data-protection contact and the
  privacy inbox address used for rights requests.]**
- **Hosting:** Vercel (application + serverless functions + Vercel Blob file
  storage). Database is managed PostgreSQL (Neon / Vercel Postgres / Supabase —
  **[OWNER TO CONFIRM: which provider and the data region]**).
- **Special-category (health) data** — health questionnaires, clinical notes,
  before-photos, AI consultation findings — is **encrypted at rest** with
  AES-256-GCM through a versioned keyring (`lib/crypto.ts`,
  `lib/clinical-crypto.ts`), with HMAC integrity hashes and an immutable,
  append-only design for clinical records.
- **Consent:** non-essential cookies are off until the visitor opts in
  (`components/legal/CookieConsent.tsx`); analytics and marketing pixels load
  only after consent (`components/marketing/TrackingScripts.tsx`). Marketing
  email needs demonstrable consent evidence, not just a tick
  (`lib/consent.ts`).
- **Rights:** subject-access export (`/api/admin/clients/[id]/export`) and
  right-to-erasure (`eraseClientData` in `app/admin/actions.ts`) are implemented
  and audit-logged.

## How to keep this pack current

Review at least **annually**, and whenever any of the following changes:

1. **A new field or model is added to `prisma/schema.prisma`** that holds
   personal or special-category data. Add it to the ROPA data-category tables and
   the retention schedule.
2. **A new third party starts receiving personal data** (new entry in
   `lib/integrations.ts`, a new API key, a new `sendEmail`/`sendSms`/AI call).
   Add it to `processors.md` and the recipients column of the ROPA, and check a
   data-processing agreement is in place.
3. **A new high-risk processing activity** is introduced (new profiling,
   automated decision-making, large-scale tracking, biometric handling). Run a
   fresh DPIA section before it ships.
4. **The consent wording or mechanism changes** — bump
   `MARKETING_CONSENT_VERSION` in `lib/consent.ts` and note it here.
5. **A breach or near-miss occurs** — record it per `breach-response.md` and feed
   any lessons back into the DPIA mitigations.

When you update a document, change its "Last reviewed" date at the top and cite
**BLD-304** (or a follow-up ref) in the commit.

Cross-references: `docs/INTEGRATIONS.md` (every external service + its env vars),
`docs/SECURITY.md`, `audit/06-pii-compliance.md` (standing PII audit), and
`docs/COMPLIANCE_ROADMAP.md` (the processor/SaaS path).

---

Last reviewed: 2026-06-18 (draft, BLD-304).
