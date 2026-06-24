# Neon Data Masking — K-Clinics column ruleset

A deliberate, column-by-column masking spec for Neon's **Data Masking (Beta)**, so an
anonymised branch can be used safely for QA, audits and preview deploys.

## Why this exists (read first)

A trial run on 2026-06-24 surfaced two traps:

1. **The Beta masks nothing by default.** A "Branch & anonymize data" branch came back
   with **Masked columns = 1** — only `neon_auth.project_config.name`. Every real PII
   column was left `None`. The auto-detection cannot be trusted; you must set each rule
   below by hand, then **Apply masking rules**, then confirm the count jumps to dozens.
2. **There are two Neon projects.** The patient data (`Client`, `Booking`, …) lives in
   the **application** project (the one the app's `DATABASE_URL` points at, endpoint
   `ep-red-sound-…`). The `neon-KClinicsOS` project holds only the `neon_auth` tables.
   **Anonymise the application project** for QA data; the auth tables are a separate,
   smaller surface (covered at the end).

## How to apply

In the Neon console for the **application** project: *Create branch → Branch & anonymize
data*. On the masking screen, use the **Search columns** box to find each column below
and set its **Masking** dropdown to the rule given. Then **Apply masking rules** and check
**Masked columns** is non-trivial. Finally run the verification SQL at the bottom.

Rule key: **Synthetic X** = use Neon's nearest synthetic generator (keeps shape + email
uniqueness). **Null** = blank it (free-text clinical, secrets, tokens, IPs — highest risk,
no realistic value needed). **Shift/Synthetic Date** = keep an age-realistic but fake date.

## `public` schema (application database)

### Client — the primary surface
| Column | Rule | Note |
| --- | --- | --- |
| `firstName` | Synthetic First Name | |
| `lastName` | Synthetic Last Name | |
| `email` | Synthetic Email | `@unique` — generator must stay unique |
| `phone` | Synthetic Phone Number | |
| `dob` | Synthetic Date / shift | drives birthday automation; keep plausible age |
| `genderSelfDescribe` | Null | free-text identity |
| `notes` | Null | free-text |
| `allergies` | Null | **clinical free-text — highest risk** |
| `medicalFlag`, `medicalFlagSetBy` | Null | clinical |
| `signupIp` | Null | |
| `passwordHash`, `resetTokenHash` | Null | credential material |
| `stripeCustomerId` | Null | payment linkage |
| `unsubToken`, `referralCode` | Synthetic/Random | both `@unique` — keep unique |
| `leaderboardDisplayName` | Synthetic First Name | shown publicly on leaderboards |

### AcademyStudent — trainee PII
| Column | Rule |
| --- | --- |
| `firstName` | Synthetic First Name |
| `lastName` | Synthetic Last Name |
| `email` | Synthetic Email |
| `phone` | Synthetic Phone Number |
| `dob` | Synthetic Date / shift |
| `notes` | Null |
| `passwordHash`, `resetTokenHash` | Null |

### Booking
| Column | Rule | Note |
| --- | --- | --- |
| `notes` | Null | free-text |
| `refundReason` | Null | |
| `stripeCustomerId`, `stripeSetupIntentId`, `stripePaymentMethodId`, `prepaidCheckoutId` | Null | payment refs |
| `manageToken` | Synthetic/Random | `@unique` self-service token |

### CallRecord — telephony
| Column | Rule | Note |
| --- | --- | --- |
| `fromNumber`, `toNumber` | Synthetic Phone Number | caller/callee |
| `agentEmail` | Synthetic Email | |
| `transcript`, `recordingUrl`, `recordingMime` | Null | already `encClinical` at rest, but blank for clean shape |
| `raw` | Null | encrypted webhook payload (duplicate transcript/PII) |
| `notes` | Null | |

### Review / Referral / Supplier
| Table.Column | Rule |
| --- | --- |
| `Review.body` | Null (free-text) |
| `Review.token` | Synthetic/Random (`@unique`) |
| `Referral.referredEmail` | Synthetic Email |
| `Supplier.contactName`, `Supplier.name` | Synthetic Full Name |
| `Supplier.email` | Synthetic Email |
| `Supplier.phone` | Synthetic Phone Number |
| `Supplier.addressLine` | Null |
| `Supplier.accountNumber` | Null (bank/account ref) |
| `Supplier.notes` | Null |

### AdminUser — staff (secrets, not just PII)
| Column | Rule | Note |
| --- | --- | --- |
| `email`, `googleEmail` | Synthetic Email | |
| `name` | Synthetic Full Name | |
| `publicPhone` | Synthetic Phone Number | |
| `photoUrl` | Null | |
| `totpSecret` | Null | **2FA secret — must blank** |
| `financePinHash` | Null | **finance PIN hash — must blank** |
| `googleRefreshToken` | Null | **OAuth token — must blank** |

## `neon_auth` schema (auth project — separate branch)
| Table.Column | Rule |
| --- | --- |
| `user.email` | Synthetic Email |
| `user.name` | Synthetic Full Name |
| `account.password` | Null |
| `account.accessToken`, `account.refreshToken`, `account.idToken` | Null |
| `session.ipAddress` | Null |
| `session.userAgent` | Null |
| `invitation.email` | Synthetic Email |
| `verification.value` | Null |

## Verify before trusting the branch

After applying, confirm **Masked columns** is non-trivial, then run this read-only check
in the SQL Editor (on the masked branch). All leak counts must be **0**; the `*_filled`
counts for clinical free-text should be **0**:

```sql
SELECT
  (SELECT count(*) FROM "Client")                                             AS clients,
  (SELECT count(*) FROM "Client" WHERE email ILIKE '%@kaulindustries.com')    AS leak_owner_domain,
  (SELECT count(*) FROM "Client" WHERE email ILIKE ANY (ARRAY
     ['%@gmail.com','%@hotmail.%','%@outlook.%','%@yahoo.%','%@icloud.com'])) AS real_provider_emails,
  (SELECT count(DISTINCT lower(email)) FROM "Client")                         AS distinct_emails,
  (SELECT count(*) FROM "Client" WHERE notes IS NOT NULL)                     AS notes_filled,
  (SELECT count(*) FROM "Client" WHERE allergies IS NOT NULL)                 AS allergies_filled,
  (SELECT count(*) FROM "Client" WHERE "medicalFlag" IS NOT NULL)             AS medicalflag_filled,
  (SELECT count(*) FROM "Client" WHERE "signupIp" IS NOT NULL)                AS signupip_filled;
```

`real_provider_emails ≈ clients` or any non-zero leak/clinical count = masking incomplete;
fix the rule and re-apply before pointing any preview/QA environment at the branch.
