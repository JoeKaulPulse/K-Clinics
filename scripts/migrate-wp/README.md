# WordPress → KClinics migration

Move **everything** off the old WordPress/WooCommerce site into the new CRM with
**zero data loss** — every client, their contact details and consent, plus (in a
later step) health/consent forms and history.

> **You run these on your own machine** (your laptop), in a terminal — **not on
> Vercel**. Vercel hosts the live website; this is a one-off local job that reads
> the dump file sitting on your computer and (for the final step) writes to the
> new database. The dump never leaves your machine.

## Ground rules

1. **WordPress is read-only.** Nothing is written to or deleted from the old site.
2. **No PII in git or chat.** Dumps live only in `scripts/migrate-wp/data/`
   (git-ignored — anything you drop there is automatically *not* committed). The
   script *output* (table names + counts) is safe to paste back.
3. **Re-runnable & non-destructive.** Imports upsert by email and only fill blank
   fields, so re-running never duplicates or clobbers.

## Do this — three commands, in order

```bash
# 0) Get the toolkit + put your dump in place (one time)
git pull                                   # pull this branch
mkdir -p scripts/migrate-wp/data
#   …copy your full-dump.sql into scripts/migrate-wp/data/  (it stays git-ignored)

# 1) INVENTORY — read-only, no database, no setup. Paste the output back to me.
node scripts/migrate-wp/inventory.mjs scripts/migrate-wp/data/full-dump.sql

# 2) DRY RUN — read-only, no database. Shows how many clients we'd create +
#    any fields I still need to map. Paste the output back to me.
node scripts/migrate-wp/migrate.mjs --file scripts/migrate-wp/data/full-dump.sql --dry-run

# 3) COMMIT — writes the clients into the new database (only after we've both
#    signed off on the dry-run numbers).
DATABASE_URL="<new-db-url>" node scripts/migrate-wp/migrate.mjs \
  --file scripts/migrate-wp/data/full-dump.sql --commit
```

Only **Node** is needed for the dry runs (already installed if you can run the
site). The `--commit` steps need the new database URL.

## Then history + clinical (same pattern: dry-run, paste, commit)

```bash
# Appointments → bookings, testimonials → reviews, loyalty → points
node scripts/migrate-wp/migrate-history.mjs  --file scripts/migrate-wp/data/full-dump.sql --dry-run
DATABASE_URL="<new-db-url>" node scripts/migrate-wp/migrate-history.mjs --file scripts/migrate-wp/data/full-dump.sql --commit

# Consents, skin-quiz, care plans, recommendations, enquiry forms (ENCRYPTED)
node scripts/migrate-wp/migrate-clinical.mjs --file scripts/migrate-wp/data/full-dump.sql --dry-run
DATABASE_URL="<new-db-url>" HEALTH_ENCRYPTION_KEY="<same-as-prod>" [HEALTH_HMAC_KEY="<same-as-prod>"] \
  node scripts/migrate-wp/migrate-clinical.mjs --file scripts/migrate-wp/data/full-dump.sql --commit
```

Run order for `--commit`: **clients first** (history & clinical link to them by
email), then history, then clinical. All steps are re-runnable (each row carries
a source marker and is skipped if already imported).

## What gets imported

- **Clients** ← WordPress users + WooCommerce customers, de-duped by email. Keeps
  signup dates, names, phone (incl. `booked_phone`), DOB (`birthday`), address,
  and marketing/SMS consent (custom columns + MailPoet + the signup checkbox).
- **Bookings** ← `grafik`/`grafik_dent` (COMPLETED, or CANCELLED when `del=1`).
- **Reviews** ← `review_user`. **Loyalty** ← `bonus` → ClientPoints.
- **Encrypted clinical** ← `sign_table` (consents + signature image),
  `skviz` (skin quiz), `care_plan`(+dent), `recommendation` → HealthAssessment
  using the app's encryption (needs `HEALTH_ENCRYPTION_KEY`).
- **Consultations** ← `wp_db7_forms` (CF7) + Elementor form submissions.
- Passwords are **not** imported — clients set one via "forgot password".
- **Not migrated** (ripped-template content/config + plumbing): `level*`,
  `price*`, `time_consultation`, `test`, `logs`, Action Scheduler, Yoast, etc.

## Files

- `inventory.mjs` / `columns.mjs` / `profile.mjs` — read-only discovery (tables,
  structures, masked data shapes). All PII-free; safe to paste back.
- `migrate.mjs` — clients. `migrate-history.mjs` — bookings/reviews/loyalty.
  `migrate-clinical.mjs` — encrypted clinical + consultations.
- `lib-dump.mjs` (SQL parser), `lib-crypto.mjs` (app-compatible encryption),
  `lib-php.mjs` (PHP unserialize) — shared helpers, no external dependencies.
