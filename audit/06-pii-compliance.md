# PII / GDPR / Compliance Audit

> Scope: PII, special-category (health) data, consent, data-subject rights, audit trail, retention and marketing-consent enforcement for the K-Clinics platform (UK aesthetics & dentistry clinic handling special-category health data under UK GDPR / DPA 2018 / PECR). Authorized review of the owner's own repository.
>
> Reviewed: `lib/consent.ts`, `lib/consent-md.ts`, `components/consent/**`, `lib/health-assessments.ts`, `lib/crypto.ts`, `lib/questionnaires*.ts`, `lib/crm.ts`, `lib/crm-data.ts`, `lib/data-export.ts`, `lib/audit.ts`, `lib/segments.ts`, `lib/email-campaigns.ts`, the consent/export/erasure/replay/marketing/account API routes, and the relevant `prisma/schema.prisma` models. No source was modified.

## Summary

The platform has a **genuinely strong cryptographic and architectural foundation** for special-category data: health-assessment answers, AI-consultation findings, before-photos, signed-consent bodies and clinical notes are encrypted at column level with **AES-256-GCM + a versioned keyring + HMAC tamper-evidence** (`lib/crypto.ts`), clinical records are append-only/immutable, RBAC distinguishes clinical roles from front-desk, the full-database export is OWNER-only behind a passkey step-up, marketing sends are hard-gated to opted-in/non-unsubscribed recipients, cookie consent is opt-in (no pre-ticked boxes, reject-as-easy-as-accept), session-replay masks inputs and excludes the booking/account areas, and the kiosk has a real 30-day retention sweep. The self-service and staff SAR export paths are correctly authorised against the requester's own identity / a `clients.export` permission.

However, several material compliance gaps remain, concentrated in three areas: **(1) special-category data stored in plaintext outside the encrypted store** (`Client.allergies`, `Client.medicalFlag`, `Consultation.medicalNotes`/`concerns`/`message`, `Booking.allergyNote`); **(2) right-to-erasure that does not actually remove the bulk of personal/health data** — `eraseClientData` redacts only the `Client` row and deletes interactions, leaving consultations, booking notes, encrypted health assessments, signed consents, before-photos, AI analyses, email metadata and call transcripts intact; and **(3) consent evidencing** — the primary `Client.marketingOptIn` is a bare boolean with no timestamp / version / source / lawful-basis, and the live medical/treatment questionnaires capture neither a privacy-notice acknowledgement nor granular consent. There is also **no audit record when clinical (health) data is decrypted for routine viewing** (only on SAR export), an **unauthenticated, consent-unverified replay-ingest endpoint**, and **no general retention/expiry policy** for client, booking, lead, consultation or audit data (kept indefinitely).

## Severity counts

| Severity | Count |
|----------|-------|
| Critical | 2 |
| High | 5 |
| Medium | 6 |
| Low | 4 |
| Info | 3 |
| **Total** | **20** |

## Findings

### [Critical] Right-to-erasure leaves health and personal data behind (pseudonymises only the Client row)
- **Location:** `app/admin/actions.ts:28-48` (`eraseClientData`)
- **Issue:** The "GDPR right-to-erasure" action updates only the `Client` row (name/email/phone/dob/notes/medicalFlag → redacted) and `deleteMany` on `Interaction`. It does **not** touch the many child tables that hold personal and special-category data keyed to the client: `Consultation.medicalNotes / concerns / message`, `Booking.notes / allergyNote / cancelReason / clinicalNoteEnc`, `HealthAssessment` (encrypted health answers), `SignedConsent` (signer name, signature image, IP), `BeforePhoto` (`dataEnc` images), `AiAnalysis`/`AiAnalysisImage` (encrypted findings + face photos), `EmailEvent.to` (email address retained on every message), `Review`, `NpsResponse.comment`, `FollowUp.comment`, `ConsultationNote.body`, and `CallRecord` (`fromNumber`, `transcript`, `recordingUrl`, `raw` webhook payload). After "erasure" the person remains fully re-identifiable and their medical history is still on file.
- **Impact:** Fails UK GDPR Art. 17 (right to erasure) and the Art. 5(1)(c) data-minimisation / (e) storage-limitation principles. A data subject told their data was erased would still have health questionnaires, consent signatures, facial photos and call recordings retained. (The separate `deleteClient` at `actions.ts:53-83` *does* cascade — see Info note — but `eraseClientData` is the path presented as "right-to-erasure" and is the one exposed via `components/admin/DataPrivacy.tsx`.)
- **Recommendation:** Make `eraseClientData` either (a) call the cascading hard delete, or (b) explicitly null/redact every free-text and encrypted field across all related models within a transaction (consultations, booking notes/clinical notes, assessments, signed consents, before-photos, AI analyses, NPS/follow-up comments, call transcripts), and either delete `EmailEvent` rows or null `to`. Document a lawful retention exception for genuinely-required financial records (charged amounts) and keep only those.

```ts
// app/admin/actions.ts:34-45 — only the Client row + interactions are touched
await db.client.update({ where: { id: clientId }, data: {
  firstName: 'Erased', lastName: null, email: `erased-${clientId}@redacted.invalid`,
  phone: null, dob: null, notes: null, medicalFlag: null, /* … */ } });
await db.interaction.deleteMany({ where: { clientId } });
// ⚠ Consultation.medicalNotes, HealthAssessment, SignedConsent, BeforePhoto,
//   AiAnalysis(+images), EmailEvent.to, CallRecord.transcript … all remain.
```

### [Critical] Special-category (health) data stored in plaintext outside the encrypted store
- **Location:** `prisma/schema.prisma:274` (`Client.allergies`), `:311` (`Client.medicalFlag`), `:425` (`Consultation.medicalNotes`), `:422-423` (`Consultation.concerns`/`message`), `:498` (`Booking.allergyNote`), `:453` (`Interaction.detail` for `CLINICAL`/`COMPLAINT` notes)
- **Issue:** While `HealthAssessment`, `AiAnalysis`, `BeforePhoto`, `SignedConsent.cipher` and `Booking.clinicalNoteEnc` are correctly encrypted, parallel special-category health data is written in **plaintext** columns: stated allergies (`Client.allergies`), a free-text clinical safety flag ("Diabetes — see medical history", `Client.medicalFlag`), consultation `medicalNotes`/`concerns`/free-text `message`, and the per-booking `allergyNote`. `Consultation` intake (`app/api/consult/route.ts:73-74`) stores `concerns`/`message` in clear and also emails them to the clinic. These fields reveal health conditions, allergies and medications — Art. 9 special-category data.
- **Impact:** Inconsistent protection of Art. 9 data; undermines the otherwise-strong encryption posture (Art. 5(1)(f) integrity & confidentiality / Art. 32 security of processing). A database snapshot, the full export (`lib/data-export.ts`), a read-replica, or a logging/backup leak exposes health data that the architecture elsewhere takes care to encrypt. The DPIA-relevant risk is that the "encrypted clinical store" narrative gives false assurance while the same facts sit in clear in adjacent columns.
- **Recommendation:** Encrypt these columns with the same `lib/crypto` keyring (or move free-text clinical content into the `HealthAssessment`/notes encrypted model), keeping only a non-clinical boolean/flag presence indicator in clear if needed for listing. Treat `medicalFlag` as encrypted-at-rest. Avoid emailing raw medical free-text in `tmplClinicNotify`.

```prisma
// prisma/schema.prisma
allergies   String?   // ⚠ plaintext stated allergies (Art. 9)
medicalFlag String?   // ⚠ plaintext clinical alert e.g. "Diabetes — see medical history"
// Consultation:
medicalNotes String?  // ⚠ plaintext
```

### [High] No audit record when clinical (health) data is decrypted for routine viewing
- **Location:** `app/admin/clients/[id]/page.tsx:62-72` and `:78-94`; `lib/health-assessments.ts:75-137` (`formatAssessment`/`readAssessment`); `lib/audit.ts`
- **Issue:** The `ASSESSMENT_VIEWED` audit action exists but is written in **only one place** — the SAR export route (`app/api/admin/clients/[id]/export/route.ts:39`). When a clinician/admin opens a client record, `formatAssessment` decrypts the latest medical history (allergies, medications, conditions, pregnancy status) and `decryptJson` decrypts AI-consultation findings and facial photos for display — with **no audit entry**. Neither `formatAssessment`/`readAssessment` nor the page logs the access.
- **Impact:** Breaks accountability (Art. 5(2)) and Art. 32 access-monitoring for special-category data. There is no record of *who viewed whose* medical history, which is a baseline expectation for health-record systems and for breach investigation. The schema and code describe an immutable audit log, but the most sensitive read path bypasses it.
- **Recommendation:** Emit `ASSESSMENT_VIEWED` (with `clientId`, actor, role; no clinical content in the summary) from `readAssessment`/`formatAssessment`, or from the client-detail page whenever clinical data is decrypted. Throttle to one event per client per actor per session if volume is a concern.

### [High] Marketing consent has no timestamp, version, source or lawful-basis record
- **Location:** `prisma/schema.prisma:275` (`Client.marketingOptIn Boolean @default(false)`); `app/admin/actions.ts:136-142` (`toggleMarketing`); `app/api/consult/route.ts:55,64`; `lib/client-auth.ts:92,107`
- **Issue:** Consent to marketing for the primary `Client` audience is a bare boolean. There is **no captured consent timestamp, no consent-text version, no source/channel, and no lawful-basis field** — unlike `NewsletterSubscriber.consentedAt` (`schema.prisma:1818`) and `dentistry-interest`/`newsletter` routes, which do record `consentedAt`. Staff can set `marketingOptIn = true` via `toggleMarketing` with no evidence of how/when consent was given, and the consult form sets it from a request body field with no proof-of-consent record.
- **Impact:** PECR reg. 22 / UK GDPR Art. 7(1) require the controller to *demonstrate* consent (what, when, how). With only a boolean, the clinic cannot evidence valid consent for any marketing email sent to `Client` records, exposing it to enforcement and complaint risk. Distinct from `NewsletterSubscriber`, which is handled correctly.
- **Recommendation:** Add `marketingConsentAt`, `marketingConsentSource` and a consent-text version to `Client`; set them only on a genuine affirmative action; record withdrawal time on opt-out. Backfill is not possible for historic boolean-only opt-ins — consider re-permissioning those.

### [High] Live medical/treatment questionnaires capture no privacy-notice acknowledgement or granular consent
- **Location:** `lib/questionnaires.ts:42-213` (`medicalHistory`, `treatmentConsent`); contrast `lib/questionnaires-imported.ts:21-24` (`agreed_terms`, `agreed_privacy`, `agreed_marketing`)
- **Issue:** The imported (legacy) questionnaire explicitly captured `agreed_privacy` ("Agreed to privacy / data policy") and a separate `agreed_marketing` flag. The current live `medicalHistory` and `treatmentConsent` questionnaires capture neither — there is a `consent_accuracy` ("information is accurate") confirmation but **no acknowledgement that the privacy notice was read** and no granular consent for processing of the special-category answers (beyond an in-form "encrypted and seen only by your care team" statement). The `photos` question does bundle a marketing-use option into a clinical question (`treatment-consent`, `photos: marketing_ok`), mixing consent purposes.
- **Impact:** UK GDPR Art. 13 (information to be provided) and Art. 9(2)(a)/(h) condition evidencing for special-category processing. No durable record that the data subject was shown the privacy notice at the point health data was collected; consent for clinical vs marketing photo use is conflated.
- **Recommendation:** Add an explicit, separately-recorded privacy-notice acknowledgement (with notice version) to the medical-history flow, and separate marketing-photo consent from clinical-record photo consent into distinct, independently-revocable records.

### [High] Unauthenticated, consent-unverified session-replay ingest endpoint
- **Location:** `app/api/track/replay/route.ts:11-39`; `app/api/track/heatmap/route.ts`
- **Issue:** `/api/track/replay` accepts rrweb event batches from any anonymous caller with no authentication, no consent check, no `enforceRateLimit`, and no origin/CSRF restriction. The "consent-gated" and "inputs masked" guarantees live **entirely client-side** in `components/marketing/BehaviorRecorder.tsx`; the server stores whatever `events` JSON is posted into `ReplayChunk` (capped at 200/batch, 20k/session). A scripted client can post arbitrary content — including unmasked text or injected PII — into the replay store, which staff later play back (`app/api/admin/marketing/replay/route.ts`).
- **Impact:** Art. 5(1)(f)/Art. 32 — an unauthenticated write path into a store that is replayed by staff is both a storage-abuse vector and a route for PII to enter a system that assumes none is present. Also weakens the consent guarantee (server cannot confirm the client actually had analytics consent).
- **Recommendation:** Rate-limit and origin-restrict the endpoint; bind a session to a short-lived signed token issued only after consent; validate event shape server-side; consider server-side scrubbing. Apply the same to `heatmap`.

### [Medium] Session-replay (rrweb) records all rendered DOM text — only inputs are masked
- **Location:** `components/marketing/BehaviorRecorder.tsx:45-50`
- **Issue:** rrweb is configured with `maskAllInputs: true`, `maskTextClass: 'kc-mask'`, `blockClass: 'kc-no-record'`, and excludes `/admin|/account|/book|/booking`. That masks form *inputs*, but rrweb still captures the full rendered DOM **text** by default (anything not explicitly tagged `kc-mask`). On marketing pages this can include a signed-in client's name in the header (`/api/account/me` returns `firstName`), personalised offer text, or chat-widget content — none of which is masked.
- **Impact:** PECR + Art. 5(1)(c): more personal data captured into replay than the "no personal data" comment claims. Lower severity because the booking/account/admin areas are excluded, but logged-in marketing pages still render identifying text.
- **Recommendation:** Switch to `maskAllText`/`maskTextSelector` covering personalised regions (header name, chat, offers), or block those components with `kc-no-record`. Re-validate the "no personal data" claim against actual rendered pages.

### [Medium] Full-database export embeds all PII/PHI ciphertext; account self-export shape is incomplete for portability
- **Location:** `lib/data-export.ts:41-106`; `app/api/admin/export/route.ts`; `app/api/account/export/route.ts:22-44`
- **Issue:** Two issues. (a) The full export (OWNER + passkey gated — good) serialises **every** model including all health ciphertext and PII; the resulting file is an unencrypted JSON document containing the entire dataset, and the audit note says encryption keys must be migrated alongside it — i.e. a downloaded export plus the keyring is full plaintext PHI in a single artefact with no expiry/secure-handling control after download. (b) The client self-service export (`account/export`) returns account + appointments + email metadata + health-form *metadata only* — it omits `AiAnalysis`, `SignedConsent`, `ClientPoints`, `Review`, `NpsResponse`, referrals and consultation content, so it is not a complete Art. 20 portability/Art. 15 access response and the encrypted health detail is only available "on request".
- **Impact:** Art. 20/15 completeness on the subject-facing export; Art. 32 handling risk for the full export artefact.
- **Recommendation:** Document and enforce secure handling/short retention of full-export files; consider encrypting the export with a separate transport key. Expand the subject export to include all categories of their data (or clearly document the manual SAR path and 1-month timeline), and provide the decrypted health answers to the verified subject rather than "on request" only.

### [Medium] `eraseClientData` is gated by `clients.export`, a weaker permission than deletion
- **Location:** `app/admin/actions.ts:28-31` (`if (!sessionCan(session, 'clients.export'))`); cf. `:56` (`deleteClient` requires `clients.delete`)
- **Issue:** Erasure of a client's personal data requires only `clients.export`, while the (more complete) hard delete requires `clients.delete`. Anyone who can export can also irreversibly redact a client's identifying fields and delete all their interactions, with no typed confirmation (unlike `deleteClient`).
- **Impact:** Integrity/availability of records and separation-of-duties; an over-broad grant could destroy interaction history. Also Art. 5(2) accountability — the erase action logs as a generic `NOTE_ADDED` rather than a distinct erasure action.
- **Recommendation:** Require `clients.delete` (or a dedicated `clients.erase`) and a confirmation for `eraseClientData`; log it under a dedicated audit action, not `NOTE_ADDED`.

### [Medium] Clinical data on the client page is gated by role, ignoring per-user permission revokes
- **Location:** `app/admin/clients/[id]/page.tsx:62` (`canViewClinical(session?.role)`) and `:78`; cf. permission `clients.clinical.view` in `lib/permissions.ts:48`
- **Issue:** The platform defines a fine-grained, individually-revocable `clients.clinical.view` permission, but the client-detail page decrypts and renders health assessments and AI findings/photos based on the **role** check `canViewClinical(role)` rather than `sessionCan(session, 'clients.clinical.view')`. A `permRevoke: ['clients.clinical.view']` applied to an ADMIN/PRACTITIONER would not stop them seeing clinical data here.
- **Impact:** Access-control bypass for the per-user override the system advertises (Art. 32 / least-privilege). Defence-in-depth gap rather than an open door (role still legitimately grants clinical access).
- **Recommendation:** Gate clinical decryption on `sessionCan(session, 'clients.clinical.view')` consistently across page, export and any clinical read.

### [Medium] No retention / expiry policy for client, lead, consultation, booking, email and audit data
- **Location:** `prisma/schema.prisma` (`Client`, `Consultation`, `Booking`, `EmailEvent`, `AuditEvent`, `CallRecord`, `ReplaySession`/`ReplayChunk`, `HeatmapEvent`, `SecurityEvent`, `HealthAssessment`); only retention sweep found: `app/api/cron/kiosk-cleanup/route.ts` (kiosk 30 days)
- **Issue:** The only time-based deletion in the codebase is the 30-day kiosk-photo sweep and loyalty-point expiry. There is no automated or documented retention limit for clients, leads/consultations, bookings, email metadata, call recordings/transcripts, replay sessions, heatmap/security events, or health assessments. `cron/daily` (checked) runs automations and key-rotation but no data pruning. Data is effectively kept forever.
- **Impact:** Art. 5(1)(e) storage limitation; health and call-recording data accumulating indefinitely increases breach blast-radius and is hard to justify in a DPIA.
- **Recommendation:** Define and implement retention windows per category (e.g. lead/consultation purge after N years of inactivity, replay/heatmap after 30-90 days, call recordings per clinical-records policy, SecurityEvent rotation), with a documented clinical-record retention basis for health data, enforced by a cron sweep.

### [Medium] Inbound call recordings, transcripts and raw payloads stored in plaintext and broadly accessible
- **Location:** `prisma/schema.prisma:383-413` (`CallRecord`: `transcript @db.Text`, `recordingUrl`, `fromNumber`, `raw Json`)
- **Issue:** VoIP call records store the caller's number, a full transcript, a recording URL and the raw webhook payload in plaintext. Calls are matched to clients (`matchedClientId`). These frequently contain health information (clients describing symptoms/treatments) and are not encrypted, not covered by the erasure path, and not subject to a retention sweep.
- **Impact:** Art. 9 (transcripts may be special-category), Art. 5(1)(e)/(f). Call recording also carries its own consent/notification obligations (callers must be informed).
- **Recommendation:** Encrypt `transcript`/`raw` at rest, add to the erasure cascade, apply a retention window, and confirm a call-recording notice/consent is in place.

### [Low] Audit-log writes fail silently, so gaps in the "immutable" trail are invisible
- **Location:** `lib/audit.ts:18-33`
- **Issue:** `logAudit` wraps the insert in `try/catch` and swallows all errors ("Auditing must never break the primary action"). Combined with the missing `ASSESSMENT_VIEWED` on routine viewing (High finding), a failed or skipped audit write produces no signal; the comment assumes monitoring exists but none is wired here.
- **Impact:** Art. 5(2) accountability — silent loss of audit entries undermines the integrity guarantee the schema advertises ("never updated or deleted").
- **Recommendation:** On audit-write failure, emit to an error channel / metric so gaps are detectable; consider a fallback durable log.

### [Low] PII (email/treatment/medical free-text) emailed externally for transactional notifications
- **Location:** `app/api/consult/route.ts:94-99` (clinic notification includes name, email, phone, message), `lib/email.ts` templates
- **Issue:** Consultation notifications email the enquirer's name, email, phone and free-text `message` (which may include health concerns) to `CLINIC_NOTIFY_EMAIL`. Email is an uncontrolled channel; the message body is also stored in plaintext (`Consultation.message`).
- **Impact:** Art. 5(1)(f) — special-category content can traverse third-party mail infrastructure. Lower severity as it is operationally necessary, but the medical free-text need not be emailed in clear.
- **Recommendation:** Send a notification with a deep link into the CRM rather than the raw medical message; or minimise the emailed content to non-clinical fields.

### [Low] Submitter IP retained on health assessments, consents and signups with no stated retention
- **Location:** `prisma/schema.prisma:1250` (`HealthAssessment.submittedIp`), `:2313` (`SignedConsent.ip` and `cipher` includes IP/UA), `:301` (`Client.signupIp`), `DiscountClaim.ip`
- **Issue:** IP addresses (personal data) are stored alongside clinical submissions and consent records indefinitely. For consent records this is defensible as proof-of-consent evidence, but there is no retention limit and the IP on `HealthAssessment` is collected without a documented purpose/notice.
- **Impact:** Art. 5(1)(c)/(e) — minimisation and storage limitation for IP data.
- **Recommendation:** Document the purpose (fraud/consent evidence), set a retention window, and drop `submittedIp` from health assessments if not strictly needed.

### [Low] Consent acknowledgements and signing rely on an unguessable token with no rate-limit on the sign endpoint
- **Location:** `app/api/consent/sign/route.ts:7-49`
- **Issue:** The public consent-sign endpoint is authenticated solely by the `ConsentRequest.token` (good: single-use, status-gated, expiry-checked, 600 KB signature cap, validated acknowledgements). It is correctly immutable and audited. There is, however, no `enforceRateLimit` on this public POST, unlike other public routes (`consult`, `account/export`).
- **Impact:** Minor abuse/DoS surface; low data-confidentiality impact since a valid token is required and the record is immutable.
- **Recommendation:** Add a modest rate limit keyed by IP/token.

### [Info] Hard delete (`deleteClient`) correctly cascades and preserves an audit stub
- **Location:** `app/admin/actions.ts:53-83`; `prisma/schema.prisma` (`onDelete: Cascade` across `Client` relations; `AuditEvent.clientId` is a non-FK string at `:1213`)
- **Issue / note:** The irreversible delete path is well-built: `clients.delete` permission + typed `DELETE` confirmation, cascades to bookings/assessments/points/reviews/etc., logs `CLIENT_DELETED` *after* deletion so the audit stub survives (because `AuditEvent.clientId` is intentionally not an FK), and keeps no personal data in the summary (only the email in `meta`). This is the behaviour the *erasure* path (Critical finding) should reuse. Note `meta: { email }` does retain the email in the audit row.
- **Recommendation:** Point `eraseClientData` at this cascade (or equivalent). Consider whether the email in the `CLIENT_DELETED` `meta` should be hashed.

### [Info] Encryption, key-rotation and immutability design are strong and should be preserved
- **Location:** `lib/crypto.ts` (AES-256-GCM + versioned keyring + HMAC, `loadActive` throws in production if keys missing), `lib/key-rotation.ts`, `lib/health-assessments.ts` (append-only versioning + `verifyIntegrity`), `app/api/admin/export/route.ts` (OWNER + passkey step-up + rate limit)
- **Note:** Per-record random IV, tagged key ids for rotation, HMAC binding ciphertext to record metadata (prevents blob-swapping), and tamper flags surfaced to clinicians (`formatAssessment.tampered`) are all best-practice. The full-export step-up (fresh WebAuthn unlock) is a notably good control. Keep these; the findings above are about closing the gaps *around* this core, not the core itself.

### [Info] Marketing send-path consent enforcement is correctly implemented (defence verified)
- **Location:** `lib/email-campaigns.ts:13-23` (`audienceWhere` forces `marketingOptIn: true, unsubscribed: false`), `lib/segments.ts:21`, `lib/automations.ts:169-175`, `app/api/unsubscribe/route.ts` (RFC 8058 one-click + token suppression)
- **Note:** Every bulk/automated email path was traced and is hard-gated to opted-in, non-unsubscribed recipients; segment rules can only *narrow* that base (they spread onto a fixed `{marketingOptIn:true, unsubscribed:false}` where-clause), so a segment lacking `optInOnly` cannot widen the audience to non-consenting clients. Transactional care emails honour the hard unsubscribe. Unsubscribe works for both account and newsletter-only subscribers. This is a strong PECR posture — the gap is *evidencing* the consent (High finding), not enforcing it.

## Data inventory

| Data category | Where stored | Protection |
|---|---|---|
| Client identity (name, email, phone, DOB, gender) | `Client` (`schema.prisma:261`) | Plaintext columns; RBAC (`clients.view`); email/DOB indexed |
| Stated allergies / clinical safety flag | `Client.allergies` (`:274`), `Client.medicalFlag` (`:311`), `Booking.allergyNote` (`:498`) | ⚠ **Plaintext** special-category (Critical) |
| Health questionnaire answers (conditions, meds, allergies, pregnancy) | `HealthAssessment.cipher` (`:1231`) | AES-256-GCM + HMAC, append-only/immutable; RBAC clinical-only |
| AI-consultation findings + face photos | `AiAnalysis.findingsEnc`, `AiAnalysisImage.dataEnc` (`:1697`) | Encrypted; clinical-only; `storeImages` flag |
| Before/after clinical photos | `BeforePhoto.dataEnc` (`:2324`) | Encrypted; clinician attestation; not in erasure path |
| Clinical treatment notes | `Booking.clinicalNoteEnc` (`:527`) | Encrypted; clinical-only |
| Consultation enquiry (concerns, medicalNotes, message) | `Consultation` (`:415`) | ⚠ **Plaintext**; also emailed to clinic (Critical/Low) |
| Signed consent (body, ticks, signature image, IP, UA) | `SignedConsent.cipher` (`:2299`) | Encrypted + HMAC + SHA-256 content hash; immutable |
| Marketing consent | `Client.marketingOptIn` boolean (`:275`) | ⚠ No timestamp/version/source (High); enforced on send |
| Newsletter consent | `NewsletterSubscriber.consentedAt` (`:1813`) | Timestamp + unsub token (correct) |
| Email history / metadata | `EmailEvent` (`:739`) | Plaintext recipient + subject; retained indefinitely; not erased |
| Call recordings + transcripts | `CallRecord` (`:383`) | ⚠ Plaintext transcript/recording/number; no retention (Medium) |
| Session replay (rrweb) | `ReplaySession`/`ReplayChunk` (`:2202`) | Inputs masked client-side; ingest unauthenticated (High/Medium) |
| Heatmap interactions | `HeatmapEvent` (`:2227`) | Coordinates only; no IP |
| Kiosk selfies + results | `KioskSession`/`KioskResult` (`:2680`) | `ipHash` only; **30-day retention sweep** (good) |
| Audit trail | `AuditEvent` (`:1208`) | Append-only; clientId non-FK survives delete; silent-fail writes (Low) |
| OAuth / 2FA secrets | `ExternalConnection.tokensEnc`, `AdminUser.totpSecret` | Encrypted via keyring |
| Passwords / reset tokens | `Client`/`AdminUser.passwordHash`, `resetTokenHash` | bcrypt; stripped from staff SAR export |
| Full database export | `lib/data-export.ts` artefact | OWNER + passkey + rate-limit; output is unencrypted JSON (Medium) |

## Files reviewed

- `lib/consent.ts`, `lib/consent-md.ts`, `components/consent/ConsentSigner.tsx`
- `lib/health-assessments.ts`, `lib/crypto.ts`, `lib/questionnaires.ts`, `lib/questionnaires-uk.ts`, `lib/questionnaires-imported.ts`, `lib/validation.ts`
- `lib/crm.ts`, `lib/crm-data.ts`, `lib/data-export.ts`, `lib/audit.ts`, `lib/auth.ts`, `lib/permissions.ts`
- `lib/segments.ts`, `lib/email-campaigns.ts`, `lib/automations.ts` (referenced), `lib/tracking.ts`, `lib/client-auth.ts`
- `components/marketing/BehaviorRecorder.tsx`, `components/legal/CookieConsent.tsx`, `components/admin/DataPrivacy.tsx` (referenced)
- `prisma/schema.prisma` (all PII/health-bearing models: `Client`, `Consultation`, `ConsultationNote`, `Interaction`, `Booking`, `HealthAssessment`, `SignedConsent`, `ConsentRequest`, `ConsentTemplate`, `BeforePhoto`, `AiAnalysis(+Image)`, `EmailEvent`, `CallRecord`, `NewsletterSubscriber`, `ReplaySession/Chunk`, `KioskSession/Result/Event`, `AuditEvent`, `DiscountClaim`, `Review`, `NpsResponse`, `FollowUp`, `JobApplication`, `Order`, `AcademyStudent`, `Enrolment`)
- API routes: `app/api/account/export`, `app/api/account/me`, `app/api/account/profile`, `app/api/account/assessment`, `app/api/admin/clients/[id]/export`, `app/api/admin/export`, `app/api/consent/sign`, `app/api/admin/consent`, `app/api/admin/medical-flag`, `app/api/admin/marketing/email/send`, `app/api/admin/marketing/replay`, `app/api/track/replay`, `app/api/unsubscribe`, `app/api/consult`, `app/api/cron/kiosk-cleanup`
- `app/admin/actions.ts`, `app/admin/clients/[id]/page.tsx`
- `.gitignore`, `.env.example` (confirmed no committed secrets; `.env` ignored)
