# Neon Data Masking — K-Clinics column ruleset

A deliberate, column-by-column masking spec for Neon's **Data Masking (Beta)**, so an
anonymised branch can be used safely for QA, audits and preview deploys.

## Why this exists (read first)

A trial run on 2026-06-24 surfaced two traps:

1. **The Beta masks nothing by default.** A "Branch & anonymize data" branch came back
   with **Masked columns = 1** — only `neon_auth.project_config.name`. Every real PII
   column was left `None`. The auto-detection cannot be trusted; you must set each rule
   below by hand, then **Apply masking rules**, then confirm the count jumps to dozens.
2. **There are multiple Neon databases.** Masking has to target the right one (see the
   topology below). The patient data lives in the **clinic application** project, not the
   `neon-KClinicsOS` project that was anonymised first in the trial.

## Current situation & Neon topology (parked 2026-06-24)

This was a trial of the Beta; **no database is currently masked correctly** and the work is
parked pending the owner. What the trial mapped out:

| Neon database | Endpoint | Contains | Masking target? |
| --- | --- | --- | --- |
| **Clinic app** (app `DATABASE_URL`) | `ep-red-sound-abzh3b7i` | `Client`, `Booking`, `CallRecord`, `AcademyStudent`, clinical PII | **Yes — primary.** Not yet masked. |
| **`neon-KClinicsOS`** (shop + auth) | `ep-icy-sea-…` (branch `qa-anon`) | shop/e-commerce (`Customer`, `Order`, `GiftVoucher`, `Product`…) + `neon_auth` + `AdminUser` | Yes if anonymising shop QA. |
| **`neon_auth`** schema | (within the above) | better-auth: `user`, `account`, `session`, `invitation` | Yes — small surface. |

Trial outcome:
- The `qa-anon` branch (off `neon-KClinicsOS`) came back **Masked columns = 1** — the Beta's
  auto-detection masked essentially nothing; every real PII column was left `None`.
- It also mis-masked a few non-PII columns (`Brand.name`, `organization.name`) as
  "Synthetic Full Name" — those should be reverted to `None` (they're product/brand names).
- `qa-anon` is an **unmasked copy** of the shop+auth data and should be **deleted**.
- Direct verification from the sandbox isn't possible (Neon Postgres port is outside the
  egress allowlist); verify by running the leak-check SQL in the Neon SQL Editor, or add
  `*.eu-west-2.aws.neon.tech` to the environment's allowlist for a read-only check.

Outstanding (owner): decide which DB(s) to anonymise, apply the per-column rules below on the
correct project, **Apply masking rules**, confirm the masked-column count, run the leak-check,
then (optionally) wire the masked branch as a non-prod `DATABASE_URL`. Delete `qa-anon`.

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

## Shop / e-commerce database (`neon-KClinicsOS`)

A separate database (storefront + `neon_auth` + `AdminUser`) — relevant only if anonymising
**shop** QA, not patient data. Set only the columns below; leave every other column (and the
entire product catalogue) at `None`. First **revert** the auto-detector's wrong guesses:
`Brand.name` and `organization.name` → `None` (product/brand names, not people).

| Table.Column | Rule |
| --- | --- |
| `Customer.email` | Synthetic Email |
| `Customer.name` | Synthetic Full Name |
| `Customer.phone` | Synthetic Phone Number |
| `Customer.notes`, `Customer.stripeCustomerId` | Null |
| `Order.email` | Synthetic Email |
| `Order.name`, `Order.shipName` | Synthetic Full Name |
| `Order.phone` | Synthetic Phone Number |
| `Order.shipLine1` | Synthetic Address (or Null) |
| `Order.shipCity` | Synthetic City (or Null) |
| `Order.shipPostcode` | Synthetic Postcode (or Null) |
| `Order.shipLine2`, `Order.note`, `Order.trackingNumber`, `Order.stripeSessionId`, `Order.stripePaymentId` | Null |
| `GiftVoucher.recipientEmail` | Synthetic Email |
| `GiftVoucher.recipientName` | Synthetic Full Name |
| `GiftVoucher.message` | Null |
| `Review.author` | Synthetic Full Name |
| `Review.email` | Synthetic Email |
| `Review.body` | Null |
| `NewsletterSubscriber.email` | Synthetic Email |
| `AdminUser.email` | Synthetic Email |
| `AdminUser.name` | Synthetic Full Name |
| `AdminUser.passwordHash` | Null |
| `AuditLog.actor` | Synthetic Email if it stores admin emails, else None |
| `AuditLog.summary` | Null (audit text can contain names/emails) |
| `Setting.value` | ⚠️ None by default, but blank it if any row holds an API key/secret (no per-row control in the UI) |

Catalogue/config tables — leave **all** columns at `None`: `Brand` (after reverting name),
`Category`, `Counter`, `Discount`, `EditorialArticle`, `Expense`, `MediaAsset`,
`MembershipTier`, `Page`, `Product`, `ProductImage`, `ProductVariant`, `ProductTag`, `Tag`,
`OrderItem`. (`neon_auth` rules are the same as the section above, plus `jwks.privateKey` → Null.)

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
