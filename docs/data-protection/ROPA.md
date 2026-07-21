# Record of Processing Activities (ROPA)

UK GDPR Article 30. K Clinics processes the personal data below as **controller**.
Grounded in `prisma/schema.prisma`, `lib/integrations.ts`, `lib/consent.ts` and
the route handlers cited.

> **This is a draft for owner review, not legal advice.** Lawful bases and the
> Art. 9 conditions stated here are the clinic's working position and should be
> confirmed with a data-protection solicitor. Items needing owner input are
> tagged **[OWNER TO CONFIRM: …]**.

Controller: K Clinics. ICO registration ZC153001. **[OWNER TO CONFIRM: registered
legal name, address, ICO number current, DPO/contact.]**

---

## 1. Controller and contact

| Field | Value |
| --- | --- |
| Controller | K Clinics **[OWNER TO CONFIRM: legal/trading name]** |
| Address | **[OWNER TO CONFIRM: registered/clinic address]** |
| ICO registration | ZC153001 **[OWNER TO CONFIRM: current]** |
| Data-protection contact | **[OWNER TO CONFIRM: name + privacy inbox]** |
| DPO appointed? | **[OWNER TO CONFIRM: required? if so, who]** |

---

## 2. Categories of data subject

- **Clients / patients** — people who book or receive treatments (`Client`).
- **Prospective clients / enquirers** — consultation requests, chat visitors,
  newsletter sign-ups, waitlist, gift-voucher purchasers/recipients
  (`Consultation`, `ChatConversation`, `NewsletterSubscriber`, `WaitlistEntry`,
  `GiftVoucher`).
- **Academy trainees / applicants** — training students and enquirers
  (`AcademyStudent`, `Enrolment`, `FundingApplication`).
- **Staff / clinicians / contractors** — platform users (`AdminUser`,
  `Contractor`, `TimeEntry`).
- **Job applicants** (`JobApplication`).
- **Suppliers / business contacts** and **inbound/outbound callers**
  (`Supplier`, `CallRecord`).

---

## 3. Processing activities

Each row is one processing purpose. "Art. 9 condition" applies only where
special-category (health) data is involved.

### 3.1 Bookings and treatment delivery

| Item | Detail |
| --- | --- |
| Purpose | Take bookings, hold appointments, deliver treatments, record the clinical encounter. |
| Data categories | Identity + contact (name, email, phone, DOB), appointment details, treatment notes, SOP/safety checklist responses, before-photos, allergies, medical flag. (`Client`, `Booking`, `BeforePhoto`, `AppointmentSession`) |
| Special category | Yes — health/clinical data (clinical notes `clinicalNoteEnc`, allergies, medical flag, before-photos). |
| Lawful basis | Art. 6(1)(b) contract (the booking) and Art. 6(1)(c)/(f) for safety records. |
| Art. 9 condition | Art. 9(2)(h) — health/medical care provided by/under a health professional. **[OWNER TO CONFIRM with solicitor: (h) vs (a) explicit consent for aesthetic, non-NHS treatment.]** |
| Recipients / processors | Hosting (Vercel), database host. Stripe (card/payment). Resend (confirmations/reminders). Twilio (SMS reminders, if enabled). |
| Retention | See `retention-schedule.md` — clinical records kept long-term per UK clinical-record guidance **[OWNER TO CONFIRM period]**. |
| Security | At-rest encryption of clinical free-text and before-photos (AES-256-GCM keyring); role-based access (`clients.clinical.view`); immutable audit log (`AuditEvent`). |

### 3.2 Health assessments and consent

| Item | Detail |
| --- | --- |
| Purpose | Capture medical history / pre-treatment questionnaires and informed-consent signatures before treatment. |
| Data categories | Health questionnaire answers; signed consent (body, e-signature image, IP, user-agent, timestamps). (`HealthAssessment`, `SignedConsent`, `ConsentRequest`) |
| Special category | Yes — full medical history. |
| Lawful basis | Art. 6(1)(c) legal obligation / Art. 6(1)(f) (clinical safety, insurance, professional duty). |
| Art. 9 condition | Art. 9(2)(h) health care. **[OWNER TO CONFIRM with solicitor.]** |
| Recipients / processors | Hosting + database host only. Google Translate is used to render foreign-language answers into English for staff (`lib/integrations.ts`), if configured — originals preserved. |
| Retention | With the clinical record. Append-only and immutable (corrections create a new version; never edited/deleted in place). |
| Security | Encrypted cipher + HMAC `integrityHash` (tamper-evident); append-only model. |

### 3.3 Payments and refunds

| Item | Detail |
| --- | --- |
| Purpose | Save a card at booking, charge on delivery / late-cancel, refund, reconcile to accounts. |
| Data categories | Name, email, amount, Stripe customer / payment-method / payment-intent ids, BNPL pre-payment refs. Card numbers are **not** stored by K Clinics — held by Stripe. (`Booking`, `Order`, `GiftVoucher`) |
| Special category | No. |
| Lawful basis | Art. 6(1)(b) contract; Art. 6(1)(c) legal obligation (tax/accounting records). |
| Recipients / processors | Stripe (payment processing). Xero (sales invoices / credit notes pushed via `lib/xero.ts`). TrueLayer (bank-balance feed; account-level, not client data). |
| Retention | Financial/transaction records kept **6 years + current year** for HMRC. **[OWNER TO CONFIRM.]** |
| Security | Stripe handles card data (PCI DSS). Xero/TrueLayer OAuth tokens encrypted at rest (`ExternalConnection.tokensEnc`). Audit log on every charge/refund/Xero push (`AuditEvent`). |

### 3.4 Client communications and service messages

| Item | Detail |
| --- | --- |
| Purpose | Booking confirmations, reminders, password resets, follow-up questionnaires, review/NPS requests, live chat replies, voicemail/call handling. |
| Data categories | Name, email, phone, message content, email-event metadata (opens/clicks/bounces), call recordings + transcripts. (`EmailEvent`, `ChatConversation`/`ChatMessage`, `FollowUp`, `NpsResponse`, `CallRecord`) |
| Special category | Possibly incidental in free-text (chat / call transcript). |
| Lawful basis | Art. 6(1)(b) contract (transactional) / Art. 6(1)(f) legitimate interests (service quality, call records). |
| Recipients / processors | Resend (email). Twilio (SMS). yay.com (telephony — call logging, recordings, voicemail transcripts). Chat AI uses Anthropic Claude (`lib/chat-ai.ts`). |
| Retention | See `retention-schedule.md`. Call recordings/transcripts **[OWNER TO CONFIRM period]**. |
| Security | Role-based access; transcripts scrubbed on erasure. |

### 3.5 Marketing email and campaigns

| Item | Detail |
| --- | --- |
| Purpose | Send marketing emails, campaigns, offers, re-engagement to people who have opted in. |
| Data categories | Name, email, opt-in flag + **consent evidence** (when/where/wording version), segment tags, engagement metrics, unsubscribe token. (`Client.marketingOptIn` + `marketingConsentAt`/`Source`/`Version`, `NewsletterSubscriber`, `Campaign`) |
| Special category | No (treatment interest may imply health — segments must avoid special-category inference). |
| Lawful basis | Consent — Art. 6(1)(a) UK GDPR + PECR reg. 22 for electronic marketing. |
| Recipients / processors | Resend (sending). Meta CAPI / Google Ads for campaign measurement (marketing-consent gated). |
| Retention | Until withdrawn; legacy boolean-only opt-ins are excluded from sends until re-permissioned (`legacyOptInWhere`, BLD-242). |
| Security | `marketableClientWhere()` enforces opt-in + not-unsubscribed + recorded consent on every bulk send; one-click unsubscribe (`/api/unsubscribe`). |

### 3.6 Website analytics and behaviour

| Item | Detail |
| --- | --- |
| Purpose | Understand site usage, measure campaigns, improve the site. |
| Data categories | GA4 / Google Ads / Meta Pixel analytics; first-party heatmaps + session replay (inputs masked, no keystrokes, no PII); A/B test exposures; QR-scan counts (coarse device/referer/country, no IP). (`ReplaySession`, `HeatmapEvent`, `AbTest`, `QrScan`) |
| Special category | No. |
| Lawful basis | Consent — Art. 6(1)(a) + PECR reg. 6 (cookies/storage). |
| Recipients / processors | Google (GA4, Google Ads), Meta (Pixel/CAPI). First-party replay/heatmaps stay in our database. |
| Retention | **[OWNER TO CONFIRM: GA4 retention setting; first-party replay/heatmap purge window.]** |
| Security | All third-party pixels gated behind the cookie banner; replay masks all text + inputs and blocks media. |

### 3.7 AI consultation ("Get My Plan" / K Vision)

| Item | Detail |
| --- | --- |
| Purpose | Account-gated photo analysis that produces a catalogue-bound, non-clinical treatment plan. |
| Data categories | Uploaded face/skin photos (downscaled in the browser), derived findings, recommended treatments, budget. (`AiAnalysis`, `AiAnalysisImage`) |
| Special category | Yes — facial images + skin findings. |
| Lawful basis | Art. 6(1)(a) consent (`AiAnalysis.consentAt`). |
| Art. 9 condition | Art. 9(2)(a) explicit consent. The output is explicitly **non-clinical** (a treatment-interest plan, not a diagnosis). |
| Recipients / processors | Anthropic (Claude Haiku/Sonnet) for the analysis (`lib/ai-consultation.ts`). |
| Retention | Image storage is opt-in (`storeImages`); findings + images encrypted (`findingsEnc`, `dataEnc`). **[OWNER TO CONFIRM: auto-purge window for stored images.]** |
| Security | Images downscaled client-side, encrypted at rest; monthly cap; refusal path for unsafe inputs. |

### 3.8 Loyalty, referrals and reviews

| Item | Detail |
| --- | --- |
| Purpose | Run the points/loyalty programme, referrals, and client reviews. |
| Data categories | Points ledger, referral links + referred-friend email, review text + optional public first-name consent. (`ClientPoints`, `Referral`, `Review`) |
| Special category | No. |
| Lawful basis | Art. 6(1)(b) contract / Art. 6(1)(f) legitimate interests; public display of a review name needs Art. 6(1)(a) consent (`Review.displayConsent`). |
| Recipients / processors | Optional sync of approved reviews to Google Business Profile. |
| Retention | See `retention-schedule.md`. |
| Security | Public display gated on explicit `displayConsent`; leaderboard opt-in only. |

### 3.9 Academy (training)

| Item | Detail |
| --- | --- |
| Purpose | Deliver clinician training: enrolment, LMS progress, quizzes, homework, funding enquiries, gamification. |
| Data categories | Name, email, phone, DOB (16+ check), goals, course progress, homework files, funding self-check answers (employment/residency/income flags). (`AcademyStudent`, `Enrolment`, `HomeworkSubmission`, `FundingApplication`) |
| Special category | Generally no. Funding answers may include socio-economic data — handle with care. |
| Lawful basis | Art. 6(1)(b) contract (training) / Art. 6(1)(a) for funding enquiries. |
| Recipients / processors | Thinkific (legacy theory platform link), Vercel Blob (homework/PDF files), Resend (email), Stripe/Clearpay (course payments/finance). |
| Retention | Awarding-body / Ofqual record-keeping rules may set a minimum. **[OWNER TO CONFIRM: VTCT/Ofqual retention requirement.]** |
| Security | Per-tenant scoping; passwords hashed; passkeys supported. |

### 3.10 Staff, contractors and HR-adjacent

| Item | Detail |
| --- | --- |
| Purpose | Run staff accounts, scheduling, time tracking, gamification, contractor check-in, recruitment. |
| Data categories | Staff name/email, hashed password, 2FA secret (encrypted), schedules, time entries, public profile, contractor contact details, job applications (name/email/phone/CV). (`AdminUser`, `TimeEntry`, `Contractor`, `JobApplication`) |
| Special category | No (unless a CV volunteers it). |
| Lawful basis | Art. 6(1)(b) contract (employment) / Art. 6(1)(c) legal obligation / Art. 6(1)(f). |
| Recipients / processors | Hosting + database host; Google Workspace Directory (mailbox management) and Google SSO, if enabled; Vercel Blob (CV uploads). |
| Retention | Employment-record retention. **[OWNER TO CONFIRM periods, incl. unsuccessful job applicants.]** |
| Security | Hashed passwords (bcrypt), TOTP secret encrypted, recovery codes hashed, passkeys; session-epoch revocation; security-event log. |

### 3.11 Security, audit and fraud prevention

| Item | Detail |
| --- | --- |
| Purpose | Detect/prevent abuse, brute-force lockout, and keep an audit trail of clinical/financial actions. |
| Data categories | Login telemetry (email attempted, IP, user-agent), discount-abuse fingerprints (hashed email/phone/name+DOB), append-only audit events. (`SecurityEvent`, `DiscountClaim`, `AuditEvent`) |
| Special category | No. |
| Lawful basis | Art. 6(1)(f) legitimate interests (security, fraud prevention) / Art. 6(1)(c). |
| Recipients / processors | Sentry (error monitoring; `sendDefaultPii: false`, replay masked). Upstash Redis (rate-limit counters), if configured. |
| Retention | **[OWNER TO CONFIRM: security-log and audit retention.]** |
| Security | Fingerprints are SHA-256 truncations, not raw identifiers; audit log is append-only. |

---

## 4. International transfers

Personal data may be processed outside the UK by sub-processors (for example
Stripe, Anthropic, Meta, Google operate in the US). Each transfer relies on the
provider's UK/EU adequacy position or its standard contractual clauses / UK
Addendum. See `processors.md` for the per-processor transfer basis. **[OWNER TO
CONFIRM: that each processor's current transfer mechanism is recorded and that
the hosting/database region is acceptable.]**

---

## 5. General security measures (apply across all activities)

- AES-256-GCM encryption at rest for clinical free-text, health assessments,
  before-photos, AI findings/images, signed consents, and OAuth tokens, via a
  versioned keyring with HMAC integrity hashes (`lib/crypto.ts`).
- Role-based access control with a revocable `clients.clinical.view` permission
  gating clinical data; least-privilege roles (FRONT_DESK, DEVELOPER and
  CONTRACTOR see no clinical/client data).
- Immutable, append-only audit log of booking → treatment → payment actions.
- Consent-gated analytics/marketing; session-replay masking.
- TLS in transit; hashed passwords; TOTP/passkey 2FA; brute-force lockout; a
  Row-Level-Security programme for tenant isolation (`prisma/platform-migrations/ring1/`).

---

Last reviewed: 2026-06-18 (draft, BLD-304).
