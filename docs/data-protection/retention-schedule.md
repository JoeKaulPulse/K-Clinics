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

---

## Clinical / special-category data

| Data | Model(s) | Trigger | Retention | Basis |
| --- | --- | --- | --- | --- |
| Health assessments / medical history | `HealthAssessment` | Last treatment | **[OWNER TO CONFIRM — UK guidance for adult clinical records is commonly 8 years from last contact; longer for under-18s. Set per the clinic's clinical-records policy.]** | Clinical safety, insurance, professional duty |
| Clinical treatment notes | `Booking.clinicalNoteEnc`, SOP responses | Last treatment | As clinical records above | As above |
| Before-photos | `BeforePhoto` | Last treatment | As clinical records above **[OWNER TO CONFIRM]** | Clinical documentation |
| Signed consents | `SignedConsent`, `ConsentRequest` | Treatment date | As clinical records above **[OWNER TO CONFIRM]** | Evidence of informed consent |
| Allergies / medical flag | `Client.allergies`, `Client.medicalFlag` | Account closure | With the clinical record | Clinical safety |
| AI consultation findings + images | `AiAnalysis`, `AiAnalysisImage` | Analysis date | Encrypted facial images (`AiAnalysisImage`) auto-deleted after **90 days** (daily cron); the non-image plan/findings kept for the client's own history **[OWNER TO CONFIRM the findings window]** | Consent |
| Incident / accident reports | `Incident` | Incident date | **Retained on an H&S / RIDDOR legal-obligation basis** (RIDDOR reports kept ≥3 years; general accident records often longer). On erasure the row is kept but the encrypted injury/description narrative is redacted and free-text location nulled — only the anonymised safety fact (category, severity, RIDDOR flag, date) remains. **[OWNER TO CONFIRM the retention period]** | Legal obligation (Art. 17(3)(b)), H&S |

## Client / contact data

| Data | Model(s) | Trigger | Retention | Basis |
| --- | --- | --- | --- | --- |
| Client identity + contact | `Client` | Last visit / account closure | **[OWNER TO CONFIRM — e.g. keep while an active client; review after a period of inactivity]** | Contract / legitimate interests |
| Consultations / enquiries | `Consultation`, `ConsultationNote` | Enquiry date | **[OWNER TO CONFIRM — e.g. 2 years if no booking follows]** | Legitimate interests |
| Live chat | `ChatConversation`, `ChatMessage` | Last message | **[OWNER TO CONFIRM]** | Legitimate interests |
| Waitlist entries | `WaitlistEntry` | Window end / booked | Delete once the window passes / booked | Legitimate interests |
| Reviews / NPS | `Review`, `NpsResponse` | Submission | **[OWNER TO CONFIRM]** | Legitimate interests / consent for public display |

## Financial / transactional data

| Data | Model(s) | Trigger | Retention | Basis |
| --- | --- | --- | --- | --- |
| Bookings (amounts, dates) | `Booking`, `BookingItem` | Transaction | **6 years + current year** | HMRC / tax law **[OWNER TO CONFIRM]** |
| Retail orders | `Order`, `OrderItem` | Transaction | As above | As above |
| Gift vouchers | `GiftVoucher` | Purchase / expiry | As above | As above |
| Payment metadata (Stripe ids) | `Booking`, `Order` | Transaction | As above | As above |
| Loyalty / points ledger | `ClientPoints`, `Referral` | Earned/spent | While the account is live; ledger is append-only | Contract |

## Marketing data

| Data | Model(s) | Trigger | Retention | Basis |
| --- | --- | --- | --- | --- |
| Marketing consent + evidence | `Client.marketingConsentAt` etc. | Consent given | Until withdrawn; keep the consent record as evidence after withdrawal | Consent (PECR/Art. 7) |
| Newsletter subscribers | `NewsletterSubscriber` | Sign-up | Until unsubscribed | Consent |
| Email engagement metadata | `EmailEvent`, `Campaign` | Send | **[OWNER TO CONFIRM — e.g. 13–25 months]** | Legitimate interests |

## Analytics / behavioural data

| Data | Model(s) | Trigger | Retention | Basis |
| --- | --- | --- | --- | --- |
| Session replay / heatmaps | `ReplaySession`, `ReplayChunk`, `HeatmapEvent` | Capture | **[OWNER TO CONFIRM — recommend a short rolling window, e.g. 30–90 days, with auto-purge]** | Consent |
| A/B test counters | `AbTest`, `AbVariant` | Aggregate | Aggregate only; no personal data | Consent |
| QR scans | `QrScan` | Scan | Coarse, no IP/PII | Legitimate interests |
| GA4 / Google Ads / Meta | (external) | Visit | Per GA4 retention setting **[OWNER TO CONFIRM]** | Consent |

## Communications

| Data | Model(s) | Trigger | Retention | Basis |
| --- | --- | --- | --- | --- |
| Call recordings + transcripts | `CallRecord` | Call | **[OWNER TO CONFIRM — recordings carry their own justification + purge window]** | Legitimate interests |

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
| Job applications | `JobApplication` | Application | **[OWNER TO CONFIRM — e.g. 6–12 months for unsuccessful applicants]** | Legitimate interests / consent |

## Security / audit

| Data | Model(s) | Trigger | Retention | Basis |
| --- | --- | --- | --- | --- |
| Security/login telemetry | `SecurityEvent` | Event | **[OWNER TO CONFIRM — e.g. 12 months]** | Legitimate interests (security) |
| Audit log | `AuditEvent` | Event | Long-term; append-only and ties to clinical/financial records | Legal obligation / accountability |
| Discount-abuse fingerprints | `DiscountClaim` | Claim | Hashed; **[OWNER TO CONFIRM purge]** | Legitimate interests (fraud) |

---

## Implementing retention

No automated retention/purge job is documented for most categories yet — periods
above are largely enforced **on request** (erasure) rather than on a schedule.
**[OWNER TO CONFIRM]** whether to add scheduled purges (session replay, old
enquiries, expired waitlist, security logs) once the periods are set; the daily
cron (`app/api/cron/daily/route.ts`) is the natural place.

---

Last reviewed: 2026-06-18 (draft, BLD-304).
