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
  {
    slug: 'ga-analytics',
    name: 'Full Google Analytics visualisation',
    summary: 'Surface all the useful GA4 data inside the platform rather than sending the owner to the GA console: total visits/visitors, time on site, page views, top pages, traffic by channel, devices, countries and where visitors land/journey — across the marketing section and dashboard. Builds on the existing GA4 Data API client (lib/ga4-data.ts) and the connected Google account. Formed from the owner’s request to "add full visualisation of all GA data in platform".',
    originIdeaTitle: 'Add full Google Analytics visualisation in the platform',
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
    title: 'VAT not displayed on public-facing prices -- Trading Standards compliance', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 9, effort: 4,
    detail: 'UK Consumer Protection Regulations require VAT-inclusive pricing to be labelled on consumer-facing displays. Added getVatNote() to lib/vat.ts; wired into pricing/page, treatment template, shop listing, product detail, and shop cart (server wrapper + CartClient). Returns full sentence note based on vat_registered + prices_vat_inclusive settings.',
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
  {
    title: 'Migrated clients have no way into their account — add passwordless activation email', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 7, effort: 3,
    detail: 'A booking moved onto the new site (manual/migrated booking) creates a Client with no password, and the only email sent was the token-based "Save a card" link — so the client could secure their appointment but had no route into the /account portal (no password, and self-service "forgot password" deliberately refuses accounts that have no password set). Fix: when staff send the card request to a passwordless client, send ONE combined welcome email instead — it greets them, shows their upcoming appointment, and gives a single passwordless magic link (/account/activate) that signs them in and lands them on the card-save step. The link reuses the existing reset-token columns (no schema change), stays valid 7 days, sets portalActive, and they can set a password later from their profile. Complements S7 (the client-data importer).',
    notes: ['Shipped: lib/email.ts tmplAccountInvite (welcome + appointment + one "Open my account" CTA); lib/client-auth.ts createAccountInvite/activateAccount (reuse resetTokenHash/Exp, 7-day TTL, portalActive on activate, password stays optional); app/account/activate route handler (IP rate-limited, signs in, redirects to the soonest card-needing booking or the dashboard); /account/activate added to the middleware public allowlist; app/api/admin/bookings/request-card branches to the combined invite for passwordless clients across email + SMS; the portal login page shows a friendly "call us for a fresh link" notice when an activation link has expired. Owner chose passwordless magic-link + one combined email.'],
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
    title: 'Order number race: replace count() with atomic Setting counter (BLD-332)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 5, effort: 1,
    detail: 'nextOrderNumber() in lib/shop.ts used db.order.count() then KC${1000+count+1}. Two concurrent checkouts could read the same count and mint the same KC#### number. Fixed with a single atomic PostgreSQL upsert: INSERT ... ON CONFLICT (key) DO UPDATE SET value = CAST(value AS INTEGER) + 1 on a _order_seq Setting row. The RETURNING value guarantees each caller gets a unique number without any schema change or @unique constraint.',
    notes: ['lib/shop.ts:60-75. No schema change; Setting key _order_seq is self-initialising at 1001. Serialised by Postgres row-level locking on the Setting PK.'],
  },
  {
    title: 'Shop field leakage: exclude costPence/barcode from public product reads (BLD-316)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 3, effort: 1,
    detail: 'activeProducts() and validateCart() in lib/shop.ts fetched all Product columns, including costPence (cost of goods / margin) and barcode (internal SKU detail). Added explicit select to both queries, returning only the fields needed by the storefront. Also adds .nvmrc pinning node 20.9.0.',
    notes: ['lib/shop.ts activeProducts() + validateCart(). .nvmrc: 20.9.0.'],
  },
  {
    title: 'GDPR SAR/erasure completeness: permission, audit action, SAR parity, DiscountClaim, Order, GiftVoucher (BLD-315)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 7, effort: 3,
    detail: 'Six Art.15/17 gaps closed. (1) eraseClientData permission changed from clients.export to clients.delete (irreversible destructive). (2) Audit action changed from NOTE_ADDED to CLIENT_ERASED (added to AuditAction enum). (3) SAR export include expanded to add aiAnalyses, reviews, npsResponses, followUps, waitlist, callRecords, referralsMade. (4) Clinical gate in export changed from canViewClinical(role) to sessionCan(session, clients.clinical.view) so individual revocations are honoured. (5) DiscountClaim emailNorm/phoneNorm/nameDobKey nullified on erase. (6) Order name/email/phone/ship* and GiftVoucher purchaser/recipient/ship* fields stripped on erase.',
    notes: ['prisma/schema.prisma: CLIENT_ERASED added to AuditAction enum. app/admin/actions.ts: permission + audit action + 3 new $transaction ops. app/api/admin/clients/[id]/export/route.ts: expanded include + sessionCan gate + DATA_EXPORTED action.'],
  },
  {
    title: 'Sentry error tracking integration (BLD-348)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 6, effort: 2,
    detail: 'Integrated @sentry/nextjs for production error aggregation. instrumentation.ts registers Sentry on both nodejs and edge runtimes via register(); onRequestError hook captures every server request error. instrumentation-client.ts initialises client-side Sentry with session replay. sentry.server.config.ts + sentry.edge.config.ts read SENTRY_DSN env var; no-op when unset so builds and tests pass without a DSN. app/global-error.tsx reports root boundary errors via Sentry.captureException(). CSP connect-src updated to allow *.sentry.io. To activate: set SENTRY_DSN (server) and NEXT_PUBLIC_SENTRY_DSN (client) in Vercel env.',
    notes: ['instrumentation.ts, instrumentation-client.ts, sentry.server.config.ts, sentry.edge.config.ts, app/global-error.tsx, next.config.mjs CSP. No withSentryConfig wrapper (instrumentation API is sufficient for App Router). @sentry/nextjs added to dependencies.'],
  },
  {
    title: 'Turnstile CAPTCHA fails closed when TURNSTILE_SECRET_KEY is unset (BLD-344)', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 9, effort: 2,
    detail: 'verifyTurnstile() in lib/security/guard.ts now returns false (not true) in production when TURNSTILE_SECRET_KEY is unset. Dev/test environments still return true so login remains testable without a key. Commit 3b8f152.',
    notes: ['lib/security/guard.ts lines 87-94. NODE_ENV guard preserves dev ergonomics while closing the production hole.'],
  },
  {
    title: 'Admin session revocation bypassed when database is unreachable (BLD-345)', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 8, effort: 4,
    detail: 'getSession(), getClientSession() and getAcademySession() in lib/auth.ts now return null on DB failure instead of trusting the raw JWT claims. Deactivated accounts can no longer remain authenticated during a database outage. Commit 3b8f152.',
    notes: ['lib/auth.ts lines 98-103 (admin), 142-145 (client). Mirror pattern across all three portal session functions.'],
  },
  {
    title: '/kiosk/display visual QA timeout (SSE networkidle) (BLD-346)', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 8, effort: 3,
    detail: 'scripts/visual-qa.mjs now uses waitUntil:load instead of networkidle for /kiosk/display, preventing the SSE persistent connection from blocking the 30 s timeout. Commit 3b8f152.',
    notes: ['scripts/visual-qa.mjs. The SSE stream keeps the network active indefinitely -- load fires once the initial HTML is parsed, which is the right signal for this page.'],
  },
  {
    title: 'VAT breakdown absent from webhook-triggered booking receipts (BLD-347)', type: 'ERROR', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 8, effort: 3,
    detail: 'finalizeBookingCharge() in lib/booking-actions.ts now computes VAT and passes it to the receipt email, matching chargeBooking() on the direct path. Clients charged via Stripe webhook (saved-card on-day charges) now receive VAT-breakdown receipts. Commit 57bee02.',
    notes: ['lib/booking-actions.ts. Extracted VAT logic is consistent with chargeBooking() direct path.'],
  },
  {
    title: 'Promise.all crash risk in finance controls route (BLD-350)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 7, effort: 3,
    detail: 'app/api/admin/finance/controls/route.ts VAT and kiosk ops replaced Promise.all with Promise.allSettled so a single DB write failure no longer crashes the entire endpoint. Partial failures are detected and surfaced cleanly. Commit 57bee02.',
    notes: ['app/api/admin/finance/controls/route.ts. Search route already used a safe() wrapper; stripe webhook cascade was reviewed as acceptable.'],
  },
  {
    title: 'Enable appointment reminder emails -- 48h and 72h flags off by default (BLD-351)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 7, effort: 1,
    detail: 'reminder_48h and reminder_72h defaults changed to true in lib/settings.ts. Clients now receive pre-appointment reminder emails automatically. Commit 57bee02.',
    notes: ['lib/settings.ts. No schema change; the automation was already complete and tested.'],
  },
  {
    title: 'Add noindex meta to /book booking entry page (BLD-352)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 7, effort: 1,
    detail: 'app/(marketing)/book/page.tsx now exports generateMetadata with robots: { index: false }. Consistent with /booking/pay, /booking/card and /booking/manage. Commit 57bee02.',
    notes: ['app/(marketing)/book/page.tsx. Thin transactional page no longer wastes crawl budget.'],
  },
  {
    title: 'Academy portal security & data-lifecycle parity -- phases 2 & 3 (BLD-314)', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 7, effort: 6,
    detail: 'Phase 2: password-reset flow for AcademyStudent (forgot-password + reset routes, timing-safe token, epoch bump on reset). Phase 3: /academy/* middleware secure-by-default gate (public catalogue slugs excepted; trainee-only reserved paths listed). eraseStudentData() GDPR Art.17 action on app/admin/actions.ts. Daily cron retention sweep added. Commit 3b8f152.',
    notes: ['middleware.ts, lib/academy-auth.ts, app/(marketing)/academy/forgot-password, app/api/academy/account/*, app/admin/actions.ts, app/api/cron/daily/route.ts.'],
  },
  {
    title: 'WCAG 2.2 AA accessibility pass S3-S5 (BLD-313)', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 9, effort: 8,
    detail: 'S3: new accessible Dialog primitive (focus trap, Escape, aria-modal, focus restore) applied to EditClientDetails and ReplayList. S4: heading hierarchy fixed on offers, team, academy pages; aria-live region on KioskDisplay; aria-pressed on PublicGallery filters. S5: scope="col" on all 15 admin tables. Merged in PR #835 (commit 421beca).',
    notes: ['components/ui/Dialog.tsx (new). 15 admin table components. docs/projects/accessibility-aa.md updated.'],
  },
  {
    title: 'Academy content batch 7 -- Treatment Planning, Skin Pharmacology, Legal Frameworks (BLD-311)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 8, effort: 5,
    detail: '3 new modules across L2/L3/L4: "Treatment Planning & Client Records" (L2), "Skin Pharmacology & Topicals" (L3), "Legal Frameworks & Professional Accountability" (L4). Each: 2 lessons, 6-question quiz, 4-5 exam-bank questions. Merged in PR #835 (commit 421beca).',
    notes: ['lib/academy-content.ts. enrichCourseContentIfNeeded() picks up additions on the next daily cron run.'],
  },
  {
    title: 'Academy content batch 8 -- Electrical Safety, Combination Protocols, Client Psychology (BLD-311)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 8, effort: 5,
    detail: '3 new modules: "Electrical Safety & Equipment Maintenance" (L2), "Combination Protocols & Treatment Sequencing" (L3), "Client Psychology & Wellbeing" (L4). Each: 2 lessons, 6-question quiz. Plus 12 new exam-bank questions across all 4 courses.',
    notes: ['lib/academy-content.ts. enrichCourseContentIfNeeded() picks up additions on the next daily cron run.'],
  },
  {
    title: 'Race-safe order number allocation -- derive from last row, not count() (BLD-332)', type: 'ERROR', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 8, effort: 3,
    detail: 'nextOrderNumber() changed from db.order.count() to findFirst({ orderBy: { createdAt: desc } }) so order numbers are derived from the highest existing row rather than a row count. Added allocateOrderNumber() with a 5-retry loop + random jitter (0-20 ms) and a timestamp-based fallback, so concurrent checkouts can no longer produce duplicate KC#### candidates. Both checkout routes updated to call allocateOrderNumber(). Commit 0a654f5.',
    notes: ['lib/shop.ts: nextOrderNumber(), allocateOrderNumber(). app/api/shop/checkout/route.ts, app/api/admin/pos/route.ts.'],
  },
  {
    title: 'GDPR SAR export parity with Art. 17 erasure list (BLD-315)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 8, effort: 4,
    detail: 'Client SAR export now includes all 10 previously-missing data categories. Non-clinical (followUps, reviews, npsResponses, waitlist, referralsMade, points) added to main include. Clinical (aiAnalyses, beforePhotos, signedConsents, consultationNotes, appointmentSessions, chatConversations, callRecords) added to the canViewClinical block via parallel Promise.all queries. Previously the erasure deleted these records but the export never included them, violating GDPR Art. 15. Commit b212eca.',
    notes: ['app/api/admin/clients/[id]/export/route.ts. Erasure list in app/admin/actions.ts eraseClientData() used as the source of truth for parity.'],
  },
  {
    title: 'Academy content batch 9 -- Record Keeping, Acne Protocols, Medication Interactions (BLD-311)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 8, effort: 5,
    detail: '3 new modules: "Record Keeping & Data Protection in Practice" (L2 -- GDPR, SAR, retention, adverse event records), "Acne & Post-Inflammatory Hyperpigmentation Protocols" (L3 -- IPL mechanism, isotretinoin 6-month rule, PIH Fitzpatrick adjustment, tyrosinase prep), "Medication Interactions & Photosensitivity" (L4 -- photosensitisers, retinoid pause, anticoagulants, immunosuppressants, GP referral pathway). Each: 2 lessons, 6-question quiz. Plus 12 new exam-bank questions across L2/L3/L4.',
    notes: ['lib/academy-content.ts. enrichCourseContentIfNeeded() picks up additions on the next daily cron run.'],
  },
  {
    title: 'Google Workspace Directory API: manage mailboxes from admin dashboard (BLD-312)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 6, effort: 8,
    detail: 'Phase A + B shipped. lib/google-workspace.ts: service-account JWT (RS256 via jose), short-TTL token cache, listWorkspaceUsers/getWorkspaceUser/createWorkspaceUser/suspendWorkspaceUser/restoreWorkspaceUser/addUserAlias/removeUserAlias/listGroups/createGroup/addGroupMember/removeGroupMember. All functions no-op when credentials absent. API routes under /api/admin/integrations/google-workspace/* gated on settings.manage with logAudit on every write. /admin/workspace page: users table (status, last login, suspend/restore, alias add/remove) + groups tab (list, create). lib/integrations.ts: Workspace card. lib/admin-nav.ts: Workspace entry. lib/secrets.ts: GOOGLE_WORKSPACE_SA_KEY, GOOGLE_WORKSPACE_ADMIN_EMAIL, GOOGLE_WORKSPACE_CUSTOMER_ID added to SECRET_DEFS. Setup: see docs/GOOGLE_WORKSPACE_MIGRATION.md section 10.',
    notes: ['To activate: (1) In Google Cloud, enable Admin SDK API; (2) Create a service account + JSON key; (3) In Google Admin console Security -> API controls -> Domain-wide delegation, grant the client ID the Directory API scopes; (4) Paste the JSON key into Admin -> Credentials (GOOGLE_WORKSPACE_SA_KEY) and set the admin email (GOOGLE_WORKSPACE_ADMIN_EMAIL).'],
  },
  {
    title: 'refundBooking() race: concurrent refund clicks fire loyalty/Xero twice (BLD-355)', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 9, effort: 2,
    detail: 'Replaced plain db.booking.update with a compare-and-swap db.booking.updateMany (WHERE refundedPence = <value-we-read>). If two concurrent callers reach the side-effects block (loyalty points reversal, Xero credit note, webhook re-delivery), only the first one wins the CAS; the second sees count=0 and returns early. Stripe-side idempotency was already guarded via idempotencyKey "refund-<id>-from-<refundedPence>-<amount>" -- this closes the application-layer gap. Mirrors the identical guard already present in the charge.refunded webhook handler.',
    notes: ['lib/booking-actions.ts refundBooking(). CAS pattern: db.booking.updateMany({where:{id, refundedPence: booking.refundedPence}}).'],
  },
  {
    title: 'GDPR BLD-315 remaining: SAR export completeness + Art.17 erasure gaps (PR #850)', type: 'TASK', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 3,
    detail: 'Six remaining BLD-315 gaps not in PR #838 or commit b074702. SAR export (Art.15): adds loyalty points, AI analysis images, shop orders, consent requests, promo redemptions. Art.17 erasure: PromoRedemption.email was exported but never nulled on erasure -- fixed. GiftVoucher purchaser erasure: claimed-by erasure now also strips purchaserName/purchaserEmail; purchased-by erasure added via email match (pre-erasure email fetched before transaction). Consultations detail page: canViewClinical(role) -> sessionCan(session, clients.clinical.view) so per-user revocations are honoured.',
    notes: ['app/api/admin/clients/[id]/export/route.ts: points, aiAnalyses with images, shopOrders, consentRequests, promoRedemptions. app/admin/actions.ts: PromoRedemption.email null on erase, GiftVoucher purchaser fields on both claimed-by and purchased-by erasure. app/admin/consultations/[id]/page.tsx: revocable clinical gate. PR #850 (claude/bld315-sar-remaining).'],
  },
  {
    title: 'Shop confirm skips Stripe verification when stripePaymentIntentId is missing (BLD-411)', type: 'ERROR', urgency: 'P0', status: 'SHIPPED', assignee: 'claude',
    value: 9, effort: 2,
    detail: 'app/api/shop/confirm/route.ts: added explicit 402 rejection when order.stripePaymentIntentId is null. Previously the Stripe check was inside if (stripePaymentIntentId) so a missing PI id (DB write failure after Stripe returned) caused finalizeOrder to run with no payment evidence. Now returns 402 Payment not found. before any finalization. The Stripe verify block is now unconditional (always runs when the id is present).',
    notes: ['app/api/shop/confirm/route.ts line 18.'],
  },
  {
    title: 'setup_intent.succeeded DB failures return 200 -- Stripe will not retry, saved card lost (BLD-412)', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 7, effort: 1,
    detail: 'app/api/stripe/webhook/route.ts line 131: added setup_intent.succeeded to the critical events set that returns 500 on DB failure. Without this, a transient DB error during setup_intent.succeeded returns 200, Stripe marks it delivered and never retries -- the payment method is not stored and the booking stays unchargeable.',
    notes: ['app/api/stripe/webhook/route.ts critical const.'],
  },
  {
    title: 'logAudit() silently swallows all write failures -- compliance gaps invisible (BLD-394)', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 8, effort: 1,
    detail: 'lib/audit.ts: catch block now calls console.error with the failure message and opts.action/actor so Sentry/monitoring surfaces audit table outages. The primary action is still never blocked (swallowing behaviour preserved). Ref BLD-394.',
    notes: ['lib/audit.ts logAudit() catch block.'],
  },
  {
    title: 'Health form -- custom boolean questions crash portal with null options (BLD-405)', type: 'ERROR', urgency: 'P0', status: 'SHIPPED', assignee: 'claude',
    value: 8, effort: 2,
    detail: 'Two fixes: (1) app/admin/health-forms/actions.ts addCustomQuestion(): boolean fieldType now auto-injects [{value:yes,label:Yes},{value:no,label:No}] options instead of null, matching the behaviour of built-in boolean questions. (2) components/portal/AssessmentRunner.tsx Field(): for single/boolean types, falls back to built-in Yes/No options when q.options is undefined/null (defensive guard for rows saved before this fix). This eliminates the TypeError crash that showed "Something went wrong. We couldnt load this just now." in the client portal.',
    notes: ['app/admin/health-forms/actions.ts needsOptions. components/portal/AssessmentRunner.tsx Field.'],
  },
  {
    title: 'Sentry DSN not validated at startup -- all unhandled errors silently dropped if unset (BLD-415)', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 9, effort: 2,
    detail: 'instrumentation.ts register(): added console.warn when neither SENTRY_DSN nor NEXT_PUBLIC_SENTRY_DSN is set, so the missing config is visible in Vercel function logs. .env.example: added SENTRY_DSN and NEXT_PUBLIC_SENTRY_DSN entries with explanatory comments.',
    notes: ['instrumentation.ts. .env.example Sentry section.'],
  },
  {
    title: 'Booking: change consultation duration to 15 min; sub-service selection already live (BLD-406)', type: 'TASK', urgency: 'P0', status: 'SHIPPED', assignee: 'claude',
    value: 7, effort: 1,
    detail: 'app/admin/bookings/create-action.ts: consultation durationMin changed from 30 to 15 (both the standalone Consultation slug and any treatment booked as a consultation via asConsultation:true). Sub-service selection (part 2 of BLD-406) is already implemented -- the NewBookingButton shows a variant dropdown when a treatment category has variants configured. Owner action required to populate sub-services: Admin -> Services, expand each treatment category (Laser Hair Removal, Facials, Body Treatments etc.), and add the specific procedures as variants with their own duration and price.',
    notes: ['app/admin/bookings/create-action.ts line 83. Owner: add variants in Admin -> Services for the sub-service dropdown to appear.'],
  },
  {
    title: 'Course lessons: PDF attachment upload and download (BLD-407)', type: 'TASK', urgency: 'P0', status: 'SHIPPED', assignee: 'claude',
    value: 6, effort: 3,
    detail: 'Added pdfUrls String[] field to Lesson model. Extended academy blob-token route to accept application/pdf (up to 500 MB, same Vercel Blob store as lesson videos). CurriculumManager lesson editor shows a PDF attachment panel -- admins upload PDFs, see a list with View/Remove per file, and the URLs are saved via updateLesson. Student-side ImmersiveCourse LessonStep shows a Lesson resources panel with PDF icon links for view/download. Refs BLD-407.',
    notes: ['prisma/schema.prisma Lesson.pdfUrls, app/api/admin/academy/blob-token/route.ts, lib/lms.ts, app/api/admin/lms/route.ts, components/admin/CurriculumManager.tsx, app/admin/academy/[courseId]/page.tsx, components/academy/ImmersiveCourse.tsx.'],
  },
  {
    title: 'Health Record Not Rendering -- readAssessment crashes page on corrupt cipher (BLD-423)', type: 'ERROR', urgency: 'P0', status: 'SHIPPED', assignee: 'claude',
    value: 8, effort: 1,
    detail: 'lib/health-assessments.ts readAssessment(): decryptJson was not wrapped in try/catch, so any health assessment with a missing or corrupt cipher would throw and crash the entire /admin/clients/[id] page (all assessments hidden). Fix: decryptJson now wrapped in try/catch returning null on failure; app/admin/clients/[id]/page.tsx formatAssessment loop also wrapped in try/catch so one bad record skips rather than breaks the page.',
    notes: ['lib/health-assessments.ts readAssessment(). app/admin/clients/[id]/page.tsx formatAssessment loop.'],
  },
  {
    title: 'Health form -- multi-type custom questions crash portal with null options (BLD-405 multi)', type: 'ERROR', urgency: 'P0', status: 'SHIPPED', assignee: 'claude',
    value: 7, effort: 1,
    detail: 'components/portal/AssessmentRunner.tsx Field() multi branch: q.options!.map() threw a runtime TypeError when options was null/undefined (e.g. a multi question saved before validation was in place). Boolean questions already had a guard; multi did not. Fix: add null guard opts = q.options ?? []; early-return a user-facing message when opts is empty rather than crashing the whole form.',
    notes: ['components/portal/AssessmentRunner.tsx Field() function, multi branch line ~212.'],
  },
  {
    title: 'Meta Pixel blocked by CSP -- connect.facebook.net missing from script-src/connect-src (BLD-395)', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 7, effort: 1,
    detail: 'next.config.mjs CSP: connect.facebook.net missing from script-src (pixel script blocked) and connect.facebook.net + graph.facebook.com missing from connect-src (pixel events blocked). Fixed by adding those origins to the relevant directives.',
    notes: ['next.config.mjs script-src and connect-src directives.'],
  },
  {
    title: 'Stripe booking-balance underpayment not rejected -- manipulated Checkout can confirm on short payment (BLD-396)', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 8, effort: 2,
    detail: 'app/api/stripe/webhook/route.ts payment_intent.succeeded handler: no amount check for booking_balance kind. A client with devtools access could pay less than the booking price and the webhook would confirm the booking. Fix: look up booking.pricePence when kind=booking_balance; if amount_received < pricePence break without finalising.',
    notes: ['app/api/stripe/webhook/route.ts payment_intent.succeeded case, booking_balance guard.'],
  },
  {
    title: '/team page indexes placeholder GMC/GDC numbers -- medical site risk (BLD-397)', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 6, effort: 1,
    detail: 'lib/team.ts: added publishedTeam filter (excludes entries whose credentials contain "[" brackets -- i.e. placeholder registration numbers). app/(marketing)/team/page.tsx: returns 404 and noindex when no published team members exist; only publishedTeam entries appear in the static fallback grid.',
    notes: ['lib/team.ts publishedTeam. app/(marketing)/team/page.tsx.'],
  },
  {
    title: 'Privacy policy missing Xero, TrueLayer, Yay.com, Google as data processors -- UK GDPR Art.13/14 gap (BLD-398)', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 6, effort: 1,
    detail: 'lib/info-pages.ts Privacy Policy "Sharing your data" and "International transfers" sections updated to name Xero (accounting), TrueLayer (bank feed/payments), Yay.com (calls/recordings) and Google (Calendar + Workspace) as data processors, with notes on UK/US transfer safeguards and Xero AU data processing.',
    notes: ['lib/info-pages.ts Privacy Policy Sharing/International sections.'],
  },
  {
    title: 'Inactive dentistry treatment pages indexed while dentistryLive=false (BLD-403)', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 5, effort: 1,
    detail: 'app/(marketing)/[slug]/page.tsx generateMetadata: dentistry treatment pages now served with noindex when site.dentistryLive is false, preventing inactive booking pages with placeholder CTAs from being crawled and indexed.',
    notes: ['app/(marketing)/[slug]/page.tsx generateMetadata, site.dentistryLive flag.'],
  },
  {
    title: 'Manage-booking links broken -- reminder emails and portal use ?token= but /booking/manage reads ?t= (BLD-454)', type: 'ERROR', urgency: 'P0', status: 'SHIPPED', assignee: 'claude',
    value: 9, effort: 1,
    detail: 'lib/automations.ts reminder email manageUrl and app/account/appointments/page.tsx portal Manage-booking link both built URLs with ?token= param; /booking/manage reads ?t=, so tapping the link landed with no booking loaded. Fixed both callers to use ?t=.',
    notes: ['lib/automations.ts manageUrl line ~361. app/account/appointments/page.tsx Link href.'],
  },
  {
    title: 'Meta CAPI purchase event sent without marketing consent -- UK GDPR Art.6 breach (BLD-455)', type: 'ERROR', urgency: 'P0', status: 'SHIPPED', assignee: 'claude',
    value: 9, effort: 1,
    detail: 'lib/booking-actions.ts finalizeBookingCharge(): sendPurchase was called with email: booking.client.email unconditionally, sending the SHA-256-hashed email to Meta CAPI regardless of marketingOptIn. Fixed: email is now only passed if booking.client.marketingOptIn is true, matching the guard already present in app/admin/bookings/actions.ts.',
    notes: ['lib/booking-actions.ts finalizeBookingCharge(), sendPurchase call.'],
  },
  {
    title: 'Above-fold treatment images missing priority prop -- LCP regression on homepage (BLD-457)', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 8, effort: 1,
    detail: 'app/(marketing)/page.tsx dual-discipline section: the two MediaArt cards (laser-hair-removal, veneers) are LCP candidates on desktop but lacked the priority prop, causing Next.js to lazy-load them. Added priority to both MediaArt calls.',
    notes: ['app/(marketing)/page.tsx dual-discipline MediaArt map.'],
  },
  {
    title: '/book page has noindex:true -- primary booking page invisible to search engines (BLD-458)', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 8, effort: 1,
    detail: 'app/(marketing)/book/page.tsx generateMetadata: removed noindex: true so the keyword-rich bottom-funnel booking page is no longer excluded from organic search.',
    notes: ['app/(marketing)/book/page.tsx generateMetadata pageMeta call.'],
  },
  {
    title: 'Add root app/error.tsx -- uncaught render errors bypass all recovery boundaries (BLD-460)', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 7, effort: 1,
    detail: 'Created app/error.tsx following the Sentry.captureException + reset button pattern used in app/admin/error.tsx. Catches render errors for pages directly under app/ that would otherwise skip segment-level boundaries.',
    notes: ['app/error.tsx (new file).'],
  },
  {
    title: 'Visual-QA: fix false P1 timeout on kiosk display/session/result pages (BLD-328)', type: 'TASK', urgency: 'P3', status: 'SHIPPED', assignee: 'claude',
    value: 3, effort: 1,
    detail: 'scripts/visual-qa.mjs: (1) kiosk/<token> and /kiosk/result/<slug> inline goto calls changed from networkidle to load; (2) /kiosk/display changed from load to domcontentloaded — the SSE channel + animation timers prevent the load event from ever firing on that page, causing a recurring false P1 30s timeout every QA run.',
    notes: ['scripts/visual-qa.mjs lines 137, 188, and 212.'],
  },
  {
    title: 'Newsletter mid-page capture: homepage, dentistry, packages (BLD-353)', type: 'TASK', urgency: 'P3', status: 'SHIPPED', assignee: 'claude',
    value: 9, effort: 3,
    detail: 'Created components/layout/NewsletterCapture.tsx -- a reusable ink-background section wrapping NewsletterForm with eyebrow, heading and strapline. Added as a mid-page section to the homepage (after testimonials), dentistry page (before RegisterInterest), and packages page (after the package list). Footer already has the form; this adds high-intent mid-page capture points on the three pages the audit identified.',
    notes: ['components/layout/NewsletterCapture.tsx (new). app/(marketing)/page.tsx, app/(marketing)/dentistry/page.tsx, app/(marketing)/packages/page.tsx.'],
  },
  {
    title: 'Academy content batch 10 -- Fitzpatrick Assessment, Vascular Protocols (BLD-311)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 8, effort: 5,
    detail: '2 new modules: "Fitzpatrick Skin Typing & Skin Assessment" (L2 -- Fitzpatrick I-VI, tan timing, contraindications, asymmetric mole referral, assessment documentation) and "Vascular Lesion Treatment with IPL & Laser" (L3 -- haemoglobin chromophore, lesion types, wavelength selection by skin type, test-patch protocol, expected response, aftercare). Each module: 2 lessons + 6-question quiz. Plus 12 new exam-bank questions (Batch 10) covering Fitzpatrick typing, vascular protocols, consent law (Health and Care Act 2022), duty of candour, and MHRA reporting.',
    notes: ['lib/academy-content.ts. enrichCourseContentIfNeeded() picks up additions on the next daily cron run.'],
  },
  {
    title: 'BLD-285 remaining: QA demo seed users per role (DEVELOPER, CONTRACTOR, PRACTITIONER, RECEPTION)', type: 'TASK', urgency: 'P3', status: 'SHIPPED', assignee: 'claude',
    value: 3, effort: 2,
    detail: 'prisma/seed.mjs: added QA demo user creation (four roles: PRACTITIONER, RECEPTION, DEVELOPER, CONTRACTOR) using qa-<role>@kaulindustries.com emails. Guarded by SEED_QA_ROLES=true env var so it never runs in production by default. Notify permissions (timetracking keys) and contractor task assignment notification were already shipped in an earlier slice.',
    notes: ['prisma/seed.mjs. Run: SEED_QA_ROLES=true SEED_QA_PASSWORD=<pw> node prisma/seed.mjs'],
  },
  {
    title: 'Academy content batch 11 -- Laser Safety, Skin Analysis, Evidence & Audit (BLD-311)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1128),
    value: 8, effort: 5,
    detail: '3 new modules added to lib/academy-content.ts: L2 Laser Safety & Equipment (2 lessons + 6-question quiz: Class 3B/4 hazards, controlled areas, PPE, eye protection); L4 Skin Analysis Techniques (2 lessons + 6-question quiz: pre-cleanse assessment, skin type vs condition, magnifying lamp, documentation); L5-7 Evidence-Based Practice & Clinical Audit (2 lessons + 6-question quiz: evidence hierarchy, red flags, 5-step audit cycle, re-audit). Plus batch 11 exam bank: 16 new questions across all three areas.',
    notes: ['lib/academy-content.ts (SHA 5525053). enrichCourseContentIfNeeded() picks up additions on the next cron run.'],
  },
  {
    title: 'Academy content batch 12 -- Skin Anatomy, Skin Tightening/HIFU/Cryo, Medication Clearance (BLD-311)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 8, effort: 5,
    detail: '3 new modules in lib/academy-content.ts: L2 Skin Anatomy & the Laser Target (2 lessons + 6-question quiz: skin layers/melanocytes, hair follicle/anagen phase); L3 Skin Tightening, HIFU & Body Contouring (2 lessons + 6-question quiz: RF/HIFU mechanisms, cryolipolysis/contraindications); L4 Medication Interactions & Pre-treatment Medical Clearance (2 lessons + 6-question quiz: photosensitisers/anticoagulants/isotretinoin, GP clearance protocols). Plus 12 new batch 12 exam-bank questions across L2/L3/L4.',
    notes: ['lib/academy-content.ts. enrichCourseContentIfNeeded() picks up additions on the next cron run.'],
  },
  {
    title: 'Kiosk campaign: share-gated claim UX + AI caption in share text (PRJ-1.14)', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1128),
    project: 'skin-smile-kiosk',
    value: 9, effort: 2,
    detail: 'Campaign launch: owner brief is brand awareness + bookings via share-to-claim discount (up to 25%). Gap: ClaimReward showed the form immediately with no share gate in the UI; users hitting claim before sharing got a confusing server error. Fix: ShareButtons now fires onShared callback on every share action; ClaimReward shows a locked card ("Share to unlock") until hasShared; KioskSessionFlow wires state. Also: result GET route now returns shareCaption so the AI-written first-person caption appears in WhatsApp/X/native share text.',
    notes: [
      'components/kiosk/ShareButtons.tsx, ResultCard.tsx, ClaimReward.tsx, KioskSessionFlow.tsx (SHA 19b17b6).',
      'app/api/kiosk/results/[id]/route.ts -- added shareCaption to select.',
      'Server-side share gate (claimKioskDiscount validates session.status === SHARED) was already correct; this PR adds the matching UI gate.',
    ],
  },
  {
    title: 'Academy cohort names + student list per cohort (BLD-484)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1131),
    value: 7, effort: 3,
    detail: 'Cohort model gets a nullable name field. Admin academy UI: add-cohort form has a name input; each cohort row shows the name as its label (falls back to date), has an inline name editor, and a collapsible student list (name, email, status) with Remove from cohort action. Applications enrolment dropdown now shows cohort names. Schema change is additive (String?).',
    notes: [
      'prisma/schema.prisma, app/api/admin/academy/route.ts, components/admin/AcademyManager.tsx, app/admin/academy/enrolments/page.tsx, app/admin/academy/page.tsx (SHA 69c0ef5 on claude/cohort-management-484).',
      'Student list on /admin/academy courses overview always shows 0 -- enrolments not fetched there; full data is on /admin/academy/enrolments.',
    ],
  },
  {
    title: '/team page driven by live staff records + public-profile toggle (BLD-487)', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1134),
    value: 8, effort: 2,
    detail: 'Owner trigger: /team must show real staff photos and correct GMC/GDC numbers, not placeholder content. Fix: /team now driven solely by publicTeam() query (AdminUser where active=true AND publicProfile=true); empty state shows "coming soon" card + noindex. StaffManager gets a team-page count banner and per-row public-profile toggle explaining deactivation behaviour.',
    notes: [
      'app/(marketing)/team/page.tsx, components/admin/StaffManager.tsx (SHA 556250b -- feat already on main).',
      'Security fix (SHA 7fe45b3, PR #1134): login email removed from publicTeam() select and team card -- it was the credential username, exposed as a mailto: link. publicPhone stays. Found by Opus 4.8 review.',
      'PR #1129 was based on a stale branch and closed; PR #1134 carries only the security fix commit on a clean base.',
    ],
  },
  {
    title: 'Live Appointment Session -- Remove Addon Treatments + Session Photos (BLD-479, BLD-480)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1135),
    value: 7, effort: 3,
    detail: 'BLD-479: Photo uploads in the live session runner -- BeforePhotoCapture integrated pre-start and in-treatment for laser gate compliance. BLD-480: Staff can now remove an add-on treatment mid-session via removeAddonTreatment() server action; guarded against charged or non-addon items; adjusts pricePence + durationMin; logs SESSION_EDITED audit event. AddonList component with per-item Remove/confirm dialog.',
    notes: [
      'app/admin/bookings/clinical-actions.ts, app/admin/bookings/[id]/session/page.tsx, components/admin/session/SessionRunner.tsx (SHA 8aeb194 on claude/booking-session-improvements-479-480-v2).',
      'PR #1132 was based on a stale branch and closed; PR #1135 is a clean cherry-pick on current main.',
    ],
  },
  {
    title: 'Academy course promotional pricing + homepage banner (BLD-490)', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1136),
    value: 7, effort: 3,
    detail: 'Admin sets a promo price (pence) and optional start/end dates per course. Public course page shows promo price (gold) + struck-through original when active. Academy homepage shows a gold banner when any course has an active promo. Active promo = promoPrice set AND (promoStartAt null OR <= now) AND (promoEndAt null OR >= now). Includes migration file for the 3 new Course columns.',
    notes: [
      'prisma/schema.prisma (promoPrice Int?, promoStartAt DateTime?, promoEndAt DateTime? added to Course -- additive, nullable).',
      'prisma/migrations/20260618150000_course_promo_pricing/migration.sql -- idempotent ADD COLUMN IF NOT EXISTS.',
      'lib/academy-utils.ts (new, getActivePromo() helper), lib/academy.ts (CourseView extended), app/api/admin/academy/route.ts, components/admin/AcademyManager.tsx, app/(marketing)/academy/[slug]/page.tsx, app/(marketing)/academy/page.tsx (SHAs 6097bcb + 949f7f8).',
    ],
  },
  {
    title: 'Academy route ops lack tenantId scope guard (BLD-484 Opus finding)', type: 'ERROR', urgency: 'P2', status: 'TRIAGE', assignee: 'claude',
    value: 5, effort: 2,
    detail: 'Opus 4.8 review found updateEnrolment, removeCohort, removeEnrolment in app/api/admin/academy/route.ts use db.enrolment.update/delete({ where: { id } }) with no tenantId filter. Create paths set tenantId. A permitted admin in one tenant could mutate another tenants enrolment/cohort by ID. Route is auth-gated (requirePermission). Fix: add tenantId filter to every update/delete where clause. Predates BLD-484; affects all existing ops.',
    notes: ['Logged from Opus 4.8 review of BLD-484 (2026-06-18). Low practical risk on single-clinic deploy; must be fixed before multi-tenant or if other clinics are onboarded.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Video content is no uploading to courses.', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude', pr: PR(1224),
    value: 9, effort: 1,
    detail: 'Owner-reported (info@kclinics.co.uk): uploading a training video to a lesson failed or did not appear afterwards. Root cause: uploadVideo/uploadAudio in components/admin/CurriculumManager.tsx only set the URL in local React state and relied on a separate manual "Save lesson" click to persist it — so the upload was lost if staff navigated away first. uploadPdf/uploadAttachment already auto-saved; video/audio did not.',
    notes: [
      'Fix: uploadVideo + uploadAudio now auto-save the lesson immediately after upload (await act(lessonSavePayload(updated))), matching the PDF/attachment handlers. components/admin/CurriculumManager.tsx.',
      'Blob path was already correct: /api/admin/academy/blob-token allows video/* up to 500 MB with a client-direct fallback above the ~4.4 MB serverless cap. A genuinely large/slow upload can still hit the existing 3-min timeout alert — separate from this persistence bug.',
      'Follow-up (closes the remaining failure modes): (1) the blob-token allowedContentTypes only listed a few video MIME types and NO audio — broadened to category wildcards (video/*, audio/*, image/*) + common docs so .mkv/.avi videos and all audio are accepted (Vercel Blob supports type/* wildcards). (2) The small-file server route /api/admin/blob-upload OK regex omitted audio — added audio/* types + pptx/ppt. (3) The flat 180s client timeout aborted large HD videos mid-upload — now scales with file size (3-min floor + ~1 min/10 MB, capped 30 min). components/admin/CurriculumManager.tsx, app/api/admin/academy/blob-token/route.ts, app/api/admin/blob-upload/route.ts.',
    ],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'SMS dummy mode silently returns ok:true — no visibility when Twilio is unconfigured', type: 'TASK', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude', pr: PR(1225),
    value: 5, effort: 2,
    detail: 'lib/sms.ts returned { ok: true, id: dummy-sms } when Twilio env vars were absent, with only a console.log — so staff could believe appointment reminders/confirmations were being sent when they were not.',
    notes: [
      'Fix (no change to send behaviour): api-health Twilio check now reports AMBER (visible warning) not grey when unconfigured (Admin → Connections); sendSms dummy path logs console.warn + returns dummy:true; instrumentation.ts warns at startup when Twilio env vars are missing (mirrors the BLD-415 Sentry check). lib/sms.ts, lib/api-health.ts, instrumentation.ts.',
      'ok:true kept so existing smsConfigured()-gated callers (booking-notify, automations) are unaffected.',
    ],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Client Account Access', type: 'ERROR', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude', pr: PR(1227),
    value: 7, effort: 2,
    detail: 'Owner-reported (info@kclinics.co.uk): manually-created clients cannot log in, and "Reset Password" sent no email. Root cause: requestPasswordReset only emails accounts that already have a passwordHash, and manually-created clients have none — so they can neither sign in nor receive a reset. There was also no admin action to send the existing passwordless activation link.',
    notes: [
      'Fix: added a staff "Send login link" action on the client profile (Admin → Clients → client). It issues a passwordless activation token (createAccountInvite) and emails the /account/activate link (new tmplPortalInvite), which signs the client in and lets them set a password later. Reuses the activation flow already used by request-card (BLD-482). app/admin/actions.ts (sendPortalInvite), components/admin/ClientActions.tsx (SendPortalInvite), app/admin/clients/[id]/page.tsx, lib/email.ts.',
      'No schema change: emailEvent logged under the existing MANUAL kind.',
    ],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Replace all email addresses across the website with: support@kclinics.co.uk', type: 'TASK', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude', pr: PR(1229),
    value: 5, effort: 2,
    detail: 'Owner (inna.k) asked for a single contact address site-wide. Site config (lib/site.ts email/emailHref) + footer + contact page already used support@; remaining hardcoded hello@/info@ references were replaced.',
    notes: [
      'lib/info-pages.ts (all legal/policy contact lines), careers/academy/funding apply routes + booking-notify clinic-notify fallback (info@ → support@), lib/push.ts VAPID contact, and two admin input placeholders → support@.',
      'Left unchanged: Resend sender/reply-to on the verified mail. subdomain (hello@mail.kclinics.co.uk / replies@reply.mail…) — changing them breaks delivery — and illustrative staff-account/alias placeholders (user@/name@/alias@/admin@).',
    ],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Full Day Closure', type: 'TASK', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude', pr: PR(1230),
    value: 6, effort: 2,
    detail: 'Owner (inna.k) wanted a "Clinic Closed" option on /admin/calendar to block all bookings for every staff member on selected dates — the calendar only let them block their own time.',
    notes: [
      'The ClinicClosure backend already existed and is enforced (model, /api/admin/closures, lib/availability.ts dayClosures). Gap was a create/reopen control on the calendar.',
      'Fix: new CalendarClosureButton on the calendar day header (schedule.manage-gated) — "Close clinic" creates an all-day closure for the date; "Reopen clinic" removes it when already closed. components/admin/CalendarClosureButton.tsx, app/admin/calendar/page.tsx. No schema/backend change.',
    ],
  },

  // ── Project: Full Google Analytics visualisation (ga-analytics) ─────────────
  // Owner asked to surface all GA data in-platform (visits, time, pages,
  // journeys) across marketing + dashboard. Epic + its work items below.
  {
    title: 'Full Google Analytics visualisation in the platform — epic', type: 'IDEA', urgency: 'P2', status: 'IN_PROGRESS', assignee: 'claude', project: 'ga-analytics',
    value: 7, effort: 5,
    detail: 'Surface all the useful GA4 data inside the admin instead of sending the owner to the Google Analytics console: total visits/visitors, time on site, page views, top pages, traffic by channel, devices, countries and where visitors land/journey — across the marketing section and the dashboard. Builds on the existing GA4 Data API client and connected Google account; no-ops cleanly until GA4_PROPERTY_ID is set.',
    notes: ['Formed from the owner request: "Add in more data from google analytics in the admin marketing section & dashboard — total visits, time spent, pages, journey etc. Basically full visualisation of all GA data in platform."'],
  },
  {
    title: 'GA4: expand the Data API client to a full batched report', type: 'TASK', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude', project: 'ga-analytics',
    value: 7, effort: 3,
    detail: 'Grow lib/ga4-data.ts from a single channel report into ga4FullReport(): overview totals (visitors, new users, sessions, page views, avg session duration, engagement/bounce rate, views/session, conversions), daily sessions trend, top pages with avg engagement time, channels, device + country breakdowns, and landing pages (journey entry → conversion). Two batchRunReports calls run concurrently; degrades to configured:false when Google isn’t connected or GA4_PROPERTY_ID is unset.',
    notes: ['Shipped on branch claude/ga4-analytics (PR pending GitHub reconnect). Keeps the existing ga4Performance() for the Performance page.'],
  },
  {
    title: 'GA4: Website analytics page + marketing dashboard snapshot', type: 'TASK', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude', project: 'ga-analytics',
    value: 7, effort: 3,
    detail: 'New /admin/marketing/analytics page: 7/28/90-day range selector, overview KPI tiles, an inline SVG daily-sessions trend, top pages, traffic by channel, device + country bars, and a landing-page/journey table — no chart dependency, house style. Marketing hub gains a GA traffic snapshot (visitors/sessions/views/avg time) linking through, plus a nav card.',
    notes: ['Shipped on branch claude/ga4-analytics (PR pending GitHub reconnect).'],
  },
  {
    title: 'GA4: dashboard widget for role-based dashboards', type: 'TASK', urgency: 'P3', status: 'IN_REVIEW', assignee: 'claude', project: 'ga-analytics',
    value: 5, effort: 3,
    detail: 'Add a compact GA traffic widget to the management dashboard so owners/marketers see live visits + trend on their landing dashboard, not only inside the marketing section. Reuses ga4FullReport().',
    notes: ['Shipped on branch claude/ga4-analytics (PR pending GitHub reconnect): GaTrafficWidget (visitors/sessions/views/avg visit + mini sparkline), rendered on the admin/Management dashboard inside a Suspense boundary (campaigns.view-gated) so a slow GA call streams in without blocking the dashboard; renders nothing until GA is connected.'],
  },
  {
    title: 'GA4: real-time active users + events/funnel breakdown', type: 'TASK', urgency: 'P3', status: 'TRIAGE', assignee: 'claude', project: 'ga-analytics',
    value: 4, effort: 4,
    detail: 'Layer GA4 realtime (runRealtimeReport — active users right now) onto the analytics page, and an events/key-events table (eventName counts) so the owner can see the on-site event funnel (view → engage → book) without leaving the platform.',
  },
  {
    title: 'Board: “Promote to project” action in the UI', type: 'TASK', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 6, effort: 3,
    detail: 'Owner noted the board had no way to turn an item into a project — projects were code-only (lib/build-backlog.ts PROJECTS, materialised by syncProjects). Added a UI path: a Project section on the task drawer (manager-gated) to promote an item into a new project (enter a name) or an existing one, or detach it.',
    notes: ['Shipped on branch claude/ga4-analytics (PR pending GitHub reconnect): promoteToProject() in lib/build-board.ts (creates a DB-only project with a unique derived slug + PRJ ref, or links an existing one; logs a board event), a promote-to-project op on /api/admin/build (build.manage-gated), and the Project control in components/admin/BuildBoard.tsx. UI-created projects are DB-only and safe — syncProjects only upserts/links, never deletes.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Before/after gallery photos bypass next/image entirely', type: 'TASK', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 8, effort: 3,
    detail: 'components/ui/BeforeAfter.tsx (used by the public /gallery page) renders real client photography as raw <img> tags with no width/height, no next/image, no lazy loading -- despite AVIF/WebP already being enabled in next.config.mjs. Every card in the grid ships full-size, unconverted originals and loads eagerly. Fix: swap both <img> tags for next/image with fill/explicit dimensions and sizes, matching the pattern already used in components/ui/MediaArt.tsx. Found in End-of-Day audit (performance discipline).',
    notes: ['Swapped both the after and before <img> tags in BeforeAfter.tsx for next/image Image components using fill (the existing container is already position:relative with an aspect-ratio className from PublicGallery.tsx) plus a responsive sizes attribute and object-cover, mirroring MediaArt.tsx. The drag/reveal slider logic (pointer handlers, clip-path, ref-based bounding-rect math) is untouched.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'kiosk-cleanup cron has no error handling — GDPR photo-retention sweep can silently fail', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 6, effort: 2,
    detail: 'app/api/cron/kiosk-cleanup/route.ts has no top-level try/catch, no Sentry.captureException, and no CRON_ALERT_WEBHOOK_URL post — unlike its sibling crons (cron/daily, cron/dispatch). An exception mid-run (e.g. a Vercel Blob delete failing) aborts the GDPR photo-retention sweep with a bare 500 that nobody is watching. Fix: wrap the handler body in try/catch and report failures the same way cron/daily and cron/dispatch do. Found in End-of-Day audit (reliability discipline).',
    notes: ['Wrapped the two-pass GDPR sweep in a top-level try/catch. On failure: logs, reports to Sentry via captureException (matching the top-level-handler pattern used in app/api/stripe/webhook/route.ts), posts a failure summary to CRON_ALERT_WEBHOOK_URL when configured (matching cron/daily and cron/dispatch), and returns a 500 with the error message instead of an unhandled crash.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Client self-service password change doesn\'t revoke other sessions', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 8, effort: 2,
    detail: 'app/api/account/profile/route.ts:32-46,68-70 updates passwordHash on password change but never bumps sessionEpoch -- unlike the admin (app/api/admin/profile/route.ts:42, "so any other stolen sessions are revoked") and academy (lib/academy-auth.ts changeAcademyPassword()) equivalents, which both increment it for exactly this reason. getClientSession() already checks session.epoch, the mechanism just isn\'t used here. A client with a stolen/copied session cookie keeps full account access after the legitimate owner "secures" the account by changing their password. Fix: add sessionEpoch: {increment: 1} and re-issue the caller\'s session, mirroring app/api/admin/profile/route.ts:38-43. Found in End-of-Day audit (security discipline).',
    notes: ['Fix: app/api/account/profile/route.ts now sets sessionEpoch: {increment: 1} alongside passwordHash on password change, then re-issues the caller\'s own client-session cookie via createClientSession() (lib/auth.ts) with the new epoch so the account holder\'s own device stays signed in while every other outstanding session (old epoch) fails getClientSession()\'s epoch check on its next request.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Gift-card balance can be permanently lost if a shop order fails to create', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 2,
    detail: 'app/api/shop/checkout/route.ts:51-73 calls reserveVoucher() (atomically decrementing the card) before db.order.create(...), with no try/catch around the create — a transient DB error there leaves the reserved balance decremented with no order and no code path that ever restores it. Fix: wrap db.order.create in try/catch and call creditVoucher() on failure, or reserve the voucher only after the order row exists. Found in End-of-Day audit (finance/commerce discipline).',
    notes: ['Fix: wrapped db.order.create in try/catch; on failure, calls creditVoucher() to restore the reserved gift-card balance before returning a 500. app/api/shop/checkout/route.ts.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Redeemed loyalty points don\'t reduce the amount charged for a booking', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 9, effort: 3,
    detail: 'chargeBooking() charges the full booking.pricePence at every real charge site (lib/booking-actions.ts:355,504; admin manual charge in components/admin/BookingActions.tsx:35) — pointsRedeemedPence set by redeemPointsOnBooking (lib/client-loyalty.ts:284-318) is never subtracted anywhere a card is actually charged. A client who redeems points for money off still gets billed full price. Fix: subtract booking.pointsRedeemedPence from the amount passed to chargeBooking() at every call site, and pre-fill the admin charge UI net of it. Found in End-of-Day audit (finance/commerce discipline).',
    notes: ['Fix: cancelBooking() and rescheduleBooking() late/reschedule fee charges in lib/booking-actions.ts now net off booking.pointsRedeemedPence before calling chargeBooking(). The admin manual-charge UI (components/admin/BookingActions.tsx) pre-fills and labels the amount net of redeemed points.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Failed Stripe SetupIntent creation leaves an orphaned booking holding the slot forever', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 8, effort: 3,
    detail: 'app/api/booking/create/route.ts:125-207 creates a PENDING booking in its own transaction, then calls stripe().setupIntents.create() unprotected outside it. If Stripe throws, the outer catch returns a 503 but never deletes/cancels the already-created booking. lib/availability.ts treats PENDING bookings as slot-blocking indefinitely, and there\'s no cron that expires stale PENDING bookings with no setup intent. Fix: wrap the SetupIntent call so a failure cancels the just-created booking, or add a sweep that expires PENDING bookings older than N minutes with no stripeSetupIntentId. Found in End-of-Day audit (reliability discipline).',
    notes: ['Fix: wrapped the SetupIntent call in try/catch; on failure the just-created booking is set to CANCELLED (freeing the slot immediately) and an audit log entry is recorded before returning a clean error. app/api/booking/create/route.ts.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Mobile nav link set in plain gold fails AA contrast on porcelain background', type: 'TASK', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 6, effort: 1,
    detail: 'The mobile drawer renders "Or request a free consultation" using text-[var(--color-gold)] (#a98a6d) on the porcelain (#f6ece3) mobile drawer background. Contrast is ~2.8:1, below WCAG AA\'s 4.5:1 minimum for normal text. docs/BRAND_GUIDELINES.md documents plain gold as decorative/large-text-only; --color-gold-deep (#816748) is the AA-safe text variant.',
    notes: ['Fix: switched the "Or request a free consultation" link to text-[var(--color-gold-deep)]. components/layout/Header.tsx. Checked the rest of the mobile drawer for the same static-gold-text pattern — the only other gold usage there ("Sign in / My account") is a hover-only accent on ink-soft text, not a persistently-rendered gold string, so left unchanged as a different pattern.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Mobile header hides the "Book Now" CTA behind the hamburger menu', type: 'TASK', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 8, effort: 3,
    detail: 'The CTA cluster including the "Book Now" button was wrapped in hidden ... xl:flex, so on mobile/tablet it never appeared in the top bar — only reachable after opening the hamburger drawer and scrolling to the bottom.',
    notes: ['Fix: added a persistent compact "Book" button (same Button component, booking.path, and light/scroll-aware gold/ink variant as the desktop Book Now) to the mobile/tablet top bar, grouped with the hamburger toggle so both sit xl:hidden on the right. Full CTA cluster at xl+ is unchanged. components/layout/Header.tsx.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Booking confirm button isn\'t disabled during Stripe submission — double-tap can double-charge', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 8, effort: 1,
    detail: 'components/booking/BookingFlow.tsx:656 (CardStep) tracks a `submitting` state and swaps the button label to "Confirming..." but never passes `disabled={submitting}` to the Button component (which already supports it, components/ui/Button.tsx:106) — a fast double-tap during the stripe.confirmSetup + /api/booking/confirm round-trip can fire two submissions. Fix: pass disabled={submitting} to the Confirm booking button. Found in End-of-Day audit (UI/UX discipline).',
    notes: ['Fix: added disabled={submitting} to the Confirm booking button. components/booking/BookingFlow.tsx.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Late-cancellation fee-decline email tells the client \'no charge has been taken\' even when a fee was declined', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 6, effort: 2,
    detail: 'lib/booking-actions.ts:409-414 + lib/email.ts:735-738 — when a late-cancellation fee charge is declined, feeCharged stays false (only set when charged>0), so the client still receives the "No charge has been taken" email even though a fee is owed and the card was declined. Fix: add a distinct "fee declined, we\'ll follow up to collect it" email branch keyed off feeFailed. Found in End-of-Day audit (product/feature-gaps discipline).',
    notes: ['Fix: tmplBookingCancelled() now takes an optional feeDeclined amount and renders a distinct "the charge was declined, we\'ll be in touch to collect it" message instead of falling through to "No charge has been taken." cancelBooking() passes chargeablePence as feeDeclined when the late-fee charge failed. lib/email.ts, lib/booking-actions.ts.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Shop gift-card balance can be fully restored twice via a declined-then-retried card payment', type: 'ERROR', urgency: 'P0', status: 'IN_REVIEW', assignee: 'claude',
    value: 6, effort: 2,
    detail: 'app/api/stripe/webhook/route.ts:160-171 credits back the full giftCardPence on payment_intent.payment_failed and cancels the order, but finalizeOrder\'s claim guard (status notIn [\'PAID\',\'FULFILLED\'], lib/shop.ts:96-106) still allows a later payment_intent.succeeded on a retried PaymentIntent to flip that CANCELLED order back to PAID. A customer whose first card attempt is declined keeps the full gift-card credit AND gets the order fulfilled once the retry succeeds. Found in End-of-Day audit (finance/commerce discipline).',
    notes: ['Fix: the webhook only cancels the order and credits back the gift card once the PaymentIntent itself reaches Stripe\'s canceled state, not on every payment_failed event — a declined Elements attempt normally leaves the same PI alive at requires_payment_method for an immediate retry, so it no longer gets prematurely cancelled/credited. app/api/stripe/webhook/route.ts. Also excluded CANCELLED from finalizeOrder\'s claimable statuses as defence in depth, so a cancelled order can never be silently re-claimed PAID. lib/shop.ts.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Floating WhatsApp button overlaps and blocks a quiz answer on /treatment-finder (mobile)', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 2,
    detail: 'On a 375x812 mobile viewport, the fixed WhatsApp button (components/layout/WhatsAppButton.tsx:21) sits directly on top of the second answer option rendered by components/finder/TreatmentFinder.tsx:60-69 — taps in the overlap zone hit the WhatsApp icon instead of the quiz option. Found in End-of-Day audit (UI/UX discipline).',
    notes: ['Fix: gave the quiz answer-options grid `relative z-50`, lifting it above the fixed WhatsApp launcher (z-40) so an overlapping tap always resolves to the answer button underneath it, not the launcher on top. components/finder/TreatmentFinder.tsx.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Wrong treatment photo live on 3 high-intent commercial pages (hydraglow-facial, cosmetic-injections, intimate-rejuvenation)', type: 'TASK', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 4, effort: 1,
    detail: 'import/slug-image-map.json maps these 3 slugs to photos of unrelated procedures — a migration mapping error, since correctly-named matching files already sit unused in public/treatments/ (HydraGlow.jpg, Cosmetic-Injections.jpg, Intimate-rejuvenation.png). Found in End-of-Day audit (SEO/content discipline).',
    notes: ['Fix: repointed the 3 slug entries in import/slug-image-map.json to their correctly-named, already-present files.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Gift-card purchase refund re-credits the card instead of debiting it — double payout', type: 'ERROR', urgency: 'P0', status: 'IN_REVIEW', assignee: 'claude',
    value: 9, effort: 3,
    detail: 'app/api/stripe/webhook/route.ts:236-250 — on charge.refunded for a GiftVoucher\'s OWN purchase PaymentIntent, the handler calls creditVoucher() (lib/gift-vouchers.ts:207-219), which INCREASES the balance and flips REDEEMED back to ACTIVE. There is no in-app "refund voucher" action (only "cancel", which never touches Stripe: app/api/admin/gift-vouchers/route.ts:27-31), so a Stripe-dashboard refund of a voucher purchase gives the customer their cash back AND keeps/regrows a spendable card up to full face value.',
    notes: ['Fix: the charge.refunded handler now distinguishes a voucher\'s OWN purchase PaymentIntent from an order that merely redeemed a voucher as a discount (the latter still credits back correctly, unchanged). On the voucher\'s own purchase, it debits the balance and cancels the card outright once the whole purchase has been refunded, via a new debitVoucherForPurchaseRefund() in lib/gift-vouchers.ts, CAS-guarded by a new additive GiftVoucher.purchaseRefundedPence watermark column (prisma/schema.prisma) mirroring the existing Booking.refundedPence pattern so redelivered/partial-then-full refund events can\'t double-debit. app/api/stripe/webhook/route.ts, lib/gift-vouchers.ts, prisma/schema.prisma.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Cancelled or refunded shop orders never restock inventory', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 3,
    detail: 'lib/shop.ts:124 decrements Product.stockQty when an order is finalized, but neither app/api/admin/orders/route.ts\'s CANCELLED/REFUNDED branches nor lib/shop.ts contains any corresponding increment — stock is permanently lost on every cancelled or refunded paid order.',
    notes: ['Fix: added restockOrder() to lib/shop.ts, which increments stockQty back for trackInventory items and is idempotent via a new additive Order.restockedAt CAS column (prisma/schema.prisma) so redeliveries or a re-cancelled order can\'t double-restock. Wired it into app/api/admin/orders/route.ts\'s REFUNDED and CANCELLED branches (gated on the order having actually been PAID/FULFILLED beforehand) and into the shop-order dashboard-refund path in app/api/stripe/webhook/route.ts\'s charge.refunded handler. app/api/admin/orders/route.ts, app/api/stripe/webhook/route.ts, lib/shop.ts, prisma/schema.prisma.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Academy enrolment payments are never reconciled when refunded outside the app (Stripe Dashboard)', type: 'TASK', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 8, effort: 4,
    detail: 'The charge.refunded webhook case (app/api/stripe/webhook/route.ts:201-278) reconciles db.booking, db.order and db.giftVoucher, but has NO db.enrolmentPayment branch. In-app refunds go through refundEnrolmentPayment (lib/academy-payments.ts:382-411), but a refund issued directly in the Stripe dashboard leaves the payment state PAID and Enrolment.paidPence un-decremented — money leaves the Stripe balance with no matching ledger entry, and paidPence-gated course access stays unlocked.',
    notes: ['Fix: added reconcileEnrolmentPaymentRefund() to lib/academy-payments.ts, mirroring refundEnrolmentPayment\'s DB-side effects (EnrolmentPayment PAID→REFUNDED via CAS, Enrolment.paidPence decremented, audit log) without re-issuing the Stripe refund or requiring an admin actor (attributed to \'stripe-webhook\' instead). Wired into the charge.refunded handler in app/api/stripe/webhook/route.ts as the fallback case once a booking, shop order and gift-voucher purchase have all been ruled out, gated on Stripe reporting the charge fully refunded. lib/academy-payments.ts, app/api/stripe/webhook/route.ts.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'CMS \'image + text\' content block bypasses next/image, ships full-resolution source PNGs to every visitor', type: 'TASK', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 2,
    detail: 'components/cms/SectionRenderer.tsx:130 renders CMS-authored images with a raw <img src={img}> (has an eslint-disable-next-line @next/next/no-img-element) instead of next/image — no resize, no AVIF/WebP conversion, no responsive sizes/srcset. Source files in public/treatments/ run 1-2.3MB (e.g. ppm.png 2.3MB). MediaArt, used elsewhere in the same file, correctly wraps next/image.',
    notes: ['Fix: replaced the raw <img> in the imageText case and the logos/partner-strip case with next/image, mirroring the fill + positioned-container pattern MediaArt already uses in the same file (added `relative` to the MaskReveal wrapper for the imageText case; used explicit width/height for the fixed-height logo images). Removed the now-unneeded eslint-disable comments. components/cms/SectionRenderer.tsx.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Before/after gallery and reviews are never linked from treatment or pricing pages', type: 'TASK', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 3,
    detail: 'components/treatment/TreatmentTemplate.tsx (the template behind every /treatments/* and /dentistry/* page) has no reference to /gallery or /reviews anywhere in its sections — both exist only via footer/mega-menu nav (lib/nav.ts:135,165,185). A visitor deciding on a specific treatment\'s price never sees social proof or before/afters relevant to it.',
    notes: ['Fix: added a small "See real results" / "Read verified reviews" link strip under the pricing column\'s VAT note, linking to /gallery and /reviews, styled to match the existing text-link pattern used elsewhere in the app (text-sm font-medium text-gold, hover:underline). components/treatment/TreatmentTemplate.tsx.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Right-to-erasure sweep excludes the Task model — client name and clinical concern survive under an \'erased\' client', type: 'TASK', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 2,
    detail: 'lib/followup.ts:46-49 creates a Task with the client\'s real name in the title (e.g. "Follow-up concern — Jane Doe (Botox)") and a quoted clinical concern in detail. eraseClientData\'s transaction (app/admin/actions.ts:59-105, ~25 explicit deletes/updates) never touches db.task, so these rows keep pre-erasure identity and clinical text forever, still linked by clientId to the now-pseudonymised client.',
    notes: ['Fix: added db.task.deleteMany({ where: { clientId } }) to eraseClientData\'s transaction, alongside the existing Interaction/ConsultationNote hard-deletes it already follows the same pattern for — Task rows created from a follow-up concern have no retention basis once the client is erased. app/admin/actions.ts.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Resend bounce/complaint webhook silently swallows the unsubscribe write — hard bounces and spam complaints can keep receiving email', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 6, effort: 2,
    detail: 'app/api/webhooks/resend/route.ts:68-73 — on email.complained/email.bounced, the db.client.update(... unsubscribed: true ...) compliance write is wrapped in try/catch with no logging, no Sentry, no retry, and the route always returns 200 regardless of the write\'s outcome — so Resend never redelivers. A transient DB error at that exact line means a client who bounced or complained keeps getting marketing email indefinitely with no operator visibility.',
    notes: ['Fix: the unsubscribe-write catch block now logs the error and calls Sentry.captureException (matching the pattern used in app/api/stripe/webhook/route.ts) and returns a 500 so Resend retries the delivery-status webhook. Success path and other event types are unchanged. app/api/webhooks/resend/route.ts.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Safety-critical warnings (allergy, tampered record, suspended) render in near-invisible contrast', type: 'ERROR', urgency: 'P0', status: 'IN_REVIEW', assignee: 'claude',
    value: 9, effort: 2,
    detail: 'app/admin/bookings/[id]/page.tsx:381 shows a client\'s allergy/dietary warning in text-[var(--color-blush)] (#cdb4a3 on #efe3d7, ~1.7:1 contrast — needs 4.5:1) — effectively invisible to staff scanning the page. Same broken pattern on the "tampered record" flag (app/admin/clients/[id]/page.tsx:345) and the "Suspended" badge (app/admin/academy/students/[id]/page.tsx:79). --color-blush-deep (5.7:1 contrast) already exists in app/globals.css:31 for exactly this case.',
    notes: ['Fix: swapped the allergy/dietary warning (app/admin/bookings/[id]/page.tsx), the tampered-record integrity flag and the discount-claim fraud flag (app/admin/clients/[id]/page.tsx), the Suspended student badge (app/admin/academy/students/[id]/page.tsx), and the medical-flag warning icon (components/admin/MedicalFlagEditor.tsx) from text-[var(--color-blush)] to text-[var(--color-blush-deep)], matching the existing 5.7:1-contrast token used elsewhere for error/destructive text on light surfaces.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Shop checkout \'Continue to payment\' silently does nothing when required fields are empty', type: 'TASK', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 1,
    detail: 'components/shop/CheckoutForm.tsx:100 — onClick={() => !busy && f.name && f.email && startCheckout()} guards the click but never shows an error or disables the button when name/email are blank. A shopper who misses a field just sees the button do nothing, unlike every sibling form (GiftVoucherFlow, GroupBookingForm, ApplyForm) which validates inline.',
    notes: ['Fix: added disabled={busy || !f.name || !f.email} to the Continue to payment Button, and added a guard at the top of startCheckout() that calls setError(\'Please enter your name and email.\') for the same missing-field case, matching the setError pattern already used by GiftVoucherFlow and ApplyForm. components/shop/CheckoutForm.tsx.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Floating WhatsApp button overlaps Back-to-top and hijacks taps on the consult-form submit button (mobile)', type: 'TASK', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 2,
    detail: 'components/layout/WhatsAppButton.tsx:21 (fixed bottom-5 right-5, md:hidden) sits 4px from components/motion/BackToTop.tsx:28 (fixed bottom-6 right-6, shown on ALL breakpoints past scrollY 1400) — both float in the same mobile corner. Separately, components/consult/ConsultForm.tsx:213\'s step-nav "Continue"/"Request consultation" button uses the same bottom-right layout that components/finder/TreatmentFinder.tsx:60-64 already had to fix (comment cites BLD-769, already shipped) by adding relative z-50 to lift it above the WhatsApp launcher — ConsultForm never got that same fix.',
    notes: ['Fix: BackToTop is now hidden below the md breakpoint (hidden md:grid) so it no longer shares the mobile corner with the WhatsApp launcher, which is mobile-only (md:hidden) — the two now never render together. Also added the same relative z-50 treatment from TreatmentFinder to ConsultForm\'s step-nav bar so a tap on "Continue"/"Request consultation" can no longer be hijacked by the WhatsApp button underneath. components/motion/BackToTop.tsx, components/consult/ConsultForm.tsx.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Meta CAPI gift-voucher Purchase event sends the buyer\'s email regardless of marketing consent', type: 'TASK', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude', pr: PR(1594),
    value: 5, effort: 1,
    detail: 'app/api/gift-vouchers/confirm/route.ts:32-34 called sendPurchase({ ..., email: voucher.purchaserEmail }) unconditionally, unlike every other conversion call site (app/admin/bookings/actions.ts:92, app/api/booking/start/route.ts:239, app/api/consult/route.ts:109), which all gate email on marketingOptIn. The voucher checkout never collects a marketing opt-in at all, so the purchaser\'s hashed email was sent to Meta\'s Advanced Matching with no consent signal.',
    notes: ['Fix: on confirm, look up an existing Client by purchaser email and only forward the email to sendPurchase if that client is marketingOptIn and not unsubscribed; otherwise pass null (default-closed, matching the other call sites). app/api/gift-vouchers/confirm/route.ts.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'URGENT: System-Wide Appointment Time Mismatch', type: 'ERROR', urgency: 'P0', status: 'SHIPPED', assignee: 'claude', pr: PR(1611),
    detail: 'lib/clinic-time.ts is the correct, DST-safe Europe/London wall-clock <-> UTC helper and is used consistently by availability/slot generation and most display surfaces, but several server-side notification/audit/summary call sites format the same stored UTC instant with a bare toLocaleString/toLocaleTimeString and no timeZone option. Node runs in UTC on Vercel, so those specific call sites render an appointment an hour off the correctly-formatted views during BST -- exactly the "requested 14:45, confirmed shows 15:45" report: the same-day request notification staff read before approving (app/api/booking/start/route.ts:214) was un-timezoned (effectively UTC), while the calendar/admin views that already pass timeZone correctly showed the true clinic-local time.',
    notes: [
      'Fix: added `timeZone: CLINIC_TZ` (Europe/London) to every server-side date/time format call missing it: the same-day booking request notification + audit summary and the guest booking-created audit summary (app/api/booking/start/route.ts, app/api/booking/create/route.ts), booking cancelled/rescheduled staff notifications and the reschedule interaction summary (lib/booking-actions.ts), the in-session next-visit audit summary and the session-answer-edited audit summary (app/api/admin/bookings/session/route.ts), the recommended-next-session date shown to clients (lib/booking-notify.ts), the admin booking detail recommended-next-visit label (app/admin/bookings/[id]/page.tsx), the admin dashboard today-bookings time widget (lib/crm-data.ts), and the client-facing appointments list including a raw `.getDate()` call that read the server-local (UTC) day-of-month instead of the clinic-local one (app/account/appointments/page.tsx). No change to how times are created or stored -- clinicWallTimeToUTC/availability were already correct; this was purely a display/notification-formatting gap. (PR 1611)',
      'Follow-up (PR 1612): fixed the residual risk flagged above -- staff manual date/time entry (new phone booking, follow-up scheduling, reschedule) parsed "YYYY-MM-DDTHH:MM" with new Date(`${date}T${time}`), which uses the DEVICE timezone rather than the clinic\'s, so a non-UK/misconfigured staff device could silently store a wrong instant (not just display one). Added clinicLocalToUTC(dateISO, "HH:MM") to lib/clinic-time.ts, delegating to the proven clinicWallTimeToUTC, and wired it into every staff manual-entry point: components/admin/NewBookingButton.tsx, components/admin/ScheduleFollowUp.tsx, components/admin/BookingActions.tsx (reschedule). Also pinned a few remaining client-side displays (booking flow, portal hero, in-session rebook, admin search) to Europe/London so every surface agrees regardless of viewer device.',
      'Verified no double-conversion: rescheduleBooking re-parses the passed value as an absolute instant (new Date(newStartISO)); client-facing and in-session flows use server-provided absolute slot ISO strings, not wall-clock parsing.',
      'Residual: other admin datetime-local surfaces (ScheduleManager, TimeOffManager, LiveClassManager, RoomClosures, MaintenanceScheduler) still parse with new Date(value) -- same latent device-timezone class, out of this scope; flagged for a follow-up as staff availability feeds slot generation.',
    ],
  },
  {
    title: 'Keyboard-operable consent signing + NPS detractor alerts + cron isolation (BLD-796, BLD-800, BLD-801)', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1612),
    value: 6, effort: 3,
    detail: 'Three accessibility/reliability fixes shipped together. BLD-796: the consent signature pad was pointer-only, unusable by keyboard/switch users. BLD-800: NPS detractors (score 0-6) had no staff alert and no service-recovery follow-up, unlike low star reviews and NPS promoters. BLD-801: the daily-cron automations step was the only step with no try/catch, so a throw skipped every remaining job and never reached the failure-summary alert.',
    notes: [
      'BLD-796: added a "type your full name to sign" fallback in components/consent/ConsentSigner.tsx that renders the typed name to a canvas image (data:image/png), satisfying the existing signatureDataUrl.startsWith("data:image/") API contract. Whitespace-only input is rejected (trimmed length must be >= 2), mirroring the blank-canvas guard.',
      'BLD-800: NPS detractors now trigger a high-priority staff notification (lib/nps.ts, mirroring the review-rating flow) and a detractorFollowUp daily automation (lib/automations.ts) -- a service-recovery apology gated on canEmailCare (transactional, not marketing), deduped per-npsId via emailEvent kind NPS_DETRACTOR. Backed by an additive NPS_DETRACTOR value on the EmailKind enum (prisma/schema.prisma).',
      'BLD-801: wrapped runDailyAutomations() in try/catch with a Tally-shaped fallback in app/api/cron/daily/route.ts, matching the pattern used by every other cron step so one failure no longer aborts the day.',
    ],
  },
  {
    title: 'Finance PIN brute-force gap, booking-confirm Sentry coverage, staff security-change notifications, booking availability index (PRJ-939.3, PRJ-939.4, PRJ-939.7, PRJ-939.8)', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1616),
    value: 7, effort: 2,
    detail: 'Four End-of-Day audit findings shipped together. PRJ-939.3: the finance PIN change endpoint (app/api/admin/finance/unlock/route.ts) rate-limited the unlock path but not the set/change-PIN path, which also verifies a guessed currentPin -- unlimited brute-force. PRJ-939.4: staff 2FA reset and admin-driven password reset (app/api/admin/staff/route.ts) sent no notification to the affected staff member, so a compromised staff.manage account could silently strip 2FA or change a colleague\'s password. PRJ-939.7: lib/availability.ts\'s hot-path booking query (status IN (...) AND startAt BETWEEN ..., often + locationId) had no composite index to match. PRJ-939.8: booking-confirmation failures (app/api/booking/confirm/route.ts, app/api/booking/pay-confirm/route.ts) only console.error\'d, never reaching Sentry, unlike the Stripe webhook.',
    notes: [
      'PRJ-939.3: moved enforceRateLimit(\'finance-unlock\') above both the \'set\' and default/unlock branches in app/api/admin/finance/unlock/route.ts, so a PIN-change attempt with a guessed currentPin is capped at 8 attempts / 5 minutes same as unlock.',
      'PRJ-939.4: added tmplStaffSecurityChange (lib/email.ts) and sent it from the reset2fa branch and the password-change branch (when the actor changes someone ELSE\'s password) in app/api/admin/staff/route.ts -- best-effort, never blocks the change itself.',
      'PRJ-939.7: added @@index([status, startAt]) and @@index([locationId, startAt]) to the Booking model (prisma/schema.prisma) -- additive, safe under the prisma db push gate.',
      'PRJ-939.8: added Sentry.captureException at every catch site in app/api/booking/confirm/route.ts and app/api/booking/pay-confirm/route.ts, tagged by route/stage, matching the pattern already used in app/api/stripe/webhook/route.ts.',
    ],
  },
  {
    title: 'Manual Price Override (BLD-812)', type: 'TASK', urgency: 'P0', status: 'SHIPPED', assignee: 'claude', pr: PR(1616),
    value: 8, effort: 2,
    detail: 'Owner-reported: staff creating a booking manually (phone/walk-in) could only use the treatment\'s default price, with no way to enter a custom amount for a promotion, special offer, or one-off agreed rate.',
    notes: [
      'Added an admin-only "Override price for this booking" field to the New Phone Booking modal (components/admin/NewBookingButton.tsx), gated on sessionIsAdmin (OWNER/ADMIN only) and passed through to createManualBooking (app/admin/bookings/create-action.ts).',
      'The server action re-validates the admin check server-side (never trusts the client flag), validates the override as a non-negative integer amount in pence, and uses it as the booking\'s total price instead of the computed treatment/variant price x sessions.',
      'Every override is written to the audit log (BOOKING_CREATED) recording both the default and overridden total, so the discount/promotion is traceable.',
    ],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Discounted payment-link charges get silently rejected by the Stripe webhook (BLD-797)', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1618),
    value: 7, effort: 2,
    detail: 'app/api/stripe/webhook/route.ts requires amount_received >= booking.pricePence for booking_balance payments, but staff-created payment links (app/api/admin/bookings/session/route.ts) can legitimately charge less than pricePence when discounted. A successful, discounted Stripe charge fails the underpayment guard and the booking is never finalised.',
    notes: [
      'Fix: the paylink case now stamps the agreed amount into payment_intent_data.metadata.expectedPence; the webhook\'s underpayment guard checks against that when present, falling back to booking.pricePence only when it is absent (preserving the original anti-tampering check for the case with no staff-set expectation). app/api/admin/bookings/session/route.ts, app/api/stripe/webhook/route.ts.',
    ],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Academy enrolment can be cancelled with a paid fee kept -- no refund, no warning (BLD-764)', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1618),
    value: 6, effort: 1,
    detail: 'app/api/admin/academy/route.ts lets an admin flip an enrolment straight to CANCELLED via a plain status dropdown (components/admin/AcademyManager.tsx) -- no confirm(), unlike the adjacent Remove button -- without ever calling refundEnrolmentPayment, sending any cancellation silently past a paid fee.',
    notes: [
      'Fix: selecting CANCELLED in the status dropdown now requires a confirm() naming the amount already paid (if any) and pointing to the separate Refund button for that payment -- matching the confirm() pattern already used by every other destructive control on this page. components/admin/AcademyManager.tsx. Deliberately does not auto-refund: cancellation and refund are staff-judgement decisions (some cancellations are non-refundable per T&Cs) that should stay two explicit actions.',
    ],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Exclude noindexed dentistry pages from sitemap.xml (BLD-839)', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1618),
    value: 5, effort: 1,
    detail: '/dentistry and 6 dentistry treatment pages render <meta name="robots" content="noindex, nofollow"> live while dentistryLive is false, yet all 7 URLs were still listed in sitemap.xml -- app/sitemap.ts built treatmentSlugs and the /dentistry static path without checking the same dentistryLive flag app/(marketing)/[slug]/page.tsx and app/(marketing)/dentistry/page.tsx already use to noindex them.',
    notes: [
      'Fix: sitemap() now reads getSiteConfig().dentistryLive and excludes the /dentistry static path and any treatment slug in the dentistry category when it is false, so the sitemap never advertises a URL the page itself marks noindex. app/sitemap.ts.',
    ],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Booking flow strands client if account creation succeeds but booking-start fails', type: 'ERROR', urgency: 'P0', status: 'SHIPPED', assignee: 'claude', pr: PR(1617),
    value: 9, effort: 3,
    detail: 'components/booking/BookingFlow.tsx:203,448 -- after AccountStep.onAuthed fires, submitBooking() runs while stage stays \'account\'; on any /api/booking/start error (slot taken, age gate, treatment unavailable) the back/nav is hidden and only \'Try again\' resends the identical failing request, with no way to change time/details short of a full reload.',
    notes: [
      'Fix: added a "Change time or details" link next to "Try again" in the account/authed error state, which clears the error and returns to the upsell step (aftercare/age confirm) -- from there the existing back nav reaches time/variant/service. authed stays true so retrying does not repeat AccountStep. components/booking/BookingFlow.tsx.',
    ],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'CSP blocks Google Tag Manager -- GA4/Meta Ads tracking broken sitewide (BLD-845)', type: 'ERROR', urgency: 'P0', status: 'SHIPPED', assignee: 'claude', pr: PR(1619),
    value: 9, effort: 1,
    detail: 'next.config.mjs script-src allowlist omitted https://www.googletagmanager.com, but components/marketing/TrackingScripts.tsx loads gtag/js from that host. Every page load threw a CSP violation and the script was blocked, so no GA4 pageviews/events or Google Ads conversion tracking fired anywhere on the site.',
    notes: [
      'Fix: added https://www.googletagmanager.com to script-src. Also added the GA4/Ads collect endpoints (google-analytics.com, googleadservices.com, googleads.g.doubleclick.net) plus googletagmanager.com to connect-src, since gtag\'s config/collect beacons need connect-src separately from the script-src load -- fixing script-src alone would have let gtag.js load but its actual pageview/conversion beacons would still have been silently blocked. next.config.mjs.',
    ],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'SAR issue (BLD-843)', type: 'ERROR', urgency: 'P0', status: 'SHIPPED', assignee: 'claude', pr: PR(1620),
    value: 8, effort: 1,
    detail: 'Clicking "Export all data (SAR)" on a client profile (app/api/admin/clients/[id]/export/route.ts) returned HTTP 500 instead of the GDPR Art. 15 export. Root cause: the callRecords select clause referenced two fields that do not exist on the CallRecord model -- duration and callerNumber -- which throws an unhandled PrismaClientValidationError before the response can be built.',
    notes: [
      'Fix: corrected the select to the real schema field names -- durationSec (not duration) and fromNumber/toNumber (not the nonexistent callerNumber). app/api/admin/clients/[id]/export/route.ts. Every other relation/model in the same export handler was cross-checked against prisma/schema.prisma and is valid; this was the only schema-drift mismatch.',
    ],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Clinical data (medical flags/allergies) exposed to non-clinical staff roles (BLD-848)', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude', pr: PR(1622),
    value: 8, effort: 3,
    detail: 'app/admin/page.tsx and app/admin/bookings/[id]/page.tsx rendered decrypted medicalFlag/allergies on the default STAFF-role dashboard and on any bookings.view-gated booking page, bypassing the dedicated clients.clinical.view permission entirely -- the exact leak components/admin/dashboard/ReceptionistView.tsx was built to prevent, reached via a different route.',
    notes: [
      'Fix: app/admin/page.tsx now omits allergies/medicalFlag from the dashboard "Up next" ArrivalPrep card unless the viewer has clients.clinical.view, mirroring ReceptionistView\'s existing redaction. app/admin/bookings/[id]/page.tsx now gates the Health & consent card\'s medical flag/allergy text behind the same canClinical check already used elsewhere on the page, showing a neutral placeholder instead.',
      'Follow-up from the mandatory Opus review pass: components/admin/ClinicalWorkflow.tsx, further down the same booking page, still rendered the raw flag text unconditionally -- the first fix alone left it half-open. Split the safety gate from the display: a new hasMedicalFlag boolean (always sent, drives the pre-treatment "reviewed" requirement) is separate from medicalFlag (decrypted text sent only to clients.clinical.view holders). Non-clinical staff still see and must clear the gate, but never the content.',
      'Residual (not fixed, flagged for a follow-up item): app/admin/clients/[id]/page.tsx passes allergies into EditClientDetails gated only by clients.edit, which FRONT_DESK holds without clients.clinical.view -- a narrower, separate disclosure path out of scope for this PR.',
    ],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: "can't open the course materials", type: 'ERROR', urgency: 'P0', status: 'IN_REVIEW', assignee: 'claude', pr: PR(1623),
    detail: 'Owner-reported (info@kclinics.co.uk): students reported course materials/files would not open, while staff saw nothing wrong on their side.',
    notes: [
      'Root cause: staff preview lesson PDFs via the raw admin Blob link in CurriculumManager.tsx, which never runs the student-side access checks (enrolment status, cohort access window, module drip-lock) that the authenticated proxy (app/api/academy/pdf/route.ts, via lib/lms.ts resolveLessonPdf) enforces on every open -- so staff structurally cannot reproduce a student-side access-check failure, and any student whose enrolment/cohort state trips one of those checks got a generic "This document could not be opened" with nothing logged.',
      'Fix: resolveLessonPdf now returns a specific denial reason (not-enrolled, locked, lesson-not-found, bad-index) instead of a bare null. The proxy route reports the diagnostic reasons to Sentry (unauthenticated/bad-request excluded as expected background noise) and returns the reason to the client; SecurePdfViewer shows an actionable message per reason. lib/lms.ts, app/api/academy/pdf/route.ts, components/academy/SecurePdfViewer.tsx.',
      'Could not identify the specific affected students this run -- DATABASE_URL is not reachable from this sandbox network for a direct read-only query. The next occurrence will surface in Sentry with the exact reason and student id.',
    ],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Client-edit dialog leaks decrypted allergies to staff without clinical-view permission', type: 'TASK', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude', pr: PR(1623),
    value: 7, effort: 2,
    detail: "app/admin/clients/[id]/page.tsx passes c.allergies (decrypted by getClient()) into EditClientDetails, gated only by clients.edit -- held by FRONT_DESK which lacks clients.clinical.view. Same leak class as BLD-848 and flagged as an explicit unfixed residual in that commit's own notes.",
    notes: [
      'Redacting the value alone would have created a worse bug: the edit form always submits allergies in its save payload, so a non-clinical save (e.g. just updating a phone number) would silently overwrite the real encrypted allergies with the redacted blank.',
      'Fix: the allergies field is now hidden and omitted from the save payload entirely for viewers without clients.clinical.view, not just blanked -- a new canEditAllergies prop drives both. components/admin/EditClientDetails.tsx, app/admin/clients/[id]/page.tsx.',
    ],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Global admin search decrypts and surfaces clinical data without clinical-view permission', type: 'TASK', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude', pr: PR(1623),
    value: 7, effort: 2,
    detail: 'app/api/admin/search/route.ts gates client results on clients.view only yet flags medicalFlag in the dropdown, and gates consultation results on consultations.view only yet decrypts and shows a concerns snippet -- both bypass the dedicated clients.clinical.view permission that the client profile page and SAR export correctly enforce.',
    notes: [
      'Fix: both now additionally require clients.clinical.view before including the medicalFlag indicator or the decrypted concerns snippet -- the underlying client/consultation rows are still findable by name, just without the clinical detail. app/api/admin/search/route.ts.',
    ],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Deepgram and Google Cloud Translation process health data as undisclosed sub-processors', type: 'TASK', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude', pr: PR(1623),
    value: 6, effort: 1,
    detail: "app/api/admin/bookings/transcribe/route.ts streams raw clinician voice-note audio to Deepgram's API, and lib/health-assessments.ts sends decrypted health-questionnaire free-text answers to Google Cloud Translation -- neither appeared in the privacy policy's processor list.",
    notes: [
      'Fix: added both to the "Sharing your data" processor list and the "International transfers" section in lib/info-pages.ts.',
    ],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Stripe SetupIntent failure in booking/create route never reaches Sentry (twin of BLD-852)', type: 'TASK', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude', pr: PR(1623),
    value: 8, effort: 2,
    detail: 'app/api/booking/create/route.ts -- when stripe().setupIntents.create() throws, the booking is cancelled and audit-logged but only console.error, no Sentry.captureException. The route comment says this mirrors app/api/booking/start/route.ts (BLD-852), but that fix does not cover this sibling route.',
    notes: [
      'Fix: added Sentry.captureException in the catch, same pattern as the booking/start fix (BLD-852, PR #1621). app/api/booking/create/route.ts.',
    ],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Dynamic catch-all routes return HTTP 200 instead of 404 (soft 404s), including /booking', type: 'ERROR', urgency: 'P0', status: 'SHIPPED', assignee: 'claude', pr: PR(1627),
    value: 9, effort: 5,
    detail: '[slug], journal/[slug], academy/[slug], shop/[slug] all call notFound() for unmatched slugs but production still returns HTTP 200. /booking is also a natural URL guess for the real booking flow and dead-ends visitors.',
    notes: [
      'Partial fix: /booking had no page.tsx of its own, so it fell through to the catch-all and soft-404d instead of reaching /book. Added a real 3xx redirect in next.config.mjs.',
      'Investigated a connection()-based fix for the soft-404 status itself, but reverted it after a full production build showed it forces the WHOLE [slug] route (treatment + CMS pages -- the highest-traffic pages on the site) to lose ISR/SSG caching, since Partial Prerendering is not enabled. Not an acceptable trade for a 404-status edge case.',
      'Live header inspection found two DIFFERENT root causes bundled under this item: [slug] is a genuine ISR-cache/status bug (x-nextjs-prerender: 1, x-vercel-cache: STALE, still 200); journal/academy/shop [slug] routes are already fully dynamic per-request (x-vercel-cache: MISS, no prerender header) yet still return 200 -- a separate bug. Left open pending a live preview deploy to diagnose safely (this sandbox cannot reach the DB or run the dev server against real data).',
      'Second attempt (this session): tried calling notFound() from each route\'s generateMetadata instead of only the page body, on the theory that the shared (marketing)/loading.tsx Suspense boundary flushes a 200 status before the page body\'s own notFound() can take effect, and that generateMetadata resolves before that boundary commits (Next.js docs describe generateMetadata as supporting notFound()/redirect() for exactly this). Shipped as PR #1634, verified tsc/build clean and no ISR regression (real slugs stayed 200, [slug] stayed SSG) -- but a mandatory post-merge production curl check showed the fake-slug status was STILL 200 after the deploy went live (confirmed against a fresh, uncached response). The generateMetadata theory does not hold for this app in practice. Reverted immediately (PR reverting 15f91a90). Root cause remains open -- the fix needs to be verified against a live/preview deploy BEFORE merging next time, not diagnosed from code reading + docs alone; this session could not reach the Vercel preview URL (sits behind Deployment Protection/SSO that could not be authenticated through non-interactively) so verification only happened post-merge on production, which is why the failed attempt reached prod at all.',
    ],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: "Booking detail 'Visit prep' panel leaks decrypted allergy note to non-clinical staff", type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude', pr: PR(1627),
    value: 7, effort: 1,
    detail: "app/admin/bookings/[id]/page.tsx fetches visitPrefs.allergyNote separately and unconditionally decClinical-decrypts it, then renders it in the 'Visit prep' box with no clients.clinical.view check, unlike the 'Health & consent' box on the same page which correctly redacts medicalFlag/allergies.",
    notes: [
      'Fix: gated the decrypt and the "Visit prep" render behind the same canClinical (clients.clinical.view) check used by the "Health & consent" box on the same page.',
    ],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: "Cookie consent banner covers hero CTA on mobile for every first-time visitor", type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude', pr: PR(1627),
    value: 8, effort: 2,
    detail: 'components/legal/CookieConsent.tsx had no max-height/scroll cap on the mobile banner; on a 375x812 viewport it covered from mid-hero to the bottom, hiding the "Book online"/"Free consultation" CTAs until the visitor interacted with it.',
    notes: [
      'Fix: capped the mobile banner to max-h-[38vh] overflow-y-auto; md: reverts to the original uncapped desktop layout.',
    ],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: "Footer 'United Kingdom' caption functions as a banned strap-line under the logo", type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude', pr: PR(1629),
    value: 7, effort: 1,
    detail: "components/layout/Footer.tsx:64 rendered a tracked-out uppercase 'United Kingdom' label directly beneath the K-monogram/wordmark on every page -- the strap-line-under-the-logo pattern docs/BRAND_GUIDELINES.md prohibits.",
    notes: [
      'Fix: removed the caption. The full postal address and "Registered in England & Wales" already appear elsewhere in the same footer, so no information was lost.',
    ],
  },
  {
    title: 'Shop nav link hidden below 1280px -- /shop unreachable from mobile/tablet menu', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude', pr: PR(1629),
    value: 7, effort: 2,
    detail: "components/layout/Header.tsx -- the Shop link only existed inside a 'hidden ... xl:flex' cluster, absent from the mobile hamburger menu (lib/nav.ts primaryNav has no Shop entry). Any visitor under the xl breakpoint (phone or tablet) had no way to reach /shop except typing the URL directly.",
    notes: [
      'Fix: added a Shop link to the mobile drawer nav in components/layout/Header.tsx (kept out of lib/nav.ts primaryNav to avoid duplicating it in the desktop mega-menu bar, since desktop already shows Shop in its own standalone cluster).',
    ],
  },
  {
    title: 'Clinical before/after photos accessible to front-desk staff without clinical.view permission', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude', pr: PR(1630),
    value: 7, effort: 2,
    detail: "app/api/admin/bookings/before-photo/[id]/route.ts granted access via clients.clinical.view OR bookings.manage -- FRONT_DESK holds bookings.manage by default despite being documented as having no clinical health data access, letting any front-desk user view decrypted clinical photos meant for clinical staff only.",
    notes: [
      'Fix: dropped the bookings.manage fallback so only clients.clinical.view gates the decrypt/serve route, matching every other clinical-data endpoint. Capture/delete (the sibling before-photo/route.ts) correctly stay on bookings.manage -- front desk can still take the photo, just not view it back.',
    ],
  },
  {
    title: 'Right-to-erasure leaves client leaderboard photo/name and concerns/gender fields uncleared', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude', pr: PR(1630),
    value: 7, effort: 2,
    detail: 'app/admin/actions.ts eraseClientData pseudonymised core PII but never reset leaderboardOptIn/leaderboardPhotoUrl/leaderboardDisplayName -- so an erased client\'s real photo and name stayed live on the public /membership leaderboard -- and never cleared the free-text concerns/genderSelfDescribe fields, despite clearing the equally sensitive allergies field on the same row.',
    notes: [
      'Fix: added all five fields (leaderboardOptIn, leaderboardPhotoUrl, leaderboardDisplayName, concerns, genderSelfDescribe) to the same erasure transaction as the rest of the Client row.',
    ],
  },
  {
    title: 'Loyalty points refunded even when they already reduced the late-cancellation fee (double-dip)', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude', pr: PR(1631),
    value: 7, effort: 2,
    detail: 'cancelBooking() (lib/booking-actions.ts) nets the late-cancellation fee by pointsRedeemedPence but then unconditionally called refundBookingPoints() afterwards regardless of whether that reduced fee was actually charged -- a client could redeem points for a discount, then late-cancel to pay the reduced fee AND get the points back, repeatably.',
    notes: [
      'Fix: only call refundBookingPoints() when charged === 0 -- covers the three cases where the points were not actually consumed (no fee due, the charge failed, or it needs further customer action) while skipping the refund when the fee was successfully charged at the points-discounted price. rescheduleBooking() already had the correct pattern (nets the fee, never refunds points) and was left unchanged.',
    ],
  },
  {
    title: 'Patch Test Status Tracking', type: 'TASK', urgency: 'P0', status: 'IN_REVIEW', assignee: 'claude', pr: PR(1632),
    value: 6, effort: 2,
    detail: 'Staff had no way to see whether a client had completed a valid patch test without searching through appointments/notes -- there was no structured "patch test" concept anywhere in the product (only prose inside the laser consent form).',
    notes: [
      'Fix (MVP): added Client.patchTestResult/patchTestDate/patchTestSetBy (mirrors the existing medicalFlag triad -- additive, no new model) plus a PatchTestEditor card on the client profile (clinical staff only) next to Medical flag, and POST /api/admin/patch-test to record PASSED/FAILED.',
      'Deliberately out of scope: automatic detection (there is no bookable "Patch Test" service or booking-derived signal to key off) and pre-booking eligibility gating (needs an owner decision on the validity window -- how many months a pass stays valid -- before a gate can be built safely). This ships the visible status; gating is a natural follow-up once that policy is set.',
    ],
  },
  {
    title: 'Sitemap lists only 6 of 72+ live, indexable journal articles (BLD-917)', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1633),
    value: 9, effort: 3,
    detail: 'app/sitemap.ts built journal entries from the static lib/articles.ts array (6 items), but /journal and /journal/[slug] actually pull from the DB-backed CMS via listBlogCards()/getBlogPost() in lib/blog.ts -- live /journal lists 72 article links, all 200 with canonicals and no noindex, yet sitemap.xml only contained the 6 static ones.',
    notes: [
      'Fix: app/sitemap.ts now calls listBlogCards() (DB posts + any native article not overridden in the DB, same source /journal itself uses) via a best-effort try/catch, falling back to the static articles array only if the DB is unreachable -- same pattern already used for courseSlugs()/shopProducts() on the same file.',
      'Merged (#1633); this entry was left at IN_REVIEW after merge in a prior session and never advanced -- correcting the status here so the board stops listing it as open work.',
    ],
  },
  {
    title: 'Focus rings, academy payment idempotency, order-cancel refund, cropped photos (BLD-755, BLD-762, BLD-763, BLD-834)', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude', pr: PR(1636),
    value: 8, effort: 3,
    detail: 'Four independent EOD-audit findings batched into one PR: no visible keyboard focus indicator on SiteSearch/NewsletterForm/RegisterInterest/ReferralCard (BLD-755); academy enrolment PaymentIntent idempotency key derived from a freshly-created row id instead of a stable enrolmentId+kind+amount, double-charge risk on retry (BLD-762); shop order "Cancel" on a paid order skipped the Stripe refund/gift-card-restore/email that "Mark refunded" performs (BLD-763); SMAS HIFU Lifting and HydraGlow Facial photos cropped onto plain background on the homepage carousel (BLD-834).',
    notes: [
      'BLD-834: Rosacea Treatment and Laser Wrinkle Removal (also named in the finding) currently render the generative-art placeholder, not a photo -- no mapped image exists for either slug, so the crop bug does not reproduce for them today. Not fixed here; needs a product/design call on sourcing or re-cropping an asset, logged separately on the board.',
      'npx tsc --noEmit and npm run build both pass clean (DB URL unset for the build check -- this sandbox cannot reach Postgres directly; no schema changes in this PR).',
    ],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Dynamic catch-all routes return HTTP 200 instead of 404 (soft 404s), including /booking', type: 'ERROR', urgency: 'P0', status: 'IN_REVIEW', assignee: 'claude', pr: PR(1637),
    value: 9, effort: 5,
    detail: 'app/(marketing)/[slug], journal/[slug], academy/[slug] and shop/[slug] all call notFound() for unmatched slugs but production returned HTTP 200 with the not-found UI. /booking was fixed earlier with a redirect (#1627); the status bug survived two reverted attempts (#1627 connection(), #1634 generateMetadata).',
    notes: [
      'Root cause: app/(marketing)/loading.tsx. The Suspense boundary streams its shell on any dynamic render, committing the 200 status before notFound() runs -- the page can then only swap UI, never the status. The two working routes (/packages, /info) are exactly the ones with dynamicParams=false, rejected before rendering starts. The generateMetadata attempt could not work because Next 15.2+ streams metadata, so it does not block the first flush either.',
      'Fix (third attempt, PR #1637, isolated in its own commit for easy revert): delete the loading boundary so the render completes before the first byte. Build route table confirms /[slug] keeps SSG+ISR (the regression that reverted attempt #1 does not recur). Trade-off: no branded spinner on marketing route transitions.',
      'This session CAN verify against the Vercel preview (the blocker recorded on 2026-07-19/20): preview status codes checked via a deployment-protection bypass before merge, result posted on the PR.',
    ],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Staff paylink Checkout session has no Stripe idempotency key', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1637),
    value: 7, effort: 1,
    detail: 'app/api/admin/bookings/session/route.ts checkout.sessions.create for the paylink action had no idempotencyKey, unlike every other charge site -- a double-click before the chargedAt guard reflects completion could create two live payment links for the same booking balance.',
    notes: ['Fix: { idempotencyKey: `paylink-${bookingId}-${amountPence}` } on the create call, matching pos-checkout-${order.id} in app/api/admin/pos/route.ts.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: "Homepage 3-step 'first hello' section invisible on mobile for most visitors", type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1637),
    value: 8, effort: 2,
    detail: 'components/home/PinnedExperience.tsx rendered the pinned scrollytelling version hidden md:block and the stacked fallback only under prefers-reduced-motion -- standard-motion mobile visitors (the majority) got neither, just the heading.',
    notes: ['Fix: the stacked layout is now CSS-gated (md:hidden when motion is on, md:grid-cols-3 under reduced motion) independent of the JS reduce flag, the same pattern as HorizontalGallery.tsx:40 SwipeRail.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Kiosk AI analysis failures never reach Sentry — flagship demo fails silently', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1637),
    value: 7, effort: 2,
    detail: 'lib/kiosk-ai.ts provider failures during the in-clinic kiosk skin analysis only console.error -- a provider outage silently breaks the flagship demo with nobody aware.',
    notes: ['Fix: Sentry.captureException (tags area:kiosk-ai) in both catch blocks -- the v1 analysis path and the v2 multi-photo path -- matching lib/chat-ai.ts and lib/ai-consultation.ts.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Stripe SetupIntent failure silently auto-cancels bookings with no alert', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1637),
    value: 7, effort: 2,
    detail: 'app/api/booking/start/route.ts -- when SetupIntent creation fails the booking is auto-cancelled with only a console/audit-log trace. A Stripe outage would silently cancel every card-protected booking sitewide.',
    notes: ['Fix: Sentry.captureException (tags route:booking/start, stage:setup-intent) alongside the existing audit log, matching the booking/create twin fixed in #1623. Note: an earlier backlog note claimed this was fixed in "PR #1621" -- no such change ever reached the route; the board TRIAGE status was correct.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Redirect stub pages (careers/gift-vouchers) served as indexable 200-status duplicates', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1637),
    value: 7, effort: 2,
    detail: 'app/(marketing)/info/[slug] maps careers/refer-a-friend/gift-vouchers to redirect(), but the route is statically generated so Next baked a client-side meta-refresh served with HTTP 200 and a self-referencing canonical -- full duplicate content, two of the three still sitemap-listed.',
    notes: ['Fix: true 308s in next.config.mjs redirects() for all three slugs; excluded from generateStaticParams (no baked duplicates exist any more); sitemap filter extended from refer-a-friend-only to all three.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Consultation/signup forms have no double-submit guard -- risk of duplicate leads/accounts', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1637),
    value: 7, effort: 2,
    detail: 'components/consult/ConsultForm.tsx relied on an onClick closure status check that reads a stale value on a fast double-click, firing two POST /api/consult requests; components/ai/KVision.tsx go() had the same pattern and never set the actual disabled attribute.',
    notes: ['Fix: ref-based reentrancy guards inside submit()/go() (a ref flips synchronously, before any re-render) plus real disabled attributes on both buttons.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Gift vouchers have no redemption path anywhere in the product', type: 'IDEA', urgency: 'P0', status: 'SHIPPED', assignee: 'claude', pr: PR(1638),
    value: 9, effort: 5,
    detail: 'Marketing promised vouchers redeemable in clinic against any treatment/product/consultation, but only the shop checkout gift-card box worked. Owner call (2026-07-20): any sale, partial allowed, leftover stays on the voucher, no cash change.',
    notes: [
      'POS: voucher-check preview (read-only, nothing reserved on abandoned baskets), atomic reserveVoucher at checkout with re-credit on every failure path, full-cover finalises as paid, card QR charges the remainder only, cancel op expires the Stripe link before claiming so pay-vs-cancel cannot race, and a checkout.session.expired webhook backstop releases reservations from abandoned QRs.',
      'Bookings: voucher op settles fully (ext_gift-voucher channel) or records a partial application on additive Booking.giftVoucherCode/Pence columns; EVERY charge path nets the voucher server-side (chargeBookingAction + paylink/terminal/external), so a reloaded till or second device cannot collect the full price on top of the reservation. voucher-remove re-credits with compensation on failure; cancelBooking returns unconsumed reservations; refundBooking returns voucher-settled money to the voucher and restores the voucher portion on full refund of a part-voucher booking.',
      'Money paths passed an 8-angle adversarial review; the confirmed findings (client-only netting, cancel race, refund rail, expiry backstop, Stripe 30p minimum) were fixed before merge. Two policy questions filed separately: day-close/Xero treatment of voucher-settled revenue.',
    ],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Privacy policy omits Meta, Google Ads and Sentry as data processors', type: 'IDEA', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1638),
    value: 8, effort: 3,
    detail: 'lib/meta-audiences.ts uploads hashed client email/phone to Meta Custom Audiences, lib/conversions.ts sends hashed email to Meta CAPI and gclid+booking value to Google Ads, and Sentry receives error/session data -- none were disclosed as recipients in the privacy policy.',
    notes: ['Owner approved the standard-phrasing disclosure this session (PRJ-939.5): Google Ads folded into the Google entry, Meta (hashed contact details only) and Sentry added to the "Sharing your data" list, and Meta + Sentry added to the international-transfers section in lib/info-pages.ts.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'POS card orders never store stripePaymentIntentId -- Mark refunded silently skips the Stripe refund', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1638),
    value: 8, effort: 1,
    detail: 'POS QR sales are paid via a Stripe Checkout Session; the webhook finalised by metadata.orderId but nothing wrote order.stripePaymentIntentId, so the orders route Mark refunded restocked, credited any gift card and flipped to REFUNDED while its Stripe refund leg was silently skipped. Found by the BLD-882 adversarial review.',
    notes: ['Fix: the shop_order webhook finalisation now records pi.id on the order (guarded, first writer wins). Pre-existing POS card orders still lack a PI -- refund those directly in Stripe.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'SAR export leaks clinical data to non-clinical staff and omits other clinical fields', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1639),
    value: 8, effort: 3,
    detail: 'app/api/admin/clients/[id]/export/route.ts decrypted medicalFlag/allergies/consultation concerns/medicalNotes/allergyNote/CLINICAL interactions/call transcripts for any clients.export holder; only assessments and photos were gated. The export also omitted ConsultationNote entirely and shipped Booking.clinicalNoteEnc as raw ciphertext.',
    notes: ['Fix: all clinical free-text decrypts only under clients.clinical.view; a non-clinical export carries an explicit clinicalDataWithheld notice and the audit line records the withholding. Consultation staff notes now included; the clinical note decrypts under the gate and the cipher never leaves the server. Folds in the BLD-701 transcript gating pending on PR #1574 (that PR can drop its export-route hunk at its next rebase).'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Stripe webhook sub-handlers swallow financial reconciliation errors, invisible to Sentry', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1639),
    value: 8, effort: 3,
    detail: 'Order finalization, gift-voucher confirmation, gift-card re-credits, restock and refund reconciliation each ran in an inner try/catch that only console.error-ed -- the outer Sentry capture never fired for them, so a transient failure left a paid order un-finalized or a refund un-reconciled with zero alerting.',
    notes: ['Fix: Sentry.captureException in all seven inner catches, tagged area:stripe-webhook + a sub tag per path (order-finalize, voucher-confirm, giftcard-recredit-failed-payment, order-restock, giftcard-recredit-refund, voucher-purchase-refund-debit, enrolment-refund-reconcile).'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Google Calendar cancellation desync -- delete failures swallowed silently, event stays live', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1639),
    value: 8, effort: 3,
    detail: 'removeBookingFromClinician wrapped the Calendar DELETE in .catch(()=>{}) then unconditionally cleared googleEventId and reported success -- a cancelled appointment could stay live on the clinician calendar with no record the sync failed.',
    notes: ['Fix: googleEventId clears only when Google confirms the event is gone (2xx, or 404/410 already-deleted); failures console.error + Sentry.captureException (area:google-calendar) and keep the id so the desync is visible and retryable.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Academy payment finalization is non-atomic -- student can pay and stay locked out', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1639),
    value: 8, effort: 3,
    detail: 'finalizeEnrolmentPayment claimed the payment row (PENDING->PAID) then called applyPaidPayment as a separate write; a crash between the two left the payment PAID with the enrolment never advanced, and the redelivery branch treated already-claimed as already-applied so it could never self-heal.',
    notes: ['Fix: claim + applyPaidPayment now run in one db.$transaction (applyPaidPayment accepts a transaction client) -- PAID implies the enrolment advanced. Notifications/receipt/audit stay outside the transaction as best-effort.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'K Vision signup always fails validation -- the Get My Plan account gate is unpassable for new users', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1639),
    value: 9, effort: 2,
    detail: 'components/ai/KVision.tsx AuthStep posts firstName/email/password but clientSignupSchema requires lastName, phone, dob and consent:true -- every signup from the flagship AI flow 422d (verified live). Found while implementing BLD-870: there were no conversions to track because the flow could not convert.',
    notes: ['Fix: a kvision-scoped schema (source:"kvision" selects it in the signup route) accepts the designed name+email+password shape -- those fields are optional in SignupInput and the DB -- and the auth step gains a "By continuing you agree to our terms and privacy policy" line.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: "K Vision AI 'Get My Plan' lead flow fires zero conversion-tracking events", type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1639),
    value: 8, effort: 3,
    detail: 'The flagship homepage lead-gen mechanic gated the AI plan behind account creation but fired no trackLead/sendLead anywhere -- invisible to GA4/Meta, so ad platforms could not optimise toward it and funnel reporting undercounted leads.',
    notes: ['Fix: successful K Vision signups fire trackLead (browser) and sendLead (GA4 + Meta CAPI, server) exactly like /api/consult, deduped via a shared eventId. No hashed email is sent -- the surface has no marketing opt-in. Shipped together with the BLD-928 signup fix that made the flow convertible at all.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: '--color-blush used as readable text fails WCAG contrast (1.69:1) across 20+ files', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1639),
    value: 8, effort: 3,
    detail: 'text-[var(--color-blush)] (#cdb4a3, 1.69:1 on porcelain / 1.56:1 on bone, needs 4.5:1) rendered error/status/delete-link text on light surfaces across the admin, academy, portal, shop and marketing forms.',
    notes: ['Fix: 201 occurrences across 100 files swapped to --color-blush-deep (#8b4a4a, 5.68:1; dark-mode variant #e98a8a), the same mechanical pattern as the gold->gold-deep sweep; bg tints/borders untouched. Deliberately left: 24 kiosk usages (hard-coded dark shell, blush passes at 7.77:1 there) and NewsletterForm (renders only inside dark ink surfaces -- the audit named it from a context-free grep).'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Booking flow selection buttons convey selected state by colour only, no ARIA state', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1640),
    value: 8, effort: 3,
    detail: 'BookingFlow treatment list, variant list, single/course toggle, popular days and time slots -- plus the ManageClient reschedule slots -- were single-select buttons with no aria-pressed, distinguished only by a gold border/fill (WCAG 4.1.2 + 1.4.1) on the primary revenue flow.',
    notes: ['Fix: aria-pressed on all six button groups, matching the pattern the add-on and refreshment buttons in the same file already used.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Booking refund claws back redeemed loyalty points but not points earned on that spend', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1641),
    value: 7, effort: 3,
    detail: 'refundBooking reversed only the REDEMPTION category on refund; the SPEND points awarded by awardClientSpend for the charged amount were never reversed, so a refunded client kept points earned on money that went back.',
    notes: ['Fix: new reverseSpendPoints in lib/client-loyalty.ts -- pro-rata on partial refunds, idempotent by ledger arithmetic (negative SPEND rows record what is already reversed, so webhook redeliveries and successive partials only reverse the delta), tier recomputed after. Wired into both refundBooking and the charge.refunded dashboard-refund webhook path.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: "Erased/deleted client data survives in clinicians' Google Calendars", type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1641),
    value: 8, effort: 3,
    detail: 'Synced calendar events carry client name/phone/email and booking notes into clinicians\' Google Calendars and the shared clinic CalDAV calendar, but eraseClientData/deleteClient never called the calendar-delete path -- a right-to-erasure request left identifying data in third-party accounts indefinitely.',
    notes: ['Fix: both actions now remove every synced event for the client\'s bookings (Google per-clinician + Hostinger CalDAV). Erasure runs the cleanup AFTER its transaction commits; deletion runs it BEFORE the cascade destroys the event ids. Failures never block the data subject\'s right -- they are logged, reach Sentry via the BLD-914-hardened helper, and are counted in the audit record for manual follow-up.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Admin data tables clip instead of scrolling on narrow screens', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1641),
    value: 6, effort: 2,
    detail: 'Sixteen admin table wrappers (StaffManager, RedirectsManager, CampaignsList, OrdersManager, ComplianceManager, SupplierManager, WorkspaceClient x2, EmailCampaignRows, ProductsList, ReplayList, marketing/email x3, reports/sessions x2) used overflow-hidden, clipping data at tablet widths.',
    notes: ['Fix: swapped to overflow-x-auto on each wrapper (rounded-corner clipping is preserved -- a non-visible overflow-x forces overflow-y out of visible per the CSS spec, so corners still clip).'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Swap low-contrast gold text to the AA-safe token sitewide', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1641),
    value: 7, effort: 2,
    detail: '--color-gold (~2.5:1 on porcelain) used at 12px on interactive links in SiteSearch, ExamBankManager, FlashcardsManager, ConnectionCentre and ConsentPanel -- the named audit call sites.',
    notes: ['Fix: the eight named small-text occurrences swapped to --color-gold-deep (4.54:1). Scope is deliberately the audit\'s named functional sites only -- the full ~400-site sweep stays deferred to the design-reviewed pass (BLD-742), same call as BLD-770.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Same-day booking requests fire zero conversion-tracking events', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1642),
    value: 7, effort: 3,
    detail: 'The sameDayRequest early return in booking/start skipped the sendSchedule CAPI call, and the RequestReceived screen (unlike Done) fired no browser event -- same-day conversions were invisible to GA4/Meta.',
    notes: ['Fix: the same-day path now fires the identical server-side Schedule conversion before its early return, and RequestReceived fires the same trackPurchase as Done, deduped via the booking id.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Add erasure and retention limit for anonymous chat PII', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1642),
    value: 7, effort: 3,
    detail: 'Anonymous chat threads (clientId null) hold visitorName/visitorEmail and free-text messages with no erasure path and indefinite retention -- eraseClientData only matched by clientId and no sweep touched ChatConversation.',
    notes: ['Fix: the daily cron now deletes anonymous conversations 12 months after last activity (messages cascade), and erasure additionally matches threads by visitorEmail (case-insensitive), mirroring the PromoRedemption/GiftVoucher email-matched pattern.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Stripe dashboard refunds on shop orders without a gift card are never reconciled locally', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1642),
    value: 7, effort: 3,
    detail: 'The charge.refunded reconcile block was nested inside a giftCardCode check, so an ordinary order refunded in the Stripe dashboard stayed PAID/FULFILLED forever with stock never restored; and any partial refund on a gift-card order was treated as full, over-crediting the card.',
    notes: ['Fix: every PI-matched order reconciles on a dashboard refund (status, restock, audit); the flip + gift-card credit only happen once Stripe\'s cumulative amount_refunded covers the whole card charge, and a partial is logged for staff to finish via Mark refunded. Cumulative per-order refund tracking (Order.refundedPence) arrives with BLD-767 in PR #1574 and can unify this with the delta pattern then.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: "ConsultationNote.body stored in plaintext, bypassing the app's clinical-encryption pattern", type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1643),
    value: 7, effort: 3,
    detail: 'Staff team notes on consultations (free-text, can hold clinical detail) were written unencrypted, unlike every structurally equivalent field (medicalNotes, allergies, clinicalNoteEnc).',
    notes: ['Fix: encClinical at write; reads (consultation page + SAR export under the clinical gate) decrypt with legacy-plaintext tolerance; the daily self-healing backfill now covers the field, with its done-flag bumped to v2 so the already-set production flag cannot skip the new column.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Meta descriptions hard-truncated mid-word/mid-sentence across ~31 treatment pages', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1643),
    value: 7, effort: 3,
    detail: 'Most imported treatment metaDescriptions were cut at ~155-157 chars mid-word (live snippets ending "...easy and efficien"), also feeding JSON-LD Service.description.',
    notes: ['Fix: 26 of 34 rewritten as complete 120-155-char sentences built from each entry\'s own content (treatment name + primary benefit, UK spelling); 8 already clean. Two clean-but-long ones (permanent-makeup-removal 182ch, microcurrent 159ch) left as-is - they end properly; shorten under a follow-up if wanted.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Add Sentry error capture to booking and payment API routes missing it', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1643),
    value: 9, effort: 4,
    detail: 'Nearly all API routes caught their own errors and returned JSON without captureException, so onRequestError never saw them - only ~6 routes reported to Sentry.',
    notes: ['Fix: 17 catch sites across 12 booking/payment routes now report, tagged by route/stage - including the fully-silent BNPL link create, POS session create, shop payment verification, and the admin-orders refund/restock/gift-card paths. Deliberate exclusions (4xx validation, designed degradation, client-input Stripe lookups that would spam on probes) documented on the PR.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Kiosk selfie photos are stored as public, unauthenticated URLs', type: 'IDEA', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1644),
    value: 8, effort: 4,
    detail: 'Face photos were stored access:public on Vercel Blob at a path built from the 10-char session token - viewable by anyone with the URL for up to 30 days, unlike every other clinical image in the platform.',
    notes: ['Fix: uploads now access:private; a session-token-authenticated relay (photo-view, no-store) is the only read path; wire payloads carry relay URLs so no display component changed; AI analysis fetches via the shared private-blob helper with a legacy-public fallback until the 30-day cleanup purges pre-change blobs. Deploy-verified: relay refuses a bogus token with 404. Sign-off note: one manual kiosk happy-path pass on the storefront screen recommended.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Academy Stripe partial refunds silently dropped — paidPence and course access stay wrong', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1646),
    value: 8, effort: 4,
    detail: 'The Stripe webhook treated academy charge refunds as all-or-nothing: a partial dashboard refund on an enrolment payment was skipped entirely, so paidPence and course access never reflected the money going back.',
    notes: ['Fix: reconcileEnrolmentPaymentRefund (lib/academy-payments.ts) applies the cumulative charge.amount_refunded against a new EnrolmentPayment.refundedPence watermark (additive migration), reversing paidPence and re-gating course access on each delta; a full refund still flips state to REFUNDED. In-app refunds stamp the watermark on their own claim so the webhook echo cannot double-apply, and legacy fully-refunded rows (refundedPence still 0) are recognised and skipped.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Stripe refund webhook drops refund deltas on concurrent events — no retry on CAS conflict', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1646),
    value: 7, effort: 4,
    detail: 'Booking refund reconciliation used a single compare-and-set on Booking.refundedPence: when two refund events for one booking landed concurrently, the loser silently dropped its delta — refund total understated, loyalty points never reversed for that slice.',
    notes: ['Fix: the CAS is now a bounded retry loop (3 attempts) that re-fetches the booking on conflict and recomputes the delta from the cumulative charge.amount_refunded; if the conflict persists the handler throws, the webhook returns 500 and Stripe redelivers. Same treatment in the enrolment-payment reconciler.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Health-assessment \'Save & exit\' discards progress despite its label', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1646),
    value: 5, effort: 2,
    detail: 'components/portal/AssessmentRunner.tsx — the control was a plain link to /account labelled as a save; answers only lived in component state, so exiting mid-assessment silently discarded everything.',
    notes: ['Fix: honest control instead of a phantom save lane — relabelled Exit assessment; leaves silently when nothing is answered, otherwise confirms the discard first (new assess.exitConfirm string, en/uk).'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Clinical treatment names and booking notes synced in plaintext to clinicians\' personal Google Calendars', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1648),
    value: 7, effort: 4,
    detail: 'Events pushed to a clinician\'s connected Google Calendar carried the treatment name in the title and client phone/email/notes in the description — often a personal account, outside CRM access controls, surfacing in lock-screen previews and shared calendars. A treatment name can itself reveal a health condition.',
    notes: ['Fix: events now carry a generic title and a login-gated CRM link only; the client data is no longer queried at all. A one-time backfill re-pushes future events with redacted content on the daily cron (Settings-keyed; not stamped while Google is parked, so enabling the integration later still triggers it). The Hostinger CalDAV feed is the clinic\'s own business calendar and deliberately keeps operational detail — owner can extend the redaction there on request.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Academy course-fee promo price re-evaluated live instead of locked at offer time', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1648),
    value: 7, effort: 5,
    detail: 'effectiveFeePence re-derived the fee from whatever promo was live on every call: a learner who paid a deposit during a promo was billed balance = list price minus paid once it expired — more than agreed — and the reverse windfall also occurred.',
    notes: ['Fix: additive Enrolment.agreedFeePence, stamped when staff make the offer (re-offers before any payment re-quote at live pricing), at the learner\'s first online payment, and at instalment-plan creation; an explicit staff price edit re-stamps it. The money engine settles against the locked fee; pre-lock rows keep the legacy derivation. Admin pipeline and student profile display the locked fee; marketing pages still quote live promos to prospects.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Academy \'Hotspot\' exercise has no keyboard path — blocks graded assessment', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1648),
    value: 7, effort: 5,
    detail: 'The Hotspot answer surface was a plain onClick div — keyboard-only students could not complete graded coursework at all (WCAG 2.1.1 Level A), unlike every sibling exercise type in ExercisePlayer.tsx.',
    notes: ['Fix: focusable image surface with visible focus ring; arrow keys move a two-tone crosshair in the same %-coordinate space as the mouse (2% steps, Shift 10%); Enter/Space places through the identical code path as a click; debounced aria-live announces position and placements; role=application + sr-only key instructions. Crosshair renders only on keyboard focus, so pointer users see no change. Same mechanism on the ExercisesManager authoring surfaces (hotspot, label, type-in). Covers BLD-890 and BLD-905.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Graded academy \'label the image\' exercise is keyboard-inaccessible', type: 'IDEA', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1648),
    value: 7, effort: 5,
    detail: 'Same finding as the Hotspot card from a different audit pass, plus the staff authoring tool (ExercisesManager) sharing the mouse-only pin placement.',
    notes: ['Shipped with the Hotspot fix in PR #1648 — the arrow-key crosshair mechanism the card proposed, applied to the learner exercise and all three authoring point editors.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'K Academy \'Hotspot\' exercise cannot be completed by keyboard', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1648),
    value: 6, effort: 5,
    detail: 'Duplicate of the Hotspot keyboard finding (BLD-855) from the end-of-day accessibility audit.',
    notes: ['Shipped with PR #1648 — see the BLD-855 entry.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Brand gold text fails WCAG AA contrast in 400+ places across admin', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1649),
    value: 8, effort: 6,
    detail: '--color-gold (#a98a6d) is 3.2:1 on white — passing AA only for large text — yet was the text colour of labels, links, prices, counts, table cells and badges across ~400 sites, public and admin.',
    notes: ['296 small-text occurrences on light backgrounds moved to --color-gold-deep (the palette\'s documented AA text colour) across 153 files; 103 deliberately kept (large display text, gold on dark surfaces, non-text decoration — all pass as-is). Three both-surface components got surface-aware colours: Header shop-link hover follows header state, Button outline hover mixes 50% toward gold via color-mix, HomeworkPanel notice joined its tone maps. White-on-gold buttons (~180 sites) are the separate owner decision on PRJ-939.9.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Brand gold used directly as functional text color fails WCAG AA contrast across roughly 400 call sites', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1649),
    value: 8, effort: 6,
    detail: 'Same finding as BLD-742 from the public-site audit pass.',
    notes: ['Shipped with BLD-742 in PR #1649 — one sitewide sweep covered both cards.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Training Days for Different Cohorts', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1650),
    value: 8, effort: 5,
    detail: 'Owner request: create separate practical training days per cohort, several dates per cohort, editable and deletable, never shared across cohorts.',
    notes: ['New additive CohortPracticalDay table; Practical days panel on each cohort row (Admin → K Academy → Cohorts) with inline add/edit/delete; tenant-scoped API ops; student portal calendars show their own cohort\'s dates, with the old single practical window as the fallback for cohorts with no dates added. Registered in the BLD-300 tenant-isolation guard.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'K Academy course videos have no captions or transcript (WCAG 1.2.2 failure on paid product)', type: 'IDEA', urgency: 'P1', status: 'BLOCKED', assignee: 'claude', pr: PR(1650),
    value: 7, effort: 6,
    detail: 'No caption path existed anywhere in the academy video stack — lesson player, demo player, immersive player.',
    notes: ['Plumbing shipped in PR #1650: additive Lesson.captionsUrl + DemoVideo.captionsUrl, caption tracks on the lesson and demo players, .vtt fields in the curriculum editor and demo manager. BLOCKED on the owner\'s A/B/C choice for captioning the existing catalogue (question on the card); the immersive player\'s encoded-art video path follows once caption files exist.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'TOTP 2FA-disable endpoint has no rate limiting — brute-forceable', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1651),
    value: 7, effort: 2,
    detail: 'A stolen admin session cookie allowed unlimited attempts at the 6-digit code to strip 2FA.',
    notes: ['Fix: enforceRateLimit(twofa-disable, 8 attempts / 5 min, admin portal) before the code check — the PRJ-939.3 finance-PIN pattern.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Internal IP block-list feed is guarded by a guessable static header', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1651),
    value: 6, effort: 2,
    detail: 'The deny-list feed accepted a hardcoded x-mw-block: 1 header readable from source, letting an attacker learn whether their IP is blocked.',
    notes: ['Fix: real shared secret (MW_BLOCK_SECRET, defaulting to the enforced CRON_SECRET) compared timing-safe on the route; the edge middleware sends the same secret. Unauthorised callers still get the indistinguishable empty 200. Verified live post-deploy: the old header value now returns an empty list.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Session JWT secret derived from weak input without a length floor', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1651),
    value: 5, effort: 2,
    detail: 'toKey byte-repeats sub-32-byte secrets up to the HS256 minimum — stretching length, not entropy.',
    notes: ['Fix: startup check (instrumentation.ts, BLD-415 pattern) reports any of the three session secrets under 32 bytes with a loud error — deliberately not a throw; the value can only be fixed by rotating it in Vercel.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'booking/confirm confirms any bookingId without ownership scoping or rate limit', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1651),
    value: 7, effort: 3,
    detail: 'No session, no ownership check, no rate limit — booking-ID probing against a money-adjacent route. The funnel is anonymous, so a session check would break guest bookings.',
    notes: ['Fix: ownership proven by possession of the SetupIntent client secret only the paying browser holds (funnel sends it; mismatch 403), plus a 10/5min rate limit. Legacy confirms without the secret are allowed but Sentry-reported; enforcement flips strict in a follow-up once pre-deploy sessions age out.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Stripe webhook sub-step failures (order finalize, voucher confirm, gift-card re-credit, refund, enrolment) never reach Sentry', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1651),
    value: 6, effort: 2,
    detail: 'BLD-868 covered the headline sub-steps; five money-path catches still swallowed errors silently.',
    notes: ['Fix: the course-prepaid confirmation notify, full-refund points reversal, SPEND-points clawback, Xero refund push and dashboard-refund client email now log + captureException, still non-fatal.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Kiosk AI analysis can double-fire and double-bill on a fast double-tap', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1651),
    value: 6, effort: 2,
    detail: 'Two near-simultaneous analyze calls both passed the status check and both triggered a billed AI run.',
    notes: ['Fix: compare-and-swap claim on stage != analyzing before scheduling; the loser returns the same success shape and follows over SSE. Failed runs reset stage to failed, so retries still pass.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Renewal-reminder cron failures never counted or alerted', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1652),
    value: 5, effort: 1,
    detail: 'The runRenewalReminders catch only console.errored, unlike every sibling step.',
    notes: ['Fix: failures++ in the catch so the existing Sentry/webhook/500 alerting fires.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Daily cron discards Google Calendar and Google Business sync failures — always logs success eve', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1652),
    value: 5, effort: 2,
    detail: 'syncAllCalendars discarded per-staff errors and always returned ok; the gbiz step swallowed too.',
    notes: ['Fix: per-staff failures counted and surfaced (ok flips false), both cron steps count into failures with logging.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Turnstile bot-check call has no timeout or telemetry', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1652),
    value: 6, effort: 1,
    detail: 'A hung Cloudflare verify stalled every gated form for the full request budget, silently.',
    notes: ['Fix: 8s AbortSignal.timeout + console.error + Sentry warning on failure; still fails closed.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Kiosk selfie fetch has no timeout unlike the AI call that follows it', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1652),
    value: 5, effort: 1,
    detail: 'The blob photo read had no timeout while the AI call beside it is capped at 30s.',
    notes: ['Fix: 15s timeout on both read paths in lib/kiosk-blob.ts (private get + legacy public fetch). Covers BLD-878 too.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Kiosk photo-fetch calls have no timeout, unlike the AI calls beside them', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1652),
    value: 5, effort: 1,
    detail: 'Duplicate of PRJ-939.13 from a different audit pass.',
    notes: ['Shipped with PR #1652 — both kiosk blob read paths capped at 15s.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Homepage below-the-fold treatment card images marked priority, hurting LCP', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1652),
    value: 5, effort: 1,
    detail: 'Both dual-discipline cards preloaded eagerly despite rendering after a full-viewport hero.',
    notes: ['Fix: priority removed; MediaArt defaults to lazy. Covers BLD-833 too.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Remove eager priority from below-the-fold homepage images', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1652),
    value: 5, effort: 1,
    detail: 'Duplicate of BLD-920.',
    notes: ['Shipped with PR #1652.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Homepage testimonial quote text hard-clipped on mobile, unreadable', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1652),
    value: 5, effort: 1,
    detail: 'Classic grid min-width:auto overflow clipped quotes mid-word at 375px.',
    notes: ['Fix: min-w-0 on the quote grid column.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'serviceLd() emits an invalid schema.org @type (\'Dentistry\') for dentistry treatment pages', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1652),
    value: 5, effort: 1,
    detail: 'Dentistry is a MedicalSpecialty enum member, not an instantiable type — failed validation on every dentistry page.',
    notes: ['Fix: always MedicalProcedure, with relevantSpecialty: schema.org/Dentistry where it applies.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Mobile header \'Book\' CTA is below the 44px touch-target minimum', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1652),
    value: 5, effort: 1,
    detail: 'The primary conversion action measured 90x36px while the hamburger beside it was 44x44.',
    notes: ['Fix: !min-h-11 on the button — 44px hit area, same visual compactness.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Live-visit page typesets "KClinics" as text instead of the logo mark, with a strap-line under i', type: 'ERROR', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1652),
    value: 5, effort: 2,
    detail: 'Both banned patterns from docs/BRAND_GUIDELINES.md in one header.',
    notes: ['Fix: real K monogram + wordmark (KioskShell pattern); the Your visit · live descriptor moved off the mark. Covers BLD-758 too.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Plain-text \'KClinics\' typeset as a pseudo-logo with a strap-line in the live-visit compani', type: 'ERROR', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1652),
    value: 5, effort: 2,
    detail: 'Duplicate of BLD-805.',
    notes: ['Shipped with PR #1652.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Gallery before/after photos servable with no published/consent check', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1652),
    value: 7, effort: 2,
    detail: 'The image route streamed any GalleryItem id — draft and unconsented clinical photos included.',
    notes: ['Fix: public access requires published + consent; drafts viewable to signed-in staff only with private, no-store caching (the admin manager previews through the same URL).'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Review-request messages bypass marketing-consent/unsubscribe checks', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1652),
    value: 6, effort: 2,
    detail: 'sendReviewRequest sent email/SMS with no opt-in or unsubscribe check, auto-triggered on booking completion.',
    notes: ['Fix: the standard marketing-consent gate (opt-in with recorded evidence, never past an unsubscribe) on both channels.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'No admin- or account-scoped 404 — unknown /admin URLs drop staff into the public marketing shel', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1652),
    value: 4, effort: 2,
    detail: 'The only not-found page rendered the full public marketing shell.',
    notes: ['Fix: minimal scoped not-found pages for /admin and /account with routes back into each shell. Deploy-verified live.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'POS \'Terminal\' checkout option is a guaranteed dead end mid-session', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1652),
    value: 5, effort: 2,
    detail: 'The Terminal tab presented as first-class but always failed — no provider has credentials.',
    notes: ['Fix: the tab renders only when a provider is configured AND a device is registered; the device manager explains the credential requirement.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Global \'Shop\' nav link is a permanent dead end to an empty, indexed page', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1652),
    value: 5, effort: 2,
    detail: 'Sitewide nav link to a coming-soon page with zero products, indexed at 0.7.',
    notes: ['Fix: the nav link (desktop + mobile), sitemap entry and page indexability all key off the live ACTIVE-product count (config cached ~1h) — everything appears when the first product goes live.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Add view_item/ViewContent tracking on treatment pages', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1653),
    value: 6, effort: 2,
    detail: 'No top-of-funnel signal existed — trackLead/trackPurchase only; detail-page views built no remarketing audience.',
    notes: ['Fix: consent-gated trackViewItem (GA4 view_item + Meta ViewContent) fired once per mount by a null-rendering client tracker on every treatment page (with live from-price) and package page.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Newsletter capture absent from most high-traffic marketing pages', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1653),
    value: 6, effort: 3,
    detail: 'Email capture rendered on only three pages and every signup was attributed to footer.',
    notes: ['Fix: NewsletterCapture on /treatments, /offers, /pricing, /reviews, /ai-consultation and every treatment page; the form carries a validated per-surface source through the API so attribution is real. Deploy-verified rendering live on /treatments.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: 'Discount/offers program is invisible to first-time visitors — no homepage placement, buried in ', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1653),
    value: 5, effort: 2,
    detail: 'OffersStrip rendered only on /pricing and /account; the homepage never showed running discounts.',
    notes: ['Fix: the strip joins the homepage above the newsletter capture, rendering nothing when no offers are live. Main-nav placement of Special Offers offered to the owner as an option on the card.'],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: "Sitewide WCAG AA contrast failure — gold background paired with white text on ~90 interactive elements", type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1655),
    value: 8, effort: 6,
    detail: "White text on the light brand gold is ~2.9:1 — fails AA at every size — across ~180 buttons and highlights.",
    notes: ["Owner chose to darken the buttons (20 Jul). 353 gold backgrounds judged individually; 168 swapped to gold-deep (the design system primary button colour) including 15 hover states and 6 hover no-ops moved to hover-to-ink; 185 kept (tints under dark text, dark-text-on-gold, decorations). Zero white-on-light-gold remains."],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: "Client contact lists uploaded to Meta for ad-audience matching without clear disclosure or distinct consent", type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1655),
    value: 7, effort: 3,
    detail: "Contact lists were uploaded to Meta for audience matching with only general marketing opt-in and no clear disclosure.",
    notes: ["Owner chose disclose + keep uploading (20 Jul). The ad-matching disclosure (contact details used in hashed form to show offers on social media, with a Privacy Policy pointer) now appears at every marketing consent point — booking signup, portal signup + wizard, profile, consult form, portal prompt — in English and Ukrainian; the privacy policy processor entry already named Meta."],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: "WebAuthn/passkey RP ID and origin are derived from the request Host header, not a fixed allowlist", type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1656),
    value: 7, effort: 3,
    detail: "rp() built the RP ID and expected origins from the request URL, trusting the Host header.",
    notes: ["Owner approved pinning (20 Jul). In production the request URL is ignored — RP ID and origins come from the canonical site URL (apex + www preserved for iOS); localhost honoured only outside production. Own PR per security-surface rule. Existing kclinics.co.uk passkeys unchanged."],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: "VAT-exclusive pricing charges net but reports gross — VAT never actually collected", type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1657),
    value: 8, effort: 4,
    detail: "Exclusive mode charged the listed net amount while reporting added VAT on top — recording VAT never collected.",
    notes: ["Owner chose prices stay inclusive (20 Jul). vatBreakdown always extracts VAT from the charged amount; the note always reads inclusive; the dead toggle removed from finance settings. Zero change to any charge; reporting corrected. Covers BLD-847."],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: "VAT never added to the Stripe charge in exclusive-pricing mode", type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1657),
    value: 8, effort: 4,
    detail: "The charge-side twin of PRJ-939.1.",
    notes: ["Resolved by the PRJ-939.1 decision (prices always inclusive) — no exclusive mode remains to add VAT in. Shipped with PR #1657."],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: "Academy trainee portfolio photos stored as public, unencrypted URLs with no consent record", type: 'IDEA', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1658),
    value: 7, effort: 6,
    detail: "Real before/after clinical photos stored as public blob URLs, identified only by a free-text ref, no consent field.",
    notes: ["Owner chose full parity (20 Jul). Private storage (prefix-pinned token), an ownership-verified authenticated relay as the only read path, a required subject-consent attestation to save, and a self-healing daily sweep re-homing public blobs into private (permanent, not one-time, because the client token cannot pin the access level). Deploy-verified: the relay 404s an unauthenticated probe."],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: "Capture booking intent before contact details to enable true abandoned-booking recovery", type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1659),
    value: 8, effort: 5,
    detail: "The funnel captured no contact details until the final step, so a treatment+time drop-off was unrecoverable.",
    notes: ["Owner chose both (20 Jul). An optional email-me-my-selection field after treatment selection posts a BookingIntent; a gated daily automation sends one transactional finish-your-booking nudge 2-72h later (legitimate interest, unsubscribe-honoured, never marketing, skipped if already booked). Plus 7-day in-browser resume, SSR-safe, capped at the time step. Covers BLD-853."],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: "Booking funnel captures zero contact info until the final step — most drop-off is unrecoverable", type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1659),
    value: 8, effort: 5,
    detail: "The browser-resume half of the funnel-capture finding.",
    notes: ["Shipped with BLD-838 in PR #1659 — funnel selections persist in-browser for 7 days and a returning visitor resumes where they left off."],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: "AI consultation ('Get My Plan') requires full password signup before showing any result", type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1660),
    value: 9, effort: 5,
    detail: "The AI plan was gated behind a name + email + password account — the biggest drop-off point in the flow.",
    notes: ["Owner chose email-only signup (20 Jul). The K Vision signup is passwordless: name + email creates a guest account (BLD-550), the plan reveals immediately on a live session, and a one-tap sign-in link is emailed for returning later. Login mode keeps the password field for the minority who set one. No schema change."],
  },
  {
    // Title matches the live board card exactly so seedBacklog dedupes onto it.
    title: "middleware.ts redirect self-fetch uses the request's own Host-derived origin — the same SSRF pattern a neighboring fetch was hardened against", type: 'ERROR', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1662),
    value: 5, effort: 2,
    detail: "loadRedirects built its self-fetch URL from req.nextUrl.origin, a client-spoofable Host header — the same SSRF sink blockedIps() next to it was already hardened against.",
    notes: ["Fix: loadRedirects now uses the same trusted SELF_BASE (NEXT_PUBLIC_SITE_URL) constant blockedIps already used, instead of the request-derived origin."],
  },
  {
    title: 'Add scheduled uptime monitoring for the live health check', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1662),
    value: 7, effort: 3,
    detail: 'scripts/healthcheck.mjs and /api/health were well-built but nothing scheduled them — no automatic detection of a production outage between manual audits.',
    notes: ["Fix: Vercel Cron hits /api/health every 5 minutes (matching the project's existing /api/cron/* convention, CRON_SECRET-authed); a failed check pages CRON_ALERT_WEBHOOK_URL and Sentry, mirroring app/api/cron/daily. CRON_ALERT_WEBHOOK_URL documented in .env.example (used in 3 places, previously undocumented)."],
  },
  {
    title: 'Academy funding application decisions never reach the student', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1662),
    value: 7, effort: 4,
    detail: 'Staff decisions on FundingApplication.status (APPROVED/DECLINED/FUNDED) were saved with no email and no portal visibility for the applicant.',
    notes: ['Fix: a status-change email (tmplFundingDecision) fires on Approved/Declined/Funded/Referred, and the trainee portal now shows a "Funding application" card with the live status.'],
  },
  {
    title: 'Student Last Login Tracking', type: 'ERROR', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1662),
    value: 6, effort: 2,
    detail: 'Most students showed "-" in the admin Last Login column despite active portal use.',
    notes: ["Root cause: students onboarded via the magic-link activation flow (app/(marketing)/academy/activate) never got lastLoginAt written — only password login and passkey auth did. activateStudent() now records lastLoginAt like every other sign-in path."],
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
