# Data retention schedule

UK GDPR Art. 5(1)(e) — storage limitation. How long each category of personal
data is kept and why. Periods marked **[OWNER TO CONFIRM]** are placeholders for
the owner to set, usually against UK clinical, tax or awarding-body guidance.

> **Draft for owner review, not legal advice.** Where a clinical or statutory
> minimum applies, set the period to at least that minimum.

## How to read this

- "Trigger" is the event the clock starts from (e.g. last treatment, account
  closure, withdrawal of consent).
- Where data sits inside a record that must be **kept for a financial/clinical
  reason**, the personal/clinical free-text is **stripped on erasure** while the
  retained record (amounts, dates) stays — see `subject-rights.md`.
- "Auto-purged" / "auto-minimised" below means the nightly cron
  (`app/api/cron/daily/route.ts`) already enforces the cutoff — no owner
  action is needed for that category. Everything still marked
  **[OWNER TO CONFIRM]** has no scheduled job and is only actioned on request
  (erasure) today.

---

## Clinical / special-category data

| Data | Model(s) | Trigger | Retention | Basis |
| --- | --- | --- | --- | --- |
| Health assessments / medical history | `HealthAssessment` | Last treatment | **8 years from last treatment** — auto-purged by the nightly cron, gated on the admin setting "Purge old health assessments"; the owner turning that setting on is the sign-off. Only clients with no treatment inside the 8-year window are touched. Until the setting is enabled, records are retained. The submission IP is nulled after 13 months regardless (identifier minimisation), independent of the setting. | Clinical safety, insurance, professional duty |
| Clinical treatment notes | `Booking.clinicalNoteEnc`, SOP responses | Last treatment | As clinical records above **[OWNER TO CONFIRM]** — no scheduled purge job exists for this model yet | As above |
| Before-photos | `BeforePhoto` | Last treatment | **8 years**, auto-purged by the nightly cron alongside signed consents | Clinical documentation |
| Signed consents | `SignedConsent`, `ConsentRequest` | Treatment date | **8 years**, auto-purged by the nightly cron (`ConsentRequest` rows still `PENDING` past their `expiresAt` are purged immediately, independent of the 8-year window). The signing IP is nulled after 13 months (identifier minimisation) while the record itself is kept for its full 8 years. | Evidence of informed consent |
| Allergies / medical flag | `Client.allergies`, `Client.medicalFlag` | Account closure | With the clinical record **[OWNER TO CONFIRM]** | Clinical safety |
| AI consultation findings + images | `AiAnalysis`, `AiAnalysisImage` | Analysis date | Encrypted facial images (`AiAnalysisImage`) auto-purged after **90 days** by the nightly cron; the non-image plan/findings kept for the client's own history **[OWNER TO CONFIRM the findings window]** | Consent |
| Incident / accident reports | `Incident` | Incident date | **Retained on an H&S / RIDDOR legal-obligation basis** (RIDDOR reports kept ≥3 years; general accident records often longer). No scheduled purge exists — on erasure the row is kept but the encrypted injury/description narrative is redacted and free-text location nulled — only the anonymised safety fact (category, severity, RIDDOR flag, date) remains. **[OWNER TO CONFIRM the retention period]** | Legal obligation (Art. 17(3)(b)), H&S |

## Client / contact data

| Data | Model(s) | Trigger | Retention | Basis |
| --- | --- | --- | --- | --- |
| Client identity + contact | `Client` | Last visit / account closure | **[OWNER TO CONFIRM — e.g. keep while an active client; review after a period of inactivity]** — no scheduled purge job exists | Contract / legitimate interests |
| Consultations / enquiries | `Consultation`, `ConsultationNote` | Enquiry date | **2 years if no booking follows** (owner-confirmed 2026-08-18, PRJ-1032.20), auto-purged by the nightly cron. Scoped to clients with no bookings at all, so an enquiry that became a client relationship keeps its history. | Legitimate interests |
| Live chat (no account) | `ChatConversation`, `ChatMessage` | Last message | **12 months of inactivity**, auto-purged by the nightly cron (BLD-837) — messages cascade with the conversation. Only threads with no linked client account are covered by this sweep. | Legitimate interests |
| Live chat (linked to an account) | `ChatConversation`, `ChatMessage` | Last message | **[OWNER TO CONFIRM]** — no scheduled purge; only actioned via the account's own erasure request | Legitimate interests |
| Waitlist entries | `WaitlistEntry` | Window end / booked | Delete once the window passes / booked **[OWNER TO CONFIRM this runs as a scheduled sweep, not only on the next matching read]** | Legitimate interests |
| Reviews / NPS | `Review`, `NpsResponse` | Submission | **[OWNER TO CONFIRM]** — no scheduled purge job exists | Legitimate interests / consent for public display |

## Financial / transactional data

| Data | Model(s) | Trigger | Retention | Basis |
| --- | --- | --- | --- | --- |
| Bookings (amounts, dates) | `Booking`, `BookingItem` | Transaction | **6 years + current year** **[OWNER TO CONFIRM]** — no scheduled purge (financial records are generally kept, not purged, on this basis) | HMRC / tax law |
| Retail orders | `Order`, `OrderItem` | Transaction | As above | As above |
| Gift vouchers | `GiftVoucher` | Purchase / expiry | As above | As above |
| Payment metadata (Stripe ids) | `Booking`, `Order` | Transaction | As above | As above |
| Loyalty / points ledger | `ClientPoints`, `Referral` | Earned/spent | While the account is live; ledger is append-only | Contract |

## Marketing data

| Data | Model(s) | Trigger | Retention | Basis |
| --- | --- | --- | --- | --- |
| Marketing consent + evidence | `Client.marketingConsentAt` etc. | Consent given | Until withdrawn; keep the consent record as evidence after withdrawal | Consent (PECR/Art. 7) |
| Newsletter subscribers | `NewsletterSubscriber` | Sign-up | Until unsubscribed **[OWNER TO CONFIRM]** — no scheduled purge job exists | Consent |
| Email engagement metadata | `EmailEvent` | Send | **18 months**, auto-purged by the nightly cron (PRJ-1032.19) | Legitimate interests |
| Campaign records | `Campaign` | Send | **[OWNER TO CONFIRM]** — no scheduled purge job exists | Legitimate interests |
| Abandoned booking funnel data | `BookingIntent` | Abandonment | **90 days**, auto-purged by the nightly cron (PRJ-1032.18) | Legitimate interests |

## Analytics / behavioural data

| Data | Model(s) | Trigger | Retention | Basis |
| --- | --- | --- | --- | --- |
| Session replay | `ReplaySession`, `ReplayChunk` | Capture | **90 days**, auto-purged by the nightly cron (cascades to chunks) | Consent |
| Heatmaps | `HeatmapEvent` | Capture | **180 days**, auto-purged by the nightly cron | Consent |
| A/B test counters | `AbTest`, `AbVariant` | Aggregate | Aggregate only; no personal data | Consent |
| QR scans | `QrScan` | Scan | Coarse, no IP/PII | Legitimate interests |
| GA4 / Google Ads / Meta | (external) | Visit | Per GA4 retention setting **[OWNER TO CONFIRM]** | Consent |

## Communications

| Data | Model(s) | Trigger | Retention | Basis |
| --- | --- | --- | --- | --- |
| Call recordings + transcripts | `CallRecord` | Call | **Content auto-minimised after ~13 months** (395 days) by the nightly cron (BLD-127): transcript, recording URL and raw payload are cleared and both phone numbers redacted. The call *fact* (who/when/duration) is deliberately retained indefinitely as a business record — that indefinite retention itself is **[OWNER TO CONFIRM]** | Legitimate interests |

## Academy / training

| Data | Model(s) | Trigger | Retention | Basis |
| --- | --- | --- | --- | --- |
| Trainee accounts + progress | `AcademyStudent`, `LessonProgress`, `QuizAttempt`, `HomeworkSubmission` | Course end | **[OWNER TO CONFIRM — awarding-body/Ofqual record rules may set a minimum]** | Contract / legal obligation |
| Funding applications | `FundingApplication` | Application | **[OWNER TO CONFIRM]** | Consent / legitimate interests |
| Enrolment enquiries | `Enrolment` | Enquiry | **[OWNER TO CONFIRM]** | Legitimate interests |

## Staff / contractor / recruitment

| Data | Model(s) | Trigger | Retention | Basis |
| --- | --- | --- | --- | --- |
| Staff accounts | `AdminUser` | Leaving date | **[OWNER TO CONFIRM — employment-record retention]** | Contract / legal obligation |
| Time entries | `TimeEntry` | Recorded | **[OWNER TO CONFIRM — payroll/working-time records, commonly several years]** | Legal obligation |
| Contractor records | `Contractor`, `ContractorVisit` | Last visit | **[OWNER TO CONFIRM]** | Legitimate interests |
| Job applications | `JobApplication` | Application | **Rejected: 6 months. Unreviewed/still-open: 12 months.** Both are auto-purged by the nightly cron (BLD-314 Phase 3), including deleting the candidate's CV from Blob storage once no application row references it. | Legitimate interests / consent |

## Security / audit

| Data | Model(s) | Trigger | Retention | Basis |
| --- | --- | --- | --- | --- |
| Security/login telemetry | `SecurityEvent` | Event | **90 days**, auto-purged by the nightly cron | Legitimate interests (security) |
| Audit log | `AuditEvent` | Event | Long-term; append-only and ties to clinical/financial records | Legal obligation / accountability |
| Discount-abuse fingerprints | `DiscountClaim` | Claim | Hashed; **[OWNER TO CONFIRM purge]** — no scheduled purge job exists | Legitimate interests (fraud) |

---

## Implementing retention

Most categories above now have a scheduled purge or minimisation job running
in the nightly cron (`app/api/cron/daily/route.ts`) — see each row for its
exact cutoff. What's still **[OWNER TO CONFIRM]** falls into two groups:

1. **Period not yet set** by the owner (client identity, reviews/NPS, staff
   and contractor records, academy records, `DiscountClaim`, `Campaign`,
   newsletter subscribers, linked-account live chat, `Booking.clinicalNoteEnc`)
   — once a period is agreed, add it to this table and, where a purge makes
   sense, to the cron.
2. **Indefinite retention as a deliberate choice** (e.g. the `CallRecord`
   business fact after its content is scrubbed, the audit log) — these need
   an explicit owner sign-off that indefinite is intended, not just an
   oversight.

---

Last reviewed: 2026-08-26 (resynced against the cron's actual cutoffs, BLD-1504).
