// Claude's working backlog for this project — migrated into the Build & Issues
// board so admin can audit the workflow (status, decisions, PRs) directly in the
// dashboard. Seeded idempotently (deduped by title) via seedBacklog().
//
// Going forward this board is the portal: a task is created here (or as a GitHub
// issue via the bridge) before work starts, and actions/decisions are logged
// against it as comments.

export type BacklogItem = {
  title: string;
  type: 'ERROR' | 'TASK' | 'IDEA' | 'REVIEW' | 'AUDIT';
  urgency: 'P0' | 'P1' | 'P2' | 'P3';
  status: 'TRIAGE' | 'IN_PROGRESS' | 'IN_REVIEW' | 'BLOCKED' | 'SHIPPED' | 'CANCELLED';
  assignee?: string; // 'claude' or a staff email
  detail: string;
  pr?: string; // GitHub PR/issue URL
  notes?: string[]; // decision log → comment events by 'claude'
  // Prioritisation: value (business worth, 1–10) ÷ effort (build cost, 1–10).
  // Open work is tackled highest value-to-effort first. Recorded on the board so
  // the ordering is auditable.
  value?: number;
  effort?: number;
  // When a task is blocked on a human, `needs` says who is best placed to help
  // (resolved to a real, active user at runtime by role/clinical status), and
  // `ask` is the precise instruction posted to them on the board.
  needs?: OwnerInputRole;
  ask?: string;
  // Declarative breakdown, seeded onto the board:
  //  • subtasks — checklist under the item; ownerInput ones ping Claude when ticked.
  //  • dependsOn — titles of other backlog items this one is blocked by; the board
  //    wires these into dependency edges and auto-flows the dependent when they ship.
  subtasks?: { title: string; ownerInput?: boolean; assignee?: string }[];
  dependsOn?: string[];
  // Groups this item under a Project (by slug, see PROJECTS) — an epic + its
  // sub-tasks share a project; the project is formed from an idea.
  project?: string;
};

// Projects group an epic + its sub-tasks under one initiative, formed from an idea.
export type ProjectDef = { slug: string; name: string; summary: string; originIdeaTitle?: string };
export const PROJECTS: ProjectDef[] = [
  {
    slug: 'skin-smile-kiosk',
    name: 'Storefront “Skin & Smile” QR kiosk',
    summary: 'OOH interactive campaign: storefront screen QR → AI skin & smile rating → social share → account + share-to-claim discount. Formed from the owner’s marketing idea.',
    originIdeaTitle: 'New marketing idea',
  },
  {
    slug: 'audit-remediation',
    name: 'Security & Compliance Audit Remediation',
    summary: 'Fix every Critical + High finding from the 10-area codebase audit (audit/ on the branch): 3 Critical (booking race, GDPR erasure completeness, encrypt health/PII at rest) + 14 High (auth, payments, data races, XSS, consent, secrets, email). Each finding is one tracked item; the epic gates on all of them. Full detail per finding in audit/SUMMARY.md and the per-area reports.',
    originIdeaTitle: 'Full-codebase audit (10 parallel area passes)',
  },
  {
    slug: 'role-based-views',
    name: 'Role-based My Day & Dashboards',
    summary: 'Make the admin landing experience role-shaped: each user type lands on a daily view built around their job (developer → build/CI; clinician → appointments, rooms, prep, client info, appointment flow; receptionist → front-of-house; contractor → contracted tasks, time tracking, facility plans), and admins/owners can switch between views. Introduces two new roles (DEVELOPER, CONTRACTOR), new data (RoomPrep, TimeEntry, ContractorTask, FacilityDoc, AdminUser.preferredDashboardView), new cross-user interactions (prep handoff, room turnover, task assignment, time visibility) and a reusable view/widget set. Full spec: docs/projects/role-based-views.md.',
    originIdeaTitle: 'Role-based My Day & Dashboards — epic',
  },
];

// Who can unblock an input-required task. Resolved to an actual user from the
// live roster: OWNER → the account owner (business/admin/DNS decisions);
// CLINICAL → the most senior practising clinician (treatment/pricing calls).
export type OwnerInputRole = 'OWNER' | 'CLINICAL';

/** Value-to-effort ratio — higher is done sooner. */
export const vToE = (it: { value?: number; effort?: number }): number | null =>
  it.value && it.effort ? Math.round((it.value / it.effort) * 100) / 100 : null;

const PR = (n: number) => `https://github.com/JoeKaulPulse/K-Clinics/pull/${n}`;

export const BUILD_BACKLOG: BacklogItem[] = [
  // ── Reconciliation entries ─────────────────────────────────────────────────
  // These mirror DB-only board items (user/routine-reported, so not originally
  // in this file) whose work has shipped: reconcileBacklog() matches by exact
  // title and advances the live item to SHIPPED on the next board load.
  {
    title: "Heatmap isn't loading in and session recordings not working", type: 'ERROR', urgency: 'P0', status: 'SHIPPED', pr: PR(489),
    detail: 'Owner-reported (issue #374): the Behaviour-insights heatmap preview and session replays were broken.',
    notes: [
      'Fixed across four merged PRs: #474 CSP frame-ancestors none→self + X-Frame-Options DENY→SAMEORIGIN so the same-origin admin preview iframe can render at all; #479 replaced rrweb-player (broken Svelte build: missing onMount, player never instantiated) with a direct rrweb Replayer; #486 removed the restrictive iframe sandbox that left a broken-page icon in Safari/some Chromium; #489 bundled the Prisma/pg stack into the function chunks, fixing the 500s that had taken down every DB route incl. the insights page and track endpoints.',
      'Verified on production endpoints: POST /api/track/heatmap validates (400 on bad payload, no module-load 500), /api/track/replay consent-gates (403), /admin/marketing/insights auth-redirects (307). NB the production domain must be promoted to a current build to serve #486/#489 — it is currently pinned (rolled back) to b7ba22b.',
    ],
  },
  {
    title: 'Session merge summary — 2026-06-10', type: 'REVIEW', urgency: 'P2', status: 'SHIPPED', pr: PR(490),
    detail: 'Routine-logged record of PRs #474 (heatmap admin iframe fix) and #477 (self-serve reschedule + kiosk claim CTA + ToS update) merged to main, with per-PR rollback lines.',
    notes: ['The summary records completed, merged work — moving to SHIPPED so it enters the admin sign-off pile rather than sitting in Claude’s actionable queue.'],
  },
  // ── Shipped this session ──────────────────────────────────────────────────
  {
    title: 'Enhance search (admin + public) — powerful & access-gated', type: 'TASK', urgency: 'P1', status: 'SHIPPED', pr: PR(331),
    value: 8, effort: 5,
    detail: 'Make search powerful everywhere it appears — admin global search and the public website — gated by user type and access, except public marketing-page search which stays open to anyone (incl. non-users).',
    notes: [
      'Top of the open backlog by value-to-effort (V:E 1.6): search is used constantly and touches both admin and the public site, for moderate build cost.',
      'Added a shared relevance ranker (lib/search-rank.ts): exact > prefix > word-boundary > substring, with a specificity/brevity bonus — replaces "most recent first".',
      'Admin global search: ranked within and across groups (best-matching category leads); broadened to Products, Suppliers, Journal, Pages, Build & issues and the user’s own Tasks — every group still permission-gated via sessionCan, and Tasks scoped to the signed-in user so no one’s task list leaks.',
      'Public search: relevance-ranked with a gentle navigational prior (treatments/pages over articles); stays fully public per the brief.',
      'UI: match highlighting (you can see why a result matched) and per-user recent searches in the admin bar.',
    ],
  },
  {
    title: 'Board ↔ GitHub: one-click sync + dashboard summary', type: 'TASK', urgency: 'P1', status: 'SHIPPED', pr: PR(322),
    value: 7, effort: 4,
    detail: 'Make the Build board and GitHub harmoniously synced with a single labelled button, and surface the tracker on the admin overview.',
    notes: [
      'Added syncAllToGithub(): pushes every unsynced item to GitHub in throttled batches (max 8/click, 700ms apart) so the secondary rate limit isn’t tripped.',
      'Admin overview now shows a Build & issues card (Open / Blocked / Not on GitHub) + a “Blocked build items” attention chip.',
    ],
  },
  {
    title: 'Tidy admin navigation: clearer groups + section icons', type: 'TASK', urgency: 'P2', status: 'SHIPPED', pr: PR(323),
    value: 5, effort: 3,
    detail: 'Split overloaded sidebar sections, disambiguate duplicate tabs, add restrained per-section icons.',
    notes: [
      'Split Clients & bookings (loyalty/offers → own group) and Catalogue (website content → Website group); moved Build & issues to Administration.',
      'Renamed marketing “Connections” → “Channel connections” to distinguish it from Administration → Integrations. One line glyph per group header; no per-item icon sweep.',
    ],
  },
  {
    title: 'Auto-import the backlog on deploy', type: 'TASK', urgency: 'P2', status: 'SHIPPED', pr: PR(324),
    value: 4, effort: 2,
    detail: 'Seed the Build board from Claude’s backlog automatically after a deploy, without build-time DB writes.',
    notes: [
      'Version-gated lazy seed: runs the first time the board is opened after a deploy (stored marker = backlog version), so it adds no connection pressure during the deploy window.',
      'GitHub mirroring stays the explicit one-click “Sync all” button (auto-firing ~20 issue creations on a page render would risk GitHub rate limits).',
    ],
  },
  {
    title: 'Database connection crashes on deploy', type: 'ERROR', urgency: 'P0', status: 'SHIPPED', pr: PR(306),
    detail: 'Product kept falling over under load/deploys due to Postgres connection exhaustion.',
    notes: [
      'Diagnosis: Vercel scales horizontally and each instance opened Prisma’s default pool, exhausting the DB connection cap.',
      'Fix: cap direct connections to connection_limit=1 (+ pool_timeout/connect_timeout); left the Accelerate prisma+postgres:// pooler path untouched (it pools centrally).',
      'Also reduced demand: paused admin polling on hidden tabs, and made the 5 deploy-time seed scripts opt-in (SEED_ON_BUILD) so they don’t add connection pressure each deploy.',
      'Deliberately did NOT run the greenfield Prisma scaffolding from the setup script — it would have overwritten the 2,400-line schema and broken every @prisma/client import.',
    ],
  },
  {
    title: 'Live chat — old conversations sometimes fail to load', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', pr: PR(300),
    detail: 'Opening a conversation showed a blank panel with no messages or buttons.',
    notes: ['Cause: the admin chat route returned a bodiless 500 on transient errors, read by the client as a silent failure with no loading/error state.', 'Fix: clear-on-switch + Loading/Error+Retry/empty states; header & email button fall back to the list row; route always returns JSON; list cap 100→200.'],
  },
  {
    title: 'Mobile admin nav weak + 2FA QR missing', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', pr: PR(303),
    detail: 'Mobile sidebar was a horizontal-scroll strip with no profile/sign-out; 2FA setup showed only the secret string.',
    notes: ['Replaced mobile nav with a grouped Menu drawer incl. profile/language/sign-out.', '2FA: render the otpauth URI as a scannable QR (qrcode) above the manual key.'],
  },
  {
    title: 'OG / social cards look poor', type: 'ERROR', urgency: 'P2', status: 'SHIPPED', pr: PR(293),
    detail: 'Generic serif text on a flat gradient when links were shared.',
    notes: ['Rebuilt as an editorial card: real treatment photography + ink scrim, Fraunces font, real K mark + CLINICS wordmark.', 'Per brand guidance: removed the circle around the K, enlarged it, and locked K + CLINICS together; descriptor reads "Aesthetics · Laser · Skin" until dentistry is live.'],
  },
  {
    title: 'Email header branding wrong (font, dentistry strapline, broken wordmark)', type: 'ERROR', urgency: 'P2', status: 'SHIPPED', pr: PR(292),
    detail: 'Header used Georgia text not the brand wordmark, advertised Dentistry (not live), and the wordmark showed broken in preview.',
    notes: ['Used the real CLINICS wordmark vector (rasterised), loaded Fraunces, fixed the preview cid swap, and made the descriptor accurate/compliant until site.dentistryLive.'],
  },
  {
    title: 'Email suite redesign — per-type animated hero motifs', type: 'TASK', urgency: 'P2', status: 'SHIPPED', pr: PR(301),
    detail: 'Redesigned all templates with a drawn-line motif per type + booking confirmation rebuild and mobile fix.',
    notes: ['Built a reusable motif engine (scripts/gen-email-heroes.mjs) — confirmed tick, clock, envelope, stars, gift, etc.; frame 0 is a static fallback for Outlook.', 'Honest constraint: true "awwwards" motion is stripped by Gmail/Outlook; used GIF heroes + CSS that degrade gracefully.'],
  },
  {
    title: 'Live chat ↔ email end-to-end', type: 'TASK', urgency: 'P1', status: 'SHIPPED', pr: PR(304),
    detail: 'Email follow-ups when a visitor leaves, manual + client-requested transcripts, threaded replies, responder identity, audit + Resend status.',
    notes: ['Decisions confirmed with owner: Resend Inbound for replies; smart "only once they’ve left" trigger; staff + AI replies eligible.', 'All chat email unified on mail.kclinics.co.uk; responder identity pulled from the logged-in account (owner/admin shown as "KClinics").'],
  },
  {
    title: 'Day-close / clinic shutdown tool', type: 'TASK', urgency: 'P1', status: 'SHIPPED', pr: PR(291),
    detail: 'End-of-day stepped flow: reconciliation, stock take, closedown checklist, reminders, reports.',
    notes: ['Owner chose full financial reconciliation; built as a schema change (additive DayClose table) flagged before merge.'],
  },
  {
    title: 'Go-live validated tracker + owner to-do', type: 'TASK', urgency: 'P2', status: 'SHIPPED', pr: PR(296),
    detail: 'Launch checklist validated live (env + DB + real DNS lookups) with a genuine % and owner-tagged manual tasks.',
  },
  {
    title: 'Build & Issues board (this board)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', pr: PR(302),
    detail: 'Kanban + staff "Report a problem" (screenshots/urgency) + audit trail + GitHub bridge.',
    notes: ['Scoped per owner: kanban + error reporting first; separate from staff to-dos; GitHub-issues bridge for actioning.'],
  },
  {
    title: 'Self-serve GitHub connection for the board', type: 'TASK', urgency: 'P2', status: 'SHIPPED', pr: PR(311),
    detail: 'Connect a repo + token in-app (encrypted), validated against the GitHub API.',
    notes: ['Connect kept failing — diagnosed via surfaced error as a 403 RATE LIMIT (token was correct), not a permissions issue.', 'Fix: treat a rate-limit 403 as a valid (authenticated) token and save it; single probe to avoid adding to the limit; fixed a "Connect &amp; test" label bug.'],
  },
  {
    title: 'Booking: "Book online" pre-selects the treatment', type: 'TASK', urgency: 'P2', status: 'SHIPPED', pr: PR(295),
    detail: 'Clicking Book online on a treatment page now carries the treatment into the flow.',
  },
  {
    title: 'Abandoned-booking recovery email', type: 'TASK', urgency: 'P3', status: 'SHIPPED', pr: PR(305),
    detail: 'One-time nudge to finish an unpaid booking.',
    notes: ['Gated behind a default-OFF Settings toggle — new client-facing automated sends shouldn’t auto-enable without owner sign-off.'],
  },
  {
    title: 'No-show rebooking email', type: 'TASK', urgency: 'P3', status: 'SHIPPED', pr: PR(308),
    detail: 'Warm rebooking note when an appointment is marked no-show.',
    notes: ['Gated behind a default-OFF Settings toggle, same reasoning as abandoned-booking.'],
  },
  {
    title: 'IPL Photorejuvenation page + injectables/laser nav', type: 'TASK', urgency: 'P2', status: 'SHIPPED', pr: PR(290),
    detail: 'Dedicated IPL page; split injectables (Botox/Fillers) and grouped laser treatments in nav.',
    notes: ['Catalogue curation (which exact IPL treatments/prices) still needs owner input — see open task.'],
  },

  // ── Open / next ───────────────────────────────────────────────────────────
  {
    title: 'Google Business: Connect button never appears even with OAuth creds set', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(472),
    value: 7, effort: 1,
    detail: 'Admin → Reviews gated the “Connect Google Business” button on googleBusinessConfigured(), which also requires GOOGLE_BUSINESS_ACCOUNT_ID + GOOGLE_BUSINESS_LOCATION_ID — but the location is auto-detected on connect and the UI says only GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET are needed. So the owner set the OAuth creds but the button stayed hidden behind the “Waiting on…” notice.',
    notes: ['Shipped (#472): the Reviews page now gates the Connect button on googleOAuthConfigured() (CLIENT_ID + SECRET only); the account/location are auto-detected on connect (only needed manually for multi-location pinning). After a redeploy the button appears on Admin → Reviews.'],
  },
  {
    title: 'Adopt the board as the work portal + migrate backlog', type: 'TASK', urgency: 'P2', status: 'SHIPPED',
    detail: 'Seed the session backlog here with statuses + decision notes; add an "assigned to me" view; create a task before any future work and log actions against it.',
    notes: ['This item is itself logged here. Going forward: create a board item (or GitHub issue) before starting, and record decisions as comments.', 'Superseded by the Build board v2 overhaul below — the board is now the portal.'],
  },
  {
    title: 'Autonomous flow hardening: smart-quote guard + fire-message update', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(440),
    value: 7, effort: 1,
    detail: 'Belt-and-braces for the fully-autonomous build routine. (1) scripts/check-backlog-quotes.mjs runs in prebuild and fails fast if lib/build-backlog.ts uses a curly/smart quote as a string delimiter (the exact bug that broke a Vercel deploy) — curly quotes inside string text and comments are still allowed. (2) The board fire-time message now tells the woken session to complete ALL actionable items (batched, deduped vs open PRs), run an Opus 4.8 max-effort review/audit, then merge to production with per-change revert notes.',
    notes: ['Shipped (#440): prebuild quote guard (tested: flags curly delimiters, ignores curly quotes in prose/comments) + updated queueHint flow. Pairs with the rewritten routine prompt + the Typecheck CI gate (#439).'],
  },
  {
    title: 'CI typecheck gate (safe autonomous merge)', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(439),
    value: 8, effort: 1,
    detail: 'There was no typecheck/build check on PRs — a syntax error (e.g. smart-quotes in a routine-generated backlog entry) only surfaced as a failed Vercel deploy after the fact. Add a GitHub Actions Typecheck job (prisma generate + tsc --noEmit) that runs on every PR + main, so broken changes are caught before merge. Recommended: make it a required check in branch protection to hard-gate the autonomous build routine’s merges.',
    notes: ['Shipped (#439): .github/workflows/typecheck.yml. Pairs with the rewritten autonomous routine prompt (complete all actionable tasks in one run, batch related work, dedupe vs open PRs, Opus 4.8 max-effort review/audit, then merge to production with revert notes for human rollback).'],
  },
  {
    title: 'Projects: group epics + sub-tasks into Projects (progress, errors, user-gated flags)', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(426),
    value: 8, effort: 5,
    detail: 'Group an epic and its sub-tasks under a Project (formed from an idea). A Projects board section shows each project with progress %, open errors, and a red count of user-gated (owner-input) items. Cards show a red numerical badge for items needing owner input, and their project. The QR kiosk idea is converted into the "Storefront Skin & Smile QR kiosk" project with all its tasks linked.',
    notes: ['Shipped (#426): BuildProject model + projectId on BuildItem; declarative PROJECTS + project field seeded by syncProjects (links items + converts the originating idea by linking it); listProjects derives progress/errors/userGated; Projects view + drill-in filter; red user-gated badges on cards + projects; kiosk audit findings filed under the project.'],
  },
  {
    title: 'Live visual QA harness (headless browser screenshots + findings)', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(425),
    value: 7, effort: 4,
    detail: 'Enable real visual click-throughs: a Playwright harness drives a headless browser through key journeys against a BASE_URL, screenshots every step, captures console/page errors + failed requests, and writes a report. Test-tagged + auto-cleanup so running against production leaves no residue.',
    notes: ['Shipped (#425): scripts/visual-qa.mjs (Playwright/chromium; kiosk display+mobile+result, home, /book, /gift-vouchers; extensible); token-authed /api/kiosk/test-cleanup deletes the sessions a run creates (cascade + Blob photos). Runs in a Full-network "Visual QA" environment; a session reads the screenshots to report findings. First live run pending owner setup (below).'],
  },
  {
    title: 'Set up the Visual QA environment + routine (network + Playwright)', type: 'TASK', urgency: 'P1', status: 'BLOCKED', assignee: 'claude', needs: 'OWNER',
    value: 7, effort: 1,
    detail: 'One-time owner setup so the visual-QA harness can run against live production.',
    ask: 'In Claude Code: (1) create a dedicated "Visual QA" environment with Network access = Full; (2) set its setup script to `npm ci && npx playwright install --with-deps chromium`; (3) create a routine "KClinics Visual QA" using that environment + repo joekaulpulse/k-clinics, with an API trigger, and the prompt I provided (runs `BASE_URL=https://kclinics.co.uk QA_TOKEN=<BOARD_QUEUE_TOKEN> node scripts/visual-qa.mjs`, then files findings to the board via /api/build/queue). Reply here when done and I’ll fire a run + review the screenshots.',
    notes: ['Decisions: target = production via a Full-network QA env; data = test-tagged + auto-cleanup (the harness deletes the kiosk sessions/photos it creates). Keeps the main build environment locked down.'],
  },
  {
    title: 'Build board: task dependencies + auto-flow (declarative, in-app)', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(404),
    value: 8, effort: 5,
    detail: 'Tasks can depend on other tasks. A task with open prerequisites is held BLOCKED; when its prerequisites ship/close it auto-advances to TRIAGE and is queued for Claude. Dependencies are editable in the modal and seedable from the backlog (dependsOn by title); subtasks are seedable too.',
    notes: ['Shipped (#404): BuildDependency edges; addDependency/removeDependency + unblockDependents wired into update/sign-off/reconcile; declarative subtasks + dependsOn seeded via wireBacklogDependencies; modal shows “Blocked by / Blocks” with add/remove; cards show a lock when dependency-blocked.'],
  },
  {
    title: 'Vercel Speed Insights', type: 'TASK', urgency: 'P3', status: 'SHIPPED', assignee: 'claude', pr: PR(424),
    value: 4, effort: 1,
    detail: 'Add Vercel Speed Insights (real-user Core Web Vitals). Implemented cleanly on current main — @vercel/speed-insights + <SpeedInsights/> in the root layout. (The auto-generated PR #194 was based on ancient main and would have deleted Accelerate/passkeys/Upstash, so it was closed and re-done safely.)',
    notes: ['Shipped (#424): @vercel/speed-insights ^2 + <SpeedInsights/> in app/layout.tsx. tsc + build green.'],
  },
  {
    title: 'Dependency upgrades: Next 16, Prisma 7, Stripe SDKs, zod 4, jose 6 (incremental + tested)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(480),
    value: 6, effort: 7,
    detail: 'Dependabot proposed sweeping MAJOR bumps in two PRs (#84 production, #307 dev): Next 15→16, Prisma 6→7, @stripe/* 3→6/5→9/17→22, zod 3→4, jose 5→6, bcryptjs 2→3, resend 4→6, TypeScript 5→6, @types/node 22→25. These cannot be blanket-merged — verified locally that the bundle breaks immediately (Prisma 7 `prisma generate` fails on install). Do them deliberately and per-family, each with its own migration + tsc/build verification, on their own PRs.',
    notes: [
      'Blanket bump verified to break (Prisma 7 generate). #84/#307 left open for reference but must NOT be merged as-is. Sequence suggestion: TypeScript/types first, then Prisma 6→7 (client + schema), then Next 15→16, then Stripe SDKs (API-version sensitive), then zod 3→4 (schema API changes), jose 6, resend 6.',
      'Partial: the 4 moderate npm-audit vulns flagged by the audit (postcss <8.5.10 XSS, bundled inside next + reached via @vercel/speed-insights/geist) are now RESOLVED via a package.json overrides forcing postcss ^8.5.15.',
      'Shipped all 6 families (#480 TS6, #481 Prisma7, #482 jose6+resend6, #483 zod4, #484 Stripe22, #485 Next16). Key migrations: Prisma 7 removed binary engine — uses @prisma/adapter-pg with lazy pg.Pool; TS 6 requires declare module for CSS side-effect imports; zod 4 renames ZodError.errors->issues, z.literal() second arg is now a string, z.record() requires explicit key schema; Next 16 revalidateTag() requires second CacheLifeConfig arg; Stripe 22 apiVersion updated to 2026-05-27.dahlia.',
    ],
  },
  {
    title: 'EOD Audit enablers: routine task-create/continue API + daily run cap', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(423),
    value: 8, effort: 3,
    detail: 'Support the End-of-Day Audit routine: a token-authed POST /api/build/queue lets a routine session create board tasks ({action:"create"}) and fire the night fix routine ({action:"continue"}). Plus a hard per-day cap on how many routine sessions the board may start, so it never exhausts the shared 15/day allowance.',
    notes: ['Shipped (#423): POST /api/build/queue (same BOARD_QUEUE_TOKEN) — create (deduped by title, ≤30) + continue. fireRoutine now enforces a daily budget (routine_fire_daily_cap, default 8) tracked in routine_fires:<date>; refuses beyond it. routineFireBudget() exposed. EOD Audit routine prompt provided to owner.'],
  },
  {
    title: 'Routine work queue: token-protected pending-work endpoint', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(420),
    value: 8, effort: 2,
    detail: 'Let an unattended routine session read the live, DB-backed board (not just the backlog in code) so it can action reported bugs/ideas. A token-authed GET /api/build/queue returns the prioritised actionable + blocked items with full detail, open subtasks, blocking dependencies and recent comments. The wake text now points sessions at it.',
    notes: ['Shipped (#420): GET /api/build/queue (outside the session-gated /api/admin namespace; bearer auth via BOARD_QUEUE_TOKEN, constant-time compare). routineQueue() serialises actionable vs blocked items with detail/subtasks/blockedBy/recentComments. fireRoutine text includes a queueHint pointing at the endpoint with the token from the routine environment.', 'Owner action: set BOARD_QUEUE_TOKEN (a random secret) in Vercel AND as an env var in the Claude Code routine environment.'],
  },
  {
    title: 'Autonomous wake: board fires a Claude Code Routine (GitHub-free)', type: 'TASK', urgency: 'P0', status: 'SHIPPED', assignee: 'claude', pr: PR(419),
    value: 9, effort: 3,
    detail: 'Make “▶ Continue working”, @claude mentions and owner-input subtask completions actually start an unattended Claude session — via a Claude Code Routine API trigger (POST the routine fire endpoint), which is GitHub-free so it never touches the rate limit. Per the docs, @mention GitHub comments are NOT a supported wake; the routine API trigger is.',
    notes: ['Shipped (#419): fireRoutine() posts to CLAUDE_ROUTINE_FIRE_URL with the bearer token + anthropic-beta header (env vars set in Vercel, never committed), 15s timeout. requestClaudeContinue + triggerClaude now prefer the routine and fall back to the governed GitHub wake only if no routine is configured. The returned claude_code_session_url is stored + surfaced as a “▶ Watch session” link and logged to the item’s activity. Owner completed routine creation + env vars (Parts A–C).'],
  },
  {
    title: '@-mentions: robust picker across admin comments (+ @claude nudge)', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(408),
    value: 8, effort: 4,
    detail: 'A reusable @-mention input with a live people-picker for admin comment surfaces. Typing “@” lists team members (and Claude) to insert; staff-only — the picker shows only for admins + clinicians/consultants, never clients. @claude nudges Claude to carry on (recorded to the work queue). Designed to drop into the build board now and consultation/client notes next.',
    notes: ['Shipped (#408): /api/admin/mentionables (admin/clinician-gated; returns team + Claude); reusable <MentionInput> with keyboard + click picker; wired into the board comment box; server resolves @handles to notifications and @claude → triggerClaude. Previously @ only parsed silently with no picker and ignored Claude.'],
  },
  {
    title: 'Consultation notes & team @-mentions (clinicians hand off / nudge)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 7, effort: 5,
    detail: 'Add a notes/comments thread to the consultation/client record so clinicians can log notes and @-mention colleagues to pull them into a live consultation or review something — reusing the <MentionInput> + mentionables API + notifications already built for the board. Staff-only (admins + clinicians), never clients.',
    notes: [
      'Component groundwork shipped with #408 (MentionInput + mentionables + notify). Remaining: a ClientNote/ConsultationNote model + thread UI on the client/consultation page, then drop MentionInput in.',
      'Shipped: new ConsultationNote model in Prisma (consultationId FK, body, author, createdAt); POST /api/admin/consultations/[id]/notes (auth-gated + @-mention resolution + notifyStaff); <ConsultationNotes> client component (MentionInput + thread, optimistic update); dedicated /admin/consultations/[id] detail page; consultation list now links to detail; client detail "Notes →" link on each consultation card.',
    ],
  },
  {
    title: 'Board: attachment upload stuck on “Uploading…” (CSP blocked Blob)', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(407),
    value: 7, effort: 2,
    detail: 'Adding photos to a task hung on “Uploading 1 of 2…” forever. Root cause: the client-direct Vercel Blob upload’s browser requests were blocked by the CSP — connect-src didn’t include the blob.vercel-storage.com domains — and the upload had no timeout, so it never failed or recovered.',
    notes: ['Shipped (#407): added the Vercel Blob domains to CSP connect-src so client-direct uploads (videos/large files) work; routed normal photos through the proven server-side upload route (no CSP/​body-limit issues); every upload is now bounded by a 90s timeout with graceful image fallback to the server route and per-file error notifications, so it can never get stuck silently.'],
  },
  {
    title: 'Board: activity ticker blows out desktop layout (horizontal overflow)', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(406),
    value: 6, effort: 1,
    detail: 'On desktop the live activity ticker’s marquee used a max-content-width in-flow row, which propagated its intrinsic width up the admin layout and stretched the whole page far wider than the viewport — pushing 5 of the 6 kanban columns off-screen and clipping the ticker.',
    notes: ['Shipped (#406): the moving row is now absolutely positioned (out of flow) inside a fixed-height w-full overflow-hidden container, so it can’t contribute to layout width; long chips are truncated; added min-w-0 guards on kanban columns + break-words on card titles.'],
  },
  {
    title: 'Board: can’t add files to a task from iPhone', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(405),
    value: 7, effort: 3,
    detail: 'Owner couldn’t attach files to a task from an iPhone. Two causes: (1) the task modal had no upload control at all (attachments only existed on the “Report a problem” screenshot flow); (2) the upload endpoint rejected iPhone HEIC/HEIF photos and all video, and the 8 MB cap + serverless body limit blocked storefront videos.',
    notes: ['Shipped (#405): task modal now has an Attachments section (photos + video) using client-direct Blob upload so it bypasses the serverless body limit and handles big videos; accepts iPhone HEIC/HEIF + .mov; BuildItem.attachments added; attach/attach-remove ops. Also widened the screenshot endpoint to accept HEIC/HEIF.'],
  },
  {
    title: 'Dedicated bot GitHub account / GitHub App for the board (remove shared rate limit)', type: 'TASK', urgency: 'P1', status: 'BLOCKED', assignee: 'claude',
    value: 7, effort: 3, needs: 'OWNER',
    ask: 'The code side is DONE (#491) — installation-token auth is wired and preferred automatically once configured. Your 5-minute setup (answers your question: a PRIVATE App on your own account, nothing published to the marketplace): GitHub → Settings → Developer settings → GitHub Apps → New GitHub App → name e.g. kclinics-board, any homepage URL, untick Webhook → Permissions: Issues Read&write + Metadata Read-only → Create. Then: (1) note the App ID; (2) Generate a private key (downloads a .pem); (3) Install App → only JoeKaulPulse/K-Clinics, and note the installation ID (the number at the end of the installation URL). Set in Vercel: GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY (paste the .pem contents), GITHUB_APP_INSTALLATION_ID — the board switches over on the next deploy, no code change needed.',
    detail: 'Root-cause fix for the rate-limit bottleneck: separate the board’s GitHub identity from the personal account used for development, so mirroring/wakes never contend with PR work. A GitHub App is preferred (scoped, higher limits, installation tokens).',
    notes: [
      'Shipped (#491): lib/github-app.ts mints installation tokens (App JWT → access-token exchange, cached in Settings with early refresh); getGithubConfig() prefers the App identity over the personal-token paths whenever the three env vars are present. Remaining: the owner setup in the ask above.',
    ],
  },
  {
    title: 'Storefront “Skin & Smile” QR kiosk — campaign epic', type: 'TASK', urgency: 'P2', status: 'TRIAGE', assignee: 'claude', project: 'skin-smile-kiosk',
    value: 8, effort: 8,
    detail: 'From the owner’s idea (board): the storefront digital screen (Novastar controller) shows a QR code; scanning starts a session that captures a photo, runs an AI “skin & smile” rating, lets the visitor share the result on social, then routes them to create an account and claim a share-for-discount reward. High lead-gen/brand potential; built on the existing K Vision AI consultation, accounts and gift/discount engines. This epic gates on its component tasks below; its owner-input subtask unblocks the build.',
    notes: [
      'Assessed from the captured idea (#403). Broken into the dependency chain below: kiosk session → photo+consent → AI rating → shareable card → account+discount, with the Novastar display and analytics/GDPR in parallel. V:E scored per task; owner-input subtasks auto-ping Claude when ticked.',
      'SHIPPED (5 of 7 sub-tasks): the technical foundation of the Skin & Smile kiosk is live end-to-end. Built: Prisma models (KioskSession/KioskResult/KioskEvent + KioskStatus enum); a friendly non-clinical AI rating (lib/kiosk-ai.ts, reusing the K Vision Claude pattern on claude-haiku-4-5); public API routes for session create/status/photo-upload/result/share/events; a GDPR cron (/api/cron/kiosk-cleanup, nightly, deletes Blob photos + sessions >30 days); full-screen storefront display (/kiosk/display) with an auto-regenerating QR; the mobile 5-step flow (/kiosk/[token]) — welcome → consent → camera capture → processing/poll → shareable result; a public shareable card (/kiosk/result/[slug]) with OG metadata; WhatsApp/X/Web-Share sharing; and a funnel-stats panel on the admin QR page. Anti-abuse: per-IP rate limits (3/day, 5/hour) on hashed IPs + 30-min session expiry.',
      'Remaining (owner-gated): account creation + share-to-claim discount (needs discount amount/validity) and the Novastar storefront screen integration (needs screen/camera specs). Both kept in TRIAGE with notes.',
    ],
    subtasks: [
      { title: 'Upload storefront photos/videos + screen & camera specs (Novastar controller)', ownerInput: true },
      { title: 'Confirm campaign goal + which discount funds the share reward', ownerInput: true },
    ],
    dependsOn: [
      'Kiosk: QR session + mobile entry (Skin & Smile)',
      'Kiosk: photo capture + consent',
      'Kiosk: AI Skin & Smile rating (reuse K Vision)',
      'Kiosk: shareable result card + social sharing',
      'Kiosk: account creation + share-to-claim discount',
      'Kiosk: Novastar storefront screen — live QR + session display',
      'Kiosk: analytics, anti-abuse & GDPR retention',
    ],
  },
  {
    title: 'Kiosk: QR session + mobile entry (Skin & Smile)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', project: 'skin-smile-kiosk',
    value: 7, effort: 5,
    detail: 'Foundation: a QR on the storefront screen opens a tokenised mobile session (/kiosk/[token]) that pairs the phone with a display session and walks the visitor through the flow. Short-lived, anonymous-until-signup, rate-limited.',
    notes: [
      'SHIPPED. New Prisma models KioskSession/KioskResult/KioskEvent (+ KioskStatus enum). POST /api/kiosk/sessions creates a 30-minute session, IP rate-limited (3/day, 5/hour) over a salted IP hash (no raw IPs stored). GET /api/kiosk/sessions/[token] returns status + resultId for polling and lazily expires stale sessions. Full-screen /kiosk/display (force-dynamic) renders a large inline-SVG QR (lib/qr qrSvg) pointing to {origin}/kiosk/{token}, with a 20-minute auto-regenerate + countdown. /kiosk/[token] validates the token (redirects to /kiosk/display if expired/unknown) and mounts the mobile flow. No auth — public surfaces, on the existing /app/kiosk/layout.tsx shell.',
    ],
  },
  {
    title: 'Kiosk: photo capture + consent', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', project: 'skin-smile-kiosk',
    value: 8, effort: 6,
    detail: 'Super-interactive, multi-source capture: (1) a fixed MAIN STORE CAMERA by the display for a live/“strike a pose” capture, (2) the visitor’s PHONE CAMERA via the QR session, and (3) additional CLOSE-UP uploads from the phone (skin/teeth detail). All with explicit, logged consent for analysis + optional social use; stored per the retention policy with an opt-out path. The phone session and the in-store camera are paired so either can drive the capture.',
    dependsOn: ['Kiosk: QR session + mobile entry (Skin & Smile)'],
    subtasks: [{ title: 'Approve consent wording for photo capture + social sharing', ownerInput: true }],
    notes: [
      'SHIPPED (phone-camera path). The mobile flow (components/kiosk/KioskSessionFlow.tsx) is a 5-step client component: welcome → consent (explicit ticked checkbox: "I agree to share my photo for AI analysis and consent to my result being shown on this device") → capture via <input type="file" accept="image/*" capture="user"> with a gallery fallback + preview thumbnail → processing → result. POST /api/kiosk/sessions/[token]/photo accepts multipart (file + consent=true), validates image type (png/jpg/webp/heic) and ≤10MB, uploads to Vercel Blob at kiosk/{token}-{ts}.jpg, records photoUrl/consentAt/status=PHOTO_TAKEN, logs consent+photo events, then fires the AI analysis without awaiting and returns immediately so the client can poll. The MAIN STORE CAMERA / paired in-store capture remains under the Novastar task (owner-gated). Consent wording subtask still owner-input for sign-off.',
    ],
  },
  {
    title: 'Kiosk: AI Skin & Smile rating (reuse K Vision)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', project: 'skin-smile-kiosk',
    value: 8, effort: 4,
    detail: 'Run the captured photo through the existing K Vision AI consultation to produce a friendly skin & smile rating + headline insights, tuned for a shareable, on-brand result (not a clinical diagnosis).',
    dependsOn: ['Kiosk: photo capture + consent'],
    notes: [
      'SHIPPED. lib/kiosk-ai.ts → analyzeKioskPhoto(photoUrl) reuses the K Vision Claude call pattern (direct fetch to api.anthropic.com, claude-haiku-4-5, cached system prompt) with a warm, non-clinical campaign prompt. It fetches the Blob photo, base64-encodes it, sends it to Claude, and parses/validates strict JSON → { headline, skinScore 1-10, smileScore 1-10, insights[2-3], treatments[1-2] } restricted to a fixed K Clinics treatment list. lib/kiosk.ts runKioskAnalysis() is the fire-and-forget step the photo route kicks off: it analyses, persists a KioskResult (with a crypto-random 8-char shareSlug), flips the session to ANALYZED, and logs an analyzed event. Returns null gracefully on any failure so the client can show a friendly retry.',
    ],
  },
  {
    title: 'Kiosk: shareable result card + social sharing', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', project: 'skin-smile-kiosk',
    value: 8, effort: 5,
    detail: 'Render a beautiful, branded result card (image + page with OG tags) and one-tap share to Instagram/TikTok/X/WhatsApp. The shared link drives traffic back to the claim page.',
    dependsOn: ['Kiosk: AI Skin & Smile rating (reuse K Vision)'],
    notes: [
      'SHIPPED. components/kiosk/ResultCard.tsx renders the branded card — headline, two gold SVG score rings (Skin/Smile, components/kiosk/ScoreRing.tsx), insight bullets and suggested-treatment chips — reused by both step 5 of the mobile flow and the public page. components/kiosk/ShareButtons.tsx provides Copy link, WhatsApp (wa.me prefilled), X/Twitter (intent), and Instagram/more via the Web Share API; every share pings POST /api/kiosk/results/[id]/share to increment shareCount + flip the session to SHARED. Public /kiosk/result/[slug] (force-static + revalidate) looks up by shareSlug (notFound otherwise), shows the card with a "Get your score" CTA → /kiosk/display, exports generateMetadata (title/description/openGraph/twitter), and deliberately never shows the photo (privacy). The result screen also has a "Claim your reward →" link to /account/register?ref=kiosk&slug={shareSlug} as the handoff to the owner-gated claim task.',
    ],
  },
  {
    title: 'Kiosk: account creation + share-to-claim discount', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', project: 'skin-smile-kiosk', pr: PR(449),
    value: 9, effort: 5,
    detail: 'After sharing, the visitor creates an account and is issued a single-use, campaign-tied discount as the share reward, tracked under the OOH MarketingCampaign.',
    dependsOn: ['Kiosk: shareable result card + social sharing'],
    notes: ['Shipped (#449). Owner chose 15% off first treatment, single-use, 60 days (configurable in Finance → Financial controls → Storefront kiosk share reward; can be paused). Flow: ClaimReward form on the result step → POST /api/kiosk/results/[id]/claim → share-gated (session must be SHARED) → upserts a marketing-opted-in Client → createPersonalCode (PERSONAL, single-use, assignedEmail, expiry) under the seeded “Storefront Skin & Smile (OOH)” MarketingCampaign (getOohCampaignId) → emails the code (tmplKioskReward) → records claimCode on the result (idempotent) + logs the claimed funnel event. Config: kiosk_discount_pct/days + kiosk_discount_enabled.'],
  },
  {
    title: 'Kiosk: Novastar storefront screen — live QR + session display', type: 'TASK', urgency: 'P3', status: 'TRIAGE', assignee: 'claude', project: 'skin-smile-kiosk',
    value: 6, effort: 6,
    detail: 'Drive the storefront screen via the Novastar controller: show the QR + an attract loop, mirror the MAIN STORE CAMERA feed (“strike a pose”), and reflect live session state (“scan to start”, “look at the camera”, result reveal) so the window is genuinely interactive. Exact integration depends on how the Novastar player accepts web content — gated on the owner’s specs.',
    dependsOn: ['Kiosk: QR session + mobile entry (Skin & Smile)'],
    notes: ['A web-renderable /kiosk/display is already live (full-screen QR + auto-regenerate countdown) for the storefront screen to point at. Awaiting owner storefront photos, screen specs, and Novastar controller details before building the live camera-mirror / session-aware attract loop.'],
  },
  {
    title: 'Kiosk: analytics, anti-abuse & GDPR retention', type: 'TASK', urgency: 'P3', status: 'SHIPPED', assignee: 'claude', project: 'skin-smile-kiosk',
    value: 6, effort: 4,
    detail: 'Conversion funnel analytics (scans → photos → shares → signups → redemptions), rate-limiting/anti-abuse on the public kiosk, and a clear photo-retention/erasure policy aligned to the consent wording.',
    dependsOn: ['Kiosk: photo capture + consent'],
    notes: [
      'SHIPPED. Funnel analytics via the KioskEvent model: scan (server-side on /kiosk/[token] load), consent + photo (photo route), analyzed (after AI save), shared (share route), claimed (client POST to /api/kiosk/events on the claim CTA). The admin QR page now shows a "Skin & Smile Kiosk" panel with a link to /kiosk/display and live funnel counts (scans/photos/analyses/shares/claims) from KioskEvent groupBy. Anti-abuse: per-IP rate limit on POST /api/kiosk/sessions — max 3 sessions/IP/day and 5/IP/hour over a salted SHA-256 IP hash; sessions expire after 30 minutes (expiresAt enforced in the status route and the photo-upload route). GDPR retention: /api/cron/kiosk-cleanup (CRON_SECRET-protected, scheduled nightly in vercel.json) deletes Blob photos via del() and removes sessions (cascading results + events) older than 30 days, returning { ok, deleted }.',
    ],
  },
  // ── Kiosk audit findings (code review of the #422 autonomous build) ─────────
  {
    title: 'Kiosk BUG: AI analysis is fire-and-forget — won’t run reliably on serverless', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', project: 'skin-smile-kiosk', pr: PR(427),
    value: 9, effort: 2,
    detail: 'In app/api/kiosk/sessions/[token]/photo/route.ts the analysis was kicked off with `void runKioskAnalysis(...)` AFTER the response is returned. On Vercel the function can be frozen/terminated once it responds, so the background work often never completes — the client then polls forever and never gets a result.',
    notes: ['Shipped (#427): replaced the fire-and-forget with `after(() => runKioskAnalysis(...))` from next/server, which keeps the serverless function alive until the analysis completes. Top actionable backlog item by V:E; the most likely cause of the live flow stalling at "analysing".'],
  },
  {
    title: 'Kiosk BUG: HEIC selfies sent to Claude as image/jpeg', type: 'ERROR', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', project: 'skin-smile-kiosk', pr: PR(438),
    value: 6, effort: 2,
    detail: 'Photos were stored as kiosk/<token>.jpg regardless of real type; mediaTypeFromUrl derived the media type from the .jpg URL, so an iPhone HEIC upload was sent to Claude as image/jpeg and analysis failed.',
    notes: ['Shipped (#438): the photo route now stores the blob with the real extension (png/webp/heic/jpg) so mediaTypeFromUrl labels HEIC correctly. Ported cleanly from the autonomous routine PRs (#434-437) which built on a stale main + had a smart-quote syntax error that failed the Vercel build.'],
  },
  {
    title: 'Kiosk: share endpoint is unauthenticated + non-idempotent', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', project: 'skin-smile-kiosk', pr: PR(438),
    value: 6, effort: 3,
    detail: 'POST /api/kiosk/results/[id]/share incremented shareCount and flipped the session to SHARED with no rate-limit — share counts could be inflated, which matters because the reward is share-to-claim.',
    notes: ['Shipped (#438): per-IP rate limit (max 20 shares/hour over the salted IP hash) on the share route.'],
  },
  {
    title: 'Kiosk: flow dead-ends before the account + discount payoff (not launch-ready)', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', project: 'skin-smile-kiosk', pr: PR(449),
    value: 8, effort: 5,
    detail: 'The live flow ended at the shareable card with no account/discount step. Resolved by shipping the share-to-claim reward (#449): the result step now has a Create-account-and-claim form issuing a single-use 15% code, so the conversion + ROI loop is live.',
    dependsOn: ['Kiosk: shareable result card + social sharing'],
  },
  {
    title: 'Kiosk: analysis timeout + stuck-state UX', type: 'TASK', urgency: 'P3', status: 'SHIPPED', assignee: 'claude', project: 'skin-smile-kiosk', pr: PR(438),
    value: 4, effort: 2,
    detail: 'analyzeKioskPhoto had no timeout on the Anthropic fetch, and on failure the session stayed in PHOTO_TAKEN, so the client polled forever.',
    notes: ['Shipped (#438): 30s AbortController timeout on the AI call; on failure the session is set to a new ANALYSIS_FAILED status; the mobile client shows a friendly "try a clearer selfie" retry, the photo route allows a re-upload when ANALYSIS_FAILED, and polling extends to ~90s before giving up.'],
  },
  {
    title: 'Build board: decouple from GitHub (DB-native queue, opt-in mirror, rate-limit governor)', type: 'TASK', urgency: 'P0', status: 'SHIPPED', assignee: 'claude', pr: PR(401),
    value: 9, effort: 5,
    detail: 'GitHub rate limits (the app token shares the JoeKaulPulse account with the automation) were bottlenecking the board. Make the dashboard the single source of truth that works fully without GitHub; turn GitHub into an opt-in, debounced, rate-limit-aware mirror/wake.',
    notes: [
      'createBuildItem no longer auto-pushes — items live on the board. Mirroring is opt-in (github_mirror_enabled, default OFF); the cron sync only runs when it’s on.',
      'Rate-limit governor: noteGhResponse reads x-ratelimit headers and arms github_backoff_until; pushToGithub/syncAll/wake all skip while backed off and recover automatically.',
      'Continue + owner-input triggers are DB-first: requestClaudeContinue/triggerClaude always record to the work queue; a GitHub @claude wake is a best-effort, debounced extra (≤1 per 10 min, only when mirror on + not limited).',
      'pendingWork(): Claude reads the next actionable items (queue, ideas to triage, open bugs, awaiting sign-off) straight from the dashboard — no GitHub round-trip. Surfaced on GET.',
      'UI: mirror on/off toggle + “GitHub cooling down” indicator; continue/sync messages reflect the DB-native queue.',
    ],
  },
  {
    title: 'Build board v2 — rich tasks, sub-tasks, sign-off, multi-view, continue + activity', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(398),
    value: 8, effort: 7,
    detail: 'Owner-directed board overhaul: stop owner-input tasks re-bouncing; expand task data (time auto, tokens self-reported, ETA, value/effort, notes, comments, @mentions, sub-tasks with statuses, owner-input auto-trigger); shipped ≠ closed (admin sign-off → CLOSED, then reopen/comment/new tasks); easy idea capture auto-triaged; a "Continue working" button to wake Claude + a live activity ticker; and multiple views (kanban, list, timeline/waterfall).',
    notes: [
      'Workflow fix (#396): owner-input tasks no longer re-bounce — once the owner responds, Claude keeps it and pulls BLOCKED → TRIAGE to action.',
      'Backend (#397): CLOSED status; BuildSubtask; value/effort/startedAt/ETA/tokens/closedAt; sign-off + reopen (admin only); @mention notifications; ideas auto-bridge to GitHub; requestClaudeContinue/triggerClaude (GitHub wake); buildActivity feed.',
      'UI (#398): activity ticker, Continue button, kanban/list/timeline views, rich modal (subtasks + telemetry + sign-off), 💡 idea capture.',
      'Decisions captured: Continue = GitHub-issue trigger; time auto-derived, tokens self-reported (best-effort); sign-off/close & reopen restricted to admins (OWNER/ADMIN).',
    ],
  },
  {
    title: 'Email lifecycle: post-course check-in, NPS, membership renewal', type: 'TASK', urgency: 'P3', status: 'SHIPPED', assignee: 'claude',
    detail: 'Remaining lifecycle emails/automations, to be built opt-in (default OFF) like the others.',
    notes: ['All three shipped, opt-in (default OFF): NPS survey (lib/nps.ts + /nps/[token] + /admin/nps) and post-course check-in fire on booking completion; membership renewal runs in lib/automations.ts. No-show rebooking note also wired on the no-show action.'],
  },
  {
    title: 'P0 session replay: fix rrweb-player v2 white-box (use rrweb.Replayer directly)', type: 'ERROR', urgency: 'P0', status: 'SHIPPED', assignee: 'claude', pr: PR(479),
    value: 8, effort: 2,
    detail: 'rrweb-player v2.0.1 ships with a broken Svelte runtime where on_mount is empty and onMount is never exported, causing the internal Replayer to never instantiate — the replay modal showed a white box. Fix: replace rrweb-player with a direct rrweb.Replayer instantiation in components/admin/ReplayList.tsx, with Play/Pause controls, elapsed/total timer, and proper cleanup on modal close.',
    notes: ['Shipped (#479): ReplayList.tsx rewritten to use rrweb.Replayer directly (dynamic import). Adds Play/Pause button + elapsed timer; skipInactive, showWarning/showDebug=false; finish + state-change event listeners for UI sync; setInterval ticker for elapsed time; proper destroy() on unmount. Bypasses rrweb-player entirely.'],
  },
  {
    title: 'P0 heatmap preview: iframe broken-page icon (sandbox too restrictive)', type: 'ERROR', urgency: 'P0', status: 'SHIPPED', assignee: 'claude', pr: PR(486),
    value: 7, effort: 1,
    detail: 'HeatmapViewer.tsx used sandbox="allow-same-origin allow-scripts" on the page-preview iframe. Despite the CSP fix (PR #474 frame-ancestors self), Safari and some Chromium builds showed a broken-page icon because the sandbox prevented the embedded page from fully initialising its browser context. Admin-only preview of the clinic own pages; sandbox provided no meaningful security. Fix: removed sandbox, added pointer-events-none so admins cannot accidentally navigate away by clicking preview links.',
    notes: ['Shipped (#486): Removed sandbox attribute from HeatmapViewer iframe; added pointer-events-none Tailwind class. tsc clean, one-line diff.'],
  },
  {
    title: 'Self-serve reschedule flow + confirmation email', type: 'TASK', urgency: 'P3', status: 'SHIPPED', assignee: 'claude', pr: PR(477),
    value: 6, effort: 5,
    detail: 'Clients can reschedule from the booking management page. Owner rules: 48h notice, max 3 free reschedules per booking (4th+ incurs full treatment fee), 24h cancel unchanged.',
    notes: [
      'Owner rules confirmed (2026-06-09): 48h to reschedule, 24h to cancel, 3 reschedules allowed before full-price charge applies.',
      'Built: Booking.rescheduleCount (schema), rescheduleBooking()+isWithin48h() in lib/booking-actions.ts, POST /api/booking/reschedule, slot-picker UI in ManageClient, tmplBookingRescheduled email, ToS updated in lib/info-pages.ts.',
    ],
  },
  {
    title: 'Resend domains: send via mail.kclinics.co.uk, reply via reply.mail.kclinics.co.uk', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(373),
    value: 7, effort: 2,
    detail: 'New DNS: mail.kclinics.co.uk = sending; reply.mail.kclinics.co.uk = reply emails + open/click tracking. Must apply across all products (transactional, campaigns, gift cards, chat, staff emails).',
    notes: ['Code reflected (#373): default From → hello@mail.<domain>; Reply-To → replies@reply.mail.<domain>; chat sends from mail.<domain> and routes replies to reply.mail.<domain>; go-live board updated with both domains + click-through links.', 'Owner confirmed the Vercel env + Resend dashboard config is done — task handed back to Claude. Owner-input trigger removed so it can’t re-bounce. Final live-confirmation handled by the post-ship review/sign-off step.'],
  },
  // ── Finance & tax (owner-directed; some gated on the Xero integration) ──────
  {
    title: 'Financial controls panel (refund window, profit rules, profitability by service)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 7, effort: 6,
    detail: 'A Finance → Financial controls admin panel for select users: set the refund window, define profit/margin rules, and monitor profitability by service (revenue − cost of goods/consumables − time).',
    notes: ['Refund window shipped (#382); VAT config shipped (#384); profitability-by-service shipped on Reports (#391); profit/margin rules + under-target alerts shipped (#392). Epic complete.'],
  },
  {
    title: 'VAT / tax configuration — per-service rate, inclusive/exclusive', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(384),
    value: 8, effort: 7,
    detail: 'Configurable VAT: per-service class (standard 20% / reduced / zero / exempt — dentistry exempt by default), inclusive/exclusive, finance-gated config, off until VAT-registered.',
    notes: ['Owner decisions captured: inclusive by default; off (No VAT) until registered; dentistry exempt, others standard 20%.', 'Foundation shipped (#384): lib/vat.ts + Finance → Financial controls VAT section + per-service vatClass. Display wiring (prices/receipts/reports) is the follow-up below.'],
  },
  {
    title: 'Apply VAT to prices, receipts & reports when registered', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(390),
    value: 6, effort: 5,
    detail: 'Now the VAT foundation exists (#384), surface it once vat_registered is on: show net/VAT/gross on the charge receipt + payment-action emails, a VAT line in reports, and VAT-aware price display. Uses lib/vat.vatBreakdown with each service’s effectiveVatClass.',
  },
  {
    title: 'In-dashboard bookkeeping + MTD (payroll, suppliers, bills, receipts) via Xero', type: 'TASK', urgency: 'P1', status: 'TRIAGE', assignee: 'claude', needs: 'OWNER',
    value: 9, effort: 10,
    ask: 'For the Xero integration (landing tonight/tomorrow): confirm the Xero org + which revenue/VAT account codes to post to, and the bookkeeping scope priority (payroll, supplier bills, bill payments, receipt capture). Goal: run day-to-day bookkeeping from the admin dashboard and rarely open Xero.',
    detail: 'Make the admin dashboard the bookkeeping cockpit: MTD-ready VAT returns, payroll, suppliers, paying bills, receipt capture/tracking — automated through the Xero integration so the owner rarely needs Xero directly. Builds on “Push sales + refunds to Xero”. Large, phased.',
    notes: ['MTD VAT submission has compliance requirements (HMRC-recognised software / Xero as the bridge) — scope carefully with the owner once Xero is connected.'],
  },
  {
    title: 'Phone booking flow — staff book for new/existing clients + card-link confirm', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(383),
    value: 9, effort: 6,
    detail: 'A guided, best-in-class admin flow for taking bookings over the phone: any staff user finds an existing client (or creates a new one with email + phone for reminders), picks treatment + time, holds the slot, and the client is emailed a secure link to save their card and confirm — never reading card details over the phone (PCI-safe). A read-out T&C/confirmation dialogue script for staff, and if a card is already on file, a confirm-on-the-call path. Consent forms continue to go via the existing secure links.',
  },
  {
    title: 'Push sales + refunds to Xero (invoice on charge, credit note on refund)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(491),
    value: 6, effort: 6,
    detail: 'Today Xero is read-only (cash position + supplier bills). To make refunds a true accounting event we need to push the sales side too: on a booking charge, create an ACCREC invoice + payment in Xero; on a refund, raise a credit note / refund against it. Refunds already net out of admin revenue (#380) and fire a GA4 refund event — this closes the loop into the books.',
    notes: [
      'Needs owner input on Xero account codes + tax treatment (which revenue account, VAT rate) before posting, so the books stay clean.',
      'Build charge→invoice first (the counterpart that doesn’t exist yet), then refund→credit-note; idempotent + audited like the rest.',
      'Shipped (#491): charge → ACCREC invoice (+ payment when a bank account code is set); refund → ACCRECCREDIT credit note (+ cash refund). Idempotent via a Booking.xeroInvoiceId claim; every push audited. OFF by default — owner enables with the xero_sales_push setting once account codes are confirmed (xero_sales_account, default 200 Sales; xero_bank_account, unset = invoices post as awaiting payment). Tax follows the VAT settings (registered → 20% inclusive, else no tax). Requires one Xero reconnect to grant the new write scopes (accounting.transactions + accounting.contacts).',
    ],
  },
  {
    title: 'Build board phase 2: public roadmap + release announcements', type: 'IDEA', urgency: 'P3', status: 'SHIPPED', assignee: 'claude',
    value: 4, effort: 6,
    detail: 'Public "coming soon"/changelog fed by items flagged public, and auto-drafted on-brand release announcements when a feature ships.',
    notes: ['Shipped: isPublic toggle in the task modal (manager only); updateBuildItem handles isPublic + auto-drafts a release event when a public item ships; listPublicItems() query; public GET /api/build/public endpoint (no auth, cached); /roadmap marketing page with "Coming soon" and "What\'s new" sections.'],
  },

  // ── Reliability ───────────────────────────────────────────────────────────
  {
    title: 'P0 outage on new-stack deploys: 500s on every DB route (broken Turbopack external symlinks)', type: 'ERROR', urgency: 'P0', status: 'SHIPPED', assignee: 'claude', pr: PR(489),
    value: 10, effort: 3,
    detail: 'The first deploy that survived #487+#488 went live and 500d on every dynamic route with "Failed to load external module ...: Cannot find module". Owner rolled production back to the last known-good build. Two stacked causes from the Next 16 / Prisma 7 upgrades: (1) lib/db.ts loads the pg driver adapter via dynamic require("@prisma/adapter-pg"), which Turbopack neither bundles nor traces, so the module was absent from all 336 function bundles. (2) Deeper: Turbopack compiles externalised server packages as hash-aliased requires (require("@prisma/client-<hash>")) backed by symlinks in .next/node_modules - and because stray lockfiles above the project (e.g. on the Vercel builder) made Next infer the wrong workspace root, the symlink targets escaped the project directory (../../../<dirname>/node_modules/<pkg>) and broke inside the lambda filesystem. Every route that touches lib/db.ts threw at require time; static pages and the non-DB /og function were fine.',
    notes: [
      'Diagnosis trail: runtime logs showed "Cannot find module" + matched "external module @prisma" but not "adapter-pg"; /og (no DB) returned 200 on the same preview while every DB route 500d; compiled chunks contained require("pg-<hash>")/require("@prisma/client-<hash>"); .next/node_modules symlinks pointed to ../../../K-Clinics/node_modules/* (wrong root geometry, mirrors /vercel/path0 on the builder).',
      'Fix: (a) serverExternalPackages: [@prisma/client, @prisma/adapter-pg, @prisma/extension-accelerate, pg] so the adapter is traced into every function; (b) turbopack.root pinned to the project dir so external symlinks become project-relative (.next/node_modules/pg-<hash> -> ../../node_modules/pg, which maps to /var/task/node_modules/pg in the lambda). Also silences the "inferred workspace root" warning. Verified on a preview deploy (DB routes 200) before merging to production.',
      'Hygiene follow-up for owner: a stray /home/user/package-lock.json (83 bytes) exists above the repo in dev containers; harmless now that turbopack.root is pinned, but worth deleting if it reappears in tooling.',
    ],
  },
  {
    title: 'P0 deploys wedged on Vercel "Deploying outputs": OG route traced whole project', type: 'ERROR', urgency: 'P0', status: 'SHIPPED', assignee: 'claude', pr: PR(488),
    value: 10, effort: 2,
    detail: 'After the db-sync flag fix (#487) unblocked the prebuild, deploys built in 2 min then hung in Vercel "Deploying outputs" (the lambda upload step) for 15+ min and never went live. Root cause: lib/og.tsx reads images and fonts with a dynamic fs.readFileSync(path.join(process.cwd(), ...)) that Next 16 / Turbopack cannot statically analyse, so it traced the WHOLE project into every route that transitively imports it via lib/seo.tsx page metadata (~150 of 336 serverless functions). Each function bundled all 167 MB of public/treatments/ photos plus 18 MB of WordPress migration dumps under scripts/migrate-wp/ and import/content.json, pushing functions to ~220-230 MB - right against Vercel 250 MB uncompressed limit - which wedges the deploy. The live site stayed up on the last good (pre-upgrade) deployment the whole time; new code simply could not land.',
    notes: [
      'Diagnosed from the Vercel build log NFT warning ("the whole project was traced unintentionally", import trace ./lib/og.tsx -> ./app/og/route.tsx) plus du: public/treatments is 167 MB / 1329 files. Confirmed 150/336 function nft.json manifests carried the migration zips, public images, and import/content.json.',
      'Fix: next.config.mjs outputFileTracingExcludes drops public/, scripts/, import/, audit/, docs/, *.tsbuildinfo from all function bundles. Verified via the .next nft.json manifests: those refs went 150 -> 0 and the largest function fell from ~230 MB to 52 MB (og route 167 MB -> 43 MB). Fraunces display fonts (assets/fonts) stay bundled; images keep their runtime URL fallback. tsc + next build green.',
      'Follow-ups (non-blocking, deferred): the dynamic reads still trigger a whole-project trace so sharp (~32 MB) is still bundled into OG functions, and the Geist label font (node_modules/geist) is not traced on Next 16 (pre-existing, cosmetic). A root-cause fix would make lib/og.tsx use static/literal paths or turbopackIgnore; left out of this hotfix to avoid risk to the OG renderer.',
    ],
  },
  {
    title: 'P0 deploys all failing on Vercel: Prisma 7 removed db-sync CLI flags', type: 'ERROR', urgency: 'P0', status: 'SHIPPED', assignee: 'claude', pr: PR(487),
    value: 10, effort: 1,
    detail: 'Every Vercel deploy (production + previews) errored in the prebuild step after the Prisma 6->7 upgrade. Root cause: scripts/db-sync.mjs used CLI flags that Prisma 7 removed/renamed. (1) prisma migrate diff still used --from-url and --to-schema-datamodel; Prisma 7 removed --from-url (use --from-config-datasource, which reads the URL from prisma.config.ts) and renamed --to-schema-datamodel to --to-schema. The invalid flag exited 1, which the pre-check misread as could-not-reach-database and retried 6 times. (2) prisma db push still passed --skip-generate, which Prisma 7 removed (db push no longer generates the client); the unknown flag made Prisma print usage and exit non-zero on all 5 retries, so failBuild() failed the deploy. tsc + next build always passed locally, so it only surfaced as a Vercel deploy ERROR.',
    notes: [
      'Diagnosed from the Vercel build logs: db push printed its help text instead of running, and the diff pre-check failed 6x with could-not-reach-database. Reproduced locally against Prisma 7.8.0: the old --from-url errors with "--from-url was removed", the new --from-config-datasource gets past flag parsing to a real connection attempt (P1001).',
      'Fix: scripts/db-sync.mjs migrate-diff now uses --from-config-datasource --to-schema; db push drops --skip-generate. Also fixed the same stale flags in the local dev helper scripts/safe-migrate.mjs. The injected DATABASE_URL flows through prisma.config.ts datasource.url for both commands. tsc + next build green.',
    ],
  },
  {
    title: 'Keep booking flow + client site up during deploys', type: 'ERROR', urgency: 'P0', status: 'SHIPPED', assignee: 'claude', pr: PR(335),
    value: 9, effort: 4,
    detail: 'Client-facing pages and the booking flow must not 500 during deploys / cold starts. Apply the same hardening as the admin fix: wrap client/booking server reads in withDbRetry with graceful fallbacks, ensure no build-time DB dependency can break prerender, and cache/ISR where safe so the hot path survives a connection blip.',
    notes: [
      'Top priority — booking being unavailable during deploys costs bookings. Extends the connection_limit/Accelerate work (#306) to every client-facing read.',
      'Shipped across #335 (booking APIs + post-booking pages), #336 (root cause: getCurrentClient request-cached + retried; getDashboard/loyalty/booking-start hardened), #337 (board/audit reliability). Remaining deepest fix is operational: confirm prod uses the pooled prisma+postgres:// URL — now visible on the new /admin/status page.',
    ],
  },

  // ── Gift cards (Products → Gifts) ─────────────────────────────────────────
  // Built on the existing gift-voucher purchase/Stripe/email + guest-checkout
  // and Product(DRAFT)/Order systems — a personalisation + physical-fulfilment +
  // IA layer, sequenced by value-to-effort.
  {
    title: 'Gifts: section + giftable-package drafts (admin foundation)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(365),
    value: 7, effort: 4,
    detail: 'A "Gifts" grouping under Products holding gift cards + giftable packages. Add the gift_card_physical_enabled setting (admin on/off). Generate curated giftable packages (from lib/packages.ts) as DRAFT products for the owner to review and publish.',
  },
  {
    title: 'Gifts: interactive gift-card studio (customise + guest checkout)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(366),
    value: 9, effort: 6,
    detail: 'An extra-special, interactive page to design a gift card — theme/colour, recipient, message, amount, delivery date — with a live preview, emailed to the recipient. Anyone can buy (no account needed), reusing the existing guest checkout + Stripe.',
  },
  {
    title: 'Gifts: render & email the customised card', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(367),
    value: 7, effort: 5,
    detail: 'Persist the customisation and render the chosen design into the recipient email (theme-aware card, Outlook-safe) + a shareable “view your card” page reusing the studio preview. New tmplCustomGiftCard template.',
  },
  {
    title: 'Gifts: physical gift-card upgrade + fulfilment (admin-toggleable)', type: 'TASK', urgency: 'P3', status: 'SHIPPED', assignee: 'claude', pr: PR(371),
    value: 6, effort: 5,
    detail: 'Optional paid upgrade to a physical card posted to the recipient — shown only when the admin enables it (gift_card_physical_enabled), with a configurable fee, shipping address capture, and an admin fulfilment view (print/queue/mark posted).',
  },
  {
    title: 'Gifts: giftable packages purchasable as gifts', type: 'TASK', urgency: 'P3', status: 'SHIPPED', assignee: 'claude', pr: PR(395),
    value: 6, effort: 5,
    detail: 'Let an approved giftable package be bought as a gift (earmarked voucher / package gift), shown in the Gifts section, guest checkout, with the same customised-card experience.',
    notes: ['Shipped (#395): published gift packages surface in a "Gift a package" section on /gift-vouchers; buying one creates a fixed-value voucher earmarked to the package (price resolved server-side), with the same custom card, scheduled delivery, receipt + claim flow. Owner controls supply by pricing & publishing the seeded Gift package drafts under Products.'],
  },
  {
    title: 'Gifts: recipient experience (claim, scheduled delivery, share)', type: 'TASK', urgency: 'P3', status: 'SHIPPED', assignee: 'claude', pr: PR(367),
    value: 5, effort: 4,
    detail: 'Polish the recipient side: scheduled delivery, claim-to-account, balance view, and a shareable card page — end to end.',
  },

  // ── Staff notifications & secured finance (decisions captured) ─────────────
  {
    title: 'In-app notification centre + easy idea submission with feedback', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(369),
    value: 8, effort: 5,
    detail: 'A StaffNotification model + bell in the admin shell so all users see tasks/actions to complete; notify on assignment/comment. Make it effortless to add an idea to the board, and notify the submitter when it gets feedback or a status change.',
  },
  {
    title: 'Staff lifecycle emails (re-engagement + weekly digest + more)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(370),
    value: 6, effort: 5,
    detail: 'Email staff about work assigned to them if idle ≥8h; a weekly Monday work-summary digest (on by default), pointing admins to secured reports. Plus other staff emails: task assigned, comment/mention reply, time-off decision, low-stock to the responsible person, day-close reminder, security alerts.',
    notes: ['Decisions captured: re-engagement threshold 8h; weekly Monday digest, on by default (each staff can opt out).'],
  },
  {
    title: 'Financial data unlock: passkey + 6-digit PIN', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 8, effort: 7,
    detail: 'Gate financial reports / cashflow / finance KPIs behind a second factor: a passkey (Face ID / Touch ID / Windows Hello via the existing WebAuthn) with a 6-digit PIN fallback. Add a "finance" step-up purpose + short-lived unlock.',
    notes: [
      'Decision captured: passkey + 6-digit PIN fallback (reuses existing WebAuthn/TOTP infra + step-up unlock pattern).',
      'PIN fallback SHIPPED (#372): reports + cashflow sit behind a 6-digit PIN (30-min finance step-up).',
      'Passkey path SHIPPED (#394): the shared WebAuthn step-up routes now accept the "finance" purpose (gated by finance.view, 30-min unlock) and the lock screen offers a Face ID / passkey button. Epic complete.',
    ],
  },

  // ── Platform observability ────────────────────────────────────────────────
  {
    title: 'System status & health page (traffic-light, Owner/Admin only)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(339),
    value: 8, effort: 5,
    detail: 'A compartmentalised audit page (Owner/Admin only) showing each service/connection, tool, admin section, database and security control as a red/amber/green light — each with detailed information underneath (not just "connected": the actual signal — e.g. DB connection mode pooled vs direct, schema in sync, integration env present, last cron run, passkey/2FA coverage, encryption self-test). Reuses the existing /api/health probes + lib/integrations. Compartmentalised in line with the ClinicOS bounded contexts so it maps cleanly onto the future per-cluster status.',
    notes: ['Foundation for the SaaS §10/§12 "status page" requirement; built on current architecture first, generalised per-tenant later.'],
  },
  {
    title: 'Planned-maintenance announcements (Claude-authored)', type: 'TASK', urgency: 'P3', status: 'SHIPPED', assignee: 'claude', pr: PR(339),
    value: 5, effort: 3,
    detail: 'A maintenance-window model Claude (and admins) can schedule + announce: title, window, affected services, impact note. Shown on the status page; can later surface to staff/clients. Grants Claude the ability to plan and post maintenance windows ahead of risky work.',
  },

  // ── ClinicOS — multi-tenant SaaS programme (migrated from docs/PLATFORM_SAAS_PLAN.md) ──
  // Planning only — nothing here is executed without explicit owner sign-off. Live
  // revenue is sacred; the programme runs in a separate environment and is read-only
  // on prod until a gated cutover. Canonical doc: docs/PLATFORM_SAAS_PLAN.md (v0.2).
  {
    title: 'ClinicOS — multi-tenant SaaS platform (programme epic)', type: 'IDEA', urgency: 'P3', status: 'TRIAGE', assignee: 'claude',
    value: 9, effort: 10,
    detail: 'Evolve the K Clinics monolith into a modular, containerised, multi-tenant SaaS ("ClinicOS") that K Clinics operates for itself (tenant #1) and licences to other clinics. Strangler-fig extraction; multi-tenant by construction; live revenue never at risk. Canonical plan: docs/PLATFORM_SAAS_PLAN.md (v0.2).',
    notes: [
      'Leadership decisions logged (§17, 2026-06-08): GCP London (europe-west2) + GKE; hire in-house SRE; both named brand + white-label tier; conservative ~4-week bake + instant DNS rollback; defer pricing tiers until COGS modelled; phased certs (Cyber Essentials → NHS DSPT → ISO 27001 → SOC 2); bootstrapped, Phase 0 value first.',
      'Non-negotiables: no data loss ever; expand/contract migrations only on the shared prod DB; new platform read-only on prod until cutover; tenant isolation is a security boundary (RLS backstop).',
      'Attachment: the full plan lives at docs/PLATFORM_SAAS_PLAN.md (v0.2) — this epic + the phase tasks below mirror §11 of that document.',
    ],
  },
  {
    title: 'SaaS Phase 0 — modularise in place (monorepo, affected-only builds)', type: 'TASK', urgency: 'P3', status: 'TRIAGE', assignee: 'claude',
    value: 8, effort: 7,
    detail: 'Turborepo/Nx monorepo + remote caching + affected-only builds; enforce module boundaries; extract framework-agnostic domain packages shared by both tracks. No infra change. Exit gate: live build cost per change ↓ ≥50%; boundary lint green; live unaffected. This is the front-loaded value step (also reduces the deploy-herd pain) with zero infra risk.',
    notes: ['Proposed first concrete spike (§18.2): move one domain (e.g. Learning) into a shared package and demonstrate affected-only builds.'],
    // The plan is explicit (§18.1): nothing executes until the owner baselines it.
    // Wiring that gate as a dependency keeps the phases out of the actionable
    // queue until sign-off, instead of looking like startable work.
    dependsOn: ['SaaS — final sign-off to baseline the platform plan'],
  },
  {
    title: 'SaaS Phase 1 — platform foundation (K8s, gateway, identity, observability)', type: 'TASK', urgency: 'P3', status: 'TRIAGE', assignee: 'claude',
    value: 7, effort: 9,
    detail: 'New isolated Vercel project + managed GKE, API gateway/BFF, Identity & RBAC, event bus, OpenTelemetry observability, GitOps, secrets via External Secrets/KMS. Containerise the monolith and run it in-cluster (still one workload), read-only on prod DB. Exit gate: monolith serves in-cluster from a replica; tracing end-to-end; DR drill #1 passes.',
    dependsOn: ['SaaS Phase 0 — modularise in place (monorepo, affected-only builds)'],
  },
  {
    title: 'SaaS Phase 2 — tenancy layer (tenant_id + RLS, backfill tenant #1)', type: 'TASK', urgency: 'P3', status: 'TRIAGE', assignee: 'claude',
    value: 8, effort: 9,
    detail: 'Add non-null tenant_id (expand-only) + Postgres Row-Level Security as the backstop; backfill K Clinics as tenant #1 (additive, no destructive change); resolve tenant context at the edge; billing/metering skeleton; automated cross-tenant isolation tests. Exit gate: isolation tests pass; K Clinics runs as a tenant in staging with zero data change in prod.',
    notes: ['Isolation model (ADR-003): pooled + RLS by default; bridge (schema-per-tenant); silo (dedicated DB/region) on demand for enterprise/PHI.'],
    dependsOn: ['SaaS Phase 1 — platform foundation (K8s, gateway, identity, observability)'],
  },
  {
    title: 'SaaS Phase 3 — first service extraction (Content/CMS behind the gateway)', type: 'TASK', urgency: 'P3', status: 'TRIAGE', assignee: 'claude',
    value: 6, effort: 6,
    detail: 'Extract Content/CMS (or Learning) — lowest coupling — behind the gateway to prove contracts, events, per-tool pipeline, deploy and rollback. Exit gate: one tool deploys to staging independently; contract tests gate; parity vs monolith.',
    dependsOn: ['SaaS Phase 2 — tenancy layer (tenant_id + RLS, backfill tenant #1)'],
  },
  {
    title: 'SaaS Phase 4 — extract by value/coupling (Payments & CRM/Clinical last)', type: 'TASK', urgency: 'P3', status: 'TRIAGE', assignee: 'claude',
    value: 7, effort: 9,
    detail: 'Strangle the remaining bounded contexts in order: Marketing → Commerce → Loyalty → Booking; Payments and CRM/Clinical (PHI) extracted last with the highest care. Each tool gets its own pipeline, SLOs, isolation, parity and rollback. Treatment-lifecycle chain becomes durable sagas with idempotent handlers.',
    dependsOn: ['SaaS Phase 3 — first service extraction (Content/CMS behind the gateway)'],
  },
  {
    title: 'SaaS Phase 5 — cutover (shadow at load → DNS blue/green → bake)', type: 'TASK', urgency: 'P3', status: 'TRIAGE', assignee: 'claude',
    value: 7, effort: 8,
    detail: 'Run the new platform in production-shadow at real load; migrate Stripe webhooks, OAuth redirect URIs, email links and passkey rpID before cutover; cutover = a DNS repoint (blue/green); ~4-week bake with the old env hot; instant DNS rollback. Gated behind every §12 check incl. pen test + DR drill.',
    dependsOn: ['SaaS Phase 4 — extract by value/coupling (Payments & CRM/Clinical last)'],
  },
  {
    title: 'SaaS Phase 6 — commercial launch (onboarding, plans, white-label, pilot)', type: 'TASK', urgency: 'P3', status: 'TRIAGE', assignee: 'claude',
    value: 7, effort: 8,
    detail: 'Self-serve tenant onboarding (idempotent seeds), plan entitlements + metering, white-label public site/theming, status page, support — and a first external pilot clinic on pooled tenancy with the SLA instrumented. Runs in parallel from Phase 2.',
    // Per the plan this track runs in parallel FROM Phase 2 — so it gates on
    // Phase 2, not on the full extraction chain.
    dependsOn: ['SaaS Phase 2 — tenancy layer (tenant_id + RLS, backfill tenant #1)'],
  },
  {
    title: 'SaaS — DB safety: expand/contract migrations + PITR + DR drills', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 8, effort: 6,
    detail: 'Move the platform path off "prisma db push --accept-data-loss" to versioned, reviewed migrations; ban data-loss flags on any prod path; pre-step snapshots; continuous backups + tested PITR restores; RPO/RTO per data class (PHI: RPO ≤5min, RTO ≤1h) proven by DR drills. (ADR-004.)',
    notes: [
      'Directly hardens the highest-risk area (§6) and the connection-exhaustion failure mode we already hit.',
      'Shipped (code side): --accept-data-loss removed from db-sync.mjs (destructive schema changes now fail the build deliberately); USE_MIGRATIONS=true env var switches to prisma migrate deploy (safe versioned path); scripts/safe-migrate.mjs wraps prisma migrate dev with diff preview + optional Neon branch snapshot; prisma/migrations/README.md documents the baseline creation process, expand/contract pattern, and RPO/RTO targets. Owner action: run prisma migrate dev --name init against a DB copy to create the baseline, commit it, then set USE_MIGRATIONS=true in Vercel.',
    ],
  },
  {
    title: 'SaaS — security & compliance roadmap (CE → DSPT → ISO 27001 → SOC 2)', type: 'TASK', urgency: 'P3', status: 'TRIAGE', assignee: 'claude',
    value: 7, effort: 8,
    detail: 'Phased certifications as a sellable trust signal: Cyber Essentials (quick), NHS DSPT, ISO 27001, then SOC 2 Type II. Clinical/PHI zone with per-tenant envelope encryption, zero-trust mTLS, DSAR/erasure per tenant, sub-processor register, UK/EU data residency, annual + pre-cutover pen test. (§10, ADR-011.)',
    dependsOn: ['SaaS — final sign-off to baseline the platform plan'],
  },
  {
    title: 'SaaS — final sign-off to baseline the platform plan', type: 'TASK', urgency: 'P3', status: 'BLOCKED', needs: 'OWNER',
    value: 7, effort: 1,
    ask: 'Review docs/PLATFORM_SAAS_PLAN.md (v0.2) and confirm you approve it as the programme baseline (the §17 leadership decisions are logged; only final sign-off remains). Reply “approved” to baseline it, or tell me what to change. Nothing executes against live until you do.',
    detail: 'The plan is explicitly planning-only until signed off (§18.1). This is the gate before any Phase 0 spike begins.',
  },
  {
    title: 'SaaS — confirm pricing tiers & amounts (after COGS model)', type: 'TASK', urgency: 'P3', status: 'BLOCKED', needs: 'OWNER',
    value: 6, effort: 1,
    ask: 'Once I’ve modelled COGS at 10 / 100 / 500 tenants, you decide the tier names, what each includes, and the prices (Solo / Clinic / Chain / Enterprise + usage components). Deliberately deferred per decision #5 — entitlement/metering is being built tier-agnostic so this is pure configuration later.',
    detail: 'Deferred decision from §17 — pricing must follow the unit-economics model, not precede it.',
  },
  {
    title: 'Verify mail.kclinics.co.uk in Resend (sending + inbound)', type: 'TASK', urgency: 'P1', status: 'SHIPPED',
    value: 7, effort: 1,
    detail: 'Chat email sends from chat@mail.kclinics.co.uk and replies route via Resend Inbound — both need mail.kclinics.co.uk verified (DKIM/SPF for sending; CNAME+CAA+MX for inbound).',
    notes: ['Owner action with the new DNS access — tracked on the Go-live page (with-owner filter).', 'Owner confirmed the domain DNS is added and verified in Resend — owner-input trigger removed so it can’t re-bounce. Final live-confirmation handled by the post-ship review/sign-off step.'],
  },
  {
    title: 'IPL service catalogue + which treatments/prices', type: 'TASK', urgency: 'P3', status: 'BLOCKED',
    value: 4, effort: 2, needs: 'CLINICAL',
    ask: 'List the exact IPL treatments you offer with prices — single-session and any course pricing, e.g. “IPL Photofacial (face) £150 · course of 3 £400”, “IPL for rosacea/redness £180”. Reply with the full list and I’ll curate the IPL page so only those treatments show, at your prices.',
    detail: 'The IPL page is live but the catalogue shows all services until curated.',
    notes: ['Needs clinical input: the exact IPL treatments + prices, then I’ll wire the service so only those show.'],
  },
  {
    title: 'S7 — migrate client data from the old system', type: 'TASK', urgency: 'P2', status: 'BLOCKED',
    value: 6, effort: 6, needs: 'OWNER',
    ask: 'Tell me where your existing client records live (which booking/CRM system, a CSV/Excel export, or paper), roughly how many clients, and which fields to bring across (name, email, phone, DOB, marketing opt-in, notes, treatment history?). If you can attach a sample export (even 5–10 rows, anonymised), I’ll write a tested importer and run it on a copy first.',
    detail: 'Bring across existing client records.',
    notes: ['Needs owner input: where the old records live (system/CSV/paper), rough volume, and what to bring across. Then I can write an importer.'],
  },

  // ── Security & Compliance Audit Remediation ─────────────────────────────────
  // The 10-area audit (audit/ on the branch) found 3 Critical + 14 High (unique,
  // after deduping cross-area overlaps). Each is tracked below under the
  // 'audit-remediation' project; the epic gates on all of them. Statuses flip to
  // SHIPPED as each fix lands. Canonical detail: audit/SUMMARY.md + per-area NN-*.md.
  {
    title: 'Security & Compliance Audit Remediation — epic', type: 'TASK', urgency: 'P0', status: 'SHIPPED', assignee: 'claude', project: 'audit-remediation',
    value: 10, effort: 9,
    detail: 'Umbrella for the audit fix-up: remediate every Critical + High finding from the 10-area codebase audit. Gates on the 17 component items below. See audit/SUMMARY.md for the consolidated rollup, remediation order and systemic root causes.',
    notes: [
      'Formed from the full-codebase audit. Risk concentrates in data-at-rest protection, GDPR data-subject handling, missing HTML sanitization and a few concurrency races — not the API/auth surface, which reviewed strongly.',
      'Outcome: ALL 17 component items SHIPPED — both XSS Highs + email injection, the 2 auth Highs, all 3 concurrency races incl. the booking-double-booking Critical, replay-ingest gating, build/db-sync, both OAuth Highs, the GDPR erasure Critical + clinical-access audit + marketing-consent evidence + questionnaire consent, and C3 encrypt-health-PII-at-rest (new lib/clinical-crypto keyring encryption at every write + tolerant decrypt at every read via the crm-data access layer, with the search tradeoff handled and an idempotent owner-gated backfill for historic rows). Each fix was type-checked + production-build-validated and merged to main; full detail in audit/SUMMARY.md.',
    ],
    dependsOn: [
      'AUDIT C1: Booking slot allocation race — add transaction + uniqueness',
      'AUDIT C2: Right-to-erasure leaves health & personal data behind',
      'AUDIT C3: Encrypt special-category (health) + contact PII at rest',
      'AUDIT H: Cross-portal JWT confusion — separate secrets + aud/typ claims',
      'AUDIT H: Deactivated clients keep portal access until token expiry',
      'AUDIT H: Gift card double-spend across concurrent orders',
      'AUDIT H: Inventory stock movement TOCTOU race',
      'AUDIT H: Build-time prisma db push mutates production DB',
      'AUDIT H: OAuth refresh token stored plaintext at rest',
      'AUDIT H: No audit record when clinical data is decrypted for viewing',
      'AUDIT H: Marketing consent has no timestamp/version/source/lawful-basis',
      'AUDIT H: Medical questionnaires capture no privacy-notice/granular consent',
      'AUDIT H: Unauthenticated session-replay ingest endpoint',
      'AUDIT H: Google Calendar OAuth callback missing CSRF state nonce',
      'AUDIT H: Raw-HTML Journal block renders unsanitized (stored XSS)',
      'AUDIT H: Imported WordPress HTML rendered unsanitized (stored XSS)',
      'AUDIT H: Marketing/automation emails inject client data unescaped',
    ],
  },
  // ── Critical ────────────────────────────────────────────────────────────────
  {
    title: 'AUDIT C1: Booking slot allocation race — add transaction + uniqueness', type: 'ERROR', urgency: 'P0', status: 'SHIPPED', assignee: 'claude', project: 'audit-remediation',
    value: 10, effort: 4,
    detail: 'app/api/booking/create/route.ts + lib/availability.ts: slot allocation has no transaction, row lock or unique constraint, so two concurrent requests can book the same slot/room/staff. Fix: allocate inside a Serializable transaction that re-checks availability, plus a DB uniqueness guard on the slot key. (audit/04-data-prisma.md)',
    notes: ['Shipped: the slot recheck + booking.create now run in ONE Serializable $transaction (mirrors redeemPromo/awardClientPoints) with ALL reads on the tx client — safe under the serverless connection_limit=1 pool. It re-reads overlapping PENDING/CONFIRMED holds and rejects a concurrent grab of the same precomputed practitioner/resource; Postgres SSI aborts the write-skew loser, mapped to a retryable 409. Remaining defence-in-depth: a DB EXCLUDE USING gist (tstzrange) constraint — left as a follow-up because it needs a raw migration + btree_gist + dedup of any existing overlapping rows.'],
  },
  {
    title: 'AUDIT C2: Right-to-erasure leaves health & personal data behind', type: 'ERROR', urgency: 'P0', status: 'SHIPPED', assignee: 'claude', project: 'audit-remediation',
    value: 9, effort: 5,
    detail: 'app/admin/actions.ts eraseClientData pseudonymises only the Client row and deletes interactions; consultations, encrypted health assessments, signed consents, before-photos, AI analyses, email metadata and call transcripts all remain. UK GDPR Art.17. Fix: erase/pseudonymise across every table holding the client\'s personal/health data (or document a lawful retention exemption per category). (audit/06-pii-compliance.md)',
    notes: ['Shipped: eraseClientData now runs ONE $transaction that — beyond pseudonymising the Client row (now incl. allergies) — strips clinical/PII free-text from RETAINED financial records (Booking notes/allergyNote/cancelReason/clinicalNote*, Consultation concerns/message/medicalNotes) and HARD-DELETES the special-category/personal child records with no retention basis: HealthAssessment, BeforePhoto, AiAnalysis (+images cascade), SignedConsent, Review, NpsResponse, FollowUp, EmailEvent, Interaction. The person is no longer re-identifiable and their medical history is gone, while HMRC-relevant booking/charge rows are kept pseudonymised. (deleteClient remains the full hard-delete option.)'],
  },
  {
    title: 'AUDIT C3: Encrypt special-category (health) + contact PII at rest', type: 'TASK', urgency: 'P0', status: 'SHIPPED', assignee: 'claude', project: 'audit-remediation',
    value: 9, effort: 7,
    detail: 'Client.allergies/medicalFlag, Consultation.medicalNotes/concerns/message, Booking.allergyNote (and contact PII: DOB/phone) are stored plaintext OUTSIDE the existing AES-256-GCM keyring, so a DB-read compromise exposes medical data directly (GDPR Art.9). Fix: route these through lib/crypto (encrypt-at-write, tolerant decrypt-at-read for legacy plaintext); owner runs a one-time backfill. (audit/06 + 04)',
    notes: ['Shipped: new lib/clinical-crypto.ts (encClinical/decClinical over the existing HEALTH_ENCRYPTION_KEY keyring; decrypt TOLERATES legacy plaintext). Encrypt-at-write at every write site (admin/medical-flag route, booking/start allergies+allergyNote, consult route concerns+message). Decrypt-at-read centralised in the crm-data access layer (getClient/getConsultation/getBooking cover the client/consultation/booking detail pages) + explicit decrypt at the SAR export, the booking visitPrefs query and the admin-search snippet. Presence-only checks (my-day badge, calendar/search ⚠, readiness/clinical-actions logic) work unchanged on ciphertext — each was verified to render a badge, not the flag text.', 'Search tradeoff (documented in the route): consultation concerns/message are no longer text-matchable once encrypted — consultations are searched by client name. Existing plaintext rows stay readable (tolerant) and encrypt on next write; an idempotent, owner-gated backfill (POST /api/admin/maintenance/backfill-clinical-encryption) upgrades historic rows. Out of scope (noted): Interaction.detail (a general mixed-use notes field). Validated: tsc clean + next build compiled successfully (local SSG errors are env-only — no DB in the container; the PR Vercel build validates against a real DB).'],
  },
  // ── High ──────────────────────────────────────────────────────────────────────
  {
    title: 'AUDIT H: Cross-portal JWT confusion — separate secrets + aud/typ claims', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', project: 'audit-remediation',
    value: 8, effort: 3,
    detail: 'lib/auth-edge.ts: client/academy secrets fall back to ADMIN_JWT_SECRET and no token carries an aud/typ claim, so identical-shape client/academy tokens are interchangeable across portals. Fix: per-portal secrets + set and verify aud/typ on every token. (audit/01-auth-authz.md)',
    notes: ['Shipped: each portal token now carries an aud claim (kc-admin/kc-client/kc-academy) set on sign (lib/auth.ts) and REQUIRED on jwtVerify (lib/auth-edge.ts), so secret reuse can no longer let a token cross portals — audience binding is the real isolation boundary. Added a one-time prod warning when CLIENT/ACADEMY_JWT_SECRET falls back to a shared value. One-time effect: existing tokens (no aud) are rejected, so users re-login once on deploy.'],
  },
  {
    title: 'AUDIT H: Deactivated clients keep portal access until token expiry', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', project: 'audit-remediation',
    value: 7, effort: 2,
    detail: 'lib/client-auth.ts getCurrentClient never rechecks portalActive (admin/academy paths do), so a deactivated client keeps access for up to the 7-day token life. Fix: re-check portalActive (and active/deleted) on each request. (audit/01-auth-authz.md)',
    notes: ['Shipped: getCurrentClient now rechecks portalActive on every request (React-cached, so no extra DB load) and returns null for deactivated clients — mirrors getCurrentStudent. A deactivated client loses portal access immediately instead of keeping it until the 7-day token expires. Confirmed portalActive is set true at register/activate/reset, so live clients are unaffected.'],
  },
  {
    title: 'AUDIT H: Gift card double-spend across concurrent orders', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', project: 'audit-remediation',
    value: 8, effort: 4,
    detail: 'app/api/shop/checkout/route.ts + lib/shop.ts: a gift card balance is read and the discount reserved against the new order, but only decremented later in finalizeOrder, so parallel checkouts each reserve the full balance. Fix: reserve/decrement the balance atomically at checkout. (audit/02-payments-finance.md)',
    notes: ['Shipped: new reserveVoucher() atomically decrements the live balance at checkout (guarded updateMany, balancePence >= want) BEFORE the Stripe PaymentIntent, so concurrent checkouts can no longer each apply the full balance. finalizeOrder no longer redeems (that would double-decrement); the two checkout failure paths re-credit via creditVoucher(). Caveat noted: an abandoned (unpaid) order leaves the amount reserved until an expiry job re-credits — self-limiting to the buyer\'s own card, not clinic loss.'],
  },
  {
    title: 'AUDIT H: Inventory stock movement TOCTOU race', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', project: 'audit-remediation',
    value: 7, effort: 2,
    detail: 'app/api/admin/inventory/route.ts: the negative-stock guard sits outside the transaction, so concurrent movements can drive stock negative. Fix: move the read+guard+write inside a single $transaction (Serializable) or use an atomic conditional update. (audit/04-data-prisma.md)',
    notes: ['Shipped: the negative-stock guard is now an ATOMIC conditional update (updateMany where currentQty >= |delta|) wrapped with the movement insert in one interactive $transaction. Two concurrent USED movements can no longer both pass the check and drive on-hand negative; an insufficient-stock attempt returns the live on-hand count.'],
  },
  {
    title: 'AUDIT H: Build-time prisma db push mutates production DB', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', project: 'audit-remediation',
    value: 8, effort: 3,
    detail: 'package.json prebuild → scripts/db-sync.mjs runs `prisma db push` against prod on every deploy, mutating the schema and failing the deploy if the DB is unreachable. Fix: do not mutate prod schema from prebuild by default; prefer versioned `prisma migrate deploy` (USE_MIGRATIONS) and make build resilient to DB unavailability. Also fix the db-sync.mjs sleep() TDZ bug. (audit/10 + 04)',
    notes: ['Shipped: (1) fixed the sleep() TDZ ReferenceError (const used before declaration) that crashed the retry/backoff in the USE_MIGRATIONS migrate-deploy path — the recommended decoupled path now actually works; (2) added opt-in DB_SYNC_NONFATAL=true so a code-only deploy proceeds when the DB is briefly unreachable instead of failing the build (decouples deploy from DB liveness), default stays fail-fast. Fully eliminating build-time db push is the USE_MIGRATIONS path — owner action to create + commit the baseline migration, tracked in the "SaaS — DB safety" item.'],
  },
  {
    title: 'AUDIT H: OAuth refresh token stored plaintext at rest', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', project: 'audit-remediation',
    value: 7, effort: 3,
    detail: 'Staff Google Calendar refresh token is stored plaintext on AdminUser (schema.prisma:857, written lib/google-calendar.ts) beside an explicitly-encrypted TOTP secret. Integration is currently parked (GOOGLE_INTEGRATION_ENABLED=false) but the live path is plaintext the moment it is enabled. Fix: encrypt via lib/crypto before persist, decrypt on read. (audit/07 + 04)',
    notes: ['Shipped: the staff Google refresh token is now encrypted at rest via the keyring (encryptJson on write in exchangeCodeForStaff, decryptJson on read in syncStaffCalendar — mirrors AdminUser.totpSecret). Reads tolerate any pre-existing plaintext during migration; the presence-count checks (integrations.ts, connected-staff sweep) still work on the encrypted blob.'],
  },
  {
    title: 'AUDIT H: No audit record when clinical data is decrypted for viewing', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', project: 'audit-remediation',
    value: 7, effort: 3,
    detail: 'app/admin/clients/[id]/page.tsx: ASSESSMENT_VIEWED is logged only on SAR export, not when a clinician opens a client and formatAssessment decrypts their medical history. Fix: write an audit event whenever clinical/health data is decrypted for routine viewing. (audit/06-pii-compliance.md)',
    notes: ['Shipped: the client-detail page now emits an ASSESSMENT_VIEWED audit event (actor + role + clientId, NO clinical content in the summary) whenever health assessments or AI-consultation findings/photos are actually decrypted for display — previously logged only on SAR export. Provides a who-viewed-whose-record trail for special-category data (Art. 5(2) / Art. 32). Best-effort so it never blocks the page.'],
  },
  {
    title: 'AUDIT H: Marketing consent has no timestamp/version/source/lawful-basis', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', project: 'audit-remediation',
    value: 7, effort: 4,
    detail: 'schema Client.marketingOptIn is a bare boolean a staff member can flip with no proof of consent (PECR / GDPR Art.7 demonstrability). Fix: capture marketingConsentAt/Source/Version (+ lawful basis) as evidenced, audited fields set at the point of consent. (audit/06-pii-compliance.md)',
    notes: ['Shipped: added Client.marketingConsentAt/Source/Version (additive, nullable) + a marketingConsentFields(source) helper carrying the versioned wording (MARKETING_CONSENT_VERSION). Set on every genuine opt-in path — admin toggle ("admin"), portal registration ("registration"), consult form ("consult-form") — and the timestamp is cleared on admin opt-out. Now evidences what/when/how per Art. 7 / PECR reg. 22 instead of a bare boolean. Historic boolean-only opt-ins can\'t be retro-evidenced — re-permissioning those is an owner decision (per the audit).'],
  },
  {
    title: 'AUDIT H: Medical questionnaires capture no privacy-notice/granular consent', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', project: 'audit-remediation',
    value: 7, effort: 4,
    detail: 'Live medical/treatment questionnaires record no privacy-notice acknowledgement or granular consent for processing special-category data. Fix: capture an explicit privacy-notice acknowledgement (version + timestamp) and the processing consent alongside the questionnaire submission. (audit/06-pii-compliance.md)',
    notes: ['Shipped: medicalHistory (v1→v2) now captures a required, durable privacy-notice acknowledgement (agreed_privacy) — stored with the questionnaire key+version so the exact wording is recoverable (Art. 13 / Art. 9(2) evidencing). treatmentConsent (v1→v2) splits the conflated photo question into clinical-record consent (photos) and an independently-revocable marketing-photo consent (photos_marketing, only asked once clinical photos are agreed) — purposes no longer bundled (Art. 7(2)). No code consumed the old marketing_ok value; UK-locale strings for the two new questions fall back to English for now.'],
  },
  {
    title: 'AUDIT H: Unauthenticated session-replay ingest endpoint', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', project: 'audit-remediation',
    value: 8, effort: 3,
    detail: 'app/api/track/replay/route.ts accepts rrweb batches from anyone with no auth, consent check or rate-limit (masking is client-side only), so PII can be ingested without consent and the table can be flooded. Fix: gate on analytics consent + a session/token check + per-IP rate-limit, and cap payload size. (audit/06 + 03)',
    notes: ['Shipped: the consent banner now mirrors the analytics choice into a readable first-party cookie (kc_analytics_consent) so the SERVER can verify it (localStorage isn\'t sent with requests). /api/track/replay now: requires consent (fail-closed 403), rate-limits per IP (240/600s → 429), caps a single batch body at 512KB (413), and refuses to store replay for sensitive paths (/admin,/account,/book,/booking,/sign). Already-consented visitors re-grant once via the banner.'],
  },
  {
    title: 'AUDIT H: Google Calendar OAuth callback missing CSRF state nonce', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', project: 'audit-remediation',
    value: 7, effort: 3,
    detail: 'app/api/admin/gcal/callback/route.ts uses a bare staffId as the OAuth state with no signed/random nonce, so the callback is CSRF-able. Fix: issue a signed, single-use state nonce at initiation and verify it on callback. (audit/07-secrets-integrations.md)',
    notes: ['Shipped: the gcal connect route now mints a random, cookie-bound state nonce (newOAuthState + attachOAuthState) with the staffId riding after the nonce; the callback validates it one-time + timing-safe via consumeOAuthState BEFORE attaching the token, then re-authorises the session (schedule.manage or own calendar). Now matches the Xero/TrueLayer/Google-Business OAuth flows; the bare-staffId state is gone.'],
  },
  {
    title: 'AUDIT H: Raw-HTML Journal block renders unsanitized (stored XSS)', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', project: 'audit-remediation',
    value: 9, effort: 4,
    detail: 'lib/blocks.ts:107 → app/(marketing)/journal/[slug]/page.tsx renders a raw-HTML block unsanitized on the public site. There is NO HTML sanitizer anywhere in the repo. Fix: add one allowlist sanitizer and apply it at every raw-HTML render sink (shared root cause with the WordPress-import finding). (audit/08-frontend-xss.md)',
    notes: ['Shipped: new lib/sanitize.ts — a pure, isomorphic, dependency-free allowlist sanitizer (strips scripts/styles/event-handlers/javascript: URLs, allowlists tags+attrs, defangs target=_blank). Applied at the html-block chokepoint in blocksToHtml and on stored Post.content in getBlogPost; smoke-tested against 11 XSS payloads (script/onerror/js-URL/entity-encoded/iframe/svg/style) with legit content preserved. Deliberately not DOMPurify/jsdom to keep the renderer isomorphic + avoid cold-start cost.'],
  },
  {
    title: 'AUDIT H: Imported WordPress HTML rendered unsanitized (stored XSS)', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', project: 'audit-remediation',
    value: 8, effort: 3,
    detail: 'lib/blocks.ts:171 → lib/blog.ts:56 stores imported WordPress HTML as a raw block and renders it unsanitized. Fix: sanitize on render (same sanitizer as the Journal-block fix) and ideally on import. (audit/08-frontend-xss.md)',
    notes: ['Shipped with the Journal-block fix (one sanitizer closes both sinks): htmlToBlocks raw-HTML blocks now render through sanitizeHtml (blocksToHtml html case), getBlogPost sanitizes stored content, and the admin BlockEditor preview sanitizes b.html too.'],
  },
  {
    title: 'AUDIT H: Marketing/automation emails inject client data unescaped', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', project: 'audit-remediation',
    value: 8, effort: 3,
    detail: 'lib/email-builder.ts + lib/email-campaigns.ts + lib/automations.ts interpolate client name/email into HTML email bodies without escaping (HTML/CSS/link injection → in-domain phishing). Fix: HTML-escape all interpolated user/client values in email templates. (audit/09-email-notifications.md)',
    notes: ['Shipped: applyMergeTags gained an { html } mode that HTML-escapes client values when spliced into HTML (campaign body/preheader, test send, composer preview) while leaving plain-text subjects untouched; automations.ts inline ${firstName} bodies now escape via escapeHtml. Confirmed the tmpl* templates in lib/email.ts already escape() their inputs.'],
  },

  // ── PROJECT: Role-based My Day & Dashboards (slug: role-based-views) ─────────
  // Full spec: docs/projects/role-based-views.md. Epic + 12 work items below;
  // dependencies wire foundation → shell → views → services → interactions → QA.
  {
    title: 'Role-based My Day & Dashboards — epic', type: 'IDEA', urgency: 'P2', status: 'TRIAGE', project: 'role-based-views',
    value: 9, effort: 9,
    detail: 'EPIC / project root. Make the admin landing experience role-shaped: developer, admin (with view switching), clinician, receptionist and contractor each land on a daily view built around their job. Adds two new roles (DEVELOPER, CONTRACTOR), new data (RoomPrep, TimeEntry, ContractorTask, FacilityDoc, AdminUser.preferredDashboardView), new cross-user interactions and a reusable view/widget set. Gates on all child items. Full plan, data model, components and acceptance: docs/projects/role-based-views.md.',
    dependsOn: [
      'Role views — Clinician dashboard & My Day',
      'Role views — Receptionist (front-of-house) dashboard & My Day',
      'Role views — Developer dashboard & My Day',
      'Role views — Contractor dashboard & My Day + data model',
      'Role views — QA, permission-leakage hardening, demo seeding & rollout',
    ],
    notes: ['Planning artifact: docs/projects/role-based-views.md. Build behind a role_views_enabled flag; roll out view-by-view.'],
    subtasks: [
      { title: 'Owner sign-off on the two new roles (DEVELOPER, CONTRACTOR) and each role default view', ownerInput: true },
      { title: 'Confirm what data a contractor may NOT see (no client / clinical / financial) — written scope', ownerInput: true },
      { title: 'Agree staged rollout order and the feature-flag gate' },
    ],
  },
  {
    title: 'Role views — foundation: roles, permissions & view resolution', type: 'TASK', urgency: 'P1', status: 'TRIAGE', project: 'role-based-views',
    value: 8, effort: 4,
    detail: 'Foundation everything else builds on. Add DEVELOPER + CONTRACTOR to enum Role (additive db push, verify on a Neon branch first). Define permission defaults for the new roles in lib/permissions.ts (Record<Role> makes this compile-enforced). Add new permission keys (contractor.tasks.view/manage, timetracking.use/manage, facility.view/manage, rooms.prep.manage). Add AdminUser.preferredDashboardView (nullable). Build lib/dashboard-views.ts (role to default view, view registry, resolveView()). Reference: docs/projects/role-based-views.md §2,§4,§5.',
    subtasks: [
      { title: 'Add DEVELOPER + CONTRACTOR to enum Role; dry-run prisma db push on a Neon branch (additive, no data loss)' },
      { title: 'Add ROLE_DEFAULTS entries + new permission keys in lib/permissions.ts' },
      { title: 'Add AdminUser.preferredDashboardView (String?) + optional contractor metadata fields' },
      { title: 'POST /api/admin/preferences to set preferredDashboardView' },
      { title: 'lib/dashboard-views.ts: role to default view map + resolveView(session) helper' },
      { title: 'Update staff editor UI to offer the two new roles' },
      { title: 'tsc + build green; no permission regressions for existing roles' },
    ],
  },
  {
    title: 'Role views — view-aware dashboard shell & widget registry', type: 'TASK', urgency: 'P2', status: 'TRIAGE', project: 'role-based-views',
    value: 7, effort: 3,
    detail: 'A view-aware shell that renders the right widget set for the resolved view, plus reusable widget primitives so views compose rather than fork. Includes the admin/owner ViewSwitcher (segmented control, persists preferredDashboardView). Reference: docs/projects/role-based-views.md §5.',
    dependsOn: ['Role views — foundation: roles, permissions & view resolution'],
    subtasks: [
      { title: 'Widget primitives: DashWidget, StatTile, TimelineList, EmptyWidget (responsive, reduced-motion, a11y)' },
      { title: 'DashboardShell: resolve active view, render its widget registry, permission-gate each widget' },
      { title: 'ViewSwitcher (OWNER/ADMIN only) — switch + persist; reflect on dashboard and My Day' },
      { title: 'Refactor the current Overview into the Admin/Owner view bundle' },
      { title: 'Mobile 360/390 pass for the shell + switcher' },
    ],
  },
  {
    title: 'Role views — Clinician dashboard & My Day', type: 'TASK', urgency: 'P2', status: 'TRIAGE', project: 'role-based-views',
    value: 9, effort: 5,
    detail: 'Clinician view: today appointments (own first, then clinic) with status + running-late flags; room availability board; room prep status for next clients; client info quick-cards (allergies, medical flag, consent state — clinical-gated); appointment-flow entry into the BLD-138 guided session. Reference: docs/projects/role-based-views.md §3.3.',
    dependsOn: ['Role views — view-aware dashboard shell & widget registry', 'Role views — Room availability & prep-status service'],
    subtasks: [
      { title: 'Today appointment list widget (own + clinic, status, running-late)' },
      { title: 'Embed RoomAvailabilityBoard + RoomPrepStatus for the clinician location' },
      { title: 'Client info quick-card (clinical-gated: allergies, medical flag, consent state)' },
      { title: 'Appointment-flow entry: jump to the current/next client guided session' },
      { title: 'Clinician My Day: clinical checklist, consult follow-ups, today earnings (if permitted)' },
      { title: 'Verify no clinical data renders for non-clinical roles reusing these widgets' },
    ],
  },
  {
    title: 'Role views — Receptionist (front-of-house) dashboard & My Day', type: 'TASK', urgency: 'P2', status: 'TRIAGE', project: 'role-based-views',
    value: 9, effort: 5,
    detail: 'Receptionist view (no clinical health data): arrivals timeline + one-tap check-in; prepare-for-arrival prep (drinks, room) handed off to the clinician; payments due / cards to capture; daily takings snapshot; calls + chat needing a reply; new booking quick action; walk-in capture. Reuses the dashboard ArrivalPrep building blocks. Reference: docs/projects/role-based-views.md §3.4.',
    dependsOn: ['Role views — view-aware dashboard shell & widget registry', 'Role views — Room availability & prep-status service'],
    subtasks: [
      { title: 'ArrivalsBoard widget + one-tap check-in action' },
      { title: 'Prep handoff: set room READY / drinks prepared, surfaced to the clinician view' },
      { title: 'Payments due / capture-card widget + daily takings snapshot' },
      { title: 'Calls + chat needing reply widget; new booking + walk-in quick actions' },
      { title: 'Receptionist My Day: front-desk task list, callbacks, follow-ups' },
      { title: 'Confirm zero clinical fields reach this view' },
    ],
  },
  {
    title: 'Role views — Developer dashboard & My Day', type: 'TASK', urgency: 'P2', status: 'TRIAGE', project: 'role-based-views',
    value: 6, effort: 3,
    detail: 'Developer view: build board snapshot (Open/In-review/Blocked/Not-on-GitHub + top items); recent Vercel deployments with state + inspector/log links; error reports (BuildItem.type ERROR) newest first; quick links (GitHub, runtime logs, platform status, token usage). No client/clinical data by default. Reference: docs/projects/role-based-views.md §3.1.',
    dependsOn: ['Role views — view-aware dashboard shell & widget registry'],
    subtasks: [
      { title: 'Build-board snapshot widget (counts + top actionable items)' },
      { title: 'Recent deployments widget (Vercel state + inspector/logs links)' },
      { title: 'Error-reports widget (type ERROR, newest first)' },
      { title: 'Quick links + token/usage stats; Developer My Day = assigned build items + PRs/reviews' },
    ],
  },
  {
    title: 'Role views — Contractor dashboard & My Day + data model', type: 'TASK', urgency: 'P2', status: 'TRIAGE', project: 'role-based-views',
    value: 7, effort: 6,
    detail: 'Contractor view (no client/clinical/financial data): contracted tasks / work to complete (assigned, due dates, status); time tracking (clock in/out, breaks, hours today/week); facility knowledge (floor + electrical plans, equipment locations, where-to-find-things, instructions). Adds the ContractorTask model + assignment flow. Reference: docs/projects/role-based-views.md §3.5,§4.',
    dependsOn: ['Role views — view-aware dashboard shell & widget registry', 'Role views — Time-tracking service (clock, breaks, timesheets)', 'Role views — Facility knowledge base (plans & where-to-find-things)'],
    subtasks: [
      { title: 'ContractorTask model (additive) + admin assignment UI' },
      { title: 'ContractorTaskList widget: today jobs, complete + notes, status' },
      { title: 'Embed TimeClock (clock in/out, break) prominently' },
      { title: 'Embed FacilityDocs viewer scoped to the contractor location' },
      { title: 'Contractor My Day layout (jobs + clock + docs); lock out all client/clinical/finance routes' },
      { title: 'Provide initial floor / electrical plans and site instructions to seed', ownerInput: true },
    ],
  },
  {
    title: 'Role views — Room availability & prep-status service', type: 'TASK', urgency: 'P2', status: 'TRIAGE', project: 'role-based-views',
    value: 7, effort: 4,
    detail: 'Shared service powering the clinician + receptionist views. RoomPrep model (roomId, date, status DIRTY/CLEANING/READY, cleanedAt/by, note; one row per room per day via upsert, no DB unique constraint per the gate). API to read/set prep status; realtime via the existing kiosk/session SSE+poll pattern so a receptionist setting READY updates the clinician live. Reference: docs/projects/role-based-views.md §4,§6.',
    dependsOn: ['Role views — foundation: roles, permissions & view resolution'],
    subtasks: [
      { title: 'RoomPrep model + upsert-by-(roomId,date) service' },
      { title: 'GET/POST room prep status API (permission: rooms.prep.manage)' },
      { title: 'RoomAvailabilityBoard (free/occupied now + next) from Resource + bookings' },
      { title: 'RoomPrepStatus widget with live updates (SSE/poll)' },
      { title: 'Link prep state to the dashboard arrival-prep checklist' },
    ],
  },
  {
    title: 'Role views — Time-tracking service (clock, breaks, timesheets)', type: 'TASK', urgency: 'P2', status: 'TRIAGE', project: 'role-based-views',
    value: 6, effort: 5,
    detail: 'Shared time tracking used by contractors (and optionally staff) and by the dashboard lunch-break action. TimeEntry model (userId, kind SHIFT/BREAK, startedAt, endedAt?, note?, taskId?). Clock in/out + break component; open entry = endedAt null. Admin timesheet rollup + export. Reference: docs/projects/role-based-views.md §4,§6.',
    dependsOn: ['Role views — foundation: roles, permissions & view resolution'],
    subtasks: [
      { title: 'TimeEntry model (additive) + start/stop/break service with single-open-entry guard' },
      { title: 'TimeClock component (clock in/out, break) + today/this-week totals' },
      { title: 'Admin timesheet view (per user, per week) + CSV export' },
      { title: 'Permission keys timetracking.use / timetracking.manage' },
    ],
  },
  {
    title: 'Role views — Facility knowledge base (plans & where-to-find-things)', type: 'TASK', urgency: 'P3', status: 'TRIAGE', project: 'role-based-views',
    value: 5, effort: 3,
    detail: 'FacilityDoc model (title, type FLOOR_PLAN/ELECTRICAL/PLUMBING/EQUIPMENT/INSTRUCTION/OTHER, fileUrl Blob, description?, locationId?, tags[], order) + an image/PDF viewer. Powers the contractor view and is useful to all staff. Admin upload/manage UI. Reference: docs/projects/role-based-views.md §4.',
    dependsOn: ['Role views — foundation: roles, permissions & view resolution'],
    subtasks: [
      { title: 'FacilityDoc model (additive) + Blob upload + admin manage UI' },
      { title: 'FacilityDocs viewer (image/PDF, grouped by type, location-scoped)' },
      { title: 'Permission keys facility.view / facility.manage' },
    ],
  },
  {
    title: 'Role views — Cross-role interactions & notifications', type: 'TASK', urgency: 'P3', status: 'TRIAGE', project: 'role-based-views',
    value: 6, effort: 5,
    detail: 'New interactions between users: prep handoff (reception sets room READY to clinician), room turnover request (clinician finishes to reception/cleaner), contractor task assignment (admin to contractor; DONE notifies admin), time-tracking visibility (contractor entries roll up to admin). All emit activity-log entries and respect permission scope. Reuse the existing notification + SSE/poll patterns. Reference: docs/projects/role-based-views.md §6.',
    dependsOn: ['Role views — Clinician dashboard & My Day', 'Role views — Receptionist (front-of-house) dashboard & My Day', 'Role views — Contractor dashboard & My Day + data model'],
    subtasks: [
      { title: 'Notification types for handoff / turnover / task-assignment' },
      { title: 'Clinician room-turnover request to reception/cleaner' },
      { title: 'Admin task-assignment ping to contractor; DONE ping back to admin' },
      { title: 'Activity-log entries for all interactions; permission-scoped visibility' },
    ],
  },
  {
    title: 'Role views — Lunch-break & per-role day actions wiring', type: 'TASK', urgency: 'P3', status: 'TRIAGE', project: 'role-based-views',
    value: 5, effort: 3,
    detail: 'Connect the dashboard Lunch & breaks action to the time-tracking break (TimeEntry kind BREAK) and to schedule/availability so a break blocks the calendar. Define per-role quick-action sets (clinician vs receptionist vs contractor vs developer). Reference: docs/projects/role-based-views.md §3,§11.',
    dependsOn: ['Role views — Time-tracking service (clock, breaks, timesheets)'],
    subtasks: [
      { title: 'Lunch break starts a BREAK TimeEntry + reflects in calendar availability' },
      { title: 'Per-role quick-action registry (which day actions show per view)' },
    ],
  },
  {
    title: 'Role views — My Day per-role rebuild', type: 'TASK', urgency: 'P2', status: 'TRIAGE', project: 'role-based-views',
    value: 7, effort: 5,
    detail: 'Rebuild /admin/my-day as the role-tailored daily planner counterpart of the dashboards, reusing the same view widgets in a day-planner layout (timeline, tasks, personal stats). Reference: docs/projects/role-based-views.md §11.',
    dependsOn: ['Role views — Clinician dashboard & My Day', 'Role views — Receptionist (front-of-house) dashboard & My Day', 'Role views — Developer dashboard & My Day', 'Role views — Contractor dashboard & My Day + data model'],
    subtasks: [
      { title: 'My Day day-planner layout that resolves the active view' },
      { title: 'Per-role My Day content reusing the view widgets' },
      { title: 'Mobile 360/390 pass' },
    ],
  },
  {
    title: 'Role views — QA, permission-leakage hardening, demo seeding & rollout', type: 'REVIEW', urgency: 'P2', status: 'TRIAGE', project: 'role-based-views',
    value: 8, effort: 4,
    detail: 'Final hardening + rollout. Role x view test matrix; automated assertion that FRONT_DESK / CONTRACTOR / DEVELOPER never receive clinical health fields; mobile 360/390 across every view; seed one demo user per role for QA; docs/runbook; ship behind role_views_enabled and roll out view-by-view. Reference: docs/projects/role-based-views.md §8,§9.',
    dependsOn: ['Role views — Cross-role interactions & notifications', 'Role views — My Day per-role rebuild', 'Role views — Lunch-break & per-role day actions wiring'],
    subtasks: [
      { title: 'Role x view rendering + permission matrix tests' },
      { title: 'Clinical-data leakage test for non-clinical views' },
      { title: 'Demo user per role seeded for QA' },
      { title: 'Feature flag role_views_enabled + staged rollout plan' },
      { title: 'tsc + next build green; visual QA at 360/390/desktop' },
    ],
  },
  {
    title: 'Retail order Mark-refunded skips Stripe API -- customers remain charged (BLD-227)', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 8, effort: 2,
    detail: 'Fixed: app/api/admin/orders/route.ts now calls stripe().refunds.create() before updating DB status when marking REFUNDED. Includes idempotency key and only updates DB on Stripe success.',
  },
  {
    title: 'Add idempotency keys to shop checkout and gift-voucher PaymentIntents (BLD-228)', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 8, effort: 2,
    detail: 'Fixed: shop-order-{id} key on shop checkout PaymentIntent; gift-voucher-{id} key on gift voucher PaymentIntent. Mirrors booking-actions pattern.',
  },
  {
    title: 'Admin password change does not bump sessionEpoch -- stolen sessions remain valid (BLD-229)', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 8, effort: 1,
    detail: 'Fixed: app/api/admin/profile/route.ts changePassword op now includes sessionEpoch: { increment: 1 } in the update, mirroring the staff route pattern.',
  },
  {
    title: 'Booking upsell shows hardcoded 0.00 as Total today (BLD-230)', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 7, effort: 1,
    detail: 'Fixed: components/booking/BookingFlow.tsx "Total today" row renamed to "Due today" with text "Nothing charged until after your visit" -- accurate for the card-save model.',
  },
  {
    title: 'Tracking IDs have no env fallback -- analytics dark when unconfigured (BLD-231)', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 10, effort: 2,
    detail: 'Fixed: lib/tracking.ts getTrackingConfig() now reads NEXT_PUBLIC_GA4_ID / NEXT_PUBLIC_GOOGLE_ADS_ID / NEXT_PUBLIC_META_PIXEL_ID env vars as fallbacks when the DB setting is absent or empty.',
  },
  {
    title: 'Stripe SDK has no maxRetries or timeout -- payment network blips silently fail (BLD-239)', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 9, effort: 2,
    detail: 'Fixed: lib/stripe.ts Stripe constructor now includes maxNetworkRetries: 3, timeout: 20000. Also added idempotencyKey setup-{bookingId} to setupIntents.create in booking/create/route.ts.',
  },
  {
    title: 'Server-side GA4/Meta conversions fire without checking marketing consent (BLD-240)', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 8, effort: 2,
    detail: 'Fixed: app/admin/bookings/actions.ts sendPurchase() call now passes email only when booking.client.marketingOptIn is true; passes null otherwise so hashed identity is excluded from ad platforms.',
  },
  {
    title: 'Follow-up & review automations query wrong Prisma model -- emails never sent (BLD-245)', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 9, effort: 3,
    detail: 'Fixed: lib/automations.ts followUps() and reviews() now query db.booking (status COMPLETED, followUpSent/reviewSent false, startAt window) instead of the non-existent db.appointment. Field mapping updated (scheduledAt -> startAt, treatment -> treatmentTitle).',
  },
  {
    title: 'chargeBooking double-charge guard reads stale data (BLD-246)', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 9, effort: 3,
    detail: 'Fixed: lib/booking-actions.ts chargeBooking() re-fetches booking.chargedAt from DB immediately before the Stripe call so concurrent staff actions both reading chargedAt:null cannot both reach paymentIntents.create.',
  },
  {
    title: 'Refund idempotency key collision -- two equal partial refunds collapse to one (BLD-247)', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 9, effort: 2,
    detail: 'Fixed: lib/booking-actions.ts refundBooking() idempotency key changed from refund-{id}-{amount} to refund-{id}-from-{refundedPence}-{amount}, making each partial refund unique at Stripe.',
  },
  {
    title: '2FA self-disable has no TOTP re-verification -- hijacked session silently removes 2FA (BLD-249)', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 8, effort: 2,
    detail: 'Fixed: app/api/admin/2fa/route.ts disable op now requires a valid current TOTP code when 2FA is enabled; verified via verifySecondFactor before calling disable2fa().',
  },
  {
    title: 'REDUCED VAT class maps to wrong Xero tax code OUTPUT2 (20%) instead of REDUCEDOUTPUT (5%) (BLD-252)', type: 'ERROR', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 7, effort: 1,
    detail: 'Fixed: lib/xero.ts xeroTaxType() now returns REDUCEDOUTPUT for REDUCED VAT class; OUTPUT2 is now STANDARD-only. Prevents 5% services being invoiced at 20% in Xero.',
  },
  {
    title: 'AI and TrueLayer fetch calls missing AbortSignal timeout -- hung connection blocks serverless slot (BLD-254)', type: 'ERROR', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 7, effort: 1,
    detail: 'Fixed: AbortSignal.timeout(25_000) added to Anthropic fetch calls in lib/chat-ai.ts and lib/ai-consultation.ts; AbortSignal.timeout(10_000) added to all TrueLayer fetch calls in lib/truelayer.ts and GitHub App token fetch in lib/github-app.ts.',
  },
  {
    title: 'CMS theme CSS values injected into <style> without sanitisation -- CSS injection risk (BLD-232)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 6, effort: 1,
    detail: 'Fixed: lib/theme.ts themeToCss() now validates each color token against a CSS color regex and strips dangerous characters (}, <, >, quotes) before injection. Invalid values fall back to transparent.',
  },
  {
    title: 'Add robots.txt -- admin, kiosk and POS routes currently crawlable by all bots (BLD-253)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 7, effort: 1,
    detail: 'Fixed: app/robots.ts disallow list extended with /kiosk, /pos-paid, /live, /nps, /follow-up. All staff-facing and transactional paths are now blocked from crawlers.',
  },
  {
    title: 'Replace force-dynamic with revalidate on journal, shop and academy pages to restore edge caching (BLD-233)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 9, effort: 2,
    detail: 'Fixed: journal/page.tsx, shop/page.tsx, academy/page.tsx, journal/[slug]/page.tsx, shop/[slug]/page.tsx, academy/[slug]/page.tsx -- replaced force-dynamic with revalidate = 3600. Transactional pages (booking, checkout, account, portal) remain force-dynamic.',
  },
  {
    title: 'Cart quantity -/+ buttons have no accessible name or minimum 44px touch target (BLD-236)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 9, effort: 1,
    detail: 'Fixed: app/(marketing)/shop/cart/page.tsx -- quantity buttons enlarged to h-11 w-11 (44px), aria-label added to each (Decrease/Increase quantity of {name}); Remove button gets aria-label="Remove {name} from cart". WCAG 2.5.5 and SC 4.1.2 compliant.',
  },
  {
    title: 'Post-booking confirmation screen has no referral prompt or loyalty points summary (BLD-234)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 9, effort: 2,
    detail: 'Fixed: components/booking/BookingFlow.tsx Done component now shows a gold-bordered referral card with the PS25/PS25 offer and a Beauty Points credit note, linking to /refer-a-friend. Added at the highest-intent post-conversion moment.',
  },
  {
    title: 'Consultation form fires no conversion event -- ad campaigns cannot optimise for leads (BLD-255)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 9, effort: 2,
    detail: 'Fixed: components/consult/ConsultForm.tsx now fires gtag(event, generate_lead, {value:0}) and fbq(track, Lead) on successful submission, enabling Google Ads and Meta to optimise for consultation leads.',
  },
  {
    title: 'Voice note transcription in guided session runner (BLD-138)', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(768),
    value: 8, effort: 4,
    detail: 'Clinicians can record a voice note during the treatment step of a session and have it transcribed via Deepgram (nova-3, en-GB) directly into the clinical note field. A microphone button sits alongside Save note; on success the transcript is appended (newline-separated) so existing hand-typed text is preserved. POST /api/admin/bookings/transcribe: crmEnabled + bookings.manage + clients.clinical.view gated; 25 MB cap; MIME allowlist; Deepgram error detail truncated.',
    notes: ['Shipped (#768). Requires DEEPGRAM_API_KEY secret. MIME allowlist: audio/webm, audio/ogg, audio/wav, audio/mp4, audio/mpeg, audio/m4a, audio/aac. Pre-content-length + post-read size guards (413 on overflow).'],
  },
  {
    title: 'Role permissions: timetracking.use + timetracking.manage; contractor task assignment notification (BLD-285)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(768),
    value: 7, effort: 2,
    detail: 'Added timetracking.use (clock in/out) and timetracking.manage (view + edit all timesheets) to the permissions catalogue (lib/permissions.ts). CONTRACTOR and STAFF roles receive timetracking.use by default. ContractorTask creation now notifies the assignee via notifyStaffById when an assigneeId is set (skips self-assignment via the actorUserId guard).',
    notes: ['Shipped (#768). Permission group: Facility. Role defaults: CONTRACTOR = [..., timetracking.use], STAFF = [..., timetracking.use]. Notification: title = "New task assigned: {title}", href = /admin/contractors.'],
  },
  {
    title: 'GDPR erasure: broaden eraseClientData to cover non-special-category PII tables (BLD-286)', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(768),
    value: 8, effort: 2,
    detail: 'eraseClientData (app/admin/actions.ts) pseudonymises the Client row but never cascade-deletes because Prisma does not auto-cascade through the pseudonymised FK. Added 5 operations to the $transaction: delete Referral rows where referrerId = clientId; nullify referredId/referredEmail on Referral rows where referredBy = clientId; delete ChatConversation, WaitlistEntry, and Appointment rows for the client. UK GDPR Art.17.',
    notes: ['Shipped (#768). Part of the ongoing GDPR erasure completeness work (AUDIT C2). Referral sender rows deleted; referred-by linkage anonymised rather than deleted to preserve campaign attribution. Appointments deleted (no financial records left -- financial BookingCharge rows are on Booking, not Appointment).'],
  },
  {
    title: 'Kiosk: seasonal scene theming -- Christmas, Valentine\'s, Summer (BLD-137 slice 1)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(769), project: 'skin-smile-kiosk',
    value: 7, effort: 3,
    detail: 'The storefront kiosk display now supports 4 seasonal themes (Default / Christmas / Valentine\'s / Summer) switchable from Admin > QR codes with no redeploy. Each theme has unique headline copy, tagline, CTA (AttractScene THEME_COPY map) and CSS colour-variable overrides applied as an inline style on the .kd-stage root (--color-ink, --color-gold-bright, --color-gold, --color-gold-soft, --color-blush). Theme stored as the string setting kiosk_theme using the existing Setting table -- zero schema changes. Admin pill-button selector gated on settings.manage; optimistic selection reverts on server error.',
    notes: ['Shipped (#769). lib/kiosk-themes.ts (theme catalogue), lib/settings.ts (getStringSetting/setStringSetting), app/admin/qr/kiosk-actions.ts (setKioskTheme server action), KioskThemeSelector.tsx (admin UI), KioskDisplay.tsx (CSS var injection), AttractScene.tsx (copy map). Opus review caught phantom --kd-* variable names -- corrected to --color-* before merge.'],
  },
  {
    title: 'Staff-only follow-up appointment scheduler on booking detail (BLD-298)', type: 'TASK', urgency: 'P3', status: 'SHIPPED', assignee: 'claude',
    value: 4, effort: 3,
    detail: 'Staff-only ScheduleFollowUp widget added to the booking detail left column. Pre-fills the recommended next-session date using recommendedNext() from lib/treatment-intervals for course treatments, checks room/clinician availability via isSlotFree, assigns clinician + room, and books via createManualBooking (flows to Google Calendar sync once enabled). Clash shows a clear message with a book-anyway override. Gated behind bookings.manage. No schema change. Also fixed right-heavy layout imbalance on the booking detail page.',
    notes: ['Component: components/admin/ScheduleFollowUp.tsx. Action: app/admin/bookings/create-action.ts scheduleFollowUpAction(). Page: app/admin/bookings/[id]/page.tsx. Client-facing UI deferred per BLD-298 brief.'],
  },
  {
    title: 'ClinicOS Ring 0.1: Tenant model + nullable tenantId on 13 Academy tables (BLD-299)', type: 'TASK', urgency: 'P3', status: 'SHIPPED', assignee: 'claude',
    value: 4, effort: 3,
    detail: 'Added Tenant model (id, slug, name, host, active) to schema.prisma and a nullable tenantId String? with @@index to all 13 Academy tables (AcademyStudent, Course, CourseModule, Lesson, Quiz, QuizQuestion, LessonProgress, QuizAttempt, LiveClass, Cohort, Enrolment, Vacancy, JobApplication) plus bonus models (StudentPasskey, ExamQuestion, PastPaper, PracticeAttempt, PointEvent, StudentBadge, DailyActivity). Additive-only -- db push safe, zero data loss. lib/tenant.ts: ensureDefaultTenant(), currentTenantId(), backfillAcademyTenant() self-healing cron. New Academy writes stamp tenantId. Live code treats tenantId as optional -- K Clinics behaves identically. Ring 0.2 (query scoping) and Ring 1 (RLS) are follow-up cards.',
    notes: ['schema.prisma: Tenant model at line 1749. lib/tenant.ts: resolver + backfill. lib/academy-auth.ts: stamps tenantId on signupStudent(). app/api/cron/daily: wires backfillAcademyTenantIfNeeded(). ADR-015 pooled-tenantId pattern documented in docs/PLATFORM_SAAS_PLAN.md.'],
  },
  {
    title: 'ClinicOS Ring 0.1: Academy JWT-secret audience hardening -- remove CLIENT/ADMIN fallback (BLD-302)', type: 'TASK', urgency: 'P3', status: 'SHIPPED', assignee: 'claude',
    value: 3, effort: 2,
    detail: 'academySecret() in lib/auth-edge.ts previously fell back through CLIENT_JWT_SECRET -> ADMIN_JWT_SECRET if ACADEMY_JWT_SECRET was unset (dev convenience that could cause cross-portal token acceptance in production). Removed the two fallbacks: academySecret() now uses ACADEMY_JWT_SECRET exclusively and throws in production if unset, matching the adminSecret() pattern. Dev environments fall back to the insecure placeholder as before.',
    notes: ['lib/auth-edge.ts lines 97-105. Matches the hardened adminSecret() pattern (no fallback). clientSecret() still has a single ADMIN_JWT_SECRET fallback -- that is a separate card (R13).'],
  },
  {
    title: 'Kiosk SSE stream refactored to shared sseSnapshotStream helper (BLD-145)', type: 'TASK', urgency: 'P3', status: 'SHIPPED', assignee: 'claude',
    value: 4, effort: 2,
    detail: 'app/api/kiosk/sessions/[token]/stream/route.ts now delegates its poll loop, heartbeat, lifetime, abort signal, cancel handler, and transient-error policy to sseSnapshotStream() from lib/sse-snapshot.ts (BLD-145). The route retains its kiosk-specific layers: auth (token exists + secret matches), per-token concurrent-connection cap (MAX 3), and the load() function (db.kioskSession.findUnique -> buildKioskStreamPayload). Connection slot released via .pipeTo().then(releaseConn, releaseConn) on both normal drain and reader cancel. No behaviour change. useKioskChannel (client hook) deferred: the BLD-145 comment explicitly flagged it for on-device testing before conversion.',
    notes: ['SSE_HEADERS now imported from lib/sse-snapshot.ts (no duplication). pollMs=500, heartbeatMs=15000, lifetimeMs=55000 unchanged. req.signal ?? new AbortController().signal guard ensures valid AbortSignal in all environments.'],
  },
  {
    title: 'Kiosk slice 2: per-location display links + locationId on KioskSession (BLD-137 slice 2)', type: 'TASK', urgency: 'P3', status: 'SHIPPED', assignee: 'claude',
    value: 6, effort: 4,
    detail: 'Added optional locationId String? to KioskSession (plain scope tag matching the FacilityDoc/ContractorVisit pattern -- no FK, no Location model touch, additive schema change). /kiosk/display accepts a ?location=<slug> search param: it resolves the Location.id by slug and stamps it on the new session at creation. Admin > QR codes page now shows a "Per-location display links" section listing all active locations with their /kiosk/display?location=<slug> URL so staff can point each site\'s storefront screen at the right link without any deploy. Sessions without locationId continue to work as before.',
    notes: ['schema.prisma: locationId String? + @@index([locationId]) on KioskSession. app/kiosk/display/page.tsx: searchParams.location -> db.location.findUnique({where:{slug}}) -> session.locationId. app/admin/qr/page.tsx: db.location.findMany(active) -> per-location link list. Consistent with FacilityDoc.locationId and ContractorVisit.locationId patterns.'],
  },
  {
    title: 'GDPR Art. 15/17 parity: SAR completeness + erasure broadening (BLD-315)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 7, effort: 6,
    detail: 'Five confirmed BLD-315 audit items addressed. (1) SAR export now includes previously omitted data-subject records: aiAnalyses (with images), followUps, reviews, npsResponses, waitlist entries, referralsMade, callRecords. Separate queries add signedConsents, beforePhotos (clinical-gated), chatConversations, and shopOrders. (2) eraseClientData now requires clients.delete (not clients.export -- wrong permission gate). (3) Erasure now also covers DiscountClaim (null emailNorm/phoneNorm), Order (null name/email/phone/ship fields -- financial totals retained for HMRC), and GiftVoucher (null purchaser + recipient PII -- balance retained). (4) Clinical view in both the SAR export and the client detail page now uses the revocable sessionCan(session,"clients.clinical.view") permission instead of the role-based canViewClinical(role) which cannot be individually revoked. (5) Erasure audit action changed from NOTE_ADDED to the dedicated CLIENT_ERASED (new AuditAction enum value -- additive schema change). SAR audit log changes from ASSESSMENT_VIEWED to DATA_EXPORTED. Deferred (need UI/legal review): kiosk consent US-transfer disclosure, translation provider sub-processor register, Order FK to Client.',
    notes: ['app/api/admin/clients/[id]/export/route.ts: include 7 extra relations + 4 separate queries + canSeeClinical gate + DATA_EXPORTED audit. app/admin/actions.ts: clients.delete gate + DiscountClaim/Order/GiftVoucher erasure + CLIENT_ERASED audit. app/admin/clients/[id]/page.tsx: sessionCan("clients.clinical.view") replaces canViewClinical(role). prisma/schema.prisma: CLIENT_ERASED added to AuditAction enum. BLD-315.'],
  },
];

// A content hash over every item's title + status + PR, so ANY change (a new
// task, a status flip to SHIPPED, a PR link) bumps the version and the board
// re-syncs — not just a change in item count (the old `length`-based key could
// miss status/content edits, leaving the board stale).
export const BACKLOG_VERSION = (() => {
  const sig = BUILD_BACKLOG.map((b) => `${b.title}|${b.status}|${b.pr ?? ''}`).join('\n');
  let h = 5381;
  for (let i = 0; i < sig.length; i++) h = ((h << 5) + h + sig.charCodeAt(i)) >>> 0;
  return `v2:${BUILD_BACKLOG.length}:${h.toString(36)}`;
})();
