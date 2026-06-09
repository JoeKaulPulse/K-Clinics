# Data Layer & Prisma Audit

Scope: `prisma/schema.prisma` (104 models, 2721 lines), `lib/db.ts`, `prisma/seed.mjs`,
`prisma/migrations/`, `scripts/db-sync.mjs`, `scripts/safe-migrate.mjs`,
`scripts/run-seeds.mjs`, `lib/data-export.ts`, and all `lib/`/`app/` code that issues
Prisma queries (raw SQL, `findMany`, `$transaction`, caching, `onDelete`).

Audit date: 2026-06-09. Source/schema not modified.

## Summary

The data layer is, on the whole, carefully built: there is **no raw SQL anywhere**
(`$queryRaw`/`$executeRaw`/`*Unsafe` produce zero hits outside a comment), so the SQL
injection surface is nil. Special-category clinical data (health assessments, clinical
notes, signed consents, before-photos, AI findings, OAuth tokens, TOTP secrets) is
app-encrypted at rest (AES-256-GCM) and the schema documents this consistently. The
money/points/stock *redemption* paths use `Serializable` `$transaction`s with in-tx
re-checks (`lib/promo.ts`, `lib/gamification.ts`, `lib/client-loyalty.ts`) — these are
correctly race-safe.

The material risks are concentrated elsewhere:

1. **Booking creation has no concurrency control.** `isSlotFree()` is a plain read,
   then `booking.create()` runs separately with no transaction, no row lock, and no
   DB-level uniqueness on (slot/clinician/resource). Two concurrent requests for the
   same slot both pass the check and both succeed → **double-booking / over-allocated
   rooms & equipment**. This is the single most important invariant in a booking system
   and it is unguarded (`app/api/booking/create/route.ts:65,106`, `lib/availability.ts`).
2. **Inventory `move` is a TOCTOU race.** The "don't go negative" check is a read
   *outside* the (non-interactive, array) transaction; the decrement is a blind
   `increment` inside it. Concurrent removals can drive stock negative
   (`app/api/admin/inventory/route.ts:83-99`).
3. **Schema is `prisma db push`-managed with no baseline migration** (the
   `prisma/migrations/` dir holds only a README). Combined with `db-sync.mjs` running in
   **`prebuild`** on every deploy, schema state is driven from `schema.prisma` with no
   version history and no review gate — a renamed/removed column is one edit away from a
   build that the (correctly `--accept-data-loss`-free) push will *fail*, blocking
   deploys, while a subtly wrong model change ships silently.
4. **Several unbounded `findMany`s on growth tables** (clients, bookings, gift vouchers,
   replay chunks, health assessments) — memory/latency/DoS risk as data grows, some with
   per-row N+1 follow-ups in a loop.
5. **PII stored plaintext** that the schema's own comments imply should be protected:
   `Client.dob`/`phone`/`allergies`, `Consultation.medicalNotes`, and
   `AdminUser.googleRefreshToken` (an OAuth refresh token in clear, beside an explicitly
   *encrypted* `totpSecret`).

Accelerate (`@prisma/extension-accelerate`) is wired in `lib/db.ts` but **no query uses
`cacheStrategy`** — so there is no stale-cache risk today, but also none of the pooling
benefit's caching layer (informational).

## Severity counts

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High     | 4 |
| Medium   | 7 |
| Low      | 5 |
| Info     | 3 |
| **Total**| **20** |

## Findings

### [CRITICAL] Booking slot allocation has no transaction, lock, or unique constraint — double-booking race
**Location:** `app/api/booking/create/route.ts:65` (check) and `:106` (write);
`lib/availability.ts:331-369` (`isSlotFree`), `:258-261`, `:365-368`; schema
`prisma/schema.prisma:476-586` (`Booking`).

**Issue:** Slot availability is validated by a read (`isSlotFree`), then the booking is
created in a *separate* statement. There is no `$transaction`, no `SELECT … FOR UPDATE`
/ advisory lock, and no database constraint that would reject a second booking for the
same time + practitioner + room/equipment. `isSlotFree` itself just `findMany`s
overlapping `PENDING`/`CONFIRMED` bookings and checks in JS:
```ts
// app/api/booking/create/route.ts
if (!(await withDbRetry(() => isSlotFree(d.startISO, durationMin, d.slug)))) { … 409 … }
…
const booking = await db.booking.create({ data: { …, startAt: start, endAt: end, … } });
```
Two requests interleave between line 65 and line 106 and both win. The same gap applies
to `pickPractitioner` and `assignResources` (also reads), so the auto-assigned clinician
and the held room/equipment can be handed to two bookings at once. `Resource` capacity is
likewise enforced only in JS (`poolFree`), never by the DB.

**Impact:** Double-booked clients, a clinician or laser assigned to two simultaneous
appointments, over-capacity rooms. In a clinic this is a safety/operational failure, not
just a UX glitch — and it is exploitable by simply firing concurrent requests (public,
rate-limited only to 12/600s per IP).

**Recommendation:** Wrap the *recheck + create* in a single `$transaction` at
`Serializable` isolation, re-running the overlap check against the same window inside the
transaction (so a serialization conflict aborts the loser), mirroring the pattern already
used in `redeemPromo`/`redeemReward`. For defence-in-depth add a DB guard against
overlapping holds per resource/practitioner (e.g. a Postgres exclusion constraint on a
`tstzrange`, or at minimum a unique key on a quantised `(practitionerId, startAt)` /
`(resourceId, startAt)` slot) so the database is the final arbiter.

---

### [HIGH] Inventory stock movement is a TOCTOU race (negative-stock guard outside the transaction)
**Location:** `app/api/admin/inventory/route.ts:83-99`.

**Issue:** The "don't drive stock negative" check reads `currentQty` *before* and
*outside* the transaction; the transaction then blindly `increment`s by the signed delta:
```ts
if (signed < 0) {
  const current = await db.stockItem.findUnique({ where: { id: itemId }, select: { currentQty: true } });
  if (current.currentQty + signed < 0) return … 'Not enough stock' …;   // read-only, racy
}
const [, item] = await db.$transaction([
  db.stockMovement.create({ … delta: signed … }),
  db.stockItem.update({ where: { id: itemId }, data: { currentQty: { increment: signed } } }),
]);
```
A non-interactive array `$transaction` gives atomicity but **not** isolation against a
concurrent read-then-write, and the check isn't even in it. Two simultaneous `USED`
movements both read `qty=1`, both pass, both decrement → `qty=-1`. The code comment
("adjust the running quantity atomically") overstates the guarantee.

**Impact:** Corrupted inventory valuation, wrong reorder suggestions, negative on-hand
quantities — and `currentQty` is a denormalised `Float` (`schema:1143`) with no
ledger-vs-cache reconciliation, so drift persists silently.

**Recommendation:** Move the balance check inside an interactive `Serializable`
`$transaction(async (tx) => …)`, re-reading `currentQty` within it and throwing if the
result would go negative; or add a DB `CHECK (currentQty >= 0)` so the write fails atomically.

---

### [HIGH] Schema managed by `prisma db push` with no baseline migration, run during `prebuild`
**Location:** `package.json:12` (`prebuild` → `scripts/db-sync.mjs`); `scripts/db-sync.mjs:81-155`;
`prisma/migrations/` (contains only `README.md`, no `*.sql`); `schema.prisma:2`
(comment: "`prisma db push` to sync").

**Issue:** No versioned migrations exist. `USE_MIGRATIONS` is unset by default, so every
deploy runs `prisma migrate diff` then `prisma db push --skip-generate` against the live
DB during the build. There is no migration history, no review of the generated DDL, and
no backfill step. The script *does* correctly omit `--accept-data-loss` (a destructive
change fails the build rather than dropping data — good), but that means a column rename
manifests as **drop+add** and either (a) fails every deploy until someone intervenes, or
(b) for additive/ambiguous changes, applies an unreviewed schema delta straight to prod.
`db-sync.mjs` runs with a **direct** `postgres://` connection that also competes with the
`prisma_migration` role's small connection cap (the file's own comments describe deploys
crashing on connection pressure).

**Impact:** Production schema changes with no audit trail or rollback artefact; deploys
can wedge on any destructive diff; risk of silently shipping code ahead of (or behind)
the database. This is the classic `db push`-in-CI footgun on a clinical/financial DB.

**Recommendation:** Do the documented switch now (the OWNER ACTION in `db-sync.mjs:23-29`):
create the baseline with `prisma migrate dev --name init` against a copy of prod, commit
`prisma/migrations/`, and set `USE_MIGRATIONS=true` so deploys run `migrate deploy` (only
pending, reviewed, non-destructive migrations). Schema changes should not be applied as a
side effect of `prebuild`.

---

### [HIGH] OAuth refresh token stored plaintext on `AdminUser`
**Location:** `prisma/schema.prisma:857` (`googleRefreshToken String?`), beside `:862`
(`totpSecret String? // encrypted base32 secret`); used at `lib/google-calendar.ts:124`.

**Issue:** `AdminUser.totpSecret` is documented as encrypted via the crypto keyring, and
`ExternalConnection.tokensEnc` (Xero/TrueLayer) and `AdminUser.recoveryCodes` (bcrypt) are
all protected — but `googleRefreshToken` is a long-lived Google OAuth refresh token stored
in clear in the same table. Anyone with DB read access (or a leaked backup / the full
export in `lib/data-export.ts`, which dumps every column verbatim) gets standing access to
staff Google Calendars.

**Impact:** A single DB/backup compromise yields persistent, offline-usable Google account
access for every connected staff member — exfiltratable independent of the app.

**Recommendation:** Encrypt `googleRefreshToken` with the same keyring used for
`totpSecret`/`tokensEnc` (e.g. `googleRefreshTokenEnc`), and exclude raw tokens from the
full export, or re-encrypt under the destination keyring on restore.

---

### [HIGH] PII / medical fields stored plaintext (DOB, phone, allergies, medical notes)
**Location:** `Client.dob` `:267`, `Client.phone` `:266`, `Client.allergies` `:274`,
`Client.gender`/`genderSelfDescribe` `:269-270`; `Consultation.medicalNotes` `:425`,
`concerns` `:421`; `Booking.allergyNote` `:498`; `DiscountClaim.nameDobKey` `:1274`,
`phoneNorm` `:1273` (raw-derived identity fingerprints).

**Issue:** The schema deliberately encrypts the *detailed* clinical record
(`HealthAssessment.cipher`, `Booking.clinicalNoteEnc`, `SignedConsent.cipher`,
`BeforePhoto.dataEnc`, `AiAnalysis.findingsEnc`) and even calls out in `Client.medicalFlag`
that "Detailed health data stays in the encrypted HealthAssessment records." Yet a
meaningful amount of special-category and contact PII lives in clear on `Client`,
`Consultation`, and `Booking`: date of birth, phone, free-text allergies/dietary notes,
gender identity, and free-text `medicalNotes`/`concerns` on consultations. `DiscountClaim`
additionally persists normalised phone and a name+DOB key in clear for de-duplication.

**Impact:** Under UK GDPR, allergies/medical notes/gender are special-category; DOB+phone
are directly identifying. A DB leak or the unencrypted full export exposes them. The
encryption boundary is inconsistent — the most sensitive fields are protected but adjacent
sensitive fields are not.

**Recommendation:** Decide a clear PII boundary. At minimum encrypt free-text
`Consultation.medicalNotes`/`Booking.allergyNote`/`Client.allergies` (special-category),
and treat `dob`/`phone` per your DPIA (consider application-level encryption or hashing of
the DOB component in `nameDobKey`). Ensure `lib/data-export.ts` handling matches.

---

### [MEDIUM] Unbounded `findMany` loads entire `Client` table (with per-row N+1) in automations
**Location:** `lib/automations.ts:189` (`birthdays`) — `db.client.findMany({ where: { dob: { not: null } } })`
then a per-client `db.emailEvent.findFirst` at `:181-184`/`:193`; similarly
`lib/client-loyalty.ts:323` (`awardBirthdayPoints`, all dob+portalActive clients, per-row
`findFirst` at `:328`).

**Issue:** Both birthday jobs pull every client with a DOB into memory and then issue one
or more queries *inside the loop* (idempotency check, send, log). No `take`, no date
prefilter on the birthday (it's filtered in JS by month/day), no batching.

**Impact:** As the client base grows this becomes O(N) round-trips per daily run and an
ever-larger heap load on a serverless function with a tiny connection pool — slow, and a
candidate for timeouts/connection exhaustion. Classic N+1.

**Recommendation:** Filter birthdays in SQL (store/compute a `(month,day)` or use a raw
date predicate) so only today's birthdays are fetched, batch the idempotency lookup
(`emailEvent.findMany` with `clientId in […]`), and cap with `take` + cursor paging.

---

### [MEDIUM] Unbounded `findMany` on growth tables (no `take`/pagination)
**Location (representative):** `lib/portal-data.ts:11` (`booking.findMany({ where: { clientId } })`);
`lib/gift-vouchers.ts:141` (all due vouchers); `app/api/admin/clients/[id]/export/route.ts:33`
(`healthAssessment.findMany` for a client, all versions); `app/api/admin/marketing/replay/route.ts:17`
(`replayChunk.findMany` — unbounded rrweb event chunks); `app/admin/staff/page.tsx:18`
(all `adminUser`); `lib/shop.ts:10` (all ACTIVE products); `app/admin/cashflow/page.tsx:24`
and `lib/cashflow.ts:138-139`; `app/admin/marketing/campaigns/page.tsx:18`;
`app/admin/redirects/page.tsx:17`; `app/admin/marketing/audiences/page.tsx:19`. (Many other
admin reads cap with `take` — these are the ones that do not.)

**Issue:** These selects have no `take`/cursor. Most are bounded *in practice today* (one
client's bookings, one tenant's staff), but `ReplayChunk`, `HealthAssessment` per client,
`GiftVoucher`, `EmailEvent` and `Booking`-per-client are unbounded-by-design growth tables.
`replayChunk.findMany` in particular concatenates every rrweb chunk for a session into one
response.

**Impact:** Memory spikes and slow pages/endpoints as history accumulates; a heavy session
replay or a long-tenured client's booking history can blow the function's memory/time
budget. Lesser scraping/DoS exposure on any of these reachable by a client token.

**Recommendation:** Add `take` (+ `orderBy` + cursor) to history reads, especially
`portal-data.ts:11`, `replay/route.ts:17`, the client export, and `gift-vouchers.ts:141`.
Stream or page the replay-chunk read.

---

### [MEDIUM] Welcome-discount "burn" is not atomic with booking creation (double-spend window)
**Location:** `app/api/booking/create/route.ts:99-101` (read ACTIVE claim), `:106` (create
booking), `:145-150` (mark claim `REDEEMED`); schema `DiscountClaim` `:1262-1287`
(`status` has no per-client partial-unique guard).

**Issue:** Unlike `redeemPromo` (which is `Serializable`), the one-time welcome discount is
read, applied to the price, and only *later* marked `REDEEMED` — all outside any
transaction. Two concurrent bookings for the same client both see `status:'ACTIVE'`, both
take the discount, and the second `update` just re-sets `REDEEMED`. The schema only has
`@@index([status])`, nothing enforcing "≤1 ACTIVE/REDEEMED claim per client".

**Impact:** A client can apply their one-time discount to two simultaneous bookings.
Low-frequency but a real revenue-leak / abuse path, and not caught by the DB.

**Recommendation:** Burn the claim inside the same `Serializable` transaction that creates
the booking (re-checking `status='ACTIVE'`), and/or add a unique constraint that prevents a
second active claim per client.

---

### [MEDIUM] `Booking` retains client PII via `onDelete: Cascade`, but loyalty/audit semantics rely on client deletion edge cases
**Location:** `Booking.client` `:478` (`onDelete: Cascade`); `HealthAssessment` `:1233`,
`SignedConsent` (no FK — `clientId String` only, `:2301`), `BeforePhoto` (`clientId String`,
no FK, `:2327`), `AuditEvent.clientId` (`:1213`, no FK).

**Issue:** Deleting a `Client` cascades to `Booking`, `HealthAssessment`, `Consultation`,
`ClientPoints`, `AiAnalysis`, etc. (good for erasure), **but** several clinical/audit
records reference the client by a bare `clientId String` with *no* relation/FK:
`SignedConsent.clientId`, `BeforePhoto.clientId`, `AuditEvent.clientId`,
`ConsentRequest.clientId`, `NpsResponse.bookingId`, `StockMovement.bookingId`. After a
client (and their bookings) is deleted, these rows become **orphans** pointing at
non-existent ids — they are neither cleaned up nor protected, and there's no referential
integrity to detect it.

**Impact:** Immutable signed consents and before-photos (encrypted PII) survive a "delete
client" with dangling references — both a GDPR-erasure completeness gap *and* orphaned
special-category data. Conversely, the cascade on `Booking` means deleting a client wipes
financial/audit history that a clinic may be legally required to retain.

**Recommendation:** Make the FK story explicit: add real relations (with
`onDelete: SetNull` or `Restrict`) for `SignedConsent`/`BeforePhoto`/`ConsentRequest`/
`AuditEvent` client links, and reconcile the erasure flow so cascaded/orphaned records are
deliberately handled (anonymise vs delete vs retain) rather than left dangling.

---

### [MEDIUM] `Booking.refundedPence`/`chargedPence` and refunds have no transactional invariant
**Location:** `Booking` charge/refund fields `:546-552`; charging code paths writing these
fields (e.g. webhook/charge handlers) update them with bare `update`s rather than a
guarded transaction; `refundBookingPoints` `lib/client-loyalty.ts:310-315` does two writes
(award + booking update) **without** a transaction.

**Issue:** Money fields on `Booking` (`chargedPence`, `refundedPence`) are mutated by
independent statements. `refundBookingPoints` awards points and then clears
`pointsRedeemed` in two separate calls — if the process dies between them, points are
refunded *and* the booking still shows them as spent (or vice-versa). No idempotency key
guards re-entry beyond the `pointsRedeemed > 0` guard.

**Impact:** Partial failures can double-refund loyalty points or leave money/points fields
inconsistent. Low frequency but financial.

**Recommendation:** Wrap multi-write money/points mutations (refunds, charge bookkeeping)
in `$transaction`, and key them by the Stripe event/intent id for idempotency.

---

### [MEDIUM] Missing `@@index` on frequently-filtered foreign keys / status columns
**Location:** see Schema hotspots table. Examples: `SignedConsent.bookingId`/`clientId`
have indexes but `BeforePhoto.clientId` (`:2327`) is not indexed (only `bookingId`);
`ConsentRequest.clientId` indexed only as composite; `PromoRedemption.bookingId` (`:1905`)
unindexed though queried; `StockMovement.bookingId` (`:1166`) unindexed though
`app/admin/reports/page.tsx:70`/`bookings/[id]` filter `where: { bookingId }`;
`Order.clientId` (`:2385`) and `GiftVoucher` lookups by `purchaserEmail`/`code` (code is
unique, email is not) unindexed; `EmailEvent.to` (`:744`) queried in
`email-campaigns.ts:154` with no index.

**Issue:** Several columns used in `where`/joins lack indexes. Some are negligible today
but grow linearly (`StockMovement.bookingId`, `EmailEvent.to`, `BeforePhoto.clientId`).

**Impact:** Sequential scans that worsen with table growth; slow admin pages/reports and
campaign de-dup once `EmailEvent`/`StockMovement` get large.

**Recommendation:** Add `@@index` for the FKs/filter columns listed in the hotspots table.

---

### [MEDIUM] No uniqueness guard on `StaffSchedule` (one block per weekday is only enforced in app code)
**Location:** `StaffSchedule` `:1012-1028` (`@@index([staffId, dayOfWeek])` but no
`@@unique`); writer `app/api/admin/schedule/route.ts:32-39` (delete-all-then-`createMany`).

**Issue:** The model comment guarantees "one block per weekday → one location per day," but
this is enforced only by the save flow (delete then recreate inside a `$transaction` — good
for that path). Any other writer, a partial failure, or a future code path can create two
rows for the same `(staffId, dayOfWeek)`, silently breaking the "can't be in two places at
once" invariant the availability engine relies on.

**Impact:** Duplicate weekly blocks → a clinician offered at two locations on one day;
availability/location logic produces wrong results with no DB backstop.

**Recommendation:** Add `@@unique([staffId, dayOfWeek])` so the invariant is enforced by
the database, not just the one happy-path writer.

---

### [LOW] Full database export streams every model/column unauthenticated of field sensitivity
**Location:** `lib/data-export.ts:41-106`; consumed by an admin export route.

**Issue:** `fullExportStream` walks the DMMF and dumps **every** model and **every** column
(ciphertext for encrypted fields, but plaintext for everything else incl. DOB/phone/
allergies/`googleRefreshToken`). It paginates by primary key (good — bounded memory), but
there is no field-level redaction and the output is a single restorable PII archive.

**Impact:** One export = the entire client/clinical/financial DB in clear (minus the
app-encrypted blobs). The blast radius of a single over-broad admin action or a leaked
download is the whole dataset. (Auth/step-up is handled at the route — out of this scope —
but the *library* makes no distinction.)

**Recommendation:** Keep the strong step-up gate on the route; consider excluding raw
secrets (`googleRefreshToken`, reset tokens) from the dump or encrypting the archive at
rest, and log/audit every export (the `actor` param is captured — ensure it's persisted).

---

### [LOW] `withDbRetry` could be applied to a non-idempotent path
**Location:** `lib/db.ts:87-103`; usage e.g. `app/api/booking/create/route.ts:41,65,72,73`.

**Issue:** `withDbRetry` is documented "do NOT wrap writes." It's used correctly here
(wrapping reads), but it's a foot-gun: it silently retries any thrown function up to 3×.
A future caller wrapping a create/update would double-apply on a transient error.

**Impact:** None today; latent risk of duplicate writes if misused.

**Recommendation:** Keep the doc comment; optionally make the read-only intent enforceable
(naming, or a lint note) so it can't drift onto a write path.

---

### [LOW] `currentQty` / `redeemedCount` / `scanCount` denormalised counters can drift
**Location:** `StockItem.currentQty` `:1143`; `PromoCode.redeemedCount` `:1880`;
`QrCode.scanCount` `:2118`; `Client.membership12moPence` `:286`.

**Issue:** Each is a cached aggregate maintained by `increment`/`decrement` alongside an
append-only ledger (`StockMovement`, `PromoRedemption`, `QrScan`) or recomputed spend.
`scanCount` is incremented in a best-effort `after()` block (`app/qr/[code]/route.ts:29-33`,
explicitly swallow-on-error) so it *will* under-count. `currentQty` has the race in the
High finding above. None have a reconciliation job.

**Impact:** Counters slowly diverge from their ledgers; mostly cosmetic, but `currentQty`
drift affects reorder decisions and valuation.

**Recommendation:** Add a periodic reconcile (sum the ledger → reset the cache), at least
for `currentQty`. Accept `scanCount` as approximate by design (document it).

---

### [LOW] `Setting` values (incl. operational toggles) are unstructured strings with no validation at the DB
**Location:** `Setting` `:1188-1193` (`value String // JSON or scalar string`); read widely
via `lib/settings.ts:184` (`setting.findMany`).

**Issue:** All feature flags / config (`enforce_staff_availability`, `auto_assign_practitioner`,
`room_equipment_binding`, day-close template, reminder schedule) live as opaque strings in a
single KV table with no schema. A malformed value can change booking/availability behaviour
clinic-wide. (Parsing/validation is in app code — out of scope — but there's no DB-side
typing.)

**Impact:** A bad write to one `Setting` row silently alters core scheduling logic; no
constraint catches it.

**Recommendation:** Validate on write (zod) and consider a `type`/schema marker column; not
a DB-fixable issue alone but worth noting as a single point of operational risk.

---

### [INFO] Accelerate extension is enabled but no `cacheStrategy` is used anywhere
**Location:** `lib/db.ts:71` (`.$extends(withAccelerate())`); grep for `cacheStrategy` →
**0 hits** across the repo.

**Issue/Impact:** Positive finding: there is **no** risk of stale auth/balance/availability
being served from an Accelerate cache, because caching is never requested — only the
connection pooler is used. Documented so a future `cacheStrategy` addition is reviewed
against the sensitive reads (auth, points balance, slot availability, charges).

**Recommendation:** If `cacheStrategy` is introduced later, never apply it to auth, loyalty
balance, inventory, or availability reads.

---

### [INFO] No raw SQL anywhere — injection surface is nil
**Location:** repo-wide grep for `$queryRaw` / `$executeRaw` / `$queryRawUnsafe` /
`$executeRawUnsafe` → only one hit, a comment in `lib/db.ts:79`.

**Issue/Impact:** Positive finding. All data access goes through the typed Prisma query
builder; there is no string-interpolated SQL and therefore no SQL-injection vector in the
data layer. The `app/api/admin/search/route.ts` free-text search uses Prisma `contains`
filters (parameterised), not raw SQL.

**Recommendation:** Keep it this way; if raw SQL is ever needed, use `Prisma.sql`
tagged templates / `$queryRaw` (never `*Unsafe` with interpolation).

---

### [INFO] `run-seeds`/`seed.mjs` are deploy-safe; reference seeds are gated off by default
**Location:** `scripts/run-seeds.mjs:10-13` (skips unless `SEED_ON_BUILD=true`);
`prisma/seed.mjs:17-21` (admin `upsert`, env-gated); `package.json:12` (`prebuild`).

**Issue/Impact:** Positive finding. The per-deploy seed run is disabled by default
(reference data not re-applied on every build), the admin seed is an idempotent `upsert`
gated on `SEED_ADMIN_*`, and the reference seeds (rooms/services/catalogue/academy/lms) are
described as idempotent top-ups. So seeds do **not** overwrite prod data on a normal deploy.
The residual risk is only if `SEED_ON_BUILD=true` is left set on prod — worth a guardrail.

**Recommendation:** Ensure `SEED_ON_BUILD` is never persistently `true` in the prod
environment; treat it as a one-shot.

## Schema hotspots

| Model | Field(s) | Issue | Suggested fix |
|-------|----------|-------|---------------|
| `Booking` | `(startAt, practitionerId)` / `(resourceId, startAt)` | no DB guard against overlapping holds → double-booking | exclusion constraint on time range, or quantised unique slot key + Serializable tx |
| `StockItem` | `currentQty` | racy negative-stock check; no `CHECK >= 0` | in-tx recheck + `CHECK (currentQty >= 0)` |
| `DiscountClaim` | `clientId` + `status` | one-time welcome claim not enforced unique per client | partial unique on active claim per client; burn in-tx |
| `StaffSchedule` | `(staffId, dayOfWeek)` | "one block per weekday" only in app code | `@@unique([staffId, dayOfWeek])` |
| `AdminUser` | `googleRefreshToken` | OAuth refresh token plaintext | encrypt via keyring (`…Enc`) |
| `Consultation` | `medicalNotes`, `concerns` | special-category PII plaintext | app-level encryption |
| `Client` | `allergies`, `dob`, `phone` | sensitive PII plaintext | encrypt allergies; DPIA dob/phone |
| `BeforePhoto` | `clientId` | no index; no FK relation (orphans on client delete) | `@@index([clientId])` + real FK |
| `SignedConsent` | `clientId`, `bookingId` | no FK relation → orphaned encrypted PII on delete | add relations (`SetNull`/`Restrict`) |
| `AuditEvent` | `clientId` | bare string, no FK; orphans after erasure | add relation or accept by design + document |
| `StockMovement` | `bookingId` | filtered in reports, unindexed | `@@index([bookingId])` |
| `EmailEvent` | `to` | queried for campaign de-dup, unindexed | `@@index([to])` (or `[campaignId, to]`) |
| `PromoRedemption` | `bookingId` | queried, unindexed | `@@index([bookingId])` |
| `Order` | `clientId` | unindexed FK | `@@index([clientId])` |
| `ReplayChunk` | (read) | unbounded `findMany` of all chunks per session | paginate/stream |

## Files reviewed

- `prisma/schema.prisma` (read in full, 2721 lines / 104 models)
- `lib/db.ts`
- `lib/data-export.ts`
- `prisma/seed.mjs`
- `prisma/migrations/` (only `README.md` present — no migrations)
- `scripts/db-sync.mjs`, `scripts/safe-migrate.mjs`, `scripts/run-seeds.mjs`
- `package.json` (build/prebuild/seed scripts)
- `lib/promo.ts`, `lib/gamification.ts`, `lib/client-loyalty.ts` (transaction usage)
- `lib/availability.ts` (slot/clinician/resource allocation)
- `lib/automations.ts`, `lib/portal-data.ts` (unbounded queries / N+1)
- `app/api/booking/create/route.ts` (booking creation path)
- `app/api/admin/inventory/route.ts` (stock movement)
- `app/api/admin/schedule/route.ts`, `app/api/admin/locations/route.ts`, `app/api/chat/route.ts`, `app/qr/[code]/route.ts` (other `$transaction` sites)
- `app/api/cron/kiosk-cleanup/route.ts`, `app/api/admin/clients/[id]/export/route.ts`, `app/api/admin/marketing/replay/route.ts`
- Repo-wide greps: `$queryRaw`/`$executeRaw`/`*Unsafe` (0 functional hits), `cacheStrategy` (0 hits), `$transaction` (13 sites), `findMany` (257 sites across 111 files)
