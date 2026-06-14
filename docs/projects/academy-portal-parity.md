# Project: Academy portal security & data-lifecycle parity

> Status: **Planning** · Board epic: `BLD-314` · Source: 2026-06-14 audit
> (security + GDPR streams).

The academy (trainee) portal was built quickly and never inherited the machinery
the **client** portal already has for session revocation, password recovery and
data-subject erasure. This project brings it to parity. Each item is additive and
respects the deploy gate (no destructive `prisma db push`, no new `@unique`).

## Why

- `AcademyStudent` has **no `sessionEpoch`** (`prisma/schema.prisma:1759`).
  `getAcademySession` (`lib/auth.ts:159`) returns the raw 7-day JWT with no DB
  lookup, no `portalActive` re-check, no epoch check. A suspended trainee — or a
  compromised credential — stays valid for up to 7 days, and there is no
  "sign out everywhere".
- There is **no password-reset flow**: `AcademyStudent.resetTokenHash` /
  `resetTokenExp` columns exist but no `forgot`/`reset` route and no
  `performPasswordReset` in `lib/academy-auth.ts`.
- `/academy` is **not gated in middleware** (`middleware.ts` covers `/account`
  and `/admin` only), so a new academy page added without an explicit
  `getCurrentStudent` guard is unprotected by default.
- There is **no `eraseStudentData`** — an academy student cannot exercise UK
  GDPR Art. 17 erasure at all (name, email, DOB, phone, goals, passkeys), and
  no retention sweep for stale `AcademyStudent` / rejected `JobApplication` rows.

## Principles

- **Reuse, don't fork.** Mirror the client-portal patterns exactly
  (`lib/client-auth.ts`, `lib/auth.ts:125-140`) rather than inventing a second
  scheme.
- **Additive & gate-safe.** New nullable/default columns only; enforce
  revocation by epoch comparison, not a new constraint.
- **Secure by default.** Centralise the guard in middleware so future pages are
  protected without per-page effort.

## Phased build

### Phase 1 — Session revocation (the security core) · effort 3
1. Schema: `AcademyStudent.sessionEpoch Int @default(0)` (additive).
2. `createAcademySession` embeds the current `sessionEpoch` in the JWT;
   `getAcademySession` re-reads the student, checks `portalActive` and that the
   token epoch matches, mirroring `getClientSession` (`lib/auth.ts:125-140`).
3. "Sign out everywhere" and admin de-activation bump `sessionEpoch`.
4. Audit: `ACADEMY_SESSION_REVOKED`.

### Phase 2 — Password reset · effort 3
1. `POST /api/academy/forgot-password` — rate-limited; always returns ok
   (no account enumeration); on a match, store a single-use SHA-256 token +
   1h expiry (reuse the client hashing in `lib/client-auth.ts:228-269`).
2. `POST /api/academy/reset-password` — verify token, set the new password,
   **bump `sessionEpoch`** (revokes existing sessions), clear the token.
3. Email via the existing transactional templates.

### Phase 3 — Middleware gate · effort 2
Add an `/academy` branch to `middleware.ts` (excluding public sub-paths like the
marketing academy index) so authentication is the secure default. Keep the
per-page `getCurrentStudent` checks as defence-in-depth.

### Phase 4 — Erasure + retention · effort 4
1. `eraseStudentData(studentId)` — an atomic `$transaction` mirroring
   `eraseClientData`: pseudonymise identity, delete passkeys, progress, exam
   attempts, certificates, applications tied to the student. Surface it on the
   admin academy student page behind a typed confirmation + a dedicated
   `ACADEMY_STUDENT_ERASED` audit action.
2. Retention sweep in `app/api/cron/daily`: minimise rejected `JobApplication`
   rows after a chosen window (proposed 12 months) and dormant unverified
   `AcademyStudent` rows.

## Acceptance

- A de-activated trainee is signed out within one request (not 7 days).
- A trainee can self-serve a password reset; the reset kills old sessions.
- A new `/academy/*` page is protected without touching middleware.
- An academy student can be fully erased, with an audit trail.

## Risk / sequencing

Phase 1 is the highest-value, lowest-risk slice and unblocks Phase 2 (reset must
bump the epoch). The schema change is additive (`db push` safe). No client-portal
behaviour changes. Ship Phase 1 → 2 → 3 → 4 as separate PRs, each typechecked +
built, citing `BLD-314` sub-refs.
