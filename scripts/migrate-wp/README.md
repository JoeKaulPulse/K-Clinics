# WordPress → KClinics migration

Move **everything** off the old WordPress/WooCommerce site into the new CRM with
**zero data loss** — every client, their contact details and consent, plus (in a
later step) health/consent forms and history.

> **You run these on your own machine** (your laptop), in a terminal — **not on
> Vercel**. Vercel hosts the live website; this is a one-off local job that reads
> the dump file sitting on your computer and (for the final step) writes to the
> new database. The dump never leaves your machine.

## Easiest: one command

```bash
# 0) one-time: pull, unzip the dump, and put your secrets in
#    scripts/migrate-wp/.env (git-ignored). Easiest way:
git pull
unzip -o scripts/migrate-wp/127_0_0_1.sql.zip -d scripts/migrate-wp/data/
vercel env pull scripts/migrate-wp/.env          # fills DATABASE_URL + keys
#    …or create that .env by hand with DATABASE_URL=… and HEALTH_ENCRYPTION_KEY=…

# 1) PREVIEW — writes nothing, shows the counts for all steps
node scripts/migrate-wp/import-all.mjs

# 2) GO LIVE — writes clients + history + staff + clinical to the database
node scripts/migrate-wp/import-all.mjs --commit

# 3) RE-RUN AFTER A BAD IMPORT — also FIXES rows the earlier import wrote badly:
#    booking times (slot ids had been read as hours), consent signatures (kept
#    as raw hex), care-plan/recommendation/skin-quiz text (spaces stripped),
#    and moves consents into the proper SignedConsent e-signature records.
node scripts/migrate-wp/import-all.mjs --commit --repair
```

`import-all.mjs` auto-finds the dump, loads `.env`, and runs the importers in
the right order (stops if any step fails; skips clinical if no
`HEALTH_ENCRYPTION_KEY`). Re-runnable — it never duplicates. `--repair` only
ever touches migration-owned rows (source-marked); hand-entered records are
never modified. The manual, step-by-step commands below are for when you want
to run one piece at a time.

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
  and marketing/SMS consent (custom columns + MailPoet + the signup checkbox),
  with GDPR consent provenance recorded on opted-in clients.
- **Bookings** ← `grafik`/`grafik_dent` (COMPLETED, or CANCELLED when `del=1`).
  `tim` is a slot id resolved through `time_consultation` (1 = 09:00 … 45 =
  20:00) as Europe/London wall time.
- **Reviews** ← `review_user`. **Loyalty** ← `bonus` → ClientPoints.
- **Consent forms** ← `sign_table` → **SignedConsent** (the e-signature system:
  listed on the client record, printable certificate). Signature images decoded
  from the dump's hex blobs and encrypted with the app's keys.
- **Encrypted clinical** ← `skviz` (skin quiz), `care_plan`(+dent),
  `recommendation` → HealthAssessment using the app's encryption (needs
  `HEALTH_ENCRYPTION_KEY`).
- **Consultations** ← `wp_db7_forms` (CF7) + Elementor form submissions.
- **Nothing is dropped**: records that can't reach a person (guest/kiosk
  consent signings, users deleted from WordPress before the export) attach to a
  quarantine client — “Legacy WordPress — Unmatched records”
  (`unmatched.wordpress@imported.kclinics.local`, tagged `legacy-quarantine`) —
  for manual reattachment.
- Passwords are **not** imported — clients set one via "forgot password".
- **Not migrated** (ripped-template content/config + plumbing): `level*`,
  `price*`, `test`, `logs`, `photos` (filenames only — the image files live on
  the old server, not in the dump), Action Scheduler, Yoast, etc.

## Files

- `inventory.mjs` / `columns.mjs` / `profile.mjs` — read-only discovery (tables,
  structures, masked data shapes). All PII-free; safe to paste back.
- `migrate.mjs` — clients. `migrate-history.mjs` — bookings/reviews/loyalty.
  `migrate-clinical.mjs` — encrypted clinical + consultations.
- `lib-dump.mjs` (SQL parser), `lib-crypto.mjs` (app-compatible encryption),
  `lib-php.mjs` (PHP unserialize) — shared helpers, no external dependencies.
