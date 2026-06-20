# Processors and sub-processors

UK GDPR Art. 28. Every third party that receives personal data from K Clinics, or
that stores/transmits it on the clinic's behalf. Drawn from the live integration
registry (`lib/integrations.ts`), `docs/INTEGRATIONS.md` and the code paths cited.

> **Inert-until-credentialed:** many integrations only become active once their
> API keys are set. A processor is "live" only where its credentials are present
> in production. The owner should confirm which are switched on.
>
> Locations and transfer mechanisms below are the **likely** position from each
> provider's public documentation and must be verified. Items needing owner/legal
> input are tagged **[OWNER TO CONFIRM: …]**.

---

## Core infrastructure (always on)

| Processor | Personal data it receives | Purpose | Location / transfer basis | DPA |
| --- | --- | --- | --- | --- |
| **Vercel** | All data passing through the app (requests, responses, logs); file uploads in **Vercel Blob** (CVs, homework, facility docs, media). | Hosting, serverless functions, file storage, CDN. | US-based; relies on SCCs / UK Addendum. **[OWNER TO CONFIRM: function/region.]** | https://vercel.com/legal/dpa |
| **Database host** (Neon / Vercel Postgres / Supabase) | The entire database — clients, bookings, clinical records (encrypted), staff, academy. | Primary data store (PostgreSQL). | **[OWNER TO CONFIRM: which provider + region; EU/UK region strongly preferred for clinical data.]** | Neon: https://neon.tech/dpa · Supabase: https://supabase.com/legal/dpa |

---

## Payments and finance

| Processor | Personal data it receives | Purpose | Location / transfer basis | DPA |
| --- | --- | --- | --- | --- |
| **Stripe** | Cardholder name, email, card details (entered directly into Stripe), payment metadata. K Clinics stores only Stripe ids, not card numbers. | Card capture, charges, refunds, BNPL (Klarna/Clearpay) checkout. | US/global; SCCs + UK Addendum. PCI DSS Level 1. | https://stripe.com/legal/dpa |
| **Xero** | Customer name + invoice/credit-note line data for treatments/orders. | Push sales invoices and credit notes; accounting. (`lib/xero.ts`) | NZ/US; adequacy/SCCs. **[OWNER TO CONFIRM transfer basis.]** | https://www.xero.com/uk/about/terms/data-processing/ |
| **TrueLayer** | Business bank-account data (clinic's own account, not client data). | Open-banking bank-balance feed. (`lib/truelayer.ts`) | UK/EU. | https://truelayer.com/legal/ |

---

## Communications

| Processor | Personal data it receives | Purpose | Location / transfer basis | DPA |
| --- | --- | --- | --- | --- |
| **Resend** | Recipient email, name, email subject/body, send metadata. | Transactional + marketing email (`lib/email.ts`). | US; SCCs + UK Addendum. | https://resend.com/legal/dpa |
| **Twilio** | Recipient phone number, message body. | SMS reminders/confirmations (`lib/sms.ts`), if enabled. | US/global; SCCs + UK Addendum. | https://www.twilio.com/en-us/legal/data-protection-addendum |
| **yay.com** | Caller/recipient phone numbers, call recordings, voicemail transcripts. | VoIP telephony, call logging, caller-to-client matching (`lib/yay.ts`). | UK. | **[OWNER TO CONFIRM: yay.com DPA link + that call recording is lawful/notified.]** |

---

## AI and transcription

| Processor | Personal data it receives | Purpose | Location / transfer basis | DPA |
| --- | --- | --- | --- | --- |
| **Anthropic (Claude)** | AI-consultation photos + prompt (`lib/ai-consultation.ts`); live-chat messages (`lib/chat-ai.ts`); dictated clinical-note transcript for tidy-up (`lib/integrations.ts` voice-note flow). | Photo analysis → non-clinical plan; chat replies; clinical-note structuring. | US; SCCs + UK Addendum. | https://www.anthropic.com/legal/commercial-terms — **[OWNER TO CONFIRM: zero-retention / no-training terms are in force for the API plan used.]** |
| **Deepgram** | Clinician's dictated audio (clinical voice note), if enabled. | Speech-to-text transcription. | US; SCCs. | https://deepgram.com/terms — **[OWNER TO CONFIRM: enabled? DPA in place?]** |

---

## Analytics and advertising (consent-gated)

These load **only after the visitor opts in** to the relevant cookie category
(`components/marketing/TrackingScripts.tsx`).

| Processor | Personal data it receives | Purpose | Location / transfer basis | DPA |
| --- | --- | --- | --- | --- |
| **Google (GA4 + Google Ads)** | Online identifiers, page/interaction events; `gclid` for offline conversion upload. | Site analytics + ad measurement. | US; SCCs + UK Addendum; Google Consent Mode. | https://business.safety.google/adsprocessorterms/ |
| **Meta (Pixel + Conversions API)** | Online identifiers + conversion events (hashed where applicable). | Ad measurement (`lib/analytics-events.ts`, `lib/conversions.ts`). | US; SCCs + UK Addendum. | https://www.facebook.com/legal/terms/dataprocessing |
| **Sentry** | Error context; session replay with **all text + inputs masked, media blocked**, `sendDefaultPii: false`. | Error monitoring + masked replay. | US/EU; SCCs. **[OWNER TO CONFIRM: EU data-region selected.]** | https://sentry.io/legal/dpa/ |

---

## Google Workspace and related (optional)

| Processor | Personal data it receives | Purpose | Location / transfer basis | DPA |
| --- | --- | --- | --- | --- |
| **Google Workspace (Directory API)** | Staff mailbox/account data. | Manage @kclinics.co.uk mailboxes from admin (BLD-312), if enabled. | US/EU; SCCs + UK Addendum. | https://workspace.google.com/terms/dpa_terms.html |
| **Google SSO** | Staff Google account id + email. | Staff sign-in, if enabled. | As above. | As above. |
| **Google Calendar** | Clinician busy-times + appointment event details. | Two-way calendar sync, if enabled. | As above. | As above. |
| **Google Business Profile / Places** | Approved review text + reviewer display data. | Show/sync reviews + star rating. | As above. | As above. |
| **Google Translate** | Client health-form free-text answers. | Translate answers to English for staff (originals preserved). | As above. | As above. |
| **Thinkific** | Trainee account/progress (legacy theory link). | Academy theory platform, where still used. | US/Canada; SCCs. **[OWNER TO CONFIRM: still in use? DPA?]** | https://www.thinkific.com/data-processing-addendum/ |

---

## Security / supporting

| Processor | Personal data it receives | Purpose | Location / transfer basis | DPA |
| --- | --- | --- | --- | --- |
| **Upstash (Redis)** | Rate-limit counters keyed by identifier/IP (transient). | Brute-force lockout fast counter (`lib/security/rate-limit.ts`), if configured. | Global; SCCs. **[OWNER TO CONFIRM: enabled + region.]** | https://upstash.com/trust/dpa.pdf |

---

## Maintenance

- When a new key is added in `lib/integrations.ts` or a new `sendEmail` /
  `sendSms` / AI / file-upload path ships, add the processor here, confirm a DPA
  is signed, and record the transfer basis.
- Confirm each processor's current sub-processor list against this register
  annually.
- For the future case where K Clinics becomes a **processor** for other clinics,
  this list also forms the disclosed sub-processor register (see
  `docs/COMPLIANCE_ROADMAP.md`, M1).

---

Last reviewed: 2026-06-18 (draft, BLD-304).
