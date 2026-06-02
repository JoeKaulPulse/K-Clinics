# WordPress → K Clinics migration

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

Only **Node** is needed for steps 1–2 (already installed if you can run the site).
Step 3 needs the new database URL.

## What gets imported (step 2/3)

- **Clients** ← WordPress users **+** WooCommerce customers (incl. guest orders),
  de-duplicated by email. Keeps original signup dates, names, phone, DOB (if the
  site stored it), marketing opt-in (only when explicitly recorded), and preserves
  any address / extra fields in the client's notes so nothing is lost.
- Passwords are **not** imported — clients set one via "forgot password" on first
  visit (no mass email, no data loss).

## What's deliberately next (after the inventory)

Health/consent forms → encrypted records, and order/booking history, depend on
*which* plugins your site uses. The inventory (step 1) tells us exactly that —
including flagging any non-empty table we don't recognise — and then I build the
mapping for those before we import them.

## Files

- `inventory.mjs` — step 1: lists tables, counts, categories, flags unknowns.
- `migrate.mjs` — step 2/3: builds & imports clients; `--dry-run` / `--commit`.
- `lib-dump.mjs` — shared streaming `.sql` parser (no dependencies).
