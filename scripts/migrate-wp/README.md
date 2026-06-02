# WordPress → K Clinics migration

Goal: move **everything** off the old WordPress/WooCommerce site into the new
CRM with **zero data loss** — clients, contact details, consent, health/consent
forms, enquiry submissions, and history (appointments, reviews, orders/invoices).

## Ground rules (safety)

1. **WordPress is read-only.** We never write to or delete from the old site. It
   stays the source of truth until the new data is verified and signed off.
2. **No PII in git or chat.** Dumps and any extracted data live only in
   `scripts/migrate-wp/data/` (git-ignored). Never paste real client rows into
   chat — share schema + redacted samples to design the mapping; share the full
   dump through a secure channel for the actual run.
3. **Idempotent + reversible.** The importer upserts (never duplicates) and tags
   every imported record (`source = "wordpress"`, plus the original WP id) so a
   migration can be re-run or rolled back cleanly.

## The four phases

### 1 · Discovery (what's in the dump)
Inventory every table + row count and locate where users, customers, forms,
orders and bookings live. Output: a data-inventory report — nothing unaccounted
for. (Designed from the **schema-only** dump first — no PII needed.)

### 2 · Mapping
A field-by-field map: each WordPress source field → the K Clinics field it lands
in. Where there's no home for a value, we **add a new field** to the schema (the
owner expects this). Anything genuinely orphaned is preserved verbatim in the
client's notes / a raw JSON sidecar so it's never dropped.

### 3 · Dry run + reconciliation
Run the importer in `--dry-run` against a copy of the data. It writes nothing and
produces a **reconciliation report**: source count vs would-import count for every
category, plus samples and a list of any unmapped fields. The owner signs this off.

### 4 · Go-live import
Run with `--commit` against production. Re-run the reconciliation to confirm the
live counts match source. Existing clients keep their records; on first visit they
use "forgot password" to set a login (no mass email, no data loss).

## What I need from you to start (no PII)

From the WordPress hosting (phpMyAdmin or shell), produce these and drop them in
`scripts/migrate-wp/data/` (git-ignored) or share securely:

```bash
# A) Schema only — table + column structure, NO data (safe to share):
mysqldump --no-data -u USER -p DBNAME > schema.sql

# B) Row counts per table (tells us where the volume is):
mysql -u USER -p -e "
  SELECT table_name, table_rows
  FROM information_schema.tables
  WHERE table_schema = 'DBNAME'
  ORDER BY table_rows DESC;" > table-counts.txt

# C) A few REDACTED sample rows from the key tables so we can map fields, e.g.:
#    wp_users, wp_usermeta, and the WooCommerce customer/order tables
#    (wp_wc_customer_lookup, wp_postmeta for shop_order), plus any form tables.
#    Replace names/emails/phones with dummy values before sharing.
```

Then, for the real run, the **full** dump + `/wp-content/uploads`:

```bash
mysqldump -u USER -p DBNAME > full-dump.sql   # full data dump
# and a copy of wp-content/uploads/ for any uploaded files/forms
```

## Target model (where things land)

- **Clients** ← WordPress users + WooCommerce customers, de-duplicated by email.
  `firstName, lastName, email, phone, dob, gender, address, tags, notes,
  marketingOptIn, smsReminders, source="wordpress"`.
- **Health/consent forms** → encrypted `HealthAssessment` records linked to the
  client (uses the app's health-encryption key).
- **Enquiry/contact forms** → `Consultation` / `Interaction` timeline entries.
- **History** → `Booking` (appointments), `Review` (testimonials), and
  order/invoice history (mapped to invoices/loyalty as agreed).
- New fields added to the Prisma schema wherever a value has no existing home.

## Running (filled in once the schema is known)

```bash
# Dry run — writes nothing, prints the reconciliation report:
DATABASE_URL=... node scripts/migrate-wp/migrate.mjs --file data/full-dump.sql --dry-run

# Commit — writes to the target database:
DATABASE_URL=... node scripts/migrate-wp/migrate.mjs --file data/full-dump.sql --commit
```
