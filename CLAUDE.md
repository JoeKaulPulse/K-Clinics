# K-Clinics — Claude Code guide

Next.js 16 + Prisma 7 (Postgres) clinic platform (booking, CRM, admin, academy),
deployed on Vercel at https://kclinics.co.uk. The admin lives under `/admin`;
public site under `/`. `.claude/hooks/session-start.sh` provisions web sessions
(npm deps + Playwright Chromium) and prints an environment-readiness report.

## Commands

- `npx tsc --noEmit` — the typecheck gate. Run before every commit.
- `npm run build` — full production build (prebuild skips DB sync when no DB URL is set).
- `npm run lint` — ESLint (next lint).
- `node scripts/visual-qa.mjs` — visual assessment harness (see below).
- `node scripts/healthcheck.mjs` — green/red checklist of the live deployment.

## Environment variables (use these in ALL routine tasks)

Set in the Claude environment (Settings → Environment variables). Every script,
audit and routine session must read these rather than hard-coding targets:

| Variable | Purpose |
| --- | --- |
| `BASE_URL` | Canonical target for visual QA, audits, healthchecks (`https://kclinics.co.uk`). `scripts/visual-qa.mjs` and `scripts/healthcheck.mjs` both honour it. |
| `QA_TOKEN` | Same value as `BOARD_QUEUE_TOKEN`; lets visual-qa delete the kiosk test sessions it creates (no residue on production). |
| `BOARD_QUEUE_TOKEN` | Bearer token for the live work queue: `GET/POST $BASE_URL/api/build/queue` (read prioritised actionable items; log audit findings with `{action:'create', items:[…]}`). |
| `QA_IGNORE_HTTPS_ERRORS` | Optional override. visual-qa auto-detects the sandbox's TLS-intercepting gateway (via `NODE_EXTRA_CA_CERTS`) and tolerates the re-signed cert only there; set `1`/`0` to force either way. On full network, leave unset so genuine certificate problems are still caught. |
| `DATABASE_URL` | Optional. Only set a read-only role or a Neon branch — never the production read-write URL — for data audits. |

## Visual assessment (visual QA)

```
node scripts/visual-qa.mjs
```

Drives headless Chromium through key journeys against `BASE_URL`, screenshots
every step, captures console errors + failed requests, and writes
`qa-output/report.md` + `report.json` + PNGs. It tags and cleans up the kiosk
sessions it creates (needs `QA_TOKEN`). Optional: `QA_SELFIE=/path/to/photo.jpg`
exercises the kiosk AI happy path. Playwright Chromium is installed by the
session-start hook.

## Task reference IDs (tracing & search)

Every item on both boards carries a stable, human-readable reference
(`lib/task-refs.ts`); grouped work shares a common root and branches with dots:

- `TSK-12` internal Tasks board (`/admin/tasks`); sub-tasks `TSK-12.1`, `TSK-12.1.2`
- `BLD-7` Build & Issues item (`/admin/build`); its subtasks `BLD-7.1`
- `PRJ-3` build project; items created in it `PRJ-3.1`; their subtasks `PRJ-3.1.2`

Rules:
- Refs are immutable once assigned; numbering gaps are normal.
- **Cite the ref in commit messages, PR titles/bodies, audit findings and
  reports** (e.g. `fix(booking): … (BLD-41)`) so work is traceable end-to-end.
- Refs are searchable in the admin global search and the board filter; new rows
  get a ref at creation, and pre-scheme rows are backfilled on board load
  (`ensureTaskRefs` / `ensureBuildRefs`).

## Audits

- `audit/` holds the standing security/quality audit reports (auth, payments,
  PII, XSS, deps…) — extend these rather than starting parallel documents.
- Log new findings to the Build board via the token-authed queue endpoint above
  so they get a `BLD-` ref and enter triage.

## Database schema changes

Deploys run `prisma db push` without `--accept-data-loss` (see
`scripts/db-sync.mjs`): schema changes must be additive/non-destructive. For
anything destructive, add a backfill path first (or move to versioned
migrations with `USE_MIGRATIONS=true`).

The gate also refuses **adding `@unique` to an existing table** (Prisma flags
it as potential data loss — "will fail if duplicates exist"), so it fails every
deploy. Don't declare new unique constraints; enforce uniqueness structurally
instead (sequences, lock-serialised allocation, self-healing dedupe — see
`lib/task-refs.ts` for the pattern).
