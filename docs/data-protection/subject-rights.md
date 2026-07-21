# Data-subject rights — handling procedure

UK GDPR Chapter 3. How K Clinics responds to requests from clients, trainees and
staff to exercise their rights, with the actual code paths that fulfil them.

> **Draft for owner review, not legal advice.** Owner inputs tagged **[OWNER TO
> CONFIRM: …]**.

## Timescales and intake

- Respond **without undue delay and within one calendar month** of receiving a
  valid request. This can be extended by up to two further months for complex or
  numerous requests — tell the person within the first month if so.
- Requests can arrive by any channel (email, in person, phone, the privacy
  inbox). **[OWNER TO CONFIRM: the privacy inbox / contact that receives rights
  requests, and who logs them.]**
- **Verify identity** before acting, proportionately — enough to be confident
  you are dealing with the right person, without asking for excessive ID.
- Usually **free**; a reasonable fee or refusal is allowed only for manifestly
  unfounded or excessive requests. Record the reason if you refuse.
- Log every request and its outcome. **[OWNER TO CONFIRM: rights-request log
  location.]**

---

## 1. Right of access (SAR — Art. 15)

A person can ask for a copy of their personal data.

**How it is fulfilled:** staff with the `clients.export` permission run the export
from the client's admin page, which calls
`GET /api/admin/clients/[id]/export` (`app/api/admin/clients/[id]/export/route.ts`).
It returns a full JSON of the client's record:

- Identity/contact, consultations, interactions, appointments, bookings, email
  events, discount claims, tasks, AI analyses (with images), follow-ups, reviews,
  NPS, waitlist, referrals, loyalty points, call records, signed consents,
  before-photo metadata, chat conversations, retail orders, consent requests,
  promo redemptions.
- **Clinical (encrypted) data** — health assessments and the decrypted
  before-photo images — is included **only for staff who hold the revocable
  `clients.clinical.view` permission** (BLD-315, BLD-367).
- Encrypted clinical/contact free-text is decrypted so the export is readable;
  secrets (`passwordHash`, reset tokens) are stripped.
- The export is **audit-logged** as `DATA_EXPORTED` (Art. 15 SAR).

**Notes for the responder:** review the export before releasing it; redact any
**third-party** personal data (e.g. another person named in a free-text note) that
should not be disclosed. The JSON is machine-readable — see also portability
below. **[OWNER TO CONFIRM: whether to provide a human-readable summary alongside
the JSON for non-technical requesters.]**

---

## 2. Right to erasure ("right to be forgotten" — Art. 17)

**How it is fulfilled:** staff with the `clients.delete` permission use the Data
Privacy panel on the client page (`components/admin/DataPrivacy.tsx`), which calls
`eraseClientData` (`app/admin/actions.ts`). In one atomic transaction it:

- **Pseudonymises** the `Client` row (name → "Erased", email →
  `erased-<id>@redacted.invalid`, clears phone, DOB, notes, allergies, medical
  flag; turns off marketing; clears portal credentials).
- **Hard-deletes** records that exist only to serve the data subject: health
  assessments, before-photos, AI analyses, signed consents, reviews, NPS,
  follow-ups, email metadata, interactions, chat conversations, waitlist entries,
  legacy appointments, appointment sessions, consultation notes, referrals made.
- **Strips identifying + clinical free-text** from records kept on a lawful
  retention basis: bookings and consultations (kept for financial/clinical-audit
  reasons but emptied of clinical/identifying free-text), retail orders and gift
  vouchers (kept for HMRC, PII stripped), discount fingerprints, promo-redemption
  emails, call recordings/transcripts.
- Is **audit-logged** as `CLIENT_ERASED` and notifies staff who manage settings.

**Important — financial/clinical retention is honoured deliberately.** Erasure
does not delete records the clinic is legally required to keep; it removes the
identifying and special-category content from them. Explain this to the requester:
the right to erasure is **not absolute** where another lawful basis (tax law,
clinical-record duties) requires retention.

> A separate **hard delete** (`deleteClient`, guarded by a typed "DELETE"
> confirmation) removes the client and all related records entirely — for genuine
> mistakes/test data, not the standard erasure path.

**Processors:** after erasure, also action deletion at processors that hold a copy
where required — for example remove the contact from Resend/marketing audiences,
and request deletion from any processor that retains the data. **[OWNER TO
CONFIRM: a checklist of which processors need a manual deletion step on erasure.]**

> **Note:** the finding in `audit/06-pii-compliance.md` describing `eraseClientData`
> as pseudonymising "only the Client row" predates the rewrite (BLD-286 and
> follow-ups). The current code erases across all the tables listed above.

---

## 3. Right to rectification (Art. 16)

Staff correct inaccurate client data directly in the admin (Edit client
details — `components/admin/EditClientDetails.tsx`; clinical free-text is
re-encrypted on save via `encClinical`). Clinical records themselves are
**append-only** — a correction is recorded as a **new version** that supersedes
the prior one (`HealthAssessment.supersedesId`), so the history stays intact and
tamper-evident. Tell the requester what was changed.

---

## 4. Right to data portability (Art. 20)

The SAR export (above) already returns the person's data as structured JSON,
which satisfies portability for data processed by consent or contract and held
electronically. Provide the JSON file directly.

---

## 5. Right to object / withdraw consent

- **Marketing:** every marketing email carries a **one-click unsubscribe**
  (`/api/unsubscribe`), which sets `unsubscribed = true`; `marketableClientWhere()`
  then excludes them from all bulk sends. A client can also turn off
  `marketingOptIn` in the portal.
- **Cookies/analytics:** the visitor can re-open the cookie banner (footer
  "Cookie settings") and withdraw consent at any time; pixels stop firing live on
  the consent change (`TrackingScripts.tsx`).
- **Objection to other processing:** handle case by case against the lawful basis
  in the ROPA; record the decision.

---

## 6. Rights related to automated decision-making (Art. 22)

The platform does **not** make solely-automated decisions with legal or similarly
significant effects. The AI consultation produces a **non-binding, non-clinical**
suggested plan that a person chooses whether to act on, and a clinician reviews
before any treatment — so Art. 22 is not engaged. **[OWNER TO CONFIRM: no future
feature introduces solely-automated significant decisions without review.]**

---

## Quick reference

| Right | Code path / mechanism | Audit action |
| --- | --- | --- |
| Access (SAR) | `GET /api/admin/clients/[id]/export` | `DATA_EXPORTED` |
| Erasure | `eraseClientData` (`app/admin/actions.ts`) | `CLIENT_ERASED` |
| Hard delete | `deleteClient` (typed confirm) | `CLIENT_DELETED` |
| Rectification | Edit client details; clinical = new version | `CLIENT_EDITED` / `ASSESSMENT_SUBMITTED` |
| Portability | SAR export JSON | `DATA_EXPORTED` |
| Withdraw marketing consent | `/api/unsubscribe`; portal toggle | — |
| Withdraw cookie consent | Cookie banner re-open | — |

---

Last reviewed: 2026-06-18 (draft, BLD-304).
