# Data Protection Impact Assessment (DPIA)

UK GDPR Art. 35. Covers the higher-risk processing on the platform: clinical
records and before-photos, payments, and marketing/analytics tracking. Mitigations
listed are **already in the live system** unless marked as a gap.

> **Draft for owner review, not legal advice.** Residual-risk ratings and the
> decision to proceed are the owner's to confirm with a data-protection
> solicitor. Owner inputs tagged **[OWNER TO CONFIRM: …]**.

---

## 1. Why a DPIA

The processing involves **special-category health data** (medical histories,
clinical notes, facial/skin photos), **systematic monitoring** of website
behaviour, and a feature that **analyses photos with AI**. These are screening
criteria for a DPIA under ICO guidance, so one is warranted even though K Clinics
is a single small controller.

## 2. Scope of this assessment

| In scope | Out of scope |
| --- | --- |
| Clinical records: health assessments, clinical notes, SOP responses, before-photos, signed consents. | Day-to-day staff scheduling and rota (low risk). |
| Payments: card capture, charges, refunds, accounting push. | Public CMS / marketing content with no personal data. |
| Marketing + analytics tracking: email marketing, GA4/Google Ads/Meta, heatmaps, session replay. | The platform's future multi-tenant/processor mode (covered in `COMPLIANCE_ROADMAP.md`). |
| AI consultation ("Get My Plan"). | |

## 3. Necessity and proportionality

- Clinical data is collected because it is **necessary to deliver treatment
  safely** and to meet professional/insurance duties — the minimum a clinician
  needs to treat.
- Card data is **not stored by K Clinics**; only Stripe ids are kept, which is
  the minimum needed to charge and reconcile.
- Marketing and analytics are **consent-first**: nothing non-essential runs until
  the visitor opts in, so processing is proportionate to a freely-given choice.
- The AI consultation is **opt-in, account-gated and explicitly non-clinical**;
  it recommends only catalogue items and does not diagnose.

---

## 4. Risk assessment

### Risk A — Unauthorised access to / disclosure of clinical records and before-photos

| | |
| --- | --- |
| Likelihood without controls | High (sensitive data, internet-facing app). |
| Impact | Severe (special-category health data, facial images). |
| Mitigations in place | • AES-256-GCM encryption at rest for clinical free-text, health assessments, before-photos, AI findings/images, signed consents (versioned keyring, `lib/crypto.ts`). • Before-photos and findings stored encrypted, never in plaintext (`BeforePhoto.dataEnc`, `AiAnalysisImage.dataEnc`). • Role-based access; clinical data gated behind the **revocable** `clients.clinical.view` permission, not just a role (BLD-315). • FRONT_DESK, DEVELOPER, CONTRACTOR roles see no clinical data. • Append-only, immutable clinical records with HMAC `integrityHash` for tamper-evidence. • Immutable audit log of clinical access/actions. • 2FA (TOTP/passkeys), brute-force lockout, session-epoch revocation. • Row-Level-Security programme for data isolation. |
| Residual risk | Low–Medium. Encryption keys live in the hosting env; key compromise remains the main residual vector. **[OWNER TO CONFIRM: key-management/rotation owner and review cadence — see `docs/KEY_ROTATION.md`.]** |

### Risk B — Before-photos: intimate-area or non-consented capture

| | |
| --- | --- |
| Likelihood without controls | Medium. |
| Impact | Severe. |
| Mitigations in place | • Capture flow requires a clinician **attestation** that the area is non-intimate and consented (`BeforePhoto.attestation`). • A dedicated photo opt-out consent record exists for clients who decline (`consent.ts`, `photo_opt_out`). • Images downscaled and encrypted. |
| Residual risk | Low, given attestation + consent records. **[OWNER TO CONFIRM: staff training that intimate areas are never photographed in-app.]** |

### Risk C — Payment data exposure / fraud

| | |
| --- | --- |
| Likelihood without controls | Medium. |
| Impact | High (financial + reputational). |
| Mitigations in place | • Card data handled entirely by **Stripe** (PCI DSS Level 1); K Clinics stores only ids. • Refunds within an allowed window; every charge/refund/Xero push audit-logged. • Xero/TrueLayer OAuth tokens encrypted at rest (`ExternalConnection.tokensEnc`). • Finance areas can be PIN-gated (`AdminUser.financePinHash`). |
| Residual risk | Low. |

### Risk D — Marketing without a lawful basis (PECR)

| | |
| --- | --- |
| Likelihood without controls | Medium (legacy lists are a common failure). |
| Impact | Medium (PECR enforcement, complaints). |
| Mitigations in place | • Demonstrable consent recorded — wording version, timestamp, source — not just a boolean (`marketingConsentFields`, `lib/consent.ts`). • `marketableClientWhere()` enforces opt-in + not-unsubscribed + recorded consent on **every** bulk send. • Legacy boolean-only opt-ins are **excluded** until re-permissioned via a double opt-in campaign (BLD-242). • One-click unsubscribe (`/api/unsubscribe`); newsletter sign-ups carry consent timestamp + unsub token. |
| Residual risk | Low. |

### Risk E — Tracking/analytics without consent (PECR + GDPR)

| | |
| --- | --- |
| Likelihood without controls | High (pixels often fire pre-consent). |
| Impact | Medium. |
| Mitigations in place | • Cookie banner: non-essential off by default, no pre-ticked boxes, "Reject" as easy as "Accept" (`CookieConsent.tsx`). • GA4 needs analytics consent; Google Ads + Meta need marketing consent; pixels do not load until then, and re-evaluate live on consent change (`TrackingScripts.tsx`, `analytics-events.ts`). • First-party session replay masks **all text + inputs** and stores no keystrokes or PII; server checks the `kc_analytics_consent` cookie before storing replay data. • QR scans log only coarse device/referer/country, no IP. |
| Residual risk | Low. **[OWNER TO CONFIRM: GA4 data-retention setting + IP-anonymisation; cookie-policy page lists each cookie.]** |

### Risk F — AI consultation: facial images + over-reach into diagnosis

| | |
| --- | --- |
| Likelihood without controls | Medium. |
| Impact | High (special-category images; medical-device line). |
| Mitigations in place | • Explicit opt-in consent recorded (`AiAnalysis.consentAt`); account-gated. • Images downscaled in the browser, encrypted at rest, storage opt-in (`storeImages`). • Output is **catalogue-bound and explicitly non-clinical** — a treatment-interest plan, not a diagnosis (keeps it the safe side of the MHRA/medical-device line, per `COMPLIANCE_ROADMAP.md`). • Monthly usage cap; refusal path for unsafe inputs. • Sent to Anthropic under commercial terms. |
| Residual risk | Medium. Depends on Anthropic retention/training terms and the photo-purge window. **[OWNER TO CONFIRM: Anthropic zero-retention/no-training terms; auto-purge window for stored images; privacy-notice wording for the feature.]** |

### Risk G — Right-to-erasure leaves residual personal data

| | |
| --- | --- |
| Likelihood without controls | Medium (cascades are easy to miss). |
| Impact | Medium. |
| Mitigations in place | • `eraseClientData` pseudonymises the `Client` row and **deletes or scrubs across every table** holding the person's data — health assessments, before-photos, AI analyses, signed consents, reviews, NPS/follow-ups, email metadata, chat, waitlist, appointment sessions, call transcripts, referrals, discount fingerprints, retail orders, gift vouchers, promo redemptions (BLD-286, BLD-127, BLD-152, BLD-315, BLD-366). • Financial records (bookings/consultations/orders) are **retained but stripped** of identifying + clinical free-text, on a lawful-retention basis. • Action audit-logged as `CLIENT_ERASED`. |
| Residual risk | Low. The current code supersedes the older audit finding in `audit/06-pii-compliance.md`, which predates the rewrite. |

---

## 5. Overall residual risk and decision

With the controls above, the residual risk is **acceptable to Low–Medium**. The
two areas to keep under review are **encryption-key management** (Risk A) and the
**AI consultation's processor terms + photo purge** (Risk F).

**[OWNER TO CONFIRM: sign-off to proceed, the review date, and any actions arising
— particularly the AI-feature processor terms and a documented key-rotation
owner.]**

---

## 6. Actions / open items

| Action | Owner | Status |
| --- | --- | --- |
| Confirm Art. 9 condition for aesthetic treatment with a solicitor | Owner | Open |
| Confirm Anthropic zero-retention/no-training terms + image purge window | Owner | Open |
| Set + document GA4 retention and IP anonymisation | Owner | Open |
| Name a key-rotation owner; record cadence | Owner | Open |
| Confirm clinical-record retention period (UK guidance) | Owner | Open |

---

Last reviewed: 2026-06-18 (draft, BLD-304).
