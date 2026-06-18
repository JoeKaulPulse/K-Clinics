# Personal-data breach response procedure

UK GDPR Art. 33 and 34. What to do when a personal-data breach is suspected or
confirmed. A personal-data breach is any breach of security leading to the
accidental or unlawful **destruction, loss, alteration, unauthorised disclosure
of, or access to** personal data — not only "hacks". Lost laptops, mis-sent
emails, and wrong-recipient SMS all count.

> **Draft for owner review, not legal advice.** Owner inputs tagged **[OWNER TO
> CONFIRM: …]**.

## Roles

| Role | Who | Responsibility |
| --- | --- | --- |
| Breach lead | **[OWNER TO CONFIRM: named person]** | Owns the response, makes the notification call, keeps the record. |
| Technical responder | **[OWNER TO CONFIRM]** | Contains the breach, preserves evidence, assesses scope in the system. |
| Communications | **[OWNER TO CONFIRM]** | Drafts subject/ICO notifications and any public statement. |

The **72-hour clock starts the moment K Clinics becomes aware** a breach has
likely occurred — not when the investigation finishes.

---

## Step 1 — Detect and report internally (immediately)

A breach may surface from: a Sentry alert, an unusual `SecurityEvent` pattern
(repeated lockouts, logins from new locations), the audit log (`AuditEvent` —
unexpected `DATA_EXPORTED` / `CLIENT_ERASED` / clinical access), a staff report,
a processor's breach notification, or a client/third-party report.

Anyone who suspects a breach must tell the **breach lead** at once via **[OWNER
TO CONFIRM: internal channel — e.g. a named phone/email]**. Do not wait to be
sure.

Record the time of awareness — this starts the 72-hour clock.

## Step 2 — Contain (first hour)

- Stop the bleeding: revoke the compromised credential/session (bump
  `sessionEpoch` to invalidate all of a user's sessions; disable the account in
  `/admin/staff`), rotate the affected key/secret, take down the leaking path.
- For a lost/stolen device: trigger remote sign-out and password reset.
- Preserve evidence: do **not** delete logs. The append-only `AuditEvent` and
  `SecurityEvent` tables are the primary record; export the relevant rows.
- If a processor caused it, get their incident report and reference.

## Step 3 — Assess the risk (within hours, before the 72-hour deadline)

Record, for the breach record:

1. **What happened** and how it was discovered.
2. **What data** is involved — categories and **whether special-category (health)
   data** is included. Clinical free-text and before-photos are **encrypted at
   rest**; if only ciphertext was exposed without the keys, the risk to
   individuals is materially lower — note this in the assessment.
3. **How many** data subjects and records (approximate is fine initially).
4. **Likely consequences** for those individuals (distress, fraud, identity
   theft, exposure of health information).
5. **Severity** — combine likelihood and impact.

## Step 4 — The 72-hour ICO notification test

> **Notify the ICO** unless the breach is **unlikely to result in a risk** to
> people's rights and freedoms. When in doubt, notify.

| Outcome | Action |
| --- | --- |
| **Unlikely to result in a risk** | No ICO notification needed. **Still record it** internally (Step 6). |
| **Likely to result in a risk** | **Notify the ICO within 72 hours** of awareness. |
| **Likely to result in a HIGH risk** | Notify the ICO **and** notify the **affected individuals without undue delay** (Step 5). |

Factors that push towards "high risk": special-category health data, before-
photos, financial data, large numbers, or data exposed in a usable (unencrypted)
form.

**How to notify the ICO:** report online at `ico.org.uk` or the ICO breach
helpline. If you cannot give all details within 72 hours, notify with what you
have and follow up. Include: nature of the breach, categories and approximate
numbers, likely consequences, and the measures taken/proposed. **[OWNER TO
CONFIRM: ICO account/reference details kept with the breach lead.]**

## Step 5 — Notify affected individuals (only if high risk)

Tell affected people **in plain language, without undue delay**: what happened,
the likely consequences, what the clinic is doing, and what they can do to
protect themselves (e.g. watch for phishing, reset a reused password). Use a
direct channel (email/letter); a public notice is a fallback if direct contact is
disproportionate.

## Step 6 — Record every breach (always)

Keep a breach record **whether or not** it was notifiable — the ICO can ask to
see it. **[OWNER TO CONFIRM: where the breach register lives — a secured doc/sheet
owned by the breach lead.]** Each entry:

| Field | Notes |
| --- | --- |
| Reference / date | |
| Time of awareness | Starts the 72h clock |
| Description | What happened + how discovered |
| Data categories + special-category? | |
| Approx. subjects / records | |
| Risk assessment + outcome | Risk / high risk / no risk |
| ICO notified? | Date + reference, or reason not |
| Individuals notified? | Date + method, or reason not |
| Containment + remediation | What was done |
| Lessons / follow-up | Feed back into the DPIA mitigations |

## Step 7 — Review

After closing the incident, review what allowed it and whether a control in the
DPIA (`dpia.md`) needs strengthening. Update this procedure if the response
exposed a gap.

---

## Processor breaches

Each processor (`processors.md`) is contractually required to notify K Clinics
without undue delay. Their notification still starts **K Clinics'** own 72-hour
clock as controller — assess and notify as above. Keep the processor's incident
reference in the breach record.

---

Last reviewed: 2026-06-18 (draft, BLD-304).
