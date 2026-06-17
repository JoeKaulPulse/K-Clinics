# ClinicOS Ring 1d — production RLS cutover runbook (BLD-301)

The operational procedure for turning on Academy Row-Level Security in production.
Read `RLS_ROLLOUT.md` first for the why; this is the day-of checklist.

The one rule that governs the whole sequence:

> **RLS on + `ACADEMY_RLS` off = every Academy query returns zero rows** (an Academy
> outage). **`ACADEMY_RLS` on + RLS off = harmless** (the GUC is set, no policy reads
> it). So the flag goes on **first** and bakes; RLS is enabled **after**, as a
> separate, instantly reversible step. Never enable RLS while any running instance
> still has the flag off.

This is why the flag and the table-enable ship in **two** releases, not one. Doing
both at once leaves a window where the old (flag-off) version is still draining
traffic when RLS turns on — those requests see an empty Academy.

## Preconditions (tick every box before the day)

- [ ] `ACADEMY_RLS` GUC plumbing is in prod code (PR #1072, merged) but the flag is
      still unset in the prod environment.
- [ ] Live isolation suite is green against a branch with `0002` applied
      (`scripts/test-tenant-isolation-live.ts`, PR #1073).
- [ ] Latency was measured on that branch with the flag on. Every Academy query is
      now a transaction (`set_config` + the query); confirm p95 is acceptable.
- [ ] The app's prod connection resolves to a role that is **neither the table owner
      nor `BYPASSRLS`** (step 4 of the rollout). Verify against prod:
      ```sql
      SELECT current_user, rolsuper, rolbypassrls
        FROM pg_roles WHERE rolname = current_user;   -- both must be false
      ```
      If this is not done, `FORCE ROW LEVEL SECURITY` is moot and isolation is not
      actually enforced — stop and finish step 4.
- [ ] A separate **owner / `BYPASSRLS`** role exists for applying `0002` and for
      audited break-glass, with a **direct** (non-Accelerate) `postgres://` URL.
- [ ] Backfill verifier is green: `node scripts/verify-tenant-backfill.mjs`
      (no NULL `tenantId` — RLS on a NULL-tenant row would hide it from everyone).
- [ ] A low-traffic window is chosen, the team is told, and a named person is on
      call to run the rollback.

## Step 1 — Ship the flag (release A)

1. Set `ACADEMY_RLS=1` in the prod environment (Vercel → Settings → Environment
   Variables → Production).
2. Redeploy so **every** serving instance has it.
3. State now: each Academy query wraps in `[ set_config('app.tenant_id', …, true),
   query ]`, but RLS is off, so rows still return exactly as before — the only
   change is one transaction per Academy query.
4. **Bake** for at least a full traffic cycle (≥ 24h). Watch Academy error rate,
   p95 latency, and Sentry. This is fully reversible with **no database change**:
   to abort, unset `ACADEMY_RLS` and redeploy.

Do not proceed until step 1 has baked clean.

## Step 2 — Snapshot

1. Take a PITR snapshot / record the restore bookmark. Note the exact UTC time.
2. Write down, in one line, how you would restore to it. If you can't, stop.

## Step 3 — Enable RLS (the toggle)

Apply the policy as the **owner / `BYPASSRLS`** role over a **direct** connection
(not Accelerate — DDL + the pooler don't mix):

```
psql "$DIRECT_OWNER_URL" -f prisma/platform-migrations/ring1/0002_academy_rls.sql
```

`0002` wraps all 22 `ENABLE/FORCE` + `CREATE POLICY` statements in one
`BEGIN…COMMIT`, so it is atomic. Because the flag is already live (step 1), the GUC
is set on every Academy query the instant the policy binds — there is no outage
window.

## Step 4 — Verify within seconds

1. Hit the live Academy through the app (a courses page / an Academy API route) and
   confirm rows still return. Empty results here = the flag is not actually live on
   the serving instances → **roll back immediately** (step 5).
2. Confirm no `new row violates row-level security` / empty-result errors in Sentry.
3. Spot-check a count against the snapshot if convenient (read-only).
4. Watch error rate and latency for 15–30 minutes before calling it done.

## Step 5 — Rollback (instant, no deploy)

If Academy reads break or errors spike, run the rollback as the owner role. Leave
`ACADEMY_RLS=1` on (it is harmless with RLS off):

```sql
BEGIN;
DO $$
DECLARE t text;
DECLARE tables text[] := ARRAY[
  'AcademyStudent','StudentPasskey','Course','CourseModule','Lesson',
  'HomeworkSubmission','Quiz','QuizQuestion','LessonProgress','QuizAttempt',
  'ExamQuestion','PastPaper','PracticeAttempt','PointEvent','StudentBadge',
  'DailyActivity','LiveClass','Cohort','Enrolment','FundingApplication',
  'Vacancy','JobApplication'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
COMMIT;
```

Academy reads recover the moment this commits. Then investigate and retry from
step 3. Only fall back to a PITR restore (step 2 bookmark) if the data itself is
wrong, which this procedure does not touch.

## Step 6 — Make it reproducible (after it is stable)

So a fresh database, a Neon branch, or `db-sync` also gets RLS:

1. Add `0002`'s SQL as a real migration folder, e.g.
   `prisma/migrations/<timestamp>_academy_rls/migration.sql`.
2. On prod, record it as already applied so `migrate deploy` does not re-run it
   (the same baseline pattern `db-sync.mjs` uses for `0_init`):
   ```
   npx prisma migrate resolve --applied <timestamp>_academy_rls
   ```
3. Commit. New environments now get RLS through the normal migration path, and the
   flag is already wired, so they are consistent with prod.

## After cutover

- `ACADEMY_RLS=1` stays set permanently.
- RLS is now the backstop the by-id ops rely on (`findUnique`/`update`/`delete`):
  a known id from another tenant returns nothing instead of the row.
- Onboarding a second tenant (Ring 2) is now safe at the database layer, not just
  the application layer.

## Dress rehearsal — local (2026-06-17, Postgres 16)

The whole sequence was rehearsed against a throwaway Postgres with the real two-role
model, so the procedure (not just the policy) is validated:

- **Roles (step 4)** — `clinic_migrator` (table owner) and `clinic_app` (runtime),
  both `NOSUPERUSER NOBYPASSRLS`, provisioned with the SQL above.
- **Seed** — 300 courses + 1500 enrolments under the default tenant, plus a second
  tenant, to exercise reads with real row counts.
- **Enable (step 3)** — `clinic_migrator` applied `0002` (22 `tenant_isolation`
  policies). The live suite (`scripts/test-tenant-isolation-live.ts`) was then run
  **as `clinic_app`** (the non-owner runtime role): all assertions ✓ — A sees only
  A, B only B, cross-tenant `findUnique` → null, cross-tenant write blocked.
- **Verify (step 5)** — as `clinic_app`: the GUC-set path returned all 300 of the
  tenant's courses (RLS admits), the no-GUC path returned 0 (deny-by-default) —
  confirming the flag is exactly what keeps reads working once RLS binds.
- **Rollback** — the DO-block above, run by `clinic_migrator`, dropped to 0 policies
  and reads recovered immediately (300 rows, plain).
- **Latency** — the `set_config` + query batch added **~0.9 ms per Academy query**
  over loopback (baseline 4.05 ms → 4.92 ms on a 300-row read). Over Accelerate the
  batch is still one round-trip, so the real-world delta is in the same ballpark;
  re-measure on the branch under the flag before prod.

Not yet exercised locally (needs the branch DB + a preview): the real `lib/db.ts`
hook (the rehearsal uses a faithful copy, since `lib/db.ts` imports `server-only`)
and the Accelerate pooled path. That is the preview-app pass in step 3, and the only
part of this runbook still to confirm before the prod cutover.
