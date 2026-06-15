# ClinicOS — Compliance roadmap (slow launch)

> **Purpose:** answer "what compliance do we need, and *when*" for licensing the K Clinics
> platform to other clinics, on a deliberately slow launch. Each item is tagged by the
> **trigger that makes it required**, not a calendar date — so nothing is done early or late.
> Companion to `docs/PLATFORM_SAAS_PLAN.md` (ADR-011 sets the certification order) and the
> standing PII audit (`audit/06-pii-compliance.md`).
>
> **British English. Planning doc — not legal advice.** The DPA, licence agreement and any
> "is this a medical device?" call must be confirmed by a data-protection solicitor (a few
> hours, not a retainer).

## The milestones (triggers)

| Milestone | Trigger — "required by the time…" |
| --- | --- |
| **M0 · Now** | We operate the platform for K Clinics only (tenant #1, sole controller). |
| **M1 · First licensed clinic** | *Any* other clinic's data enters our database — **the moment we become a processor.** Hard gate. |
| **M2 · Pilot (clinics 2–3)** | More than one external tenant live; data isolation must be proven, not assumed. |
| **M3 · Scale / public sign-up** | Self-serve onboarding or ~10+ tenants; enterprise buyers in the pipeline. |
| **Deferred · Triggered** | Only when a *specific* condition occurs (NHS data, a clinical-recommendation feature, an enterprise buyer's RFP). |

---

## M0 — Now (single clinic). Status: essentially done

| Requirement | Why | Status |
| --- | --- | --- |
| **ICO data-protection registration** | Legal duty for any org processing personal data. | ✅ **Done** — ZC153001. (Re-check the registration covers a future software/processor activity when M1 nears.) |
| **Encrypt special-category data at rest** (allergies, medical flag, consultation/booking clinical free-text) | UK GDPR Art. 9 / Art. 32. Was the audit's Critical C3. | ✅ **Done (12 Jun)** — routed through `lib/clinical-crypto.ts`; see audit/06. |
| **Right-to-erasure actually erases** (across all special-category tables) | UK GDPR Art. 17. Was the audit's Critical C2. | ✅ **Done (12 Jun)** — `eraseClientData` rewritten; see audit/06. |
| Cookie consent, marketing opt-in gating, session-replay masking | PECR / GDPR. | ✅ Already in place (audit/06 confirms). |

**M0 takeaway:** with the two Criticals closed, the platform's *own* clinical data posture is sound. Nothing else is legally required while K Clinics is the only clinic on it.

---

## M1 — Before the first licensed clinic goes live (the processor gate)

This is the real gate. The day another clinic's client data lands in our DB, **they are the controller and we are their processor** — UK GDPR imposes specific duties, and these are also what their insurer will ask for. Nothing below is optional once money changes hands.

### Legal / contractual (must-have)
| Requirement | Why | Effort / cost |
| --- | --- | --- |
| **Data Processing Agreement (DPA)** with each clinic | Art. 28 — a processor *must* have a written DPA. | Solicitor template, reused per tenant. ~£2–5k one-off (covers MSA too). |
| **Sub-processor register**, disclosed to tenants | Art. 28(2) — Vercel, Neon/Postgres, Upstash, Vercel Blob, Resend, Twilio, Anthropic, Stripe. | Internal doc; keep current. |
| **Records of Processing (ROPA)** + controller/processor mapping | Art. 30. | Internal doc. |
| **DPIA** (covers special-category processing at scale + the kiosk selfie) | Art. 35 — mandatory for large-scale special-category processing. Kiosk is defensible (auto-purge, explicitly non-clinical) but must be written down. | Internal effort. |
| **Breach-notification process** (72-hour) | Art. 33/34. | Runbook; reuse the incident runbook in the SaaS plan §10. |
| **Licence / MSA** with liability cap + SLA | Commercial protection; health data raises the stakes — never licence on a handshake. | Bundled with the DPA spend above. |
| **Cyber liability + professional indemnity insurance** | Tenants/insurers require it before signing. | Annual premium; get Cyber Essentials first to lower it. |

### Technical isolation (must-have — from the SaaS plan risk register)
| Requirement | Why | Source |
| --- | --- | --- |
| **Per-tenant data isolation** — `tenantId` on every tenant-owned model + RLS backstop | One missed `where` leaks another clinic's patients. | Plan R12 / ADR-015 |
| **Per-tenant Stripe accounts** (each clinic holds its own) | Keeps us out of their money flow → lightest PCI/compliance burden. | Plan R14; go/no-go Q1 |
| **Per-tenant secrets** (`ManagedSecret` needs a tenant column) | Today one global row per key → tenant B could send on tenant A's credentials. | Plan R15 |
| **Per-tenant DSAR / export / erasure** | Generalise the now-complete `eraseClientData` + full export to run *per tenant*. | audit/06; plan §6.4 |
| **Per-tenant `HEALTH_ENCRYPTION_KEY`** (envelope keys) | One key for all tenants' PHI is unacceptable once external. | Plan R18 |

### Trust signal (strongly recommended at M1, not legally required)
| Requirement | Why | Cost |
| --- | --- | --- |
| **Cyber Essentials** (self-assessed) | First thing clinics ask for; ADR-011's first step; lowers insurance. | ~£500 |

---

## M2 — Pilot (clinics 2–3)

| Requirement | Trigger | Cost |
| --- | --- | --- |
| **Penetration test** (incl. a tenant-isolation test) | Before there's a tenant whose data we can't personally vouch for. The SaaS plan gates cutover on this. | ~£4–8k |
| **Tenant-isolation test suite in CI** (isolation fuzzing) | Prevent regressions once multi-tenant. | Internal |
| **Status page + monitoring/alerting** | Tenants expect uptime visibility; supports the SLA. | Low |
| **Documented retention schedule** per data category | Art. 5(1)(e) — close the audit's "no general retention policy" gap. | Internal |

---

## M3 — Scale / public sign-up

| Requirement | Trigger | Cost |
| --- | --- | --- |
| **Cyber Essentials Plus** (audited) | Larger buyers; stronger trust signal. | ~£2–3k |
| **ISO 27001** | Enterprise/RFP buyers start requiring it. | £5–15k+/yr |
| **Self-serve onboarding controls** (per-tenant provisioning, billing/metering) | Public sign-up. | Build work |

---

## Deferred — only when specifically triggered

| Requirement | Trigger (and only then) |
| --- | --- |
| **NHS DSPT** | A tenant handles **NHS data**. *Note: dental practices often do — likely the first deferred item to bite, despite "NHS integration later".* Free but effortful. |
| **SOC 2 Type II** | A large/US-facing buyer demands it. After ISO 27001. |
| **MHRA / UKCA medical-device registration** | **Only if a feature starts diagnosing or recommending treatment for a medical condition.** The current kiosk AI is deliberately on the safe side of this line (`lib/kiosk-ai.ts` — "this is NOT a medical assessment"). Record-keeping (storing what a clinician types) stays clear. **Rule going forward: any feature that *interprets* clinical data and *recommends* treatment needs a regulatory check before it ships.** |
| **CQC** | Never for us — CQC registers *clinics*, not software vendors. Our buyers may need it for what they do. |

---

## One-page answer to "when do I need what?"

1. **Now:** nothing further — the two Criticals are fixed; K Clinics' own data is compliant.
2. **Before the first paying clinic:** DPA + sub-processor register + DPIA + licence/MSA + insurance (legal pack ~£2–5k + premium), **and** the technical isolation set (tenantId/RLS, per-tenant Stripe, per-tenant secrets, per-tenant erasure/keys). Get **Cyber Essentials** (~£500) as the trust ticket.
3. **At 2–3 clinics:** **penetration test** (~£4–8k) + isolation tests in CI + retention schedule.
4. **At scale:** Cyber Essentials Plus → ISO 27001.
5. **Only if triggered:** NHS DSPT (watch dental tenants), SOC 2, MHRA (don't build a clinical-recommendation feature without a regulatory check).

**Rough one-off spend to reach "can licence to clinic #1": ~£8–15k** beyond engineering time (legal pack + Cyber Essentials + first pen test), with DSPT/ISO/SOC 2 deferred until a buyer demands them.
