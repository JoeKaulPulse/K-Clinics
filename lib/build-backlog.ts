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
    notes: [
      'Proposed first concrete spike (§18.2): move one domain (e.g. Learning) into a shared package and demonstrate affected-only builds.',
      'Owner go-ahead 18 Aug 2026 (in session with Joe): start Phase 0 now — modularise in place only, no infra change. The sign-off gate stays on Phases 1+ (they still depend on the baseline decision); Phase 0 was explicitly released from it.',
    ],
    // §18.1's sign-off gate originally held every phase. The owner released
    // Phase 0 on 18 Aug 2026 (zero-infra-risk, front-loaded value), so its
    // dependsOn is removed; Phases 1+ still chain behind the gate via Phase 0's
    // own completion and the plan baseline.
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
    notes: [
      'app/(marketing)/[slug]/page.tsx generateMetadata, site.dentistryLive flag.',
      'Superseded by BLD-1250: the placeholder booking CTAs that justified this noindex are gone -- dentistry treatment pages now show an "Opening soon" badge and a register-interest CTA -- so the pages are indexed again, with their title/description swapped to coming-soon framing while dentistryLive is false.',
    ],
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
      'Superseded by BLD-1250: the dentistry pages are no longer noindexed, so the gating this item added was removed and all 9 dentistry URLs are listed unconditionally again. The invariant this item existed to protect -- everything in the sitemap is indexable -- still holds.',
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
  {
    title: 'Treatment and booking pages show no social proof despite working review data', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1686),
    value: 7, effort: 3,
    detail: 'The working 4.5-star/25-review aggregate and testimonials carousel were wired into the homepage only -- the treatment and booking pages, where buying decisions actually happen, carried no visible trust signal.',
    notes: ['Fix: reused the existing Stars badge and testimonial cards on TreatmentTemplate and the book page, near the price/CTA. (PRJ-1034.7)'],
  },
  {
    title: 'Fixed chat button overlaps footer legal text again (regression of BLD-556)', type: 'ERROR', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1685),
    value: 6, effort: 3,
    detail: 'The fixed WhatsApp/live-chat button sat on top of the footer copyright line at the true bottom scroll position on both mobile and desktop -- the BLD-556 IntersectionObserver fade didn\'t reliably hold at the final resting position.',
    notes: ['Fix: adjusted useHideAtFooter\'s IntersectionObserver threshold/rootMargin (plus a scroll-position fallback) so the button reliably stays hidden at the bottom of the page. Verified with local Playwright screenshots at 375x812 and 1440x900. (PRJ-1034.10)'],
  },
  {
    title: '12 legal/policy pages are orphaned with zero internal links', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1684),
    value: 5, effort: 2,
    detail: 'Only 2 of 12 /info/[slug] legal pages were ever linked from a page, despite all 12 being in sitemap.ts -- orphan pages get little to no crawl priority.',
    notes: ['Fix: added a Legal & Policies list in the Footer linking every /info/[slug] page. (PRJ-1034.11)'],
  },
  {
    title: 'Careers \'Apply for this role\' doesn\'t pass the selected role to the form', type: 'ERROR', urgency: 'P3', status: 'SHIPPED', assignee: 'claude', pr: PR(1684),
    value: 3, effort: 2,
    detail: 'Every vacancy\'s Apply link pointed to the bare #apply anchor and ApplyForm always defaulted to the first role, misattributing applications for any other vacancy.',
    notes: ['Fix: the vacancy is now passed through to ApplyForm, which seeds its Role dropdown from it. (PRJ-1034.12)'],
  },
  {
    title: 'Marketing route group has no loading.tsx/Suspense boundaries', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1684),
    value: 6, effort: 3,
    detail: 'The whole app/(marketing)/ tree, including the DB-backed /book and /search routes, had zero loading.tsx boundaries, blocking on a blank tab instead of streaming a skeleton.',
    notes: ['Fix: added loading.tsx skeletons for /book and /search. (PRJ-1034.8)'],
  },
  {
    title: 'Gift voucher amount presets have no accessible selected state', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1683),
    value: 6, effort: 1,
    detail: 'The preset amount buttons on /gift-vouchers carried no aria-pressed, so the visually-selected amount was indistinguishable to a screen reader.',
    notes: ['Fix: added aria-pressed matching the existing pattern in BookingFlow.tsx. (PRJ-1034.3)'],
  },
  {
    title: 'Reversed heading order (h2 before h1) on every login/signup/reset page', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1683),
    value: 6, effort: 2,
    detail: 'AuthShell rendered a decorative brand-panel tagline as h2 before the page\'s real h1 in DOM order, across every auth page.',
    notes: ['Fix: changed the decorative tagline from h2 to a styled p so h1 remains the first heading. (PRJ-1034.9)'],
  },
  {
    title: 'Stripe webhook drops dashboard refunds after the first in-app refund on a charge', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1682),
    value: 7, effort: 3,
    detail: 'originatedInApp checked whether ANY refund on a charge carried in-app metadata rather than the specific event\'s refund, so a later dashboard-issued refund after an in-app one was silently dropped -- refundedPence went stale, no Xero credit note, no loyalty clawback, no client email.',
    notes: ['Fix: match on the specific refund object for each webhook event (or compare charge.amount_refunded against the stored watermark unconditionally) instead of gating on any historical refund\'s metadata, while preserving idempotency. (PRJ-1034.5)'],
  },
  {
    title: 'Live health check never verifies scheduled cron jobs are actually running', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1681),
    value: 8, effort: 2,
    detail: 'cron_daily_last/cron_dispatch_last heartbeats were only checked on human-viewed admin pages, never by the /api/health endpoint Vercel Cron polls and alerts on, so a silently-broken cron went undetected.',
    notes: ['Fix: reused the existing staleness logic from lib/api-health.ts inside /api/health so cron staleness triggers the same Sentry/webhook alert path as other health failures. (PRJ-1034.2)'],
  },
  {
    title: 'Booking confirmation email failures never reach Sentry', type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude', pr: PR(1681),
    value: 5, effort: 1,
    detail: 'lib/booking-notify.ts only console.error\'d and wrote a FAILED EmailEvent row on send failure, so a Resend outage at booking time went unalerted.',
    notes: ['Fix: added Sentry.captureException/captureMessage in notifyBookingConfirmed\'s failure paths, tagged area: booking-notify, consistent with app/api/booking/confirm/route.ts. (PRJ-1034.6)'],
  },
  {
    title: 'Unauthenticated signup can hijack any existing client\'s account', type: 'ERROR', urgency: 'P0', status: 'SHIPPED', assignee: 'claude', pr: PR(1680),
    value: 10, effort: 3,
    detail: 'POST /api/account/signup upserted the Client row matched by attacker-supplied email and unconditionally minted a kc_client session, letting anyone who knew a target email (e.g. from a prior consult/guest-booking/kiosk lead) hijack that account with zero verification.',
    notes: ['Fix: never mint a session for a pre-existing Client row; route pre-existing passwordless records through the email-link invite flow instead; stop overwriting name/phone/DOB on records with prior activity. Follow-up: BookingFlow shows a claim-email message instead of a raw 401 for returning guests. (PRJ-1034.1)'],
  },
  {
    title: 'Cancelled appointments still earn loyalty points', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1687),
    detail: 'finalizeBookingCharge() (the async SCA-confirm / Stripe-webhook charge path) awarded loyalty SPEND points unconditionally, even for a late-cancellation fee -- the synchronous chargeBooking() path never did this for late fees.',
    notes: ['Fix: finalizeBookingCharge() now skips the loyalty award when opts.late is true, matching the synchronous path. (BLD-994)'],
  },
  {
    title: 'Staff \'charge for delivered service\' can double-charge clients who redeemed loyalty points', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1687),
    value: 7, effort: 2,
    detail: 'chargeBookingAction() netted an applied gift voucher off the charge amount server-side, but never netted pointsRedeemedPence -- only pre-filled client-side, so a stale UI / edited amount / replayed request could double-charge a client who already redeemed points as money off the booking.',
    notes: ['Fix: nets redeemed loyalty points off the charge amount server-side, same as the existing gift-voucher netting. (BLD-1001)'],
  },
  {
    title: 'Concurrent in-app refunds can silently drop refund accounting', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1687),
    value: 8, effort: 4,
    detail: 'refundBooking() did a single non-retrying compare-and-swap write on refundedPence; on a lost race it returned ok:true without running loyalty/Xero/email side-effects, even though the Stripe refund had already gone through.',
    notes: ['Fix: refundBooking() now re-reads and retries the CAS write (up to 2 attempts) instead of silently dropping the accounting, mirroring the existing retry pattern in the charge.refunded webhook handler. (BLD-1000)'],
  },
  {
    title: 'Academy live classes notify zero enrolled students on create/reschedule/cancel', type: 'TASK', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 8, effort: 4,
    detail: 'upsertLiveClass/removeLiveClass in app/api/admin/academy/route.ts let staff create, reschedule (edit startAt/endAt/joinUrl) or delete a scheduled live class via components/admin/LiveClassManager.tsx with zero email reaching enrolled students, and lib/automations.ts had no LiveClass awareness at all.',
    notes: ['Fix: added lib/academy-live-class.ts with notifyLiveClassChange() (created/rescheduled/cancelled) and sendLiveClassSameDayReminders() -- both query Enrolment rows with status in (PAID, ENROLLED) for the class\'s courseId and email applicantEmail directly (works whether or not the learner has a linked AcademyStudent account; widened from ENROLLED-only during review since self-serve Stripe payments land a learner in PAID and nothing auto-promotes PAID to ENROLLED, so an ENROLLED-only filter would have missed every paying student). Four new email templates in lib/email.ts (tmplLiveClassScheduled/Rescheduled/Cancelled/Reminder) and a new EmailKind.LIVE_CLASS enum value (additive, no @unique) for logging + dedup via meta {liveClassId, change}. Wired into upsertLiveClass (notify on both create and update, non-blocking .catch) and removeLiveClass (read the row, delete, then notify only if a row was actually deleted -- avoids a false cancellation on a race/bad id). Added liveClassReminders() to lib/automations.ts, folded into runDailyAutomations() and its Tally type, plus the fallback Tally literal in app/api/cron/daily/route.ts. Same-day reminder window mirrors the clinicDateISO/clinicDayBounds pattern from the booking reminders() job; idempotency reuses the EmailEvent-lookup dedup pattern already used by tierNudges/membershipRenewal/aftercare rather than a new schema field, since one class has many recipients. Email-only: no SMS wired in, since lib/sms.ts sendSms() is booking-specific (needs a Booking-shaped manage link/phone-consent flow) and adding it here would be new infrastructure, not a one-line reuse. Files: prisma/schema.prisma, lib/email.ts, lib/academy-live-class.ts (new), lib/automations.ts, app/api/admin/academy/route.ts, app/api/cron/daily/route.ts. (BLD-1034)'],
  },
  {
    title: 'Team-chat "New conversation" modal has no keyboard trap or Escape handling', type: 'TASK', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 6, effort: 1,
    detail: 'NewChatModal.tsx is a hand-rolled role="dialog" aria-modal="true" panel with backdrop click-to-close, but no focus trap, no Escape-to-close, no initial-focus move into the panel, and no focus-return to the opener on close -- a keyboard or screen-reader user could tab out of the dialog into the page behind it.',
    notes: ['Fix: wired the existing useDialogBehaviours hook (components/ui/Dialog.tsx) into NewChatModal.tsx -- panelRef + tabIndex={-1} on the role="dialog" panel, onKeyDown on the overlay. Both call sites (ChatLauncher.tsx, MessagesPage.tsx) already conditionally mount the modal, so active is always true. Branch claude/a11y-modal-richtext-1003-1033. (BLD-1003)'],
  },
  {
    title: 'Rich-text block editor field has no accessible name or visible focus ring', type: 'TASK', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 5, effort: 1,
    detail: 'RichTextField.tsx already accepted an ariaLabel prop and applied it to its contentEditable div, but its only caller (BlockEditor.tsx) never passed one, so every block content field was an unlabelled textbox to a screen reader. Separately, the field carried outline-none with no focus-visible replacement, so Tailwind\'s utilities layer beat the @layer base :focus-visible rule in app/globals.css and keyboard focus was invisible.',
    notes: ['Fix: BlockEditor.tsx now passes ariaLabel={`${BLOCK_LABELS[b.type]} block content`} (e.g. "Paragraph block content", "Heading block content") to RichTextField. RichTextField.tsx\'s rt-field div gained focus-visible:ring-2 focus-visible:ring-[var(--color-gold)], matching the ring color/utility pattern used across the admin (SearchBox.tsx, NewsletterForm.tsx, AddTreatment.tsx, PosTerminal.tsx, etc). Branch claude/a11y-modal-richtext-1003-1033. (BLD-1033)'],
  },
  {
    title: '/book page awaits three independent data stages sequentially, delaying first paint', type: 'TASK', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 8, effort: 3,
    detail: 'app/(marketing)/book/page.tsx awaited getReviewAggregate(), then the catalogue+offers try/catch, then the signed-in client-personalisation try/catch, one after another, even though none of the three reads another\'s output -- on the site\'s highest-value conversion route.',
    notes: ['Fix: each stage now runs inside its own async function and all three are kicked off together via Promise.all, combining results only after. The "call us" degraded fallback, the best-effort/never-break-the-page behaviour of client personalisation, and all error logging are unchanged. (BLD-1031)'],
  },
  {
    title: '/admin dashboard runs a string of independent queries sequentially after its main batch', type: 'TASK', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 8, effort: 5,
    detail: 'app/admin/page.tsx ran a 17-query Promise.all, then unchargedCompleted, then sameDayRequests, then can/locale/treatments/roomsToday, then the nextBk -> nextRoom -> nextRoomPrep lookup -- each blocking the next -- even though most only depend on the canX permission booleans resolved before the batch even starts, not on each other\'s results.',
    notes: ['Fix: folded unchargedCompleted and sameDayRequests into the main query batch, and run sessionPermissions(), getLocale(), loadBookingTreatments(), roomsToday and the nextBk/nextRoom/nextRoomPrep chain concurrently with that batch via one upfront Promise.all. todayNotReady stays sequential after the batch (it genuinely reads todaysBookings/reqConsent/reqPhoto from it); the nextRoom/nextRoomPrep lookup stays sequential internally (it genuinely reads nextBk.id/nextRoom.id) but the chain as a whole no longer waits on anything else. No query logic, filters, or permission gates changed. Suspense-wrapping the slower widgets (stretch goal) was not attempted -- deferred as a larger structural change. (BLD-1002)'],
  },
  {
    title: 'Shop checkout never fires a GA4/Meta purchase conversion', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 2,
    detail: 'CheckoutForm.tsx never called trackPurchase and neither the shop confirm route nor finalizeOrder() ever called sendPurchase, unlike bookings and gift vouchers -- every shop order converted with zero ad-attribution data reaching GA4 or Meta.',
    notes: ['Fix: components/shop/CheckoutForm.tsx PayStep onDone now fires trackPurchase (browser, Meta Purchase) deduped by orderId; app/api/shop/confirm/route.ts returns totalPence so the client has a value to report. Server-side, lib/shop.ts finalizeOrder() now calls sendPurchase after the atomic PAID claim, so it fires exactly once regardless of whether the confirm route, the Stripe webhook backstop, or the fully-gift-card-covered checkout path finalises the order. Shop checkout is guest-first (Order.clientId is only set for a logged-in portal session) -- email is only passed to Meta/GA4 when the order is linked to a client with marketingOptIn and not unsubscribed, defaulting to no email otherwise, same stance as the existing gift-voucher purchase event. (BLD-1005)'],
  },
  {
    title: 'Academy enrolment payments never fire a GA4/Meta purchase conversion', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 8, effort: 3,
    detail: 'Unlike bookings and gift vouchers, neither app/api/academy/pay/confirm/route.ts nor lib/academy-payments.ts finalizeEnrolmentPayment() called trackPurchase/sendPurchase, so course-fee and deposit payments never reached ad-attribution tracking.',
    notes: ['Fix: components/academy/EnrolmentCheckout.tsx PayStep onDone now fires trackPurchase (browser, Meta Purchase) deduped by paymentId. Server-side, lib/academy-payments.ts adds sendEnrolmentPurchaseConversion(), called from finalizeEnrolmentPayment() only on the tx.claimed branch so it fires exactly once whether the Stripe webhook or the synchronous confirm endpoint claims the payment. AcademyStudent has no marketing-consent field of its own -- consent is read off the linked CRM Client via student.clientId, and email is only passed to Meta/GA4 when that Client has marketingOptIn and is not unsubscribed, defaulting to no email for an unlinked student. (BLD-1036)'],
  },
  {
    title: 'Outdated Next.js ships with 5 high-severity CVEs including a middleware-bypass advisory', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 8, effort: 2,
    detail: 'package.json pins next@^16.2.9 (confirmed via npm ls); npm audit reports 5 high-severity Next.js advisories in the installed range: middleware/proxy bypass under Turbopack+single-locale, SSRF in Server Actions/rewrites via attacker-controlled hostname, unauthenticated disclosure of internal Server Function endpoints, and cache-confusion of response bodies. middleware.ts is where this app\'s entire session/portal-gating model lives, so a middleware-bypass CVE sits directly on the auth-enforcement path.',
    notes: ['Fix: ran npm audit fix (no --force, package.json unchanged) -- resolved next to the latest patched 16.2.x point release (16.2.11) already permitted by the existing ^16.2.9 range, which clears every Next.js-specific advisory (middleware bypass, Server Action SSRF/DoS, cache confusion, internal endpoint disclosure). Also picked up postcss 8.5.23 (path-traversal fix) in the lockfile, same way. Residual npm audit findings after this fix are NOT actioned here: sharp\'s libvips CVE has no fix within the next@16 line (npm audit fix --force would downgrade next to 14.2.35, an unacceptable regression) and the remaining entries (eslint-config-next\'s own transitive eslint/minimatch chain, @prisma/dev, find-my-way, valibot) are devDependency-only build/CLI tooling that never ships in the production request-handling path, not part of the app\'s runtime attack surface. Re-run `npm audit` to confirm this residual set unchanged. (BLD-1030)'],
  },
  {
    title: 'Form error text uses a non-AA-contrast color token on light surfaces', type: 'TASK', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 6, effort: 1,
    detail: 'text-[var(--color-blush)] (#cdb4a3, ~1.7:1 contrast) is used for error copy on light porcelain/bone backgrounds in components/kiosk/KioskShell.tsx:104 and components/kiosk/ClaimReward.tsx:65, well below WCAG AA\'s 4.5:1 minimum. app/globals.css already defines --color-blush-deep, explicitly annotated \'error/destructive text on light surfaces\', and it\'s used correctly elsewhere (e.g. BookingFlow.tsx).',
    notes: ['Fix: swapped both error messages (KioskShell.tsx email-plan error, ClaimReward.tsx claim error) from --color-blush to --color-blush-deep. No layout/behaviour change. (BLD-1058)'],
  },
  {
    title: 'Paying academy students hit a dead-end \'Content coming soon\' label with no action', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 6, effort: 2,
    detail: 'app/(marketing)/academy/portal/page.tsx shows a static, non-interactive \'Content coming soon\' label (no link, no ETA, no contact CTA) for any paid/enrolled trainee whose course has zero lessons/quizzes uploaded -- a directly reachable state whenever an admin creates a course and takes payment before uploading modules (courseProgress() in lib/lms.ts).',
    notes: ['Fix: replaced the static label with a real action -- an AButton linking to /contact -- for the active-but-no-content case, keeping the plain \'Awaiting confirmation\' label only for the not-yet-active case. (BLD-1055)'],
  },
  {
    title: 'Membership tier calculation counts refunded revenue toward spend', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 6, effort: 2,
    detail: 'rolling12moSpendPence() in lib/membership.ts summed Booking.chargedPence over the trailing 12 months but never subtracted Booking.refundedPence, so a fully or partially refunded treatment still counted its full charge toward a client\'s K Circle spend -- a client could reach Silver/Gold/Platinum (and keep the faster points multiplier, early access, retail discount) on revenue the clinic never actually kept.',
    notes: ['Fix: rolling12moSpendPence() now aggregates both chargedPence and refundedPence over the window and nets them (chargedPence - refundedPence, floored at 0) before adding paid retail-order spend, so a refund immediately lowers the rolling total the next time the tier is recomputed. reverseSpendPoints() (lib/client-loyalty.ts) already calls recomputeClientTier() right after a refund, so the corrected tier takes effect on that same request, not just on the nightly recomputeActiveTiers() cron. No schema change; Order refunds already excluded via the existing PAID/FULFILLED status filter. (PRJ-1060.7)'],
  },
  {
    title: 'Price-list importer silently turns blank price cells into live £0 bookable prices', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 2,
    detail: 'parseMoney() in lib/price-import.ts returns 0 (not null) for a blank price cell, the same as it does for an explicit \'on consultation\' note. A genuinely missing column is skipped with a warning, but a blank cell in an existing price column is not -- it silently becomes a real pricePence:0 variant with no warning, and the commit route deletes+recreates ServiceVariant rows live from it. The admin preview only shows 3 sample rows per section, so a mis-parsed row further down is invisible before commit, and a pricePence:0 variant is real and bookable.',
    notes: ['Fix: parseMoney() now returns null for a genuinely blank cell (skipped with a warning, same as a missing column) and only returns 0 for text matching /consult/i or a word-bounded /\\bpoa\\b/i. Pre-merge review corrected the POA rule: an unanchored /poa/ also matched inside real treatment copy ("Lipoatrophy correction", "Hypoallergenic 1ml"), turning rows that main skipped with a warning into silent, warning-free GBP 0 bookable prices -- the exact failure this item exists to remove. The bulk .xlsx importer (app/api/admin/services/import-xlsx/route.ts, components/admin/PriceListUpload.tsx) now surfaces every zero-priced row per section (not just the first 3 samples) and requires an explicit \'Import at £0 anyway\' confirmation per section before commit; the commit route re-derives zero-price rows from the freshly re-parsed raw text server-side rather than trusting the client\'s confirmZero flag alone. (BLD-1054)'],
  },
  {
    title: 'Booking-management token leaks into GA4/Google Ads via URL tracking', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 9, effort: 2,
    detail: 'SMS/email \'manage your booking\' links carry Booking.manageToken (a bearer credential with no other auth) in the query string. TrackingScripts.tsx mounts GA4 automatic pageview tracking unconditionally across the whole marketing route group with no exclusion for this page, unlike BehaviorRecorder which already excludes /booking|/account|/admin -- so GA4 reports the full URL including the token, and anyone with GA4 reporting access can lift tokens and view/reschedule/cancel other clients\' bookings.',
    notes: ['Fix: components/marketing/TrackingScripts.tsx now returns null (mounts nothing -- no GA4 config call, no Meta pixel PageView) across the whole /booking subtree, matching BehaviorRecorder\'s existing path-exclusion pattern. Pre-merge review widened this from /booking/manage alone: /booking/card?t= takes the SAME Booking.manageToken (and mints a Stripe SetupIntent client_secret from it) and /booking/pay?pi= carries the PaymentIntent reference, so excluding only /booking/manage left the identical credential exposed in GA4 reporting one route over. /book (the acquisition funnel, where trackPurchase fires) is deliberately NOT excluded -- it carries no credential. (BLD-1051)'],
  },
  {
    title: 'Kiosk photo-view endpoint exposes visitor face photos behind a brute-forceable token', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 8, effort: 2,
    detail: 'app/api/kiosk/sessions/[token]/photo-view/route.ts serves the visitor\'s actual face photo gated only by the kiosk session token, while sibling routes (frame, stream) require an additional secret because lib/kiosk.ts itself documents the token as brute-forceable. This also contradicts the deliberate privacy design in kiosk/results/[id]/route.ts, which omits the photo URL. No rate limiting on the endpoint either.',
    notes: ['Fix: photo-view now requires the session secret via secretMatches (same as frame/stream) plus a 30-req/60s rate limit keyed on the token. buildKioskStreamPayload() only embeds a working (secret-bearing) relay URL for callers that already proved they hold the secret -- the secret-gated SSE stream route passes its validated secret through; the unauthenticated token-only status poll (app/api/kiosk/sessions/[token]/route.ts) gets photoUrls/bestPhotoUrl omitted rather than dead (or, worse, secret-leaking) links. Verified all three real consumers (KioskDisplay/RevealScene via the SSE stream, the phone-side result view, the public /kiosk/result share page) never relied on the token-only poll for photo URLs. (BLD-1052)'],
  },
  {
    title: 'CRM client search runs an unindexed substring scan with 3 sequential queries', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 2,
    detail: 'listClients() in lib/crm-data.ts filters firstName/lastName/email/phone with case-insensitive \'contains\' (leading-wildcard ILIKE), which a plain btree index cannot serve -- prisma/schema.prisma only had ordinary btree indexes on Client. It also ran its count/findMany/count sequence one after another instead of in parallel, unlike getOverview() ~20 lines above in the same file.',
    notes: ['Fix: added pg_trgm GIN indexes on Client.firstName, lastName, email and phone (prisma/schema.prisma), enabling the postgresqlExtensions preview feature and the pg_trgm datasource extension to support them -- purely additive (new indexes only, no drops or renames) and does not add any @unique constraint, so it clears both the no-accept-data-loss deploy gate and the no-new-unique-on-existing-table gate. Also changed listClients()\'s total/rows/hiddenTest queries to run concurrently via Promise.all (matching getOverview()\'s existing pattern), with a rare-case fallback re-fetch if the requested page lands past the last page once the count resolves, so pagination behaviour is unchanged. (BLD-1056)'],
  },
  {
    title: '/api/booking/popular-days fans out ~48 concurrent DB queries per funnel treatment-select', type: 'TASK', urgency: 'P3', status: 'IN_REVIEW', assignee: 'claude',
    value: 4, effort: 1,
    detail: 'popularDays() in lib/availability.ts ran all 12 candidate days through freeSlots (~4 reads each) in one Promise.all, bursting ~40-48 in-flight queries on the booking conversion path (components/booking/BookingFlow.tsx\'s treatment-select step). Already bounded and using withDbRetry gracefully, so not broken, just pooler-pressure-heavy for a hot path.',
    notes: ['Fix: batched the 12 candidates into groups of 4 processed sequentially (Promise.all per batch), capping peak concurrent queries at ~16 instead of ~48. Return shape and caller behaviour unchanged. (PRJ-1032.13)'],
  },
  {
    title: 'Admin sidebar logo lockup has a strap-line, violating the no-strap-line brand rule', type: 'TASK', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 3, effort: 1,
    detail: 'components/admin/AdminShell.tsx rendered \'{locationLabel} - CRM\' directly beneath the K monogram + CLINICS wordmark inside the logo lockup\'s own flex container -- a strap-line under the logo, which docs/BRAND_GUIDELINES.md forbids. components/live/LiveCompanion.tsx already implements the identical lockup correctly: the descriptor is a separate, spaced-apart sibling paragraph outside the logo\'s own wrapper.',
    notes: ['Fix: wrapped the KMark + ClinicsWordmark pair in their own inner lockup span (matching LiveCompanion.tsx\'s header pattern) and moved the location/CRM paragraph out to be a sibling of that span with mt-6 spacing, mirroring LiveCompanion\'s header + mt-6 descriptor. Logo mark files and the location/CRM text itself are unchanged -- only the structural relationship moved. (BLD-1057)'],
  },
  {
    title: 'Admin \'Refund\' link uses a decorative-only color token as text, failing contrast', type: 'TASK', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 4, effort: 1,
    detail: 'app/globals.css documents --color-stone-soft as \'decorative/borders only -- NOT for text on light\' (~2.15:1 contrast), yet components/admin/AcademyManager.tsx used it for the \'Refund\' action link text on a light background, well under WCAG AA\'s 4.5:1.',
    notes: ['Fix: switched the Refund link (components/admin/AcademyManager.tsx) from text-[var(--color-stone-soft)] to text-[var(--color-blush-deep)] -- the same destructive/error-on-light token already used one line below it for the \'Remove payment\' link, and documented in app/globals.css as the correct choice for error/destructive text on light surfaces. app/globals.css\'s own comment for --color-stone-soft only says it is decorative-only; it does not point to --color-stone as an alternative, so blush-deep (matching the adjacent destructive action) was used instead. (BLD-1059)'],
  },
  {
    title: 'Fixed back-to-top button overlaps the live-chat launcher on desktop', type: 'TASK', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 4, effort: 1,
    detail: 'components/motion/BackToTop.tsx (bottom-6/8 right-6/8, z-40) and components/chat/LiveChat.tsx (bottom-5 right-5, z-40) both float in the same bottom-right corner. BackToTop\'s visibility logic only excluded the mobile-only WhatsApp button, not LiveChat, so on any md+ page with more than ~1400px of scroll both buttons rendered stacked on top of each other well before the footer-hide behaviour kicked in.',
    notes: ['Fix: components/motion/BackToTop.tsx now sits at bottom-24 (md) / lg:bottom-28 (lg), well clear of LiveChat\'s ~52px-tall launcher at bottom-5/right-5, instead of bottom-6/lg:bottom-8. Horizontal offset (right-6/lg:right-8) is unchanged since the two no longer overlap vertically. (BLD-1010)'],
  },
  {
    title: 'Academy funding page mega-menu links point to sections that do not exist', type: 'TASK', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 4, effort: 1,
    detail: 'lib/nav.ts\'s Academy -> \'Fund Your Training\' column linked to /academy/funding#eligibility (\'Check Your Eligibility\') and /academy/funding#bnpl (\'Buy Now, Pay Later -- Spread the cost with Clearpay\'), but app/(marketing)/academy/funding/page.tsx has no id="eligibility" (the real wizard section uses id="check") and no #bnpl section exists at all -- the page never mentions Clearpay/BNPL anywhere.',
    notes: ['Fix decision: updated lib/nav.ts\'s link to /academy/funding#check rather than renaming the section id to #eligibility. The page already has four other in-page links pointing at #check (two Button hrefs and a Link, all on the same page), and its visible heading (\'What could you use?\', eyebrow \'Check your options\') does not literally read \'Check Your Eligibility\', so the id was not the more-correct name to rename to -- pointing the nav link at the id that already exists was the smaller, safer change. Removed the \'Buy Now, Pay Later -- Spread the cost with Clearpay\' entry entirely rather than fabricating a #bnpl section or BNPL copy the page does not support -- inventing financing claims was out of scope and risky. Real BNPL content for the funding page is a separate, larger task requiring real marketing copy. (BLD-1061)'],
  },
  {
    title: 'YouTube and Google Maps embeds load before cookie consent', type: 'ERROR', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 6, effort: 2,
    detail: 'components/cms/SectionRenderer.tsx embedded youtube.com/embed (the cookie-setting domain, not youtube-nocookie.com) and a raw Google Maps iframe with no consent check anywhere in the file, while GA4/Meta/Sentry are all correctly gated in components/marketing/TrackingScripts.tsx.',
    notes: ['Fix: (a) the video embedUrl() helper in SectionRenderer.tsx now builds youtube-nocookie.com/embed/ URLs instead of youtube.com/embed/ -- a drop-in domain swap, same player behaviour, no cookies set until the visitor interacts with it. (b) added components/cms/ConsentGatedMap.tsx, a small client component using the same getConsent()/kc-consent pattern as TrackingScripts.tsx, and wired it into SectionRenderer.tsx\'s MapSection in place of the raw iframe. The Maps iframe only renders once marketing consent has been given (same bucket as the Google Ads/Meta pixels); before that it shows a placeholder with a \'Cookie settings\' button (reopens the existing CookieConsent banner via the kc-open-consent event) and a direct \'Open in Google Maps\' link using the site\'s existing mapLink. (BLD-1009)'],
  },
  {
    title: 'Careers CV/portfolio link is unvalidated and rendered as a raw href in the admin panel -- stored XSS risk against staff', type: 'ERROR', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 6, effort: 1,
    detail: 'app/api/careers/apply/route.ts validated cvUrl as z.string().max(500) only (no .url()/scheme check), from a public, unauthenticated, honeypotted-but-otherwise-open form. It is stored and rendered as <a href={a.cvUrl} target="_blank" rel="noopener"> in components/admin/CareersManager.tsx with no scheme filtering -- an applicant could submit cvUrl: "javascript:..." which would execute when a staff member clicked it.',
    notes: ['Fix: cvUrl now requires z.string().max(500).url() plus a refine() enforcing an http(s) scheme, rejecting the request with the existing 400 validation-error path instead of storing an arbitrary-scheme URL. (BLD-1040)'],
  },
  {
    title: 'Legacy SEO redirect sends preserved link equity to a noindex page', type: 'TASK', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 4, effort: 1,
    detail: 'next.config.mjs permanently redirected /dentistry-all-treatments to /dentistry "to preserve SEO equity from the legacy site," but /dentistry currently serves noindex/nofollow while site.dentistryLive is false -- inbound legacy link equity hitting that redirect landed on a dead end, contradicting the redirect\'s own stated purpose.',
    notes: [
      'Fix: retargeted the redirect to /treatments (always-indexable aesthetics catalogue) with a comment to point it back at /dentistry once dentistryLive flips true -- next.config.mjs redirects are static at build time and cannot read the DB-backed flag, so this needs a manual follow-up rather than a dynamic check. (BLD-1008)',
      'Follow-up done under BLD-1250, ahead of the trigger this note anticipated: /dentistry became indexable without dentistryLive flipping, so /dentistry-all-treatments now points back at the topically correct /dentistry.',
    ],
  },
  {
    title: 'Admin SEO canonical-URL override has no validation before publishing live', type: 'TASK', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 4, effort: 1,
    detail: 'app/api/admin/seo/route.ts only trimmed body.canonical before saving to PageSeo; lib/seo.tsx\'s pageMeta() then used it verbatim as alternates.canonical with no check that it was an absolute, same-domain, well-formed URL. A relative path, typo, or wrong host pasted into the admin SEO panel would have silently shipped a broken or cross-domain canonical tag on the live page.',
    notes: ['Fix: canonical must now be empty (no override) or a well-formed absolute https? URL on the site\'s own domain (lib/site.ts\'s site.url, www-prefix-insensitive) -- anything else returns a 400 with a clear error instead of saving. (BLD-1060)'],
  },
  {
    title: 'Homepage <title> exceeds SERP display length, truncating the locality signal', type: 'TASK', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 4, effort: 1,
    detail: 'Homepage title ("KClinics -- Aesthetics & Aesthetic Dentistry, Reimagined | Islington, London") was 75 characters, set redundantly in both app/layout.tsx (root default) and app/(marketing)/page.tsx (generateMetadata). Google typically truncates around ~55-60 chars/600px, cutting off "Islington, London" -- the locality signal -- from the site\'s single most important page.',
    notes: ['Fix: shortened both to "KClinics -- Aesthetics & Dentistry | Islington, London" (53 chars), keeping the two in sync as before. No other metadata fields changed. (BLD-1053)'],
  },
  {
    title: 'LocalBusiness JSON-LD availableService list is a hardcoded shortlist, not the real 40+ treatment catalogue', type: 'TASK', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 3, effort: 1,
    detail: 'lib/seo.tsx\'s organizationLd listed only 4 aesthetic + 3 dentistry procedures as MedicalProcedure/Dentistry items, while lib/treatments.ts defines 40+ live treatments -- the schema under-represented actual service breadth to crawlers and AI answer engines.',
    notes: ['Fix: availableService is now generated from the real aesthetics/dentistry arrays in lib/treatments.ts instead of a hardcoded list, keeping the existing dentistryLive gate on the Dentistry entries. Same JSON-LD shape/property names, just a data-source swap. (BLD-1039)'],
  },
  {
    title: 'Daily birthday/win-back automations run unbounded client.findMany scans',
    type: 'ERROR', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 6, effort: 3,
    detail: 'birthdays() in lib/automations.ts loaded every Client row with any dob set, then filtered month/day in JS -- only ~1/365th of the loaded rows ever matched. winBacks() had no take cap on its findMany (unbounded growth as the client base grows) and called the sentRecently() helper once per row inside its loop, an N+1 query pattern.',
    notes: ['Fix: birthdays() now filters month/day in SQL via a $queryRaw SELECT id FROM "Client" WHERE dob IS NOT NULL AND EXTRACT(MONTH FROM dob) = ... AND EXTRACT(DAY FROM dob) = ..., then findMany only the matching ids -- confirmed via prisma/schema.prisma that model Client has no @@map/@map override, so the physical table/column names are the Prisma defaults ("Client", dob). winBacks() now takes take: 500 with orderBy: { lastVisitAt: \'asc\' } (oldest-lapsed-first; a client not reached today is still lapsed tomorrow, so nothing is permanently missed, just spread across runs) and replaces the per-row sentRecently() call with one bulk emailEvent.findMany pre-fetch keyed by clientId, built into a Set checked in the loop. Files: lib/automations.ts. Review follow-up: the take: 500 bound plus a STABLE oldest-lapsed-first ordering (lastVisitAt does not change when a win-back is sent) meant any client fetched into the 500 and then skipped in JS -- already win-backed, no marketing consent, unsubscribed -- would sit at the head of the list on every future run and permanently starve every lapsed client behind it. The 90-day dedupe and the canEmail() consent gate are now applied in the `where` clause (emails: { none: { kind: WIN_BACK, status: SENT, createdAt: { gte: since } } } plus marketingOptIn/unsubscribed/marketingConsentAt), so each run picks 500 genuinely sendable clients and makes real progress; the separate bulk pre-fetch is no longer needed and canEmail() stays as defence-in-depth. (PRJ-1043.12)'],
  },
  {
    title: 'Google Calendar sync only prunes past stale busy-blocks, so a deleted future event leaves a phantom availability hold forever',
    type: 'ERROR', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 3,
    detail: 'syncStaffCalendar() in lib/google-calendar.ts upserts every event Google returns into StaffTimeOff (kind GCAL_BUSY, keyed by gcalEventId), but its only prune was deleteMany({ endAt: { lt: now } }) -- past blocks only. If a clinician deletes or moves a FUTURE event on Google\'s side, the old GCAL_BUSY row is never in data.items again on the next sync, but the past-only prune never touches it, so it wrongly blocks availability indefinitely.',
    notes: ['Fix: each sync run now tracks the gcalEventIds actually kept (present, non-cancelled, non-transparent, within the fetched [timeMin, timeMax] window) in a Set, then the prune deletes any GCAL_BUSY row for that staffId whose startAt falls within that same window but whose gcalEventId is NOT in the kept set (phantom hold for an event no longer on Google\'s side), OR-ed with the original past-only condition (endAt < now) so leftover blocks outside the window still age out. An empty kept set (Google reports zero events this run) correctly clears every previously-synced GCAL_BUSY row in the window via notIn: [], since they are then all genuinely stale. Files: lib/google-calendar.ts. Review follow-up: the prune deletes in-window blocks Google did NOT return, so it is only sound against a COMPLETE event list -- and the fetch asked for a single maxResults=250 page with no nextPageToken handling. A clinician with more than 250 events in the 60-day window would have had the real busy blocks past the first page deleted, advertising them as free and allowing double-booking. The fetch now follows nextPageToken (bounded at 10 pages); if pages still remain the list is marked incomplete and only the original past-only prune runs that cycle (logged). The gcalEventId filter is omitted entirely when the kept set is empty rather than relying on notIn: [] semantics. (PRJ-1043.14)'],
  },
  {
    title: 'Stripe webhook idempotency ledger is claimed before the handler runs, so a failed critical event is never retried', type: 'ERROR', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 8, effort: 3,
    detail: 'app/api/stripe/webhook/route.ts wrote the ProcessedStripeEvent row for event.id BEFORE running the switch handler. If a critical handler (payment_intent.succeeded/payment_failed, charge.refunded, setup_intent.succeeded, checkout.session.expired, course_prepaid) threw, the route returned 500 so Stripe redelivers -- but the ledger row already existed, so the redelivery hit a P2002 on the create and was acked as a duplicate without the handler ever re-running. A transient DB blip on the first delivery of a genuine payment event permanently dropped it.',
    notes: ['Fix: added a `status String @default("DONE")` column to ProcessedStripeEvent (prisma/schema.prisma) -- additive, non-destructive, no new @unique constraint; existing rows backfill to \'DONE\' (safe default, treats historical events as already-completed). The initial claim now writes status: \'PROCESSING\'. On a P2002 conflict the route re-reads the row: if status is \'DONE\' it acks as a duplicate as before; otherwise (still \'PROCESSING\', i.e. a prior attempt failed) it falls through and re-runs the handler -- every handler is already idempotent (CAS on booking/order/enrolment state), so re-running is safe. The row is flipped to \'DONE\' right before the final `{ received: true }` response, on both the genuine-success path and the non-critical-failure path (critical failures return 500 before reaching that line, so their row correctly stays \'PROCESSING\' for the retry to find). (PRJ-1043.2)'],
  },
  {
    title: 'Scheduled gift-voucher delivery marks delivered:true even when the recipient email send fails', type: 'ERROR', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 5, effort: 2,
    detail: 'lib/gift-vouchers.ts deliverDueVouchers() called sendVoucherEmails(v.id, true).catch(() => {}) and then unconditionally set delivered: true regardless of whether the recipient notification actually sent. sendVoucherEmails used Promise.allSettled internally and never surfaced which task failed, so a failed recipient send was silently marked as delivered and never retried by the next cron run.',
    notes: ['Fix: sendVoucherEmails now returns Promise<{ recipientOk: boolean }> -- true when there is no recipient send to make (nothing to deliver, matching existing delivered semantics for vouchers with no recipient email), otherwise true only if the recipient-email task both settled and RESOLVED with { ok: true }. Review follow-up: checking Promise.allSettled status alone was a no-op -- lib/email.ts sendEmail never throws, it resolves with { ok: false, error } on a provider failure, timeout or missing RESEND_API_KEY, so every send counted as fulfilled and delivered: true was still set exactly as before. Also, the retry now sends the recipient copy ONLY (purchaserReceipt: false): confirmVoucher already emailed the purchaser their receipt (with the \'scheduled for\' line) at purchase time, so re-sending it on each daily cron attempt would spam the purchaser for as long as the recipient address keeps failing. deliverDueVouchers() only sets delivered: true when recipientOk is true; otherwise it leaves delivered: false (so the next cron run retries) and logs console.error(\'[gift-vouchers] scheduled delivery failed, will retry:\', v.id). confirmVoucher()\'s existing call site (which sets delivered as part of the same updateMany, not gated on this return value) needed no behaviour change, just continues to ignore the return value. (PRJ-1043.6)'],
  },
  {
    title: 'Chat-inbound webhook dedup is a non-atomic check-then-insert, allowing double-posted visitor messages', type: 'ERROR', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 5, effort: 3,
    detail: 'app/api/webhooks/chat-inbound/route.ts deduped redelivered inbound emails with a bare db.chatMessage.findFirst({ where: { externalId } }) check before db.chatMessage.create(...) and db.chatConversation.update(...) (staffUnread increment). Two concurrent redeliveries of the same inbound email could both pass the findFirst check before either insert landed, double-posting the visitor message and double-incrementing staffUnread. externalId has no @unique constraint (the deploy gate forbids adding one to an existing table).',
    notes: ['Fix: wrapped the findFirst check, chatMessage.create and chatConversation.update in one db.$transaction(..., { isolationLevel: \'Serializable\' }), using tx.* instead of the bare db.* calls, mirroring the existing pattern in app/api/booking/create/route.ts. Postgres Serializable Snapshot Isolation detects the write-skew between the two transactions\' predicate-scans on externalId and aborts the loser; the conflict is caught (err.code === \'P2034\' or /write conflict|deadlock|could not serialize/i on the message) and treated as a quiet no-op, same as the pre-existing \'seen\' duplicate path. The transaction returns whether it actually inserted so the staff notification (and the response) still skip cleanly on a genuine duplicate, matching prior behaviour. (PRJ-1043.13)'],
  },
  {
    title: 'Staff/admin appointment reschedule has no transaction guarding the clash-check + write', type: 'ERROR', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 5, effort: 2,
    detail: 'rescheduleBooking() in lib/booking-actions.ts ran its clash check (admin branch: a plain db.booking.findMany against the target clinician/room; client branch: isSlotFree) and the eventual db.booking.update({startAt, endAt}) as two separate, non-transactional steps. Two staff (or a staff reschedule racing a client self-service reschedule) could both pass the clash check for the same new slot and both commit, double-booking the clinician/room.',
    notes: ['Fix: the final booking.update now runs inside a Serializable db.$transaction that re-reads overlapping PENDING/CONFIRMED bookings on this booking\'s own practitionerId/resource ids (same overlap math as app/api/booking/create + app/api/booking/start) immediately before the write, for BOTH the admin and client self-service branches. isSlotFree (lib/availability.ts) does not accept a tx client, so the client branch keeps it as an early pre-check (unchanged) and gets the same tx-scoped re-check as the admin branch right before the commit -- the write is now guarded by a same-transaction Serializable re-check either way. On a clash or a P2034/serialize-conflict error, returns the function\'s existing {ok: false, code: \'SLOT_TAKEN\'} shape instead of throwing. Review follow-up: the 4th+ reschedule fee (chargeBooking) now runs AFTER the transaction claims the slot, not before it -- charging first meant a client who lost the race was billed the full booking price for a reschedule that then returned SLOT_TAKEN, and the seconds-long Stripe call sat inside the race window. If the charge itself hard-fails the move is rolled back to the original startAt/endAt/rescheduleCount, preserving the original \'no reschedule without payment\' rule. (PRJ-1043.7)'],
  },
  {
    title: 'Same-day booking-request approval has no transaction guarding the clash-check + confirm', type: 'ERROR', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 5, effort: 2,
    detail: 'approveBookingRequestAction() in app/admin/bookings/actions.ts ran an isSlotFree re-check then a separate db.booking.update({status: \'CONFIRMED\'}) with nothing transactionally guarding the gap. Two staff approving same-day requests for the same clinician/room at the same time could both pass isSlotFree and both confirm, double-booking the slot.',
    notes: ['Fix: isSlotFree (lib/availability.ts) does not accept a tx client, so it stays as the initial pre-check unchanged. Immediately before confirming, a Serializable db.$transaction re-reads overlapping PENDING/CONFIRMED bookings on this booking\'s own practitionerId/resource ids (same overlap math as app/api/booking/create) and only then updates status to CONFIRMED inside that same transaction. On a clash or a P2034/serialize-conflict error, returns the function\'s existing {ok: false, error: \'That time is no longer free. Reschedule with the client, or decline the request.\', clash: true} shape. (PRJ-1043.8)'],
  },
  {
    title: 'Staff manual-booking creation has no transaction guarding the clash-check + create', type: 'ERROR', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 5, effort: 2,
    detail: 'createManualBooking() in app/admin/bookings/create-action.ts ran an isSlotFree check then a separate db.booking.create({...}) with nothing transactionally guarding the gap between them. A concurrent public/portal Serializable booking (or another staff booking) could take the same room/clinician in between, double-booking the slot.',
    notes: ['Fix: the isSlotFree pre-check is unchanged. The eventual booking.create now runs inside a Serializable db.$transaction that re-reads overlapping PENDING/CONFIRMED bookings on the precomputed practitionerId/resource ids (same overlap math as app/api/booking/create + app/api/booking/start) immediately before the write. input.override (\'book anyway\', a deliberate staff bypass) skips both the pre-check and this re-check, unchanged from before. On a clash or a P2034/serialize-conflict error, returns the function\'s existing {ok: false, error: \'That slot clashes with an existing appointment, closure, or has no free room/clinician. Tick "book anyway" to override.\', clash: true} shape. (PRJ-1043.9)'],
  },
  {
    title: 'Academy practice API leaks another course exam-question bank and answer keys to non-enrolled students', type: 'ERROR', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 6, effort: 2,
    detail: 'app/api/academy/practice/route.ts never checked enrolment. The \'start\' action called bank.generatePractice({courseId}) for any courseId a signed-in trainee supplied, and when courseId was omitted it fell through to a topic-only draw across every course\'s questions (generatePractice in lib/exam-bank.ts scopes by courseId only when provided). The \'check\' action graded any questionId against its stored answer key with no ownership check at all, so a trainee could probe arbitrary question IDs for answers regardless of which course they belong to.',
    notes: ['Fix: app/api/academy/practice/route.ts now imports studentCanAccess from lib/lms (same pattern as app/api/academy/homework/route.ts). \'start\' now requires courseId (400 if missing -- the client already always sends it) and checks studentCanAccess(student.id, courseId) before calling generatePractice, closing the no-courseId cross-course leak. \'check\' has no courseId in its payload, so lib/exam-bank.ts gains a questionCourseId(questionId) helper; the route looks up the question\'s course and checks studentCanAccess before calling checkPracticeAnswer, returning 403 Not enrolled. if the question has no course or access fails. \'submit\' gets the same courseId enrolment check before recordPractice runs (so XP/badges cannot accrue for a non-enrolled course). (PRJ-1043.4)'],
  },
  {
    title: 'Academy demo walkthroughs leak content, mistake answer keys and XP to non-enrolled students', type: 'ERROR', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 6, effort: 2,
    detail: 'lib/demos.ts getDemoPlay(id, studentId) and gradeDemo(studentId, videoId, presses) never checked enrolment even though DemoVideo carries courseId. Any signed-in trainee could load another course\'s demo video/captions via getDemoPlay, or POST presses to app/api/academy/demos/route.ts for any videoId and get back the graded mistake list (the answer key) plus awarded XP for a course they were never enrolled in.',
    notes: ['Fix: lib/demos.ts imports studentCanAccess from lib/lms. getDemoPlay returns null (same shape as the existing !r || r._count.mistakes === 0 not-found case) when r.courseId is set and studentCanAccess(studentId, r.courseId) fails, so it doesn\'t reveal whether the demo exists. gradeDemo\'s select already included courseId; it now returns the existing { ok: false, error: \'Demo not found.\' } response (no separate access-denied message) when studentCanAccess fails, before the mistake list or XP is computed. app/(marketing)/academy/demos/[id]/page.tsx already passes studentId from getCurrentStudent(), so no route signature changes were needed. (PRJ-1043.10)'],
  },
  {
    title: 'Academy practice submit trusts client-supplied score, letting a scripted client inflate XP and the leaderboard', type: 'ERROR', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 5, effort: 2,
    detail: 'app/api/academy/practice/route.ts \'submit\' action passed the client\'s raw total/correct numbers straight to bank.recordPractice(), which awards XP and badges off them. A scripted client could POST {action:\'submit\', total:100, correct:100} in a loop with no relation to any real answer, inflating XP/badges/leaderboard standing arbitrarily.',
    notes: ['Fix: components/academy/PracticeRunner.tsx now accumulates a per-question answers array ({questionId, answer}, the option indices the trainee selected) in state and sends that array (not total/correct) on \'submit\'. app/api/academy/practice/route.ts validates each entry, caps the array at 30, deduplicates by questionId, and hands it to the new bank.gradePracticeAnswers(courseId, answers), which loads the stored answer keys for exactly those ids scoped to { courseId, active: true } and recomputes total/correct server-side before calling recordPractice -- the same trust model as the quiz API (gradeQuiz). Fabricated or foreign question ids simply do not count, and claimed correctness is ignored entirely. recordPractice\'s own signature is unchanged. Residual limitation: the \'check\' action returns correctIndices for immediate feedback (by design), so a scripted client that first walks a real question set via \'check\' can still submit those answers; that is bounded by the real bank for a course the trainee is enrolled on, and closing it further would need server-side per-run session state. (PRJ-1043.11)'],
  },
  {
    title: 'Client Date of Birth not captured on staff phone bookings', type: 'TASK', urgency: 'P0', status: 'IN_REVIEW', assignee: 'claude',
    value: 6, effort: 2,
    detail: 'The public booking flow, portal signup and consultation form all already collect and persist Client.dob (a field that has existed on the schema all along, driving birthday automations). The one gap: the admin "New phone booking" flow (components/admin/NewBookingButton.tsx + app/admin/bookings/create-action.ts) only ever collected firstName/lastName/email/phone for a new client -- no dob field existed anywhere in that form or its server action.',
    notes: ['Fix: added a "Date of birth" date input to the New client tab in NewBookingButton.tsx, sent only when a brand-new client is being created (not when an existing client is selected). createManualBooking() in create-action.ts accepts an optional dob, validates it parses to a real date, and writes it with the same no-clobber semantics already established for this field elsewhere (BLD-712, app/api/consult/route.ts): on create it is set directly; on an upsert-by-email match it is only written if the existing client has no dob saved, so a returning caller\'s existing date of birth is never overwritten by a fresh (possibly blank) staff entry. (BLD-1065)'],
  },
  {
    title: 'Price/Offer JSON-LD nested inside an array on priced treatment pages', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 8, effort: 2,
    detail: 'serviceLd() (lib/seo.tsx:152-212) returns an array (MedicalProcedure + Service/Offer) when pricePence is set; app/(marketing)/[slug]/page.tsx spread its result straight in as one element of the outer JSON-LD array instead of spreading its own contents, producing a nested array. Nested arrays are not valid JSON-LD node objects, so the Service/Offer price node was unreadable and "from £X" rich results were silently broken on all ~19 priced treatment/dentistry pages.',
    notes: ['Fix: app/(marketing)/[slug]/page.tsx now computes serviceLd() into a local sld and spreads it conditionally -- ...(Array.isArray(sld) ? sld : [sld]) -- so both the array and single-object return shapes flatten correctly into the outer JSON-LD array. serviceLd() itself and its only other reference (an already-SHIPPED @type fix) were unaffected; this was the one call site building the page-level JSON-LD array. (PRJ-1060.1)'],
  },
  {
    title: 'Shop/gift-voucher payment buttons have no disabled state during Stripe confirm', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 2,
    detail: 'The final "Pay now"/"Pay & send" buttons in components/shop/CheckoutForm.tsx and components/gift/GiftVoucherFlow.tsx never got disabled={busy} while stripe.confirmPayment() was in flight, unlike every other payment-confirmation button in the app (PayNowForm.tsx, CardOnFileForm.tsx, EnrolmentCheckout.tsx). A double-tap during the confirm round-trip risked duplicate confirm calls, with no visual feedback beyond the label text that a charge was processing.',
    notes: ['Fix: both buttons now pass disabled={busy} (mirroring EnrolmentCheckout.tsx\'s onClick={() => !busy && pay()} disabled={busy} pattern) -- the shared Button component already renders the disabled/opacity styling, so this is a one-line change per button with no new markup. (PRJ-1060.4)'],
  },
  {
    title: 'Server-side GA4/Meta conversion events ignore cookie-consent rejection', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 8, effort: 3,
    detail: 'lib/conversions.ts sendPurchase/sendRefund/sendLead/sendSchedule fired GA4 Measurement Protocol and Meta Conversions API events (including a hashed email to Meta) unconditionally -- gated only on marketingOptIn (a separate CRM field) for whether to include the email, never on whether the visitor had actually accepted the cookie banner. Clicking "Reject non-essential" in components/legal/CookieConsent.tsx still let every booking/order/lead fire server-side, which the client-side pixels (lib/analytics-events.ts) already correctly withhold -- a PECR/UK-GDPR gap plus an inconsistency between the two tracking paths.',
    notes: ['Fix: CookieConsent.tsx now mirrors BOTH choices into first-party cookies (kc_analytics_consent already existed; added kc_marketing_consent alongside it, same pattern). lib/conversions.ts\'s four send* functions take analyticsConsent/marketingConsent flags and skip GA4 (analytics) / Meta + Google Ads (marketing) individually when the corresponding flag is not explicitly true -- undefined defaults to not-consented, so any call site that forgets to thread it through fails closed rather than over-sending. Live route handlers with their own request (gift-vouchers/confirm, consult, account/signup, shop/checkout) read the two cookies directly via the new lib/attribution.ts consentFromCookieHeader() helper. Booking and Order gained analyticsConsent/marketingConsent columns (additive, @default(false)) captured at booking/order creation time -- the same place attribCampaign/gclid are already captured -- because the deferred Purchase/Refund/Schedule sends for a charged booking or a webhook-finalised order run from a Stripe webhook with no request/cookie context of their own; lib/marketing.ts bookingAttribution() and app/api/shop/checkout/route.ts now capture the two cookies at creation time for that later read-back. Staff-initiated charges (admin phone bookings, POS) have no visitor cookie interaction to read, so they correctly stay default-false (no event fires) rather than guessing. Residual gap: lib/academy-payments.ts sendEnrolmentPurchaseConversion() (BLD-1036) isn\'t threaded through this pass -- academy course purchases will simply stop firing GA4/Meta events (fail closed, not a regression) until a follow-up wires consent capture through Enrolment/EnrolmentPayment the same way. (PRJ-1034.4)'],
  },
  {
    title: 'Referral reward can be double-paid under concurrent qualifying bookings', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 2,
    detail: 'maybeQualifyReferral() in lib/client-loyalty.ts read the Referral row (status === \'JOINED\'), decided the friend\'s first >=GBP100 treatment qualified, then wrote status: \'QUALIFIED\' and awarded 2500 points to both the referrer and the referred client -- a classic read-then-write with no atomicity between the check and the pay-out. Two qualifying bookings for the same referred client completing concurrently (e.g. two admin tabs completing different bookings, or the charge webhook and an admin manual-complete racing on the async SCA path) could both read status JOINED before either write landed, so both branches would flip the row to QUALIFIED and both would call awardClientPoints for both sides -- double-crediting GBP50 of loyalty points across the two accounts.',
    notes: ['Fix: replaced the plain db.referral.update(...QUALIFIED...) with a conditional db.referral.updateMany({ where: { id: ref.id, status: \'JOINED\' }, data: {...QUALIFIED...} }) and only proceed to awardClientPoints (both sides) plus the reward emails when claimed.count === 1. Same CAS-then-check-rowsAffected pattern as the refundedPence claim in lib/booking-actions.ts refundBooking() (BLD-1000) and the loyalty/payment idempotency guards from BLD-994/1001 -- no new @unique constraint added, so the additive-schema deploy gate is unaffected. A concurrent loser now sees count === 0 and returns without a second award. (PRJ-1060.8)'],
  },
  {
    title: 'Live external-provider health probes never run automatically', type: 'ERROR', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 6, effort: 1,
    detail: 'lib/api-health.ts has a full probe registry for external providers (Stripe, Resend, Twilio, Anthropic, Xero, Meta, etc.), exposed at app/api/admin/api-health/route.ts with the standard CRON_SECRET bearer auth (lib/cron-auth.ts, same mechanism /api/cron/daily uses), but vercel.json only scheduled /api/health (a lightweight DB/schema check) -- never /api/admin/api-health -- so the real provider probes only ran when a human opened /admin/api-health or curled it directly.',
    notes: ['Fix: added a vercel.json cron entry scheduling /api/admin/api-health every 30 minutes (*/30 * * * *), matching the maxDuration:60 mirror pattern already used for the other cron routes (BLD-841 precedent). The route already handles a bare GET with no query params -- it runs all probes live and returns the report -- so this is a drop-in wire-up with no route changes needed. (PRJ-1060.12)'],
  },
  {
    title: 'optimizePackageImports misconfigured for motion -- tree-shaking not applied site-wide', type: 'ERROR', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 5, effort: 1,
    detail: 'next.config.mjs listed experimental.optimizePackageImports: [\'motion\'], but every import site in the repo (47 files under components/) pulls from the motion/react subpath export, e.g. import { MotionConfig } from \'motion/react\' -- never the bare motion specifier. Next.js/Turbopack matches optimizePackageImports entries against the exact import specifier used in code, so \'motion\' never matched anything and the whole optimisation silently did nothing, shipping the full unshaken motion/react bundle to every client.',
    notes: ['Fix: changed the config entry to \'motion/react\' (the exact specifier actually imported), confirmed by grepping every "from \'motion...\'" import in the codebase. Verified with npx tsc --noEmit and a full npm run build afterward. (PRJ-1060.3)'],
  },
  {
    title: 'kc_attrib ad-attribution cookie ignores cookie-consent choice', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 2,
    detail: 'middleware.ts set the kc_attrib cookie (first-touch UTM/gclid/campaign data, later read by lib/marketing.ts bookingAttribution() and uploaded to Google Ads / sent to Meta CAPI via lib/conversions.ts) gated on kc_analytics_consent rather than kc_marketing_consent. kc_attrib is itself an ad-attribution mechanism, so a visitor who accepted analytics but rejected marketing (or vice versa) got the wrong outcome: attribution data captured without marketing consent, or legitimately-consented attribution never captured at all -- the same PECR/UK-GDPR gap PRJ-1034.4 already closed for the server-side GA4/Meta conversion sends, just one layer further back at the point the cookie itself is written.',
    notes: ['Fix: middleware.ts now imports ANALYTICS_CONSENT_COOKIE and MARKETING_CONSENT_COOKIE from lib/attribution.ts (replacing a hardcoded \'kc_analytics_consent\' string) and gates kc_attrib on marketing consent specifically, while the audience-segment cookie below it (content personalisation only, not ad-attribution) stays gated on analytics consent as before. When marketing consent is not present, middleware also actively clears any already-set kc_attrib cookie on every request -- fail closed for cookies set under the old (pre-fix) analytics-only gate or from before a consent choice was ever made, so no attribution data lingers to be read back later. This is purely the cookie-write side: the read side already fails closed correctly (lib/marketing.ts bookingAttribution() always returns the marketingConsent flag alongside any parsed attribution, and lib/conversions.ts\'s sendPurchase/sendSchedule already gate the actual Google Ads/Meta forwarding on marketingConsent -- the PRJ-1034.4 pattern -- so no change was needed there). (PRJ-1060.11)'],
  },
  {
    title: 'Chat "email me this transcript" endpoint was an open relay to arbitrary recipients', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 8, effort: 2,
    detail: 'app/api/chat/route.ts op:emailTranscript accepted a client-supplied `email` on every call and used it as the send-to address whenever the conversation had no visitorEmail saved yet (the common case for an anonymous visitor). Since the visitor also fully controls their own chat messages (op:send, no auth), an attacker could open a fresh conversation, author whatever they liked as their own VISITOR messages, then call emailTranscript with any victim address -- the endpoint would render those messages into the transcript template and send it from chat@mail.kclinics.co.uk to that address. The only guard was the shared 30-requests/60s "chat" rate limit covering start+send+emailTranscript together, so ~30 arbitrary sends per IP per minute were possible. Once a conversation already had a visitorEmail (left at chat start, or a logged-in client\'s account email), the code already correctly ignored later overrides and kept sending to that address only -- the hole was scoped to the first-time "no email on file yet, let me type one in" path.',
    notes: ['Fix: app/api/chat/route.ts emailTranscript now enforces its own dedicated rate limit (enforceRateLimit(req, \'chat-transcript-email\', 5, 3600) -- 5/hour per IP, reusing the existing lib/security/guard.ts helper rather than a new mechanism) before touching the database, and validates the client-supplied address with the same /\\S+@\\S+\\.\\S+/ format check used elsewhere in the codebase (BookingFlow, waitlist, kiosk) before accepting it. The recipient-lock behaviour itself (a conversation with an existing visitorEmail can never be redirected by a later call; only a conversation with no visitorEmail yet may set one, once) is unchanged and was already correct -- the fix closes the abuse surface around that one legitimate first-time path rather than removing it, since the visitor genuinely may not have left an email at chat start. The email body was already, and remains, rendered server-side from the conversation\'s own stored ChatMessage rows (lib/chat-email.ts emailChatTranscript) -- never from client-supplied free text -- so this fix is scoped to recipient throttling/validation, not the (already safe) body path. The admin-triggered send (app/api/admin/chat/route.ts, staff-authenticated) never accepted a toOverride at all and was not affected. (PRJ-1069.9)'],
  },
  {
    title: 'Buy Now Pay Later marketing promise does not match actual booking checkout', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 2,
    detail: 'app/(marketing)/finance/page.tsx, the AI-consultation flow (app/(marketing)/ai-consultation/page.tsx, components/ai/KVision.tsx), the sitewide footer (components/ui/PaymentMarks.tsx), the info/payment-option page (lib/info-pages.ts) and app/llms.txt/route.ts all promised "spread the cost with Clearpay/Klarna at checkout" or listed Clearpay/Klarna as accepted payment methods, but the real treatment-booking checkout (app/api/booking/create/route.ts, app/api/booking/start/route.ts) only ever calls stripe().setupIntents.create({ payment_method_types: [\'card\'] }) -- there is no BNPL option anywhere in the self-service booking flow. Real BNPL only exists for K Academy enrolment (automatic_payment_methods on the enrolment PaymentIntent) and a staff-initiated admin payment link for a course balance (app/api/admin/bookings/bnpl-link/route.ts) -- neither is reachable from a client booking a treatment online.',
    notes: ['Fix: removed the false claim rather than building real BNPL into booking checkout, following the BLD-1061 precedent. app/(marketing)/finance/page.tsx: dropped the whole "Buy Now, Pay Later" section (worked example, Clearpay/Klarna bullets, hero CTA button and #buy-now-pay-later anchor) plus the metadata description/keywords that named Clearpay/Klarna/BNPL; kept the genuinely real "pay as you go" and "0% interest-free options on eligible treatments" claims. lib/page-seeds.ts (the CMS "take over this page" starting seed for /finance) updated to match, so re-taking over the page will not reintroduce the false copy. lib/nav.ts: removed the two "Buy Now, Pay Later" links (main nav "Ways to Pay" column, footer "Discover" column) that pointed at the now-deleted #buy-now-pay-later anchor. lib/seo-audit.ts and lib/search.ts: matching corrections to their own copies of the /finance metadata/keywords so the SEO audit and site search stay consistent. app/(marketing)/ai-consultation/page.tsx and components/ai/KVision.tsx: removed "and Clearpay" / "spread the cost with Clearpay" from the three-step explainer and the AI plan result screens. components/ui/PaymentMarks.tsx (rendered in the footer on every page, including checkout): dropped the Clearpay and Klarna marks and the aria-label naming them as accepted payment methods -- this was the most directly misleading instance since it is a literal "accepted payment methods" claim shown at the point of payment. lib/info-pages.ts: removed the "Klarna" block from the /info/payment-option page. app/llms.txt/route.ts: corrected the general "Finance" fact line; left the K Academy "Clearpay finance available" line alone since Academy enrolment payments are genuinely BNPL-capable. Verified live (curl https://kclinics.co.uk/finance and /info/payment-option) before editing: both pages\' HTML matched the coded copy exactly (including the RSC flight-data payload), so neither is currently CMS-overridden in the database -- this fix reaches production as soon as it deploys, no separate admin/DB action needed. (BLD-1006)'],
  },
  {
    title: 'Booking-flow slot search has no live-region announcement for screen readers', type: 'ERROR', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 6, effort: 1,
    detail: 'components/booking/BookingFlow.tsx swapped the "Finding available times..." loading text for the list of time-slot buttons with no aria-live/role="status" wrapper (WCAG 4.1.3). Screen-reader users heard nothing while slots loaded and got no announcement when results appeared.',
    notes: ['Fix: wrapped the loading/result region (loading text, no-availability message, or the slot button list) in a role="status" aria-live="polite" container, matching the convention already used elsewhere in the codebase (components/contact/EnquiryForm.tsx, components/admin/session/SessionRunner.tsx). Visual layout unchanged. (PRJ-1069.2)'],
  },
  {
    title: 'Padding-less "Back" links across multi-step flows give a near-invisible mobile tap target', type: 'ERROR', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 6, effort: 2,
    detail: 'Several near-identical inline "Back" buttons across multi-step flows (booking, treatment finder, consultation form, AI vision plan builder, academy lesson player, onboarding wizard, day-close and patient assessment wizards) were plain text links with no padding -- text-sm/text-xs with no hit-area sizing -- well under the ~44x44px mobile tap target (WCAG 2.5.5).',
    notes: ['Fix: added min-h-11 rounded-full px-4 py-2 (the touch-target pattern already used for the same "Back" text in components/consent/ConsentSigner.tsx) to every bare-text Back button: components/booking/BookingFlow.tsx, components/finder/TreatmentFinder.tsx, components/consult/ConsultForm.tsx, components/admin/DayCloseRunner.tsx, components/portal/AssessmentRunner.tsx, components/ai/KVision.tsx (NavRow + AuthStep), components/academy/ImmersiveCourse.tsx, components/onboarding/OnboardingModal.tsx. Text size/colour unchanged -- rounded-full has no visible border/background here, so only the tap target grew. (PRJ-1069.6)'],
  },
  {
    title: 'Academy payment amount/currency mismatch never reaches Sentry', type: 'ERROR', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 6, effort: 1,
    detail: 'finalizeEnrolmentPayment() in lib/academy-payments.ts detects a Stripe PaymentIntent whose received amount or currency does not match the expected charge -- a signal of tampering or a pricing bug -- but only wrote console.error. Nothing surfaced the condition to Sentry, so it was invisible outside a manual log trawl.',
    notes: ['Fix: added a Sentry.captureMessage call (level error, tags: { area: "academy-payments" }) alongside the existing console.error, with the mismatch context -- piId, paymentId, enrolmentId, expected and received amount, expected and received currency -- as extra data. Mirrors the pattern already used for the analogous anthropic-call-failed checks in lib/chat-ai.ts and lib/ai-consultation.ts. File: lib/academy-payments.ts. (PRJ-1069.1)'],
  },
  {
    title: 'Login/signup/password-reset failures logged to console only, never reach Sentry', type: 'ERROR', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 6, effort: 2,
    detail: 'The genuine-unexpected-error catch blocks in the client and academy account routes (login, signup, forgot-password, reset) -- app/api/account/login, app/api/account/signup, app/api/account/forgot-password, app/api/account/reset, app/api/academy/account/forgot-password, app/api/academy/account/reset-password -- only wrote console.error when the underlying auth/db call threw. Routine user-input rejections (wrong password, validation failures) already return ok:false without throwing and were correctly left alone; the gap was that a real backend failure in these flows was invisible in Sentry.',
    notes: ['Fix: added Sentry.captureException(err, { tags: { area: "<route>" } }) next to the existing console.error in each of the six catch blocks, matching the tags shape used across app/api (e.g. app/api/booking/reschedule, app/api/shop/checkout). Left the wrong-password/wrong-credentials branches (which return ok:false without throwing, e.g. app/api/account/login\'s loginClient result and app/api/admin/login\'s password check) untouched -- those stay console/audit-log only by design, not Sentry noise. Files: app/api/account/login/route.ts, app/api/account/signup/route.ts, app/api/account/forgot-password/route.ts, app/api/account/reset/route.ts, app/api/academy/account/forgot-password/route.ts, app/api/academy/account/reset-password/route.ts. (PRJ-1069.5)'],
  },
  {
    title: 'BNPL-prepaid course bookings could be charged again in full', type: 'ERROR', urgency: 'P0', status: 'IN_REVIEW', assignee: 'claude',
    value: 9, effort: 3,
    detail: 'chargeBooking() (lib/booking-actions.ts) and finalizeBookingCharge() only treated booking.chargedAt as "already paid". The course BNPL/Klarna/Clearpay pre-payment path sets prepaidAt/prepaidPence instead and never touches chargedAt, so a client who paid a course in full via Klarna/Clearpay could be billed a second time: the late-cancellation fee, the 4th-reschedule fee, the staff "Charge now" action, and the POS/session-screen paylink, card-terminal, external and gift-voucher ops all gated on chargedAt only. BookingActions\' prepaid prop (meant to hide the charge UI) was also never passed in from app/admin/bookings/[id]/page.tsx, so staff saw a live "Charge card on file" button for an already fully-paid course.',
    notes: ['Fix: chargeBooking() and finalizeBookingCharge() (lib/booking-actions.ts) now treat prepaidAt the same as chargedAt in their idempotency guards -- the single choke point both the cancellation-fee and reschedule-fee paths already route through, and the authoritative guard for the webhook/SCA-recovery/terminal-capture finalisation. app/admin/bookings/actions.ts chargeBookingAction() gains the same check. app/api/admin/bookings/session/route.ts (the POS/session screen): paylink, terminal, external and gift-voucher ops now also refuse a prepaid booking. app/admin/bookings/[id]/page.tsx now passes prepaid={Boolean(b.prepaidAt)} into BookingActions, which hides the charge panel and shows a clear "Pre-paid in full via BNPL" message instead. Also corrected two "revenue at risk" / "needs payment" dashboard counts (app/admin/page.tsx, components/admin/dashboard/ReceptionistView.tsx) that were flagging completed-but-unbilled bookings without excluding prepaid ones, which is what nudged staff toward the manual double-charge in the first place. tsc and build both pass. (BLD-1119)',
      'Review follow-ups, same branch: (1) chargeBooking() now returns alreadyPaid: true when its idempotency guard short-circuits, and cancelBooking()/rescheduleBooking() no longer count that as a collected fee -- a pre-paid course cancelled inside 24h previously emailed the client that a late-cancellation fee had been charged and wrote the same figure into the client record while no money moved. The redeemed-points return gate deliberately still excludes that case, so behaviour for already-paid bookings is otherwise unchanged. (2) finalizeBookingCharge() now separates its two zero-row outcomes: the ordinary already-finalised no-op, versus a payment genuinely captured at Stripe against a pre-paid booking, which is now logged to Sentry, written to the audit trail and pushed to finance.view staff as "refund required" instead of disappearing silently. (3) prepaidAt: null added to the partial-cover gift-voucher updateMany too, which re-credits its reservation on a lost race. (4) Closed the remainder hole the guard would otherwise create: courseTotalPence() reads the primary line item only, so add-on treatments sit OUTSIDE the pre-payment. addTreatmentToBooking() and the booking-detail picker now refuse a pre-paid booking (removal stays allowed so existing rows can be cleaned up), and app/api/admin/bookings/bnpl-link refuses to mint a link while booking.pricePence exceeds the course total -- so prepaidAt always means the whole booking balance is settled, which is what every charge guard now assumes. (BLD-1119)',
      'Correction to the premise, recorded for accuracy: the pre-payment PaymentIntent minted by app/api/admin/bookings/bnpl-link carries metadata.bookingId as well as kind: course_prepaid, so payment_intent.succeeded in app/api/stripe/webhook ALSO runs its generic booking branch for it -- finalizeBookingCharge() sets chargedAt/chargedPence (and sends a receipt, awards loyalty, raises the Xero invoice) moments before the course_prepaid branch sets prepaidAt, in the same event and in that order. In live data prepaidAt therefore never exists without chargedAt, which means the double-charge described above was in practice already blocked by the pre-existing chargedAt guards, and BNPL money does reach day-close and the CRM revenue figures. The prepaidAt guards are still correct and are a no-op on today data; they are the precondition for ever cleaning up that double-recording (skipping finalizeBookingCharge for kind: course_prepaid), which is exactly what would open the hole for real. (BLD-1119)',
      'Remaining gaps found during review, NOT changed here: the course_prepaid webhook claim gates on prepaidVia: null only, so a pre-payment landing on a booking already charged on card is recorded rather than flagged for a refund (the new finalizeBookingCharge alert covers only the reverse order); the pre-payment link ignores pointsRedeemedPence and giftVoucherPence, so a client who redeemed points or a gift voucher on a course still pays the full course price via BNPL; and the POS/session checkout screen has no prepaid awareness in its snapshot, so on a booking that is prepaid but somehow not charged it would offer payment buttons that every server op now refuses (safe, but a dead end for staff). (BLD-1119)'],
  },
  {
    title: 'No saved-card status shown on the admin client profile', type: 'TASK', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 4, effort: 1,
    detail: 'app/admin/clients/[id]/page.tsx had no indicator of whether a client had a payment card on file. The signal already exists and is used elsewhere (app/admin/bookings/create-action.ts searchClientsForBooking, components/admin/NewBookingButton.tsx, components/admin/session/SessionRunner.tsx) as "does this client have any booking with a Stripe payment method attached" -- Client.stripeCustomerId alone is not proof of a saved card, since it is written as soon as a Stripe customer is created for the client, before the card-save step (SetupIntent) completes. Reviewed BLD-1097 (Client.dob and Client.allergies) and BLD-998 (treatment duration display) alongside this one: both were already correctly implemented, see notes.',
    notes: ['Fix: app/admin/clients/[id]/page.tsx now computes hasCardOnFile = c.bookings.some(b => !!b.stripePaymentMethodId) (the bookings are already fetched in full by lib/crm-data.ts getClient) and renders a read-only "card on file" / "no card on file" badge next to the existing marketing-consent badge in the client header. Display only -- no new card management action added. tsc and build both pass. (BLD-1013)',
      'BLD-1097 (edit DOB and allergies from the admin client profile) needed no change -- already fully implemented. components/admin/EditClientDetails.tsx already renders both as editable fields (a date input for dob, a text input for allergies gated on the clients.clinical.view permission), wired to app/admin/clients/actions.ts editClient(), which persists Client.dob and the encrypted-at-rest Client.allergies immediately and writes a CLIENT_EDITED audit entry. No code changed for this item. (BLD-1097)',
      'BLD-998 (treatment duration shown to clients must exclude internal buffer time) needed no change -- already correctly separated. prisma/schema.prisma documents Booking.durationMin as the client-facing figure and Booking.bufferMin as "not client-facing" turnaround/cleanup time (effective busy window is [startAt, endAt + bufferMin]); Booking.endAt is start + durationMin only, never the buffered end. Audited every client-facing duration surface -- components/booking/BookingFlow.tsx (variant.durationMin), components/treatment/TreatmentTemplate.tsx (variantNote from ServiceVariant.durationMin), components/live/LiveCompanion.tsx / app/live/[token]/page.tsx (Booking.durationMin), app/(marketing)/booking/manage (no duration shown at all), and lib/email.ts (the booking confirmation email never states a duration) -- none of them read or add bufferMin. The only place bufferMin and durationMin are combined is server-side scheduling/clash logic (lib/availability.ts, lib/booking-actions.ts) and staff-only admin screens (app/admin/bookings, app/admin/reports, app/admin/my-day, app/admin/clients/[id]/page.tsx "Xm booked" line), which is correct and out of scope (task said not to touch scheduling logic). No code changed for this item. (BLD-998)'],
  },
  {
    title: 'Incorrect package pricing displayed for treatment courses', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 2,
    detail: 'app/admin/bookings/create-action.ts computed defaultTotalPence for a multi-session course booking as pricePence (the single-session rate) multiplied by the session count, ignoring ServiceVariant.courses -- the admin Services pricing UI (components/admin/ServicesManager.tsx) already lets staff configure a distinct, usually cheaper, package price per session-count tier (e.g. "6 sessions for GBP450" rather than 6x the single-session rate). The only workaround was a manual overridePricePence staff had to remember to apply by hand every time.',
    notes: ['Fix: create-action.ts now looks up variant.variant.courses for a tier whose sessions count matches the requested session count and, if found, uses its totalPence as defaultTotalPence instead of the multiplication -- mirroring the identical course lookup already used on the public/portal booking flow (app/api/booking/start/route.ts:64). Falls back to the existing pricePence * sessions multiplication when no matching tier exists, so non-package bookings and mismatched counts are unaffected. The manual overridePricePence staff override (BLD-812) is untouched and still takes priority when set. courses is properly typed as Course[] via lib/services.ts asCourses(), confirmed against real usage before writing the fix. tsc and build both pass. (BLD-1148)'],
  },
  {
    title: "Klarna/Clearpay (BNPL provider) undisclosed in the privacy policy's data-sharing list", type: 'IDEA', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 1,
    detail: "app/api/admin/bookings/bnpl-link/route.ts routes course pre-payments through Stripe Checkout specifically to surface Klarna/Clearpay, sending client name/purchase amount/treatment to that provider for its own underwriting (a separate data controller from Stripe). The privacy policy's subprocessor list (lib/info-pages.ts:74) named Stripe, Resend, Twilio, Vercel, Upstash, Anthropic, Deepgram, Google Cloud Translation, Xero, TrueLayer, Yay.com, Google, Meta and Sentry -- Klarna/Clearpay appeared nowhere in that paragraph or the international-transfers paragraph.",
    notes: ["Fix: added Klarna and Clearpay to both paragraphs in lib/info-pages.ts (the /privacy-policy page). The sharing-your-data sentence is a list of 'with X' clauses (processors; regulators; insurers/legal advisers; law enforcement), so Klarna/Clearpay were given their own clause rather than being appended to the processor list -- listing an independent controller inside a list introduced as 'service providers who process data on our behalf under contract' would have contradicted itself. The clause states what is shared (name, contact details, the amount payable and a description of what you are paying for -- the treatment or course booked, which is the Stripe Checkout line-item name built from booking.treatmentTitle in bnpl-link/route.ts:56) and that they make the credit/eligibility assessment as independent data controllers on their own terms, not on KClinics' instructions -- the accurate legal relationship for a BNPL underwriting decision, unlike the other listed providers who only process on KClinics' behalf. The international-transfers paragraph now includes them in the list of providers based outside the UK. No other page or claim changed -- this only corrects the privacy policy's existing accurate list to be complete; it does not add or promise any new BNPL surface (BLD-1006/BLD-1061 already removed false BNPL claims elsewhere in the site, which stays correct: real BNPL is limited to Academy enrolment and the staff-initiated course pre-payment link). tsc and build both pass. (BLD-1136)"],
  },
  {
    title: 'GET /api/chat message poll has no rate limit, unlike its POST sibling', type: 'TASK', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 5, effort: 1,
    detail: "Security audit: app/api/chat/route.ts GET (message poll) took only token/after (a Prisma cuid, not a CSPRNG) and returned full message bodies with zero throttling, while POST on the same route enforced enforceRateLimit(req,'chat',30,60). Unlimited requests could hammer the token space and mutate presence state (lastVisitorSeenAt).",
    notes: ["Fix: added enforceRateLimit(req, 'chat-poll', 60, 60) to the GET handler -- a higher allowance than POST's 30/60 since the widget polls every ~4s while open. Reviewed independently (max-effort pass): signature verified against lib/security/guard.ts, degrades softly on 429 (client already tolerates {ok:false, messages:[]} and retries). tsc and build both pass. (PRJ-1069.3)",
      "Fix: app/api/admin/api-health/route.ts now calls Sentry.captureException(e, { tags: { route: 'admin/api-health' } }) in its catch block, alongside the existing console.error -- the health-check tool's own failures were previously as invisible as the outages it exists to catch. (PRJ-1069.4)",
      "Fix: app/api/consent/[token]/route.ts GET now calls enforceRateLimit(req, 'consent-read', 20, 600), matching the sibling /api/consent/sign, and logs a new CONSENT_READ audit event (additive AuditAction enum value, with a matching prisma/migrations entry) whenever the endpoint actually returns a template's content + client name for a token. Reviewed independently: doesn't break the admin activity feed's icon lookup (unknown actions render a fallback icon). (PRJ-1069.7)",
      "Fix: app/admin/bookings/page.tsx now batches listBookings(), sessionPermissions(), getLocale() and loadBookingTreatments() into one Promise.all -- none of the four depend on another's result. Reviewed independently: confirmed no ordering dependency and that the existing sessionCan/redirect guard still runs first. tsc and build both pass. (PRJ-1069.8)",
      'Shipped together as PR #1730 on claude/security-reliability-batch (commit 0dc3e280), reviewed at max effort with no defects found. Residual, non-blocking risk noted by review: if Upstash Redis is not linked in production, the shared enforceRateLimit falls back to a Postgres SecurityEvent insert-per-request -- worth confirming the Redis check is green on /admin/api-health post-deploy. Rollback: git revert 0dc3e280.'],
  },
  {
    title: "CMS 'Sand' section background fails AA text contrast with default body-text color", type: 'TASK', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 2,
    detail: "components/admin/PageBuilder.tsx lets editors set a CMS section's background to --color-sand (#e3d3c4), but components/cms/SectionRenderer.tsx still rendered body copy in --color-stone (#775f54) on top of it -- ~4.05:1 contrast, below the 4.5:1 AA minimum.",
    notes: ["Fix: SectionRenderer's SectionFrame now sets style={{ '--color-stone': 'var(--color-ink-soft)' }} on the sand-background wrapper, so descendant body text resolves to ink-soft instead. Reviewed independently: recomputed both ratios (stone-on-sand 4.05:1 fails, ink-soft-on-sand 8.2:1 passes), confirmed the override can't leak outside the sand section and behaves correctly in dark mode (both variables are redefined per-theme). (BLD-1151)",
      'Fix: components/chat/LiveChat.tsx message-list scroller now has aria-live="polite" role="log", so screen-reader users hear new assistant/agent replies on the public chat widget (distinct from the already-fixed admin team-chat modal). (PRJ-1060.5)',
      "Fix: app/(marketing)/page.tsx's homepage 'Signature treatments' carousel now filters featured items by dentistryLive instead of hardcoding 'veneers' in unconditionally -- /veneers is currently noindexed and not bookable. Reviewed independently: confirmed dentistryLive is correctly in scope (from getSiteConfig()) and the type guard against getTreatment()'s Treatment | undefined return is sound; confirmed live that /veneers still serves noindex. (PRJ-1069.11)",
      "Scoped out during independent review, NOT shipped: this batch originally also removed 9 mega-menu links as '404s' (BLD-1150). Review found the finding's premise was wrong -- lib/treatments.ts spreads lib/treatments-imported.ts into the treatments array, so all 9 slugs (laser-wrinkle-removal, rosacea-treatment, laser-skin-rejuvenation, microcurrent, led-therapy, bb-glow, deep-cleansing-facial, facial-massage, dermal-fillers) ARE defined; confirmed live all 9 return HTTP 200 and are in the live sitemap.xml. Removing them would have orphaned 9 real, indexed, bookable pages -- the same defect PRJ-1060.6 fixed for /roadmap, in reverse. The nav change was reverted (lib/nav.ts is byte-identical to main); BLD-1150 needs re-triage on the board with the real 404 URL if one exists, since it isn't any of these 9. (BLD-1150)",
      'Shipped as PR #1732 on claude/a11y-correctness-batch (commits 932ac064, 897348f4 -- the second commit is the independent review\'s BLD-1150 revert). Residual, non-blocking follow-up noted by review: 19 other files also use a raw bg-[var(--color-sand)]) class and may have the same contrast issue on their body text -- worth a follow-up ticket. Rollback: git revert 897348f4 932ac064.'],
  },
  {
    title: "Public /roadmap changelog page has zero inbound links", type: 'TASK', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 5, effort: 1,
    detail: "app/(marketing)/roadmap/page.tsx was fully built and data-backed but wasn't linked from lib/nav.ts, the Header, the Footer, or app/sitemap.ts -- confirmed by a repo-wide grep. A dead URL nobody could discover.",
    notes: ["Fix: added a footer link (Discover group) and a sitemap.ts entry. Reviewed independently: the page renders only listPublicItems() (isPublic: true) plus curated content, isn't in robots.ts disallow, and carries a self-canonical -- safe to surface. (PRJ-1060.6)",
      "Fix: components/layout/NewsletterForm.tsx now calls trackLead({ detail: { source: 'newsletter', surface } }) on successful signup, matching EnquiryForm/KVision/FranchiseEnquiryForm -- newsletter subscriber growth from ad campaigns can now be measured. Reviewed independently: /api/newsletter sends no server-side CAPI Lead, so no double-count. (BLD-1130)",
      "Fix: lib/automations.ts now attaches List-Unsubscribe / List-Unsubscribe-Post MIME headers (RFC 8058 one-click) to every bulk lifecycle email -- birthday, follow-up, win-back, tier-nudge, anniversary, aftercare, satisfaction, rebook-nudge, NPS-promoter and (added during independent review, the one send the first pass missed) the K Circle membership-renewal nudge -- matching the pattern already used by the newsletter and campaign senders. Verified exhaustively after the review fix: every sendEmail call that builds an unsubscribe URL now carries the header; transactional sends with no unsubscribe link were correctly left out of scope. (BLD-1141)",
      "Fix: app/(marketing)/academy/[slug]/taster/[lessonId]/page.tsx switched from export const dynamic = 'force-dynamic' to export const revalidate = 3600, matching the sibling treatment page's ISR convention -- the lesson lookup has no session/auth dependency. (BLD-1128)",
      'Shipped together as PR #1731 on claude/marketing-perf-batch (commits 2e9fb630, 1e90d996 -- the second commit is the independent review\'s List-Unsubscribe fix for BLD-1141). Residual, non-blocking follow-up noted by review: taster-page ISR can go up to an hour stale after an admin lesson edit, since the lesson-save path doesn\'t revalidate this specific route. Rollback: git revert 1e90d996 2e9fb630.'],
  },
  {
    title: 'Allow Price Override on the Appointment Page', type: 'ERROR', urgency: 'P0', status: 'IN_REVIEW', assignee: 'claude',
    detail: 'The ability to override the treatment price should also be available on the main Appointment page, not just within the Live Appointment view. The overridden price should apply only to that specific appointment; the default treatment pricing should remain unchanged.',
    notes: ['Fix: new overrideBookingPrice server action (app/admin/bookings/clinical-actions.ts) + PriceOverride control in the Treatments & billing panel of /admin/bookings/[id]. Sets the treatment (base) price for that appointment only -- add-on line items keep their own prices, the catalogue price is untouched, and the primary BookingItem is kept in sync so itemised views and exports match. Reason is required and the change is written to the booking activity log as "Price adjusted: £X → £Y — reason". Gated on bookings.charge (the permission that already allows the BLD-207 checkout adjust) and refused once charged/pre-paid or cancelled -- post-payment corrections stay an owner-gated question (BLD-1094). (BLD-1149)'],
  },
  {
    title: 'Cron/health failure alert webhook is fire-and-forget, may silently never send', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 1,
    detail: 'app/api/cron/daily/route.ts and app/api/health/route.ts POSTed the Slack/Discord ops alert with an un-awaited fetch(...).catch(()=>{}) before returning; on the serverless runtime the function can freeze once the response is sent, so the two most consequential alert paths could silently drop the notification.',
    notes: ['Fix: both routes now await the webhook fetch in a try/catch before returning, matching app/api/cron/dispatch/route.ts and app/api/cron/kiosk-cleanup/route.ts. (BLD-1137)'],
  },
  {
    title: 'Kiosk AI error responses from Anthropic never reach Sentry', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 8, effort: 2,
    detail: 'lib/kiosk-ai.ts swallowed non-2xx Anthropic API failures with only console.error, unlike lib/chat-ai.ts and lib/ai-consultation.ts which call Sentry.captureMessage on the identical check — kiosk AI outages were invisible to on-call.',
    notes: ['Fix: both the v1 and v2 !res.ok branches now call Sentry.captureMessage with level error and tags {area: kiosk-ai, status}, mirroring chat-ai. (BLD-999)'],
  },
  {
    title: 'Admin SAR export has no rate limit, unlike every other export endpoint', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 8, effort: 2,
    detail: 'app/api/admin/clients/[id]/export/route.ts returned a client’s full record gated only by clients.export — no enforceRateLimit, unlike account export (5/hr) and admin bulk export (6/hr). A compromised staff session could script-loop client IDs and bulk-exfiltrate health records.',
    notes: ['Fix: added enforceRateLimit(req, admin-sar-export, 30, 3600, admin) after the permission check — 30/hr leaves room for a busy front desk while capping bulk exfiltration; the existing per-export DATA_EXPORTED audit row is unchanged. (BLD-1134)'],
  },
  {
    title: 'Already-submitted review page re-invites negative reviewers to post publicly on Google', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 2,
    detail: 'app/review/[token]/page.tsx showed the “Share it on Google too” link on the already-submitted branch whenever googleUrl existed, with no rating check — ReviewForm gates the same nudge behind rating >= 4 on first submit.',
    notes: ['Fix: the already-submitted branch now renders the Google link only when review.rating >= 4 (rating was already in the page query), matching ReviewForm’s gate. (BLD-1004)'],
  },
  {
    title: 'GDPR erase/delete buttons use a low-contrast color combination', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 2,
    detail: '--color-blush (#cdb4a3) as a solid background with white text is roughly 2:1 against the 4.5:1 AA requirement — on the Erase and Delete permanently buttons (components/admin/DataPrivacy.tsx), academy exercise incorrect-answer markers and the SEO severity badge.',
    notes: ['Fix: swapped the solid blush backgrounds under white text to --color-blush-deep (#8b4a4a, the palette’s documented AA destructive colour) in DataPrivacy.tsx, ExercisePlayer.tsx (hotspot/label markers) and SeoDashboard.tsx (severity badge, grade badge and score bar). Translucent blush tints with ink text are untouched. (BLD-1120)'],
  },
  {
    title: 'Admin analytics/SEO tables clip instead of scrolling on narrow screens', type: 'TASK', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 6, effort: 2,
    detail: 'app/admin/seo/page.tsx, app/admin/marketing/performance/page.tsx and app/admin/marketing/analytics/page.tsx rendered bare <table> elements; body { overflow-x: clip } means any table wider than its column gets cut off with no way to see the extra columns.',
    notes: ['Fix: each of the six tables is wrapped in a div.overflow-x-auto so wide content scrolls inside its own container. (BLD-1125)'],
  },
  {
    title: 'Promo-code redemption cap and once-per-client limit can be bypassed under concurrent requests', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 3,
    detail: 'Both booking routes applied priceWithPromo (a read-only check) to set the final price, then ignored redeemPromo’s boolean — the only atomic enforcement of maxRedemptions/oncePerClient. Concurrent requests with the same capped code all kept the discount; only one incremented the counter.',
    notes: ['Fix: both call sites now check redeemPromo’s return. app/api/booking/create/route.ts re-prices the booking at the undiscounted amount; app/api/booking/start/route.ts falls back to the best non-promo offer captured before the promo won (automatic offer or welcome discount, burning the welcome claim when that is the fallback) and syncs the primary BookingItem’s discountPence. Both log a SESSION_EDITED audit event with the restored amount. Charge time reads booking.pricePence, so the corrected price is what gets collected. (BLD-1035)'],
  },
  {
    title: '/admin/reports runs six-plus independent queries as sequential round trips', type: 'TASK', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 3,
    detail: 'After its initial Promise.all, app/admin/reports/page.tsx separately awaited goodsCost, usedCost, minMarginPct, usedRow, an appointmentSession query and the VAT config import one after another — none depend on each other, only on since/bookingWhere.',
    notes: ['Fix: the six independent reads now run in one Promise.all (the VAT module import is included with a null fallback so the existing best-effort try/catch semantics are unchanged; the registered-only bySlug/svcRows pair stays dependent on vatCfg inside the try). staffRows still waits on byStaff as before. (BLD-1126)'],
  },
  {
    title: 'Stripe-dashboard refund reconciliation never restores the gift-voucher-covered portion of a booking', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 3,
    detail: 'The webhook’s charge.refunded booking branch reconciled refundedPence, clawed back loyalty points, pushed the Xero credit note and emailed the client — but never called creditVoucher, unlike the in-app refundBooking() (BLD-882). A booking partially settled by card + gift voucher, refunded via the Stripe dashboard, permanently stranded the voucher-covered value.',
    notes: ['Fix: the webhook branch now mirrors refundBooking() — on a full refund of a non-voucher-charged booking with giftVoucherPence > 0, creditVoucher restores the voucher balance (capped at face value, so a redelivered event can never over-credit) with a REWARD_REDEEMED audit entry. (BLD-1138)'],
  },
  {
    title: 'Academy quiz attempt-limit exhaustion permanently blocks course completion with no escape hatch', type: 'IDEA', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 8, effort: 3,
    detail: 'gradeQuiz() hard-stopped at quiz.maxAttempts, the player showed a dead-end message, and there was no admin way to reset attempts — a student who exhausted attempts on one required quiz could never complete a paid course (certificates require every quiz passed).',
    notes: ['Fix: new additive QuizAttemptGrant table (studentId, quizId, extra, reason, grantedBy) — attempt history is never deleted; grants raise the allowance. gradeQuiz and the course view both honour granted extras. The admin student page grows a "Blocked — out of attempts" panel (only for exhausted-not-passed quizzes) with a Grant 1 extra attempt control that requires nothing destructive, records a reason and writes an audit entry via the new grantQuizAttempts op (settings.manage). The student-facing exhausted message now offers a "Contact your tutor" mailto CTA to request a resit. Authorisation policy defaulted to the existing academy-management permission (settings.manage); grants are capped at 10 per call. (BLD-1139)'],
  },
  {
    title: 'Stripe disputes/chargebacks are not handled anywhere in the webhook or booking/order state', type: 'IDEA', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 8, effort: 4,
    detail: 'No charge.dispute.* case in the Stripe webhook: a chargeback silently debited the Stripe balance with zero DB/booking/order state change, no staff notification, and no Xero reversal — the booking still showed fully paid after the funds were gone.',
    notes: ['Built the visibility half: charge.dispute.created/closed are now handled — resolved to the booking or shop order via the payment intent, written to the audit trail as a new additive PAYMENT_DISPUTED action, reported to Sentry, pushed to the ops webhook channel, and notified to staff holding bookings.charge with a link to the record; both events are in the critical retry list so a DB failure makes Stripe redeliver. Deliberately NOT built without an owner decision (asked on this card): automatic booking/order state change on a lost dispute, Xero provisional-loss entry, and the escalation path. The Stripe dashboard webhook endpoint must have charge.dispute.created and charge.dispute.closed enabled for events to arrive. (PRJ-1069.12)'],
  },
  {
    title: 'Publish-consent for public before/after gallery photos is an unevidenced checkbox, not a real consent record', type: 'IDEA', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 8, effort: 3,
    detail: 'GalleryItem.consent was a bare boolean set by any staffer with settings.manage — no timestamp, signer identity, or link to a SignedConsent record; an identifiable clinical photo could go live with no durable proof consent was given.',
    notes: ['Built the evidence half: additive consentBy/consentAt columns on GalleryItem, stamped with the acting admin + time whenever the consent attestation is ticked (and cleared when unticked) on both create and update. The publish guard (cannot publish without consent) is unchanged. NOT built without an owner decision (asked on this card): hard-gating published:true behind a linked SignedConsent record, which changes staff workflow for clinical photo publishing. (BLD-1037)'],
  },
  {
    title: 'Klarna/Clearpay BNPL button is fully built but never rendered on the booking page', type: 'TASK', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 8, effort: 1,
    detail: 'components/admin/BnplPaymentButton.tsx is a complete, working component calling the already-implemented BNPL link route, but was imported nowhere -- app/admin/bookings/[id]/page.tsx only had a comment referencing it. Staff could not offer BNPL on course bookings at all.',
    notes: ['Fix: BnplPaymentButton now renders in the Treatments & billing panel of /admin/bookings/[id] for course bookings (courseSessions > 1) that are unpaid, not pre-paid and not cancelled/no-show -- the same lifecycle gate the API route itself enforces, plus the bookings.manage permission the route requires. (BLD-1165)',
      'Pre-merge review, same branch: the UI gate is stricter than the route on chargedAt (the button hides once the card on file has been charged, the route did not check it), so app/api/admin/bookings/bnpl-link now refuses a booking with chargedAt set -- otherwise a stale tab or direct call could mint a payment link for a booking already paid and collect twice. Two states where the button shows but the route refuses are left as-is deliberately, because the refusal message is the instruction staff need: an on-consultation (0-price) course, and a course carrying add-on line items (BLD-1119 requires the pre-payment to settle the booking in full). (BLD-1165)'],
  },
  {
    title: 'Un-awaited fire-and-forget calls silently drop waitlist re-offers and calendar sync', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 2,
    detail: 'lib/booking-actions.ts (waitlist re-offer on cancellation, CalDAV/Google Calendar push+remove) and app/api/booking/confirm/route.ts (calendar push) used import().then().catch() with no await before the handler returned its response -- the same class of bug already fixed for the ops-alert webhook (BLD-1137), which Vercel can freeze mid-flight once the response is sent.',
    notes: ['Fix: all five call sites now await the background call, capped at 10s so a slow provider cannot delay the response either (booking-actions.ts via a small bestEffort helper; the confirm route via Promise.allSettled raced against a timeout). Cancelled slots now reliably re-offer to waitlisters, and calendar push/remove/reschedule sync can no longer be silently dropped. (BLD-1166)',
      'Pre-merge review, same branch -- the awaits were correct but were placed mid-function, which put the added latency in front of work that must not be lost: (1) cancelBooking awaited the waitlist re-offer and then the calendar removals in two separate capped groups (up to 20s) BEFORE the late-fee audit log, the loyalty-points return, the gift-voucher re-credit and the client cancellation email; all three calls now run in ONE parallel group at the very end of the function, so the tail costs at most one 10s cap and nothing that moves money or emails the client sits behind it. (2) rescheduleBooking pushed the calendar before the client confirmation email -- moved after it, same reasoning. (3) app/api/booking/confirm has maxDuration=30 and already spends up to 15s on notifications, so a flat 10s calendar cap could push it past the function limit and turn an already-CONFIRMED booking into a 504 at the last step of the funnel; the cap is now the smaller of 10s and the time left in the 30s budget. (4) bestEffort clears its timer when the call wins (the BLD-281 pattern in lib/email) instead of leaving a 10s timer pending. Behaviour is otherwise unchanged: the helper still cannot throw, and no calendar/waitlist failure can fail a booking action. (BLD-1166)'],
  },
  {
    title: '/offers page is a static hardcoded list and never shows live admin-created promotions', type: 'TASK', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 2,
    detail: 'app/(marketing)/offers/page.tsx rendered a hardcoded OFFERS array and never imported OffersStrip, the component that already pulls real-time discounts onto the homepage and /pricing -- a time-limited promotion set up in admin showed everywhere except the one page whose entire purpose is "see current offers".',
    notes: ['Fix: /offers now renders <OffersStrip heading="Live promotions" /> above the evergreen offer cards, matching the /pricing placement. Safely renders nothing when the CRM/DB is unavailable or there are no live offers, so the static page still works standalone. (BLD-1167)',
      'Pre-merge review, same branch: the page still carried `export const revalidate = false` from when it was a purely static list, so the live strip would have been rendered once at build and cached forever -- a promotion created in admin would still never have appeared, and one that ended would have kept showing. Changed to revalidate = 3600, the same hourly ISR /pricing and the homepage use for the identical component. (BLD-1167)'],
  },
  {
    title: 'Contact enquiry form has no marketing-consent checkbox', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 6, effort: 2,
    detail: 'components/contact/EnquiryForm.tsx posted to /api/consult without marketingOptIn, unlike ConsultForm.tsx which has the checkbox -- consultSchema.marketingOptIn defaults to false, so every /contact submission (the site\'s highest-traffic lead form) created a client with marketing consent off and no way to opt in.',
    notes: ['Fix: added the same marketing-consent checkbox used in ConsultForm.tsx and threaded marketingOptIn through the /api/consult request body. (BLD-1168)',
      'Pre-merge review, same branch -- three consent gaps closed on the new surface: (1) the checkbox wording dropped ConsultForm\'s second sentence about hashed contact details being used for social ads, yet the same tick is what lets /api/consult pass the email to Meta CAPI, and both stamp the same MARKETING_CONSENT_VERSION as evidence of WHAT wording was shown; the copy is now word-for-word identical. (2) /api/consult hard-coded marketingConsentSource: "consult-form", so a /contact opt-in recorded the wrong WHERE; consultSchema gains a closed formSource enum (consult-form | contact-form, defaulting to consult-form) that the route passes to marketingConsentFields. (3) the mailto: fallback that runs when the API is unavailable now carries a "Marketing opt-in: Yes/No" line, so a ticked box is not silently dropped. (BLD-1168)'],
  },
  {
    title: 'Treatment Duration Display', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    detail: 'Clients could see the internal booking time (setup + treatment + cleaning, e.g. "70 min") instead of the actual treatment duration (e.g. 50 minutes). Internal booking times should remain visible only to staff.',
    notes: ['Fix: new additive ServiceVariant.displayDurationMin — the client-facing treatment length. When set, the public booking flow (variant list and add-on list) and the marketing treatment pages show it; when blank, clients see the internal time as before. The internal durationMin is untouched and still drives slot availability, room/equipment holds and the staff diary — the flow deliberately keeps sending it to the availability API. Admins set the new "Client min" column per variant on Admin → Services & pricing (blank = same as internal). Staff surfaces are unchanged. (BLD-998)'],
  },
  {
    title: 'Missing DB index on Enrolment.cohortId powers a full-table-scan groupBy on every academy course page', type: 'TASK', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 6, effort: 2,
    detail: 'cohortsWithRemaining() groupBy on Enrolment.cohortId ran with no index touching cohortId, on every ISR regeneration of the public course page.',
    notes: ['Fix: added @@index([cohortId, status]) to Enrolment with a matching additive migration. (BLD-1142)'],
  },
  {
    title: 'Allow admins to edit Date of Birth and Allergy Notes', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    detail: 'Request: admins should be able to edit a client’s Date of Birth and Allergies / Medical Notes at any time.',
    notes: ['Already delivered (BLD-199): the client profile’s "Edit details" dialog edits both — DoB as a date field, Allergies gated on the clinical-view permission so a non-clinical staffer can never silently wipe the hidden value; saves are immediate and audit-logged. Replied on the board with step-by-step staff instructions and flipped the card to Shipped. (BLD-1097)'],
  },
  {
    title: 'Admin UI uses raw Tailwind colours instead of brand palette tokens across 56+ components', type: 'TASK', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 8, effort: 5,
    detail: "components/admin/ReviewsBoard.tsx, BuildBoard.tsx and dozens more use raw Tailwind swatches instead of the theme tokens defined in app/globals.css, failing every brand audit.",
    notes: ["Built on a draft PR, NOT merged -- an Opus review pass found a real accessibility regression risk in the conversion itself. Fix: about 52 admin components swapped raw Tailwind status colours (green/red/amber) for the jade/blush-deep/gold theme tokens; scope, visual weight (tint stayed tint, solid fill stayed solid fill) and file boundary (components/admin/ only) all check out, and one dark-mode contrast bug the conversion introduced along the way (unread-count badges going near-invisible) is already fixed on the branch. Unresolved: several of the light-theme tinted badges and warning panels this branch converts -- plus about 15 more already on main using the same pattern -- fall below the WCAG AA 4.5:1 text contrast ratio (measured 3.4-4.2:1), because the palette has no dedicated AA-safe 'coloured text on its own tint' pair for gold or jade at the intensities used. This is the same class of bug BLD-1120 fixed for the Erase/Delete buttons. Needs a design-system call before merge: add an AA-safe on-tint text token to app/globals.css, or switch tinted badges to text-[var(--color-ink)] (10-13:1), the pattern ComplianceManager/TimeOffManager/OrdersManager already use for blush tints. Reply on this card with your preference and this ships once applied. (BLD-1032)"],
  },
  {
    title: 'VAT is entirely unimplemented for shop/POS retail sales despite the storefront claiming VAT-inclusive pricing', type: 'IDEA', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 8, effort: 4,
    detail: "Product has no vatClass field and finalizeOrder never touches the VAT engine -- only booking/treatment revenue is reflected in VAT reporting, even though the storefront already claims VAT-inclusive pricing once the clinic is registered. Filed as IDEA, not auto-built -- deserves an owner call on scope/timing.",
    notes: ["Built on a draft PR, NOT merged -- this card was explicitly filed as an owner decision, not an auto-build, and that was only caught after the branch was built and reviewed. What is on the branch: an additive Product.vatClass field (nullable, defaults to STANDARD when unset, matching Service.vatClass's own convention), a VAT-class selector on the product editor, and paid/fulfilled retail Order revenue folded into the same Reports page 'of which VAT' figure the booking side already computes -- display/reporting only, no customer-facing charge changes. Deliberately NOT extended to the Xero push (it does not touch orders/products at all today) or to Order.shippingPence (delivery VAT) -- both are out of the scope this card asked you to confirm. Reply on this card to confirm scope and timing and this ships as-is. (BLD-1170)"],
  },
  {
    title: 'K Vision web AI face-analysis flow has no age verification, unlike the physical kiosk', type: 'IDEA', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 3,
    detail: 'components/ai/KVision.tsx and app/api/ai-consultation/analyze/route.ts let any visitor create a guest account and upload a face photo for AI cosmetic analysis with no age gate, unlike the kiosk (explicit 18+ declaration) and booking/gift-card claim (isAdultOn). Filed as IDEA, not auto-built -- needs an owner decision on the minimum age and what happens below it.',
    notes: ["Built on a draft PR, NOT merged -- this card was explicitly filed as an owner decision, not an auto-build, and that was only caught after the branch was built and reviewed. What is on the branch: app/api/ai-consultation/analyze/route.ts now requires a verified adult DOB before the AI call runs -- date of birth plus an explicit 'I confirm I am 18 or over' checkbox, persisted to Client.dob/ageDeclaredAt on first confirmation -- mirroring the existing app/api/account/gift-card/claim/route.ts pattern exactly. The prompt only appears in KVision.tsx when needed (no verified adult DOB on file yet). Signup itself is untouched -- age stays enforced at the point of the action, not at signup, matching this codebase's documented policy -- so the specific 'changes the signup form's UX' concern the original filing raised does not apply to this implementation. Still needs your decision before this merges: is 18 the right minimum, and is a hard block (no plan shown, no parental-consent path) the right response below it, matching every other age gate already in this codebase? Reply on this card and this ships as-is. (BLD-1169)"],
  },
  {
    title: 'Track prepaid treatment sessions for clients and staff', type: 'TASK', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    detail: 'A clear system to track treatment packages and prepaid sessions, visible in the client’s online account and the admin system: package purchased, total sessions, used, remaining, which session is being booked, and paid status.',
    notes: ['Built with BLD-1098 as one feature. Additive Booking.packageBookingId self-relation: a course purchase is the existing sessions>1 booking (BLD-409); each later visit booked against it links back, so used/booked/remaining balances DERIVE from real bookings and can never drift from the diary. Cancelled/no-show sessions do not consume the package. Staff flow: the New phone booking modal loads the selected client’s packages and, when one matches the chosen treatment with sessions remaining, offers "Use package session — nothing to charge" (validated server-side: same client, same treatment, remaining > 0; booking created at £0, linked, audit-logged with its session number). Paid status = charged or BNPL pre-paid. (BLD-1014)'],
  },
  {
    title: 'Display package session balance for clients and admins', type: 'TASK', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    detail: 'A package balance indicator visible to both clients and admin users: total purchased, used, remaining, per package; "No active package" when none.',
    notes: ['Built with BLD-1014. Admin: a Packages card at the top of the client profile (label, paid badge, used/booked/remaining per package, linking to the purchase booking; "No active package." when none) and a "Session X of N" chip on every linked appointment page linking back to the package. Client portal: a "Your packages" card on the account dashboard (EN + UK translations) showing Session X of N, remaining count and paid status. Balances update automatically because they are derived from booking statuses — a completed session moves used up with no manual deduction. (BLD-1098)'],
  },
  {
    title: 'Outstanding Payment Warning', type: 'TASK', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    detail: 'If a payment for a late cancellation or no-show fails, display a clear Outstanding Payment warning to the client and staff; block new client bookings until the balance is settled; clear automatically once paid.',
    notes: ['Built. The balance is DERIVED: a booking cancelled inside 24h (fee not waived) or marked no-show, with a price and no charge recorded, is outstanding — charging it or waiving the fee clears every warning automatically, no flag to reset (lib/outstanding.ts). Staff: a red banner on the client profile lists each owed appointment with links and the exact clear-path, and every appointment page of that client carries the same warning strip. Clients: a red card on the account dashboard (EN + UK) with the amount and a call-us button, shown before anything promotional. Enforcement: both public booking endpoints (signed-in and new-client flows, which the guest flow also passes through) refuse new bookings with a clear message while a balance remains. Staff manual bookings are deliberately NOT blocked — reception can still book with judgment, with the warning in view. Note: pre-existing unwaived late-cancel/no-show fees from before this feature now surface and block those clients — waive the fee on the old appointment to clear any that should not count. (BLD-1066)'],
  },
  {
    title: 'POS quantity steppers are under the touch-target minimum', type: 'TASK', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 5, effort: 1,
    detail: 'PosTerminal basket +/- buttons rendered at 28px on a touchscreen till, under the ~44px guideline.',
    notes: ['Fix: bumped to h-11 w-11 (44px) with per-product aria-labels. (BLD-1129)'],
  },
  {
    title: 'Raw Error objects (not .message) are console.error’d in PII-collecting routes, risking plaintext PII in Vercel logs', type: 'ERROR', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 5, effort: 1,
    detail: 'Eight PII-collecting routes logged the full error object; a PrismaClientValidationError echoes submitted names/emails/phones/dob into Vercel function logs, bypassing Sentry’s sendDefaultPii:false.',
    notes: ['Fix: all eight sites (consult, account signup/login/forgot/reset, booking guest, academy forgot/reset) now log (err as Error)?.message, matching the codebase convention; Sentry still receives the full exception with PII scrubbing. (BLD-1173)'],
  },
  {
    title: 'Booking-confirmation SMS and clinic-notify email failures are silently swallowed', type: 'ERROR', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 5, effort: 1,
    detail: 'lib/booking-notify.ts settled the clinic-notify email and client SMS via Promise.allSettled with results never inspected — a failing SMS provider or clinic inbox was invisible.',
    notes: ['Fix: results are now inspected with labels; both helpers RESOLVE with {ok:false} rather than rejecting, so the check covers resolved failures too. Failures console.error and reach Sentry with the booking id, matching the client-email handling above. (BLD-1174)'],
  },
  {
    title: 'Duplicate MedicalClinic JSON-LD emitted twice on /contact and /clinics', type: 'TASK', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 5, effort: 1,
    detail: 'The marketing layout already renders organizationLd() on every page; /contact and /clinics rendered it again, producing two MedicalClinic nodes with the same @id (confirmed live).',
    notes: ['Fix: dropped the redundant organizationLd() call and import from both pages; breadcrumbLd stays. (BLD-1175)'],
  },
  {
    title: 'Public /api/search endpoint has no rate limiting, unlike every other public route', type: 'TASK', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 6, effort: 2,
    detail: 'Every distinct ?q= is its own CDN cache key, so the unthrottled ILIKE scan was a direct path to sustained DB load.',
    notes: ['Fix: enforceRateLimit(req, search, 60, 60); the 429 body matches the SearchResults shape so the header live-search box degrades to empty hits. (BLD-1172)'],
  },
  {
    title: 'Cookie-consent banner covers the mobile WhatsApp lead button on first visit', type: 'ERROR', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 6, effort: 2,
    detail: 'The consent banner (inset-x-3, z-80) sat spatially over and above the mobile WhatsApp CTA (bottom-5 right-5, z-40) on every first visit.',
    notes: ['Fix: the banner now stops at right-20 on mobile, leaving the WhatsApp button tappable beside it; desktop position unchanged (the button is mobile-only). (BLD-1152)'],
  },
  {
    title: 'Sitewide scroll-reveal wrapper can leave content invisible with no scroll event, and ignores prefers-reduced-motion', type: 'ERROR', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 2,
    detail: 'components/motion/Reveal.tsx left children at opacity 0 until the intersection observer fired — confirmed live to strand in-viewport sections invisible on /laser-hair-removal and /book — and never checked prefers-reduced-motion.',
    notes: ['Fix: Reveal/Stagger gain a viewport fallback — 1.5s after mount, anything positioned inside the viewport that the observer has not revealed is forced visible; below-the-fold content keeps the scroll reveal. All three wrappers (Reveal, Stagger, StaggerItem) now render statically under prefers-reduced-motion via the existing useReducedMotionSafe hook (the StaggerItem case matters: a static parent with motion children would have left them hidden). (BLD-1171)'],
  },
  {
    title: 'Review and Improve Terms & Conditions Acceptance Across All Booking Flows', type: 'TASK', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    detail: 'Review every way a client can enter the system and make T&C + cancellation-policy acceptance active, mandatory, never pre-selected, and reliably recorded.',
    notes: ['Reviewed every entry flow. Already-active acceptance existed everywhere: portal signup, guest booking, public booking (with cancellation wording in the label), consult/contact form (all z.literal(true) checkboxes, never pre-selected) and K Vision (explicit by-continuing line, owner decision BLD-734). The REAL gap: acceptance was validated then discarded — no durable record. Built: additive Client.termsAcceptedAt/termsAcceptedSource/termsVersion + termsAcceptanceFields() (mirroring the marketing/AI-consent evidence pattern), recorded with first-acceptance-wins no-clobber updates at all three write points (signupClient — covers registration, guest and K Vision; the public booking create route; the consult route). Labels strengthened to name the full consequence chain at the tick: 24h cancellations and no-shows charged in full, unpaid fees must be settled before booking again (now literally true via BLD-1066). Admin: a T&Cs accepted/not-yet-accepted chip on the client profile with date, surface and wording version in the tooltip; staff-created clients show not-yet-accepted until their first online signup/booking/enquiry captures it. Version constant 2026-08-v1 — bump it whenever the shown wording changes. (BLD-1067)'],
  },
  {
    title: 'Admin access to edit prices on existing bookings', type: 'TASK', urgency: 'P0', status: 'IN_REVIEW', assignee: 'claude',
    detail: 'Admins should be able to edit the price of any existing appointment, including paid ones, with a reason and full audit history.',
    notes: ['Owner decision 5 Aug: RECORD-ONLY for paid appointments. overrideBookingPrice now allows admins (sessionIsAdmin, stricter than the bookings.charge gate that covers unpaid edits) to correct an already-paid appointment’s recorded price: pricePence and the primary line item update, chargedPence stays exactly what the card paid, and the audit entry states both figures plus that any refund/Xero/loyalty adjustment is manual. The appointment-page control shows "Correct price (record only)" with explicit copy for the paid case. Unpaid-edit behaviour (BLD-1149) is unchanged; BNPL pre-paid stays uneditable. (BLD-1094)'],
  },
  {
    title: 'Extend online booking availability until 8:00 PM', type: 'TASK', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    detail: 'Clients should be able to see and book time slots up to and including 8:00 PM, depending on staff and room availability.',
    notes: ['Owner decision 5 Aug: LATE STARTS, ROTA-GATED. With staff-availability enforcement on, freeSlots and isSlotFree now allow slot STARTS up to 20:00 (LATE_START_MAX) even when the treatment runs past the advertised close — every late slot must still pass the per-clinician rota check (clinicianFree), so evenings only appear on days someone is actually rostered late, and the room/equipment pool checks are unchanged. Advertised opening hours (site.hours, Google/schema.org) are untouched. Without staff enforcement there is no rota to gate by, so the end-by-close rule stays. To open evenings: roster a clinician past 19:00 on the staff schedule for that day. (BLD-1015)'],
  },
  {
    title: 'Membership leaderboard photo/name consent has no evidence trail', type: 'IDEA', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 6, effort: 3,
    detail: 'setLeaderboard flipped a boolean with only an audit note — no timestamp or attestor recorded for a public disclosure of client identity.',
    notes: ['Owner decision 5 Aug: tick-with-record. Additive Client.leaderboardConsentBy/leaderboardConsentAt, stamped with the acting staff member and time when the opt-in is switched on (cleared when switched off), mirroring the gallery-photo evidence pattern (BLD-1037). (BLD-1122)'],
  },
  {
    title: 'Treatment Finder quiz never captures the lead', type: 'IDEA', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 8, effort: 4,
    detail: 'A visitor could complete the finder quiz and leave zero trace — no CRM lead, no ad-platform event — and the quiz collected no contact details, so silent capture raised a consent question.',
    notes: ['Owner decision 5 Aug: OPTIONAL EMAIL STEP. The results step now offers "Email me my results" with a plain consent line (results + possible consultation follow-up, explicitly no newsletter): entering an email posts to the new rate-limited /api/finder-lead (no-clobber client upsert, source treatment-finder; interaction note; results email with links and from-prices via the live catalogue) and fires the client-side trackLead event, matching the other capture points. Skipping the step keeps the quiz fully anonymous — no tracking, no storage. (BLD-1127)'],
  },
  {
    title: 'Stripe disputes/chargebacks are not handled anywhere in the webhook or booking/order state — automation half', type: 'IDEA', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    detail: 'The visibility half (audit + Sentry + ops webhook + staff notify) shipped earlier; the state/Xero half was held for an owner decision.',
    notes: ['Owner decision 5 Aug: FULL AUTO on a lost dispute. charge.dispute.closed with status lost now reconciles automatically — booking: refundedPence advanced by the dispute amount via CAS, loyalty points clawed back (full-refund return + pro-rata spend reversal), a Xero credit note pushed (pushBookingRefundToXero, reason "Chargeback lost") and a PAYMENT_REFUNDED audit entry; shop order: status → REFUNDED + stock restored (order sales carry no Xero push to reverse) + audit. Won/other outcomes change nothing. All side-effects sit behind the existing CAS claims so a redelivered event cannot double-run them. (PRJ-1069.12)'],
  },
  {
    title: 'Meta description & Article JSON-LD polluted with nav chrome on ~60 imported journal posts', type: 'TASK', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 8, effort: 4,
    detail: 'Every WP-imported /journal post\'s <meta name=description> and Article JSON-LD description read like "Cosmetology Blog Dentistry Blog {Title} {excerpt}..." — confirmed live. scripts/migrate-wp/migrate-blog.mjs never set metaDescription on import, so lib/blog.ts getBlogPost() fell back to the stored excerpt, and that excerpt itself carries leftover breadcrumb/nav-label text scraped ahead of the real article copy from the original WordPress page dump.',
    notes: [
      'CODE-LEVEL READ-TIME MITIGATION, not a DB backfill — DATABASE_URL in this environment is read-only per this repo\'s CLAUDE.md, so the stored Post.excerpt/metaDescription columns were NOT touched. Could not get a live DB connection to sample real rows either (direct TCP to the Neon host times out from this sandbox — confirmed with a raw /dev/tcp probe and a Prisma pg-adapter query, both hung/failed); proceeded from the bug report\'s documented evidence pattern.',
      'Added lib/blog.ts stripNavChrome(text, title?): (1) strips a leading run of "<Capitalized word(s)> Blog" nav labels via /^(?:(?:[A-Z][a-z]+\\s){0,2}[A-Z][a-z]+\\s+Blog\\s+)+/ — matches the confirmed "Cosmetology Blog Dentistry Blog " pattern and generalises to a few concatenated "<Category> Blog" labels without matching a legitimate excerpt that merely starts with a capitalized word; (2) strips a leading literal duplicate of the post\'s own title (matched exactly against the known title, so it cannot misfire) — WP page dumps apparently also leaked the H1 title text ahead of the real excerpt.',
      'Applied ONLY to the metaDescription fallback in getBlogPost() (lib/blog.ts) — the displayed excerpt/lede paragraph under the H1 is untouched (separate, lower-priority display bug, not in scope). Consumers fixed for free: generateMetadata() and articleLd() in app/(marketing)/journal/[slug]/page.tsx both read a.metaDescription.',
      'Pre-merge review, same branch: step (2) was NOT safe as written. The claim that a literal title match "cannot misfire" is wrong — a title is very often a legitimate opening for real prose, so a CLEAN post titled "Microneedling" with the excerpt "Microneedling is a collagen induction therapy..." had its first word eaten and its meta description started mid-sentence at "is a collagen induction therapy...", which is the same SEO damage this item exists to undo. Fix: the title strip now only runs on an excerpt that actually carried the step-(1) nav labels. In the WP dump the leaked H1 always sits behind those labels, so requiring them keeps the intended de-duplication on the affected imports while leaving every clean excerpt alone. Verified: polluted "Cosmetology Blog Dentistry Blog Microneedling Microneedling is..." still resolves to "Microneedling is..."; clean "Microneedling is..." and "Laser hair removal works by..." are now untouched.',
      'Also checked in review, no change needed: the step-(1) regex cannot catastrophically backtrack. Its greedy outer + has nothing following it, so a failed iteration ends the match instead of forcing a retry — measured linear, 300KB of adversarial "Blog Blog Blog..." input in under 3ms. Known residual false positive, judged acceptable: an excerpt genuinely opening "<Capitalised word> Blog " (e.g. "Our Blog is where we share...", capital B required) would lose those two words from its meta description only. Tightening the pattern further risks missing the real nav chrome.',
      'Follow-up for an owner with write DB access: a one-time cleanup of the stored Post.excerpt values for the ~60 affected wordpress-sourced posts would give a permanently clean excerpt (and let the display-side lede also stop carrying the chrome) — not required for this fix, which makes the public-facing SEO/JSON-LD bug disappear on every request regardless. (BLD-1182)',
    ],
  },
  {
    title: 'Automated API-health cron computes a critical outage state but never alerts anyone', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 8, effort: 3,
    detail: 'runApiHealth() (lib/api-health.ts) computes an overall traffic light across every probe, including critical: true checks like Stripe and Anthropic, but app/api/admin/api-health/route.ts just returned the report — nothing called Sentry.captureMessage or posted to CRON_ALERT_WEBHOOK_URL when a critical check went red, so a dead/revoked key went unalerted until a human opened /admin/api-health or a real payment/AI call failed in front of a customer.',
    notes: ['Fix: after runApiHealth() the route now alerts (Sentry.captureMessage + awaited POST to CRON_ALERT_WEBHOOK_URL, mirroring the existing pattern in app/api/health/route.ts and app/api/cron/daily/route.ts) when any critical: true check is red. Two scoping decisions: (1) alerts key off individual checks.critical && light === red, not overall === red alone, since overall is the worst light across ALL probes including non-critical ones (TikTok, GitHub mirror, etc.) — alerting on overall directly would page for a red integration nobody needs paging for; (2) alerts only fire on a fresh transition into red, using the existing ApiHealthResult.since field (reset to generatedAt the run a check changes light, carried forward unchanged otherwise) — so an ongoing outage does not re-page every ~30 minutes on the cron schedule, only the moment it starts. Alerting is gated on cronAuthed (the request presented CRON_SECRET) so an admin interactively opening /admin/api-health does not trigger a page — they can already see the red light on the page, matching the authed gate in app/api/health/route.ts. (BLD-1187)',
      'Pre-merge review, same branch: the de-duplication test was since === report.generatedAt, i.e. "this check changed light on THIS run". That is only reliable if the cron is the only caller, and it is not — every /admin/api-health page open fires a live run (components/admin/ApiHealthPanel.tsx probes on mount, and every 60s with auto-refresh on), as does ConnectionCentre.tsx after a key is saved. Any of those runs rewrites the stored report and consumes the light change, so the next cron sees an unchanged light and stays silent: the outage is never paged. That is the likeliest moment for one, because pasting a wrong or expired key is what turns Stripe/Anthropic red in the first place. Fix: the route now keeps its own watermark (Setting api_health_last_alert_at) and alerts on any critical red check whose `since` — the moment it went red, carried forward while the light holds — is newer than the last alert sent, advancing the watermark only after the alert has gone out. Same "no re-paging every 30 minutes for one ongoing outage" behaviour, but a transition consumed by an interactive run is still paged on the following cron. First run after deploy pages once for any critical check that is already red. (BLD-1187)',
    ],
  },
  {
    title: 'BNPL course pre-payment bills full list price, ignoring points/voucher already redeemed', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 8, effort: 3,
    detail: 'courseTotalPence (lib/booking-actions.ts), the single source of truth for both minting the BNPL Checkout Session amount and validating the webhook payment, never subtracted booking.pointsRedeemedPence or booking.giftVoucherPence, so a client who had already redeemed loyalty points or a gift voucher on a course was billed the discount twice.',
    notes: [
      "Fix: courseTotalPence now nets pointsRedeemedPence and giftVoucherPence off the gross price (clamped to zero) before returning, for both the primary-line-item figure and the legacy no-line-item fallback — both are always gross, never pre-discounted (confirmed against the same netting pattern already used at the point of charge in app/admin/bookings/actions.ts, BLD-882/BLD-1001). Only courseTotalPence changed, so the mint site (bnpl-link route) and the webhook validation stay in sync automatically. (BLD-1186)",
      'Pre-merge review, same branch: netting courseTotalPence broke the BLD-1119 guard in app/api/admin/bookings/bnpl-link/route.ts, which compared the (now netted) course figure against the always-gross booking.pricePence to detect add-on line items. On a course with no add-ons but with points or a voucher redeemed, booking.pricePence > course.pence became true, so the route refused to mint the link at all — with an "extras on top can\'t be collected" message naming add-ons that do not exist — for exactly the discounted booking this fix targets. courseTotalPence now also returns grossPence (the same primary-line-item figure before the netting) and the guard compares gross with gross, so its difference still means "the add-ons total" and nothing else. The amount actually charged, and the webhook validation, both still use the netted pence. A second, smaller consequence handled at the same time: when points/voucher cover the course in full the netted total is 0, which previously fell into the on-consultation branch and told staff to "set a price" on a priced booking; that case now returns its own message.',
      'Reviewed and NOT changed (pre-existing, wider than this item): courseTotalPence returns the primary line item\'s pricePence, which is gross of that item\'s own discountPence — the automatic offer / welcome / promo discount recorded at booking time (app/api/booking/start/route.ts sets booking.pricePence to the sum of pricePence - discountPence per item). A BNPL link for a promo-discounted course therefore still quotes the undiscounted price. Same class of bug as this item but a separate field, and the discountPence bookkeeping is inconsistent after overrideBookingPrice (which rewrites the primary item pricePence and leaves discountPence stale), so it needs its own item rather than a same-branch patch. (BLD-1186)',
    ],
  },
  {
    title: "Chargeback 'lost' refund cap is a no-op, can push refundedPence past chargedPence", type: 'ERROR', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 6, effort: 1,
    detail: 'In the charge.dispute lost-dispute branch (app/api/stripe/webhook/route.ts), Math.min(X, Math.max(c, X)) always resolves to X for any c, so the intended cap at chargedPence never capped anything — a dispute landing on top of a prior partial refund could inflate refundedPence above what was actually charged, corrupting reports and the downstream loyalty clawback / Xero credit-note amounts that read the same total.',
    notes: ['Fix: replaced with Math.min((full.refundedPence ?? 0) + amount, full.chargedPence ?? 0), the straightforward cap the code was clearly trying to write. Checked chargedPence can be 0/null here: this branch only runs when Stripe has confirmed a real dispute, which requires a captured charge, and every path that sets chargePaymentIntentId on a successful capture (chargeBooking, finalizeBookingCharge) sets chargedPence in that same write — so chargedPence is always populated in practice by the time a dispute fires; capping to 0 in the hypothetical unset case is still correct (refundedPence cannot exceed what was charged). (BLD-1190)'],
  },
  {
    title: 'Shared Dialog component never locks background scroll', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 8, effort: 2,
    detail: 'components/ui/Dialog.tsx rendered its overlay/panel without locking document.body scroll while open, unlike the other overlays in the app (Header mobile menu, Intro, ImmersiveCourse, ExplainerPlayer) which do this manually. The background page could scroll behind the modal.',
    notes: [
      'Fix: Dialog now locks document.body.style.overflow on open and restores the previous value on close/unmount, matching the existing save/restore pattern used elsewhere in the codebase. Restoring to the captured previous value (rather than unconditionally clearing it) means a nested Dialog closing does not clobber an outer Dialog\'s lock. (BLD-1183)',
      'Pre-merge review, same branch: the original wording of this item claimed 13 modals were affected and therefore fixed. Corrected — 13 files import from components/ui/Dialog.tsx, but only two of them (components/admin/ReplayList.tsx and components/admin/EditClientDetails.tsx) render the <Dialog> component and so gain the scroll lock. The other eleven files (13 call sites) use the useDialogBehaviours() hook instead — focus-in, Tab trap, Escape and focus restore around their own bespoke overlay markup — and still do not lock background scroll: AdminShell (mobile drawer), BuildBoard x2, StaffManager x2, MediaPicker, NewBookingButton, ReportProblem, SupplierManager, teamchat/NewChatModal, academy/CourseReviewPrompt, academy/SecurePdfViewer, ai/KVision. Moving the lock into the hook was deliberately not done here: six of those call sites pass no `active` argument, so it defaults to true and the lock would hold for as long as the component is mounted rather than while its modal is open — every site needs checking before the hook can own the lock. Worth its own item. (BLD-1183)',
    ],
  },
  {
    title: 'Supplier list row is mouse-only, unreachable by keyboard (WCAG 2.1.1)', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 6, effort: 2,
    detail: 'The clickable supplier row in components/admin/SupplierManager.tsx had onClick with no tabIndex or onKeyDown, so keyboard-only staff could not reach or open the supplier editor.',
    notes: ['Fix: added tabIndex={0} and an onKeyDown handler (Enter or Space opens the editor, Space prevents default to stop page scroll), matching the existing clickable-row pattern already used for the Build board list rows. (BLD-1185)'],
  },
  {
    title: 'Meta Custom Audience sync uses a weaker consent gate than the rest of the app', type: 'TASK', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 1,
    detail: 'syncSegmentToMeta built its consent gate inline (marketingOptIn + unsubscribed only), missing the marketingConsentAt evidence check every other marketing audience already requires.',
    notes: ['Fix: lib/meta-audiences.ts now spreads the canonical marketableClientWhere() from lib/consent.ts instead of the inline pair, so a Meta Custom Audience sync excludes legacy boolean-only opt-ins with no recorded consent evidence, matching every other marketing audience in the app. (BLD-1181)'],
  },
  {
    title: 'Consultation.message (health-adjacent text) shown to staff without clinical.view permission', type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 6, effort: 2,
    detail: 'The client profile page rendered a consultation\'s free-text message to any staff viewer regardless of the clients.clinical.view permission, even though the same page already gates every other clinical field on it.',
    notes: ['Fix: the consultation message render in app/admin/clients/[id]/page.tsx is now gated behind the existing `clinical` flag, matching the pattern used for assessments, AI analyses, the medical flag and clinical interactions elsewhere on the same page; category, treatments, status and date remain visible to all staff. (BLD-1184)'],
  },
  {
    title: 'Gift-voucher, shop and academy checkouts have no marketing-consent capture', type: 'TASK', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 3,
    detail: 'The gift-voucher, shop and academy-signup forms collect a purchaser email but offer no marketing opt-in, unlike BookingFlow and ConsultForm.',
    notes: ['Fix: added the same opt-in checkbox and copy used by BookingFlow/ConsultForm to GiftVoucherFlow, shop CheckoutForm and the academy signup form (AcademyAuth), each threading marketingOptIn through its API route into a no-clobber Client upsert stamped with marketingConsentFields() (lib/consent.ts) — gift-vouchers.ts and the shop checkout route now upsert/update the purchaser\'s Client record by email (previously neither touched one at all), and academy signupStudent()/linkClientByEmail creates or updates the linked Client on an affirmative opt-in. (BLD-1188)'],
  },
  {
    title: 'ChatMessage.body stored in plaintext, bypassing the app\'s clinical-encryption pattern', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 7, effort: 3,
    detail: 'Live-chat visitor/staff/AI messages (ChatMessage.body) were written unencrypted, even though visitors may describe symptoms or treatment concerns in the widget -- the same category of content Consultation.message/medicalNotes already encrypt via lib/clinical-crypto.ts. This table was out of scope of that earlier remediation.',
    notes: [
      'Fix: encClinical at every write site (visitor start/send in app/api/chat/route.ts, the inbound-email webhook, the staff reply and AI assistant/hand-over replies in app/api/admin/chat/route.ts and lib/chat-ai.ts, the transcript-emailed system note in lib/chat-email.ts) and decClinical at every read/display site (the visitor widget poll, the admin chat inbox list preview + thread, the AI assistant\'s own conversation-history prompt, the visitor-reply and transcript emails, and the client SAR export) -- decClinical tolerates legacy plaintext rows, matching every other clinical-encrypted field. No schema change: ChatMessage.body stays a plain String @db.Text column. Confirmed no SQL contains search exists over ChatMessage.body, so nothing needed to move to a separate searchable field. (BLD-1160)',
      'Marked SHIPPED (2026-08-09): this entry was left at IN_REVIEW with no pr link even though the fix above is live in the current codebase -- re-filed independently on the board as BLD-1216 and re-verified today against current code (6 write sites, 6 read sites, all confirmed already encrypted, matching these notes exactly). Closing the loop here; BLD-1216 closed on the board with the same evidence.',
    ],
  },
  {
    title: 'Owner requests: month-at-a-glance calendar, ascending academy course levels, cancelled-but-used package session', type: 'TASK', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 4,
    detail: 'Three owner-requested admin/academy changes: (1) the calendar page only ever showed one day, with no way to see which days of the month have appointments; (2) the public academy course grid was ordered featured-then-curated-order, not by qualification level, so Level 4 could appear above Level 2; (3) when a client cancelled with enough notice that no late fee applied but the clinic and client agreed the prepaid package session was spent, there was no way to record that -- the session silently returned to the package balance.',
    notes: [
      'BLD-995: new components/admin/MonthCalendar.tsx (presentational, Monday-first, tz-stable noon-UTC anchors) beside the day diary on app/admin/calendar. One extra query per page load counts the whole visible month\'s live bookings (PENDING/CONFIRMED/COMPLETED) and buckets them per clinic-local day, rather than one query per day. Days with bookings are filled; clicking a day opens its schedule, and the month can be browsed independently of the day via a ?month= param.',
      'BLD-996: lib/academy.ts listCourses() now sorts the result ascending by a numeric key parsed from the free-text `level` field ("Level 2" -> 2, "Levels 5-7" -> 5); unlevelled courses sort last. Array.prototype.sort is stable, so courses on the same level keep the existing featured/order/price ordering. Note the side effect: `featured` no longer floats a course to the very top of the public grid, only to the top of its own level. listCourses only feeds the public academy page, the sitemap and the SEO audit -- the admin course list is unaffected.',
      'BLD-1096: additive nullable Booking.packageSessionUsedAt / packageSessionUsedBy (no @unique, no default, no backfill -- safe for the prisma db push deploy gate). New admin-only server actions markPackageSessionUsed / unmarkPackageSessionUsed (app/admin/bookings/actions.ts, both idempotent and audit-logged) drive components/admin/PackageSessionToggle.tsx on the booking detail page. The booking\'s status is never touched -- it stays CANCELLED everywhere -- and lib/package-sessions.ts counts a marked cancelled session as used, exactly like a COMPLETED one. A "Package session used" badge appears on the booking detail, the bookings list and the client profile, and the day diary shows the slot faded and struck through.',
      'Review fix (BLD-1096): the mark was offered on, and accepted for, the course PURCHASE booking as well as follow-up sessions. That combination does nothing: clientPackages() drops any package whose purchase booking is CANCELLED, and it counts the purchase\'s own slot without reading packageSessionUsedAt -- so the badge and the audit entry would have claimed a session was deducted when no balance changed. Both the server action and the booking-detail gate now require Booking.packageBookingId (a real follow-up session), with an explicit error explaining why a cancelled course purchase can\'t be marked.',
      'Review fix (BLD-995): MonthCalendar used hardcoded var(--color-blush-deep) / #a8321f for the has-bookings fill and its hover, and var(--color-blush-deep) again for the legend dot -- exactly the off-palette-hex pattern PRJ-1032.35 was cleaning up elsewhere in the same run. Now --color-blush-deep (the palette\'s only red, app/globals.css @theme) with a color-mix hover, and --color-porcelain rather than literal white for the foreground so the fill still clears AA when the admin dark theme redefines both tokens.',
      'Review fix (BLD-1096): the day diary derived its faded/struck-through treatment from `b.status === \'CANCELLED\'` alone, relying on the page query being the only source of cancelled rows. It now checks packageSessionUsedAt too, so the styling can\'t mislabel a plain cancellation if that query ever widens.',
    ],
  },
  {
    title: 'sharp (Next.js Image Optimization dependency) vulnerable to libvips CVEs', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 6, effort: 1,
    detail: 'npm audit flagged GHSA-f88m-g3jw-g9cj: sharp versions below 0.35.0 inherit several libvips vulnerabilities (CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591). sharp backs next/image, used across admin media uploads, kiosk photos and before/after gallery photos.',
    notes: [
      'Fix: added an npm overrides entry holding sharp at ^0.35.3 (0.35.3 is the version the advisory names as the fix, bundling libvips 8.18.3). The installed lockfile already resolved sharp to 0.35.3 via next\'s own optional dependency range, so npm audit already showed 0 vulnerabilities before this change and the lockfile did not move -- the override exists to hold that patched version in place against any future range widening rather than to fix an active install. Verified sharp still loads and reports vips 8.18.3 after the pin, and both npx tsc --noEmit and npm run build pass. (BLD-1154)',
      'Review fix (BLD-1154): the override was an exact "0.35.3". Changed to "^0.35.3" so a future libvips patch released as 0.35.4 is picked up by a normal install instead of needing a package.json edit -- which is the whole point of the item. It keeps the same security floor and the same 0.36 upper bound as the exact pin. Re-verified: npm audit reports 0 vulnerabilities, the lockfile still resolves sharp 0.35.3 (the newest 0.35.x published), and npm ci --dry-run stays in sync with package.json (the lockfile records no overrides block at all, matching the three pre-existing overrides on main, so this addition does not desync the deploy install).',
      'Marked SHIPPED (2026-08-09): this entry was left at IN_REVIEW with no pr link even though the fix above is live in the current codebase -- re-filed independently on the board as BLD-1218 and re-verified today against current code (npm ls confirms sharp@0.35.3 installed). Closing the loop here; BLD-1218 closed on the board with the same evidence.',
    ],
  },
  {
    title: 'Five independent frontend/UX/accessibility findings: booking DOB, plain img tags, off-palette dark UI colours, chat AI-consent notice, academy video captions', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 7, effort: 3,
    detail: 'Five unrelated frontend findings from the live build board, fixed together on one branch: (1) booking DOB field had no max date or age check; (2) GiftPackages/CartClient used plain img tags instead of next/image; (3) KVision/GetMyPlanBand/LiveCompanion/room-display used off-palette hardcoded hex colours instead of theme tokens; (4) the live chat widget sent visitor messages to an AI with no consent notice; (5) the academy immersive course video player had no captions track.',
    notes: [
      'BLD-1144: BookingFlow.tsx DOB input now has max set to today, plus a client-side dobError() check (under-18 or over-120 years old) with inline feedback under the field, checked before signup/guest submit. Server-side: lib/validation.ts dobField now rejects under-18 and over-120 dates for clientSignupSchema (signup + guest booking) and bookingCreateSchema.',
      'BLD-1158: GiftPackages.tsx and CartClient.tsx now render product images with next/image (fill+sizes for the gift card, width/height for the cart thumbnail) instead of a plain img tag, and the @next/next/no-img-element eslint-disable comments are removed.',
      'PRJ-1032.35: added a small set of new @theme dark-surface tokens (--color-night, --color-night-ink, --color-night-ink-soft, --color-night-muted, --color-night-faint, --color-night-mild, --color-night-moderate, --color-night-notable, --color-night-notable-text) to app/globals.css, then replaced every off-palette hex literal in KVision.tsx, GetMyPlanBand.tsx, LiveCompanion.tsx and app/room-display/[token]/page.tsx with the matching token (or an existing token where one already fit, e.g. --color-gold-soft/--color-gold-bright/--color-stone). The var(--color-gold, ...) fallback is now #a98a6d everywhere, matching the real palette gold.',
      'BLD-1155: components/chat/LiveChat.tsx now shows a one-line, dismissable notice above the message input on first open ("Replies may be AI-assisted; see our Privacy Policy", linked) before the visitor sends anything to the AI auto-reply. Dismissal is remembered in localStorage; sending is not gated.',
      'BLD-1157: ImmersiveCourse.tsx threads the lesson\'s own captionsUrl (already in lib/lms.ts, from BLD-904) onto the synthetic media step it builds from lesson.videoUrl, and TeachMicro now renders <track kind="captions" ...> on the native-video case, same as LessonMedia/DemoPlayer. The jsx-a11y/media-has-caption eslint-disable on that video is removed (the audio branch is unaffected — no per-lesson audio captions exist).',
      'Marked SHIPPED (2026-08-09): this entry was left at IN_REVIEW with no pr link even though every fix above is live in the current codebase -- re-filed independently on the board as BLD-1219 and re-verified today against current code (4 of 5 confirmed already fixed matching these notes; the 5th, off-palette colours, was re-checked and the KVision/GetMyPlanBand/LiveCompanion/room-display usages are var(--color-gold) with an on-palette fallback or a documented literal equal to the token, not a regression). Closing the loop here; BLD-1219 closed on the board with the same evidence.',
    ],
  },
  {
    title: 'Group booking enquiry never fires the browser-side Meta pixel Lead event', type: 'ERROR', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 5, effort: 1,
    detail: 'GroupBookingForm posts to /api/consult, which sends a server-side CAPI Lead event, but the component never called the browser-side trackLead(), so Meta never got the matching browser event to dedup against for these high-value group/event enquiries.',
    notes: ['Fix: mirrors the ConsultForm pattern -- a client-generated eventId is sent to /api/consult and passed to trackLead() on a successful response, so the browser and CAPI Lead events share one id and de-duplicate correctly. (PRJ-1060.9)'],
  },
  {
    title: 'Gallery before/after images get generic, non-unique alt text', type: 'ERROR', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 4, effort: 1,
    detail: 'BeforeAfter.tsx defaults labelBefore/labelAfter to Before/After, and PublicGallery rendered every case without overriding them, so every gallery image got identical alt text ("Before treatment" / "After treatment") despite each case carrying a distinct category (Laser Hair Removal, Veneers, ...).',
    notes: [
      'Fix: PublicGallery now passes case-specific alt text to BeforeAfter, derived from each item\'s category plus its caption when present (e.g. "Veneers -- before treatment: upper arch"), so no two gallery images share the same alt. (BLD-1176)',
      'Review fix (BLD-1176): the first cut overrode labelBefore/labelAfter instead, which also changes the two on-image badges. Those badges are absolutely positioned at the top-left and top-right corners of a 4:3 tile in uppercase with 0.16em tracking, so "BEFORE LASER HAIR REMOVAL" and "AFTER LASER HAIR REMOVAL" would overlap in the middle of every tile in the 3-column grid. BeforeAfter now takes separate optional altBefore/altAfter props (defaulting to the badge text, so its only other behaviour is unchanged) and PublicGallery sets those, leaving the badges as the short "Before"/"After". Residual: two published cases in the same category with no caption still share alt text -- there is no other distinguishing field on GalleryItem to use.',
    ],
  },
  {
    title: 'Audit re-check: 3 previously reported findings already resolved, no code change needed', type: 'AUDIT', urgency: 'P3', status: 'SHIPPED', assignee: 'claude',
    value: 2, effort: 1,
    detail: 'Re-verified three findings pulled from the queue before starting work on this batch; all three were already fixed by earlier, differently-numbered work.',
    notes: [
      'BLD-1143 (duplicate MedicalClinic JSON-LD on /contact, /clinics): contact/page.tsx and clinics/page.tsx already only render breadcrumbLd(); the page-level organizationLd() call was removed by BLD-1175 (commit 21c3f202). Same underlying issue, different ref -- no further change needed.',
      'PRJ-1034.12 (careers Apply link ignores the selected role): app/(marketing)/careers/page.tsx already links to /careers?role={id}#apply and ApplyForm already seeds vacancyId from the ?role param, falling back to roles[0] -- shipped in commit 44988f05 (PR #1684). No further change needed.',
      'BLD-1150 (9 nav links to non-existent treatment pages): verified via getTreatment() that all 9 slugs (laser-wrinkle-removal, rosacea-treatment, laser-skin-rejuvenation, microcurrent, led-therapy, bb-glow, deep-cleansing-facial, facial-massage, dermal-fillers) already resolve -- they are defined in lib/treatments-imported.ts and merged into lib/treatments.ts\'s treatments array, none are POM-filtered. lib/nav.ts needs no change.',
      'BLD-1150, re-verified again (2026-08-09): still live at HTTP 200 for all 9 slugs. Re-triaged on the board a second time despite this note -- flagging for the owner that this finding keeps getting re-filed from the same stale audit source; recommend cancelling it outright rather than re-triaging.',
      'BLD-1233, verified (2026-08-09): "Kiosk result page link is nearly unreadable (1.99:1 contrast)" does not reproduce. app/kiosk/result/[slug]/page.tsx wraps the flagged link in a <main> with bg-[var(--color-ink)] (dark), not porcelain as the finding assumed -- text-gold-soft (#c2a589) on ink (#2a2420) computes to 6.59:1, above AA 4.5:1. The 1.99:1 figure is gold-soft on porcelain, a background this page does not use. No code change.',
      'BLD-1218, re-verified again (2026-08-09): sharp still pinned at ^0.35.3 (npm ls confirms 0.35.3 installed), commit 27fbef3e / BLD-1154. Already closed once on the board at line ~3435 above; noting the re-file here too.',
    ],
  },
  {
    title: 'Security batch: MIME bypass, passkey owner-gate, staff password strength, marketing rate-limit, PII error logging', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 8, effort: 3,
    detail: 'Five independent security/PII findings from the build board: an empty Content-Type could skip the media/build-upload MIME allow-list entirely; the passkey list/remove route only required a signed-in session where every sibling passkey route requires OWNER; staff.manage could set any staff password with no strength check, unlike client/academy self-service resets; the marketing email send route had no rate limit anywhere and no audit log on its test-send branch; and three public booking routes still logged raw error objects instead of just the message, bypassing sendDefaultPii:false.',
    notes: [
      "Fix (BLD-1191): app/api/admin/media/route.ts and app/api/admin/build/upload/route.ts both checked `file.type && !OK_MIME.test(file.type)`, so a missing/empty Content-Type short-circuited the whole allow-list check and let any file through. Changed both to `!file.type || !OK.test(file.type)`, matching the correct pattern already in app/api/admin/blob-upload/route.ts.",
      "Fix (BLD-1145): app/api/admin/security/passkey/route.ts GET and POST (remove) only checked getSession(), while register-options/route.ts and register-verify/route.ts both enforce session.role !== 'OWNER'. Added the same OWNER-only check to GET and POST here.",
      "Fix (BLD-1153): app/api/admin/staff/route.ts create and update handlers hashed any truthy password with no strength check. Added the same minimum-length (8+) and isBreachedPassword() (lib/security/breached-password.ts, HaveIBeenPwned k-anonymity check) gate already used by the client and academy self-service password resets (lib/client-auth.ts, lib/academy-auth.ts) to both handlers.",
      "Fix (PRJ-1060.2): app/api/admin/marketing/email/send/route.ts had no enforceRateLimit call on any branch and no logAudit on its test-send branch, unlike every other op in the file. Added enforceRateLimit (lib/security/guard.ts, matching the (req, scope, limit, windowSec, portal) shape used elsewhere in app/api/admin) to test, sendNow, schedule, abTest and the immediate-send branch, and a logAudit(SETTINGS_UPDATED) call to the test branch recording the recipient.",
      "Review fix (PRJ-1060.2): the new test-send audit entry was written before the sendEmail result was checked, so a provider rejection (the branch that returns 502) still logged \"Sent test email ... to ...\". It now records the attempt either way but says which happened. Reviewed and left alone deliberately: three more routes still carry the same `file.type && !OK.test(...)` MIME shape fixed under BLD-1191 -- app/api/kiosk/sessions/[token]/photo and .../photos (an empty or unrecognised Content-Type is exactly what iOS sends for some HEIC uploads, so tightening those would reject genuine client photos and needs its own ref plus magic-byte sniffing) and app/api/admin/facility (admin-only, images or PDFs). isBreachedPassword fails open on a HaveIBeenPwned outage, matching the client and academy self-service resets it was copied from.",
      "Fix (BLD-1179): three public PII-collecting booking routes still logged the raw error/err object - app/api/booking/create/route.ts, app/api/booking/pay-confirm/route.ts, and two spots in app/api/booking/start/route.ts (the reported card-setup failure plus a second customer-recreate failure in the same file found on inspection). All four now log (e as Error)?.message / (err as Error)?.message, matching the pattern already used in app/api/consult/route.ts and app/api/account/signup/route.ts. Grepped the rest of app/api/** for the same raw-object pattern: every remaining hit is in a webhook, cron job or admin-only route, out of scope per the finding, so no further changes made.",
      'Marked SHIPPED (2026-08-09): this entry was left at IN_REVIEW with no pr link even though every fix above is live in the current codebase -- re-filed independently on the board as BLD-1223 and re-verified today against current code (all 5 sub-findings confirmed already fixed, matching these notes exactly). Closing the loop here; BLD-1223 closed on the board with the same evidence.',
    ],
  },
  {
    title: 'Booking-widget date pick double-queries clinician schedules; SMS has no retry/failure visibility; abandoned PENDING bookings hold slots forever (BLD-1189, BLD-1038, BLD-1156, PRJ-1043.3)',
    type: 'ERROR', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 3,
    detail: 'Three independent reliability gaps: (1) recommendedSlots() in lib/availability.ts called freeSlots() (which runs cliniciansForDay) and then called cliniciansForDay again itself, so the adminUser/schedules/timeOff/bookings query ran twice per date pick. (2) sendSms (lib/sms.ts) had an 8s timeout but no retry and logged nothing on failure, unlike sendEmail; lib/automations.ts reminders() discarded the SMS result with .catch(() => null) and only set a boolean, with no error count or log. (3) app/api/booking/create commits a PENDING booking (holding the slot) before card entry, and lib/availability.ts treats PENDING like CONFIRMED with no time bound, so a client closing the tab (or a bot hitting the endpoint) left a permanent hold; the only existing PENDING->CANCELLED paths were an immediate SetupIntent failure or an explicit cancel.',
    notes: [
      'Fix (BLD-1189): cliniciansForDay is now wrapped in React\'s cache() so it runs at most once per request per (treatmentSlug, dateISO, excludeBookingId). Its signature moved from (treatmentSlug, dayStart, dayEnd, excludeBookingId) to (treatmentSlug, dateISO, excludeBookingId) -- Date objects would defeat cache()\'s reference-equality memoization since freeSlots() and recommendedSlots() each construct their own Date instances via clinicDayBounds(dateISO), while dateISO itself is the same string both callers already have. All four call sites (freeSlots, recommendedSlots, pickPractitioner, isSlotFree) updated accordingly. Files: lib/availability.ts.',
      'Fix (BLD-1038, BLD-1156): sendSms now retries up to 3 attempts with backoff (700ms * attempt) on a timeout, network error, or a 429/5xx from Twilio, logging every failed attempt via console.error -- mirrors sendEmail\'s retry/backoff pattern in lib/email.ts. The dummy-mode (Twilio not configured) console.warn(\'[sms:dummy]...\') and dummy:true flag were already in place from a prior fix and are unchanged. lib/booking-notify.ts already inspects/logs the sendSms result generically (fixed under BLD-1174); lib/automations.ts reminders() now inspects the result too: on failure it increments t.errors and logs console.error, matching the adjacent email branch instead of silently discarding the outcome. Files: lib/sms.ts, lib/automations.ts.',
      'Fix (PRJ-1043.3): added releaseAbandonedPendingBookings() (lib/booking-actions.ts) -- cancels (status: CANCELLED, no charge/fee logic, matching the existing plain-cancel path already used for an immediate SetupIntent failure in app/api/booking/create) any PENDING booking older than 45 minutes (PENDING_ABANDON_MS), wider than the kiosk session\'s 30-minute TTL to leave room for a slow card-setup/3DS flow. Wired into the existing 15-minute app/api/cron/dispatch sweep alongside the other idempotent per-cycle cleanups (waitlist expiry, chat-email follow-ups), so a closed tab or a bot hitting /api/booking/create can no longer hold a slot indefinitely. Files: lib/booking-actions.ts, app/api/cron/dispatch/route.ts.',
      'Review fix (PRJ-1043.3): the first cut swept EVERY PENDING booking past the 45-minute cutoff, which is not safe -- PENDING is not exclusive to the online-checkout hold. app/api/admin/bookings/session/route.ts books a next visit as PENDING whenever the client has no card on file (a staff-made, legitimately long-lived booking), and app/api/admin/bookings/request-card sends that client a card link whose page (app/(marketing)/booking/card) stamps a stripeSetupIntentId on open -- so neither "still PENDING" nor "has a setup intent" distinguishes an abandoned checkout from a staff booking. The sweep is now scoped to: stripeSetupIntentId set AND stripePaymentMethodId null (reached the card step, never attached a card -- both public routes stamp the setup intent at creation, and card-saved plus the setup_intent.succeeded webhook stamp the payment method), startAt still in the future (a past PENDING row holds no slot; mirrors the same guard in the abandoned-booking recovery email in lib/automations), take 200 per cycle, and a BOOKING_CREATED AuditEvent whose actor is exactly \'client\' -- the origin check, since staff-created bookings audit under the staff email and a missing audit row also means no sweep (fail-safe). The updateMany re-asserts status PENDING + no payment method so a card saved between the read and the write cannot be cancelled.',
      'Review fix (BLD-1189): cliniciansForDay\'s DB read is now wrapped in withDbRetry INSIDE the cache() memo. React cache() memoizes rejections as well as results, so a transient pool error would have been replayed to every later caller in the same request -- including the withDbRetry(() => isSlotFree(...)) wrappers in app/api/booking/create and app/api/booking/start, whose retries would have become no-ops. Retrying inside the memo means only a persistent failure is ever cached.',
      'Review fix (BLD-1038): the new per-attempt console.error lines logged the full destination phone number. They now log the last 4 digits only, matching the no-raw-PII-in-logs rule applied under BLD-1179. Pre-existing finding left alone (separate ref needed): the dummy-mode console.warn at the top of sendSms still logs the full number and message body when Twilio is unconfigured.',
    ],
  },
  {
    title: 'Finance batch: BNPL phantom-debt rebooking block, undercounted voucher loyalty spend', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 6, effort: 2,
    detail: 'Two finance/voucher bugs: a client who pre-paid a course via BNPL then late-cancelled was reported as owing the full course price and blocked from rebooking; and a partial-voucher booking earned loyalty points and K Circle tier credit only on the card remainder, undercounting the voucher-covered portion of the same spend.',
    notes: [
      'Fix (BLD-1200): outstandingBalance() in lib/outstanding.ts filtered on chargedAt: null but not prepaidAt, so a booking cancelled after being fully pre-paid via BNPL (cancelBooking\'s "already paid in full" branch in lib/booking-actions.ts, which correctly leaves chargedAt null and charged at 0) was still counted as a late-cancel debt equal to the full price, tripping the owed.totalPence > 0 gate in app/api/booking/create. Added prepaidAt: null to the where-clause so a prepaid booking is never treated as outstanding, regardless of chargedAt.',
      'Fix (BLD-1202): bookingSpendPence() in lib/client-loyalty.ts and rolling12moSpendPence() in lib/membership.ts both read only chargedPence, which for a partial-voucher booking is deliberately just the card/terminal/pay-link remainder (BLD-882) -- the voucher-covered portion lives separately in giftVoucherPence and was never added back in, so it earned zero loyalty points and did not count toward K Circle tier spend. Both functions now add giftVoucherPence to the spend basis, EXCEPT when chargePaymentIntentId is \'ext_gift-voucher\' (a booking settled entirely by voucher in one shot), where chargedPence already carries the full amount and giftVoucherPence just labels the same money -- adding it there would double-count. awardClientSpend\'s select now also fetches giftVoucherPence and chargePaymentIntentId; rolling12moSpendPence adds a second aggregate for the not-already-included voucher portion within the rolling window.',
      'Review fix (BLD-1202), two counting bugs in the above. (1) bookingSpendPence() returned (chargedPence ?? 0) + voucher and only fell back to pricePence when that sum was zero -- so a booking with a partial voucher applied but not yet charged returned the VOUCHER amount instead of the full list price. awardClientSpend fires on completion as well as on charge (whichever happens first) and writes one SPEND row per booking idempotently, so on the completion-first path -- the common one -- the client earned points on the voucher slice alone and the later charge never topped it up. That is an under-award, the same class of bug BLD-1202 exists to fix. It now returns pricePence whenever chargedPence is 0/null (pricePence is the undiscounted figure and already covers the voucher portion) and only adds the voucher on top of a real charge. (2) rolling12moSpendPence() added giftVoucherPence for every non-sentinel booking in the window, including ones refunded IN FULL. refundBooking() and the charge.refunded webhook both creditVoucher() the voucher portion back to the client once the refund is full, but neither zeroes giftVoucherPence -- so the card leg netted to zero while the voucher slice kept counting, leaving phantom K Circle tier credit on a booking that was fully refunded AND had its voucher balance returned. The aggregate is now a findMany that skips a booking whose refundedPence has reached its chargedPence (Prisma cannot compare two columns in a where-clause); partial refunds do not return the voucher, so they still count. Pre-existing, left alone (separate ref needed): reverseSpendPoints() pro-rates the reversal on chargedPence while the points were earned on chargedPence + voucher, so a PARTIAL refund of a partial-voucher booking now over-reverses slightly, against the client.',
      'BLD-1201 (gift-voucher Xero reconciliation) was pulled back OUT of this batch before merge, on the Opus review\'s recommendation: pushing a Xero sales invoice + bank payment at redemption time is a revenue-recognition policy call (recognise on redemption vs. defer against a liability account), the bank payment would date-mismatch the actual cash-in from when the voucher was originally sold, and -- unlike a code change -- invoices/payments written into the live Xero cannot be undone by git revert alone. Needs an accountant/owner decision before it ships; re-triaged on the board as its own item, unchanged from the original finding.',
      'Marked SHIPPED (2026-08-09): this entry was left at IN_REVIEW with no pr link even though both fixes above are live in the current codebase -- re-filed independently on the board as BLD-1225 and re-verified today against current code (both bugs confirmed already fixed, matching these notes exactly). Closing the loop here; BLD-1225 closed on the board with the same evidence.',
    ],
  },
  {
    title: 'Marketing batch: Academy purchases missing server-side consent-gated conversions, no abandoned-order recovery', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 7, effort: 3,
    detail: 'Two independent revenue/marketing gaps: sendEnrolmentPurchaseConversion() called sendPurchase() with no consent arguments, and sendPurchase() treats missing consent as not-consented, so every academy course sale silently skipped its server-side GA4/Meta CAPI Purchase event; and lib/automations.ts had no job at all for the Order model, so a shopper who reached checkout and never paid was never re-emailed to recover the sale.',
    notes: [
      'Fix (BLD-1203): added Enrolment.analyticsConsent / Enrolment.marketingConsent (nullable Boolean columns, additive) to prisma/schema.prisma, mirroring Booking.analyticsConsent / Order.analyticsConsent. Captured in startEnrolmentPayment() (lib/academy-payments.ts) — now takes an optional consent argument and writes it onto the enrolment at the moment the learner starts an online payment — read from the cookie-banner cookies (consentFromCookieHeader, lib/attribution.ts) by app/api/academy/pay/route.ts, the same pattern app/api/shop/checkout/route.ts already uses for Order. sendEnrolmentPurchaseConversion() now selects analyticsConsent/marketingConsent off the enrolment and threads them into sendPurchase(), so the server-side GA4/Meta events fire for consented purchases instead of being skipped unconditionally.',
      'Fix (BLD-1204): added abandonedOrders() to lib/automations.ts, mirroring abandonedBookings() — same 2-72h timing window off Order.createdAt (status PENDING), same EmailEvent dedupe pattern (kind ABANDONED_ORDER, status SENT, meta.orderId), same sendEmail mechanism, gated behind a new abandoned_order_recovery setting (lib/settings.ts, ships off by default). Added EmailKind.ABANDONED_ORDER (additive enum value) and a tmplAbandonedOrder() email template (lib/email.ts). Wired into runDailyAutomations()\'s existing Promise.allSettled batch, same as every other automations job, so it runs off the existing daily cron with no separate wiring needed.',
      'Review fix (BLD-1204): abandonedOrders() selected every PENDING Order, but app/api/admin/pos creates Order rows for over-the-counter till sales as well as the web shop. An abandoned in-clinic sale is left PENDING with a name defaulted to \'In-store sale\' and an optional (often blank) customer email -- so the automation would email till customers a "finish your order" link to /shop/cart, which has nothing to do with the sale they walked away from, and would call sendEmail({ to: \'\' }) for the blank ones, writing a FAILED EmailEvent that the SENT-only dedupe never suppresses so it retried on every daily run for the whole 72h window. The query now also requires stripePaymentIntentId not null and a non-empty email: app/api/shop/checkout sets the PI id the instant the PaymentIntent is created (and deletes the order if that fails), whereas POS card sales use a Checkout Session and only get a PI id from the webhook, by which point they are PAID -- so PENDING-with-a-PI-id is exactly the set of abandoned web checkouts. The non-empty email check also restores the Boolean(email) half of canEmailCare(), which abandonedBookings() applies and this did not. Verified separately with prisma migrate diff (main schema vs this branch): the only DDL db push will apply is ALTER TYPE "EmailKind" ADD VALUE \'ABANDONED_ORDER\' plus two nullable Enrolment columns -- additive, no unique constraint, nothing the no--accept-data-loss deploy gate rejects, and the two hand-written migration files match it.',
      'Marked SHIPPED (2026-08-09): this entry was left at IN_REVIEW with no pr link even though both fixes above are live in the current codebase -- re-filed independently on the board as BLD-1226 and re-verified today against current code (both gaps confirmed already fixed, matching these notes exactly). Closing the loop here; BLD-1226 closed on the board with the same evidence.',
    ],
  },
  {
    title: 'Destructive admin Remove actions inconsistently guarded — some skip confirmation entirely', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 7, effort: 2,
    detail: 'Several admin Remove/Delete handlers fired their mutation immediately with no confirm() step, while near-identical Remove/Delete buttons elsewhere in the same file did confirm first, risking accidental irreversible deletes.',
    notes: [
      'Fix: added a confirm() gate to six handlers that had none: BundlesManager.tsx removeItem (course-in-bundle Remove button), AbManager.tsx removeVariant (Remove variant button), DemosManager.tsx deleteMistake (mistake-marker x button), ScheduleManager.tsx remove() in TimeOff (removeTimeOff), WorkspaceClient.tsx removeAlias (Google Workspace alias DELETE), and FacilityDocsViewer.tsx remove() (facility doc DELETE). Each message names the specific thing being removed and states it cannot be undone, matching the wording style of the confirm() calls already used on the sibling Delete buttons in the same files. Audited every components/admin/**/*.tsx file (192 files) for remove/delete/destroy-named handlers and for fetch calls with method DELETE; all other matches already had a confirm() (or, for teamchat/ChatWindow.tsx remove(), the confirm sits in the caller before invoking it) and were left untouched. Two reversible toggles (SessionRunner.tsx removeVoucher, NotificationPreferences.tsx disablePush) were intentionally left alone — removing a promo code or disabling push notifications is trivially reversible, unlike the six irreversible-delete handlers above. (BLD-1208)',
      'Marked SHIPPED (2026-08-09): left at IN_REVIEW with no pr link even though the fix above is live in the current codebase. Re-filed independently on the board as BLD-1227, which found the SAME pattern missed by this pass in two more spots: BuildBoard.tsx (the board\'s own admin component) removeAttachment() and removeDep() fire their delete immediately with no confirm(), next to the guarded del()/signoff() in the same file. Fixed both under BLD-1227. Also re-examined the "intentionally left alone" SessionRunner.tsx removeVoucher call: on reflection a till operator mid-sale benefits from the same one-tap-undo guard as the sibling add-on removeVoucher in the same file already has (handleRemove), so added confirm() there too even though it is reversible — cheap, consistent, and matches the sibling. NotificationPreferences.tsx disablePush left alone as originally decided (a personal, instantly-reversible preference toggle, not a shared-state admin delete).',
    ],
  },
  {
    title: 'Consultation team notes bypass the clients.clinical.view permission gate', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 8, effort: 2,
    detail: 'app/admin/consultations/[id]/page.tsx correctly gated consult.medicalNotes behind clients.clinical.view, but built and passed the full decrypted "team notes" thread to ConsultationNotes with no clinical check at all, so any staff member with only consultations.view (e.g. FRONT_DESK) could read every note body -- and notes are encClinical()\'d specifically because they can hold clinical detail (BLD-913). The POST route had the matching gap: it only required consultations.manage, so the same front-desk-role staff could author clinical free-text notes too.',
    notes: [
      'Fix (BLD-1199): app/admin/consultations/[id]/page.tsx now only decrypts and passes note bodies to <ConsultationNotes> when clinical (sessionCan(session, \'clients.clinical.view\')) is true -- notes resolves to [] otherwise, mirroring the existing consult.medicalNotes && clinical pattern in the same file. Non-clinical staff see a "You don\'t have permission to view clinical notes for this consultation." message in place of the thread, and the input box is hidden with it (no point letting them draft a note the API will reject). app/api/admin/consultations/[id]/notes/route.ts POST handler now requires both sessionCan(session, \'consultations.manage\') and sessionCan(session, \'clients.clinical.view\'), returning the same 403 Forbidden shape as before when either is missing.',
      'Review fix (BLD-1199): the gate had one remaining hole. The POST route notifies every @-mentioned colleague with the first 90 characters of the note as the notification body (StaffNotification.body, plaintext, plus an email copy when that user has opted the clinical category into email) -- so a front-desk or contractor account mentioned in a note still received the clinical text even though the page and the API now refuse them. resolveMentions now resolves each hit with hasPermission(user, \'clients.clinical.view\') and the quote is only attached for recipients who hold it; everyone else still gets the mention (title + link) with no body. Pre-existing, left alone (separate ref needed): the notification TITLE carries the client full name to any mentioned account, and StaffNotification.body is not encrypted at rest like the note it quotes.',
      'Marked SHIPPED (2026-08-09): this entry was left at IN_REVIEW with no pr link even though the fix above is live in the current codebase -- re-filed independently on the board as BLD-1228 and re-verified today against current code (both the page-level and POST-route gates confirmed already fixed, matching these notes exactly). Closing the loop here; BLD-1228 closed on the board with the same evidence.',
    ],
  },
  {
    title: 'Team-chat SSE stream re-runs a per-channel N+1 unread-count query burst every 1.5s', type: 'TASK', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 8, effort: 4,
    detail: 'app/api/admin/team-chat/stream/route.ts called sseSnapshotStream with no probe argument, so every ~1.5s poll tick ran the full lib/team-chat.ts streamSnapshot(), which issues one db.teamMessage.count() per channel membership via Promise.all -- a continuous per-tick N+1 query burst for every open admin session, repeated on every browser auto-reconnect.',
    notes: [
      'Fix: added streamProbe(meId) to lib/team-chat.ts -- a single db.teamChannelMember.findMany() joined to its channel (select: lastReadAt, muted, channel.id, channel.lastMessageAt), reduced to a sorted "channelId:lastMessageAt:lastReadAt:muted" string. No per-channel count query. Wired it into app/api/admin/team-chat/stream/route.ts as sseSnapshotStream\'s probe argument (matching the existing probe shape used by lib/appointment-session-server.ts sessionProbe for the booking-live stream). sseSnapshotStream (lib/sse-snapshot.ts) already supported probe-first polling -- it calls probe() every tick and only calls load() (here, streamSnapshot() and its count() burst) when the probe string changes since the last tick. The probe string covers every input streamSnapshot\'s rev is built from: new messages and reactions bump channel.lastMessageAt, markRead bumps lastReadAt, setMuted flips muted, and joining/leaving a channel changes the membership row set -- so nothing that would change the real snapshot goes undetected. (BLD-1207)',
      'Review fix (BLD-1207): one input was in fact undetected -- deleting a message. deleteMessage() soft-deletes (deletedAt set, body cleared) and did NOT bump channel.lastMessageAt, but streamSnapshot counts unread with deletedAt: null, so deleting a message nobody had read yet lowers every other member\'s unread count while the probe string stays byte-identical. The probe then skips load() and the stale (inflated) badge sticks until some unrelated event moves the channel -- a silent regression, since the full-JSON snapshot comparison the probe replaced caught it via the unread number. deleteMessage() now bumps lastMessageAt best-effort, exactly as toggleReaction() already does for the same reason. Rest of the probe checked and sound: no ambiguity from the string join (channel ids are cuids, so neither separator can appear in a field), the sort is stable on the unique id prefix, membership add/remove changes the row set, and sse-snapshot assigns lastKey from the PRE-load probe value so a write landing between probe and load re-fires next tick rather than being swallowed. Residual, accepted: two messages in the SAME channel within the same millisecond would collapse (lastMessageAt is ms-precision in both the probe and rev) -- vanishingly unlikely for human chat, and self-healing on the next event.',
    ],
  },
  {
    title: 'Imported treatment pages show mismatched, boilerplate benefit copy', type: 'TASK', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 8, effort: 4,
    detail: '27 of 34 entries in lib/treatments-imported.ts (rendered live via TreatmentTemplate on kclinics.co.uk) paired specific benefit headings (e.g. "Fine Lines & Wrinkles", "Acne Scars") with the same ~4 recycled, unrelated generic sentences, a duplicate tagline was reused verbatim across several unrelated treatments, and several facts[] values were visibly truncated mid-word from the original WordPress export. Found by End-of-Day Audit 2026-08-06 (SEO & content discipline).',
    notes: [
      'Fix (BLD-1205): rewrote every benefits[].text across the 27 affected entries to a short, specific, clinically modest sentence matching its own heading and treatment -- the 4 recycled generic sentences ("Delivered by qualified, licensed practitioners." etc.) no longer appear anywhere in the file. For the 9 dentistry entries, which also shared identical generic benefit titles ("Expert clinicians"/"Advanced technology"/"Personalised plan"/"Considered care"), gave each procedure distinct, specific headings and text too. Deduped the 2 tagline collisions found across all 34 entries (a "redness, acne and uneven skin tone" tagline shared by 3 laser/skin treatments, and a "reducing cellulite" tagline shared by 2 body treatments) with new unique copy. Completed 15 facts[] values that were truncated mid-word or with a dangling trailing space (e.g. "...12-18 mont" -> "...12-18 months", "...each sessi" -> "...each session, building with the course"). Left the 7 entries fixed in an earlier pass (rosacea-treatment, laser-wrinkle-removal, microcurrent, deep-cleansing-facial, bb-glow, led-therapy, facial-massage) untouched -- verified byte-identical before/after. Only lib/treatments-imported.ts changed; benefits/tagline/facts were the only fields touched in the 27 entries. Verified via npx tsc --noEmit and npm run build.',
      'Flagged, not fixed here (separate refs needed if pursued): three dentistry taglines (root-canal-treatment, dental-crowns, clear-braces) are themselves cut off mid-sentence with the same WordPress-truncation signature as the facts bug, but are not duplicates so were out of this fix\'s stated scope; and spider-veins-removal\'s facts has a label/value mismatch ("Sessions" holding a Results-shaped value, "lasting up to 12 months") rather than a literal truncation.',
      'Review fix (BLD-1205): a second pass tightened six benefit lines that overstated efficacy or still paired a specific heading with generic filler -- anti-cellulite-programs (all four benefits grounded in its own intro instead of provider boilerplate), vacuum-massage (removed an unsubstantiated "toxins" claim), tooth-extraction (retitled a mismatched heading), and softened absolute-verb claims ("stops"/"prevents") to "helps prevent"/"helps stop" in root-canal-treatment, dental-bridges and clear-braces (dropped a comparative-efficacy claim against metal braces). Residual, flagged for an owner call: 8 facts[] values now state an interval ("of 2-4 weeks" etc.) that was authored to complete a truncated string rather than recovered from the source -- clinically standard ranges, but a claim about this clinic\'s own protocol worth confirming; and the same truncation this ticket fixed in facts[] still exists in faqs[] on the same pages (e.g. "Typically 3-6 sessions with intervals ."), out of this fix\'s scope.',
    ],
  },
  {
    title: 'Shared Dialog component never locks background scroll', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1767),
    value: 8, effort: 2,
    detail: 'BLD-1183 locked document.body scroll in the <Dialog> component itself, but 11 files (13 call sites) use the lower-level useDialogBehaviours hook directly for their own bespoke overlay markup and did not get the lock -- the page behind those modals could still scroll. Re-triaged as BLD-1194 for the residual 11 sites.',
    notes: [
      'Fix (BLD-1194): moved the scroll-lock effect from <Dialog> into useDialogBehaviours itself, gated on the hook\'s existing active parameter, and removed <Dialog>\'s now-redundant duplicate effect. Individually verified all 13 call sites (AdminShell, BuildBoard x2, StaffManager x2, MediaPicker, NewBookingButton, ReportProblem, SupplierManager, teamchat/NewChatModal, academy/CourseReviewPrompt, academy/SecurePdfViewer, ai/KVision) are safe to gate on active -- each either passes an explicit boolean that is the visibility flag, or is itself the dialog panel and is only ever mounted via a {condition && <Comp/>} gate in its parent, so the component\'s mounted lifetime already equals the modal\'s open period.',
      'Review fix (BLD-1194), two defects found and fixed. (1) React unmounts a deleted subtree\'s useEffect cleanups parent-first, so an outer and a nested overlay unmounting in the same commit (e.g. leaving an academy lesson via browser Back while the PDF viewer or explainer is open) ran the naive save/restore backwards -- the outer restored empty string, then the inner restored the "hidden" it had captured, leaving the page permanently unscrollable. Replaced it with a module-scope ref-counted useBodyScrollLock() (order-independent by construction), exported from components/ui/Dialog.tsx, and moved ImmersiveCourse/ExplainerPlayer onto it. (2) AdminShell\'s mobile drawer is lg:hidden but mobileOpen did not track the breakpoint -- resizing/rotating past lg while it was open left it display:none yet still holding the lock, with its own close button and the hamburger also lg:hidden (no way to dismiss it). It now closes itself via a matchMedia(min-width: 64rem) listener the moment the desktop layout takes over. Noted, left alone: components/layout/Header.tsx and components/motion/Intro.tsx still write document.body.style.overflow directly, but neither\'s lifetime can overlap a dialog\'s (both are top-level full-screen overlays; Intro is a ~1.75s boot splash).',
    ],
  },
  {
    title: 'Enrolled academy students on a course with zero uploaded modules hit a dead end', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1768),
    value: 7, effort: 3,
    detail: 'app/(marketing)/academy/portal/page.tsx: when courseProgress() (lib/lms.ts) finds zero lessons/quizzes for a paid, active enrolment, the only action was a generic "contact us" link -- no ETA, no auto-notify when content lands.',
    notes: [
      'Fix (BLD-1231): added Enrolment.contentReadyNotifiedAt (nullable DateTime, additive) and EmailKind.COURSE_CONTENT_READY (additive enum value). New courseContentReady() job in lib/automations.ts runs unconditionally (always on, not opt-in -- this is a transactional "your paid course is ready" notice, not marketing) as part of the existing daily automations batch: finds courses with at least one published lesson or quiz, then every PAID/ENROLLED enrolment on those courses with contentReadyNotifiedAt still null gets a one-time tmplCourseContentReady() email (lib/email.ts) and the timestamp is set only on a successful send, so a delivery failure retries the next day. Portal copy (app/(marketing)/academy/portal/page.tsx) now tells students they will be emailed automatically, alongside the existing Contact us fallback. Did not block course sale/payment on content existing -- that is a revenue-affecting product decision left for an owner call, not something to decide unilaterally in an unattended build.',
      'Review fix (BLD-1231), four defects found and fixed in courseContentReady(). (1) Mass-mail on first run: the audience was every PAID/ENROLLED enrolment on any course that has content, and contentReadyNotifiedAt is null on every pre-existing row, so the first cron run after deploy would have emailed "your course is ready to start" to the entire paying student base -- including people already part-way through, on courses that have had content for years. An enrolment now only qualifies when the course\'s FIRST lesson/quiz was created after that enrolment took its place (acceptedAt, else createdAt), i.e. there really was a window where they had paid and had nothing to study, and only when that first content landed within CONTENT_READY_WINDOW_DAYS (30) so shipping the feature cannot retro-announce old content. (2) Dead link for account-less enrolments: an Enrolment can exist with studentId null (details captured at enquiry before an account exists), but the portal lists enrolments by studentId and /academy/learn/<slug> resolves access via studentCanAccess(studentId) -- so those rows never saw the dead end and could not open the emailed link. Added studentId not-null (and a non-empty applicantEmail filter, so blank rows no longer consume the per-run budget). (3) Concurrent-run double send: two overlapping cron invocations both read contentReadyNotifiedAt null and both sent. The stamp is now claimed with a conditional updateMany BEFORE the send (count 0 means another run owns the row), and released on a failed send so the retry-tomorrow behaviour is kept; if the release itself fails the row stays stamped, which fails closed to a missed nudge rather than a duplicate. (4) A student holding two live enrolments on one course (re-sit) got two identical emails; the duplicate is now stamped but not sent. Also replaced the unbounded distinct-courseId scan with a per-course earliest-content map, added a deterministic orderBy plus an explicit CONTENT_READY_MAX_PER_RUN budget, and recorded courseId on the EmailEvent meta. Checked and left as-is: no consent gate, matching sendLiveClassSameDayReminders() (lib/academy-live-class.ts), the existing academy precedent -- this is service information about a product the student has paid for, not direct marketing, so Client.unsubscribed (a marketing preference) must not suppress it; there is no hard-bounce suppression list in the schema to honour.',
    ],
  },
  {
    title: 'Broken migrated journal images (403), refund CAS race can double-record, admin remove-without-confirm follow-up', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1771),
    value: 8, effort: 3,
    detail: 'Three items surviving verification out of 15 pulled from the live queue this run (the other 12 were already fixed under earlier, differently-numbered work or did not reproduce -- see the closing notes on those entries above): (1) BLD-1230, WordPress-migrated Journal article images 403 site-wide because the live firewall blocks /wp-content/* as an attack signature; (2) BLD-1234, refundBooking()\'s CAS retry loop re-adds the fixed refund amount on every retry instead of reconciling against Stripe\'s ground truth, so two concurrent identical refunds can double-record the money; (3) BLD-1227, a follow-up on the BLD-1208 admin-confirm sweep that missed BuildBoard.tsx\'s own removeAttachment()/removeDep() and SessionRunner.tsx removeVoucher().',
    notes: [
      'Fix (BLD-1230): added resolveMigratedImage() to lib/treatment-images.ts, reusing the existing manifest.json set (the same one treatmentImage()/packageImage() already use) to rewrite any .../wp-content/uploads/.../<file> URL to /treatments/<file> when that file has already been downloaded locally, else leaves the URL untouched. Wired into lib/blog.ts at all three DB read paths: listBlogCards() (card thumbnails), getBlogPost() (hero image via coverImage), and a new rewriteMigratedImageSrcs() helper that rewrites <img src="..."> occurrences in the sanitized article HTML body (srcset is already stripped by sanitizeHtml\'s allowlist, so src is the only attribute in play). Read-time transform only, no DB write and no migration needed -- the specific article this was filed against (aesthetic-dentistry-how-to-achieve-the-perfect-smile) already has its image at public/treatments/Aesthetic-Dentistry_-How-to-Achieve-the-Perfect-Smile.jpg.',
      'Fix (BLD-1234): refundBooking() (lib/booking-actions.ts) now captures the Stripe refund with expand: [\'charge\'] and reads charge.amount_refunded as stripeRefundedTotal. The CAS retry loop reconciles against that ground truth exactly like the charge.refunded webhook handler (app/api/stripe/webhook/route.ts) already does -- delta = stripeRefundedTotal - current.refundedPence, break with no write if delta <= 0 (already reconciled by a concurrent writer), otherwise advance by the delta rather than blindly re-adding the caller\'s fixed amount. External/cash and voucher-only payments (no Stripe charge to reconcile against) keep the original blind-add behaviour, unchanged.',
      'Fix (BLD-1227): added confirm() to BuildBoard.tsx removeAttachment() ("Remove this attachment?") and removeDep() ("Remove this dependency link?"), and to SessionRunner.tsx removeVoucher() ("Remove this voucher from the sale? The total will go back up."), matching the sibling confirm()-guarded handlers already in the same two files (del()/signoff() in BuildBoard.tsx, handleRemove() in SessionRunner.tsx).',
      'Also closed this run, no code change needed: 12 of the 15 items pulled from the live queue were already fixed under earlier work (BLD-1160, BLD-1199, BLD-1200/1202, BLD-1203/1204, BLD-1145/1153/1179/1191, BLD-1144/1155/1157/1158, BLD-1154) that never got its board entry marked SHIPPED, or did not reproduce against current code at all (BLD-1150 nav links, BLD-1233 kiosk contrast, BLD-1206/BLD-1180/BLD-1229 correctly left as owner-gated IDEAs, untouched). See the closing notes appended to each entry above and the individual board comments left on BLD-1150/1216/1218/1219/1223/1225/1226/1228/1233 for the full evidence trail.',
    ],
  },
  {
    title: 'Brand gold color token used as real link/text color fails WCAG AA contrast', type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 3, effort: 2,
    detail: 'BLD-1232: --color-gold (#a98a6d) on porcelain (#f6ece3) measures 2.75:1, below the 4.5:1 AA text minimum. Confirmed real on three of the flagged/related surfaces (large step-number labels rendered directly on the default porcelain background); the two originally-cited examples in the finding (ImmersiveCourse.tsx "Need a hint?" and its XP/level labels) turned out to be a false positive on inspection -- that component only ever renders inside its own fixed inset-0 bg-[var(--color-ink)] overlay (line 155), never on porcelain, where gold-on-ink measures ~4.77:1 and already passes AA.',
    notes: [
      'Fix: swapped text-[var(--color-gold)] to the already-defined AA-safe --color-gold-deep (4.54:1 on porcelain) on the three confirmed real instances -- the step-number labels in app/(marketing)/refer-a-friend/page.tsx:42, app/(marketing)/gift-vouchers/page.tsx:54, and the shared CMS "steps" section renderer components/cms/SectionRenderer.tsx:288 (used across any admin-built page that includes a numbered-steps block). Left every decorative-only gold usage untouched (bullet glyphs like squares/stars/arrows prefixing list items, aria-hidden icons, gold-tinted icon badges) per the finding\'s own guidance to reserve plain gold for decoration -- swept the full text-[var(--color-gold)] call-site list first and confirmed HomeworkPanel.tsx already handles its light/dark surfaces correctly (it swaps to gold-deep in its light tone object) and ImmersiveCourse.tsx never renders outside its dark overlay, so neither needed a change.',
      'Also closed this run, no code change needed: BLD-1150 (9 mega-menu links reported 404ing) does not reproduce -- verified live, all 9 URLs return 200; app/(marketing)/[slug]/page.tsx falls back to an admin-published CMS page when lib/treatments.ts has no static entry, and CMS pages now exist at all 9 paths. BLD-1233 (kiosk result-page link contrast) re-confirmed as the false positive already noted against this entry on 2026-08-09 -- gold-soft renders on the page\'s dark ink background (~6.6:1), not porcelain as the original finding assumed. Both were previously noted in this file as not reproducing but their board rows were still sitting at TRIAGE; flipped both to SHIPPED with evidence comments this run.',
    ],
  },
  {
    title: 'npm audit: high-severity transitive CVEs (js-yaml, nanoid) (BLD-1213, BLD-1243)', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1774),
    value: 5, effort: 1,
    detail: 'npm audit --omit=dev --audit-level=high failed CI on two pre-existing transitive advisories: js-yaml 4.0.0-4.3.0 (CVE-2026-59870, quadratic CPU in !!omap resolution) and nanoid <3.3.17 (GHSA-2v37-7h3g-55p8, custom generators loop indefinitely at size zero). Neither is a direct package.json dependency.',
    notes: [
      'Fix: ran npm audit fix on its own branch off main -- resolved both advisories via lockfile-only transitive bumps, no package.json change. npm audit --omit=dev --audit-level=high now reports 0 vulnerabilities. npx tsc --noEmit and a DB-less production build (DATABASE_URL= npx next build) both pass clean on the bumped lockfile -- plain npm run build is not runnable in the sandbox because its prebuild db-sync step cannot reach Postgres.',
      'Pre-merge review: re-verified on the branch. package.json has zero diff, so no declared dependency range moved. Both bumps are patch-level (js-yaml 4.3.0 -> 4.3.1, nanoid 3.3.16 -> 3.3.18) and the whole lockfile diff is those two entries, 12 lines, with no new transitive packages. Provenance confirmed as transitive-only: js-yaml comes in via eslint-config-next > eslint > @eslint/eslintrc, nanoid via next > postcss (which the existing postcss ^8.5.15 override already covers, unchanged). npm audit reports 0 vulnerabilities with dev dependencies included too, and npm ls flags no invalid or unmet non-optional deps.',
    ],
  },
  {
    title: 'Academy banner shipped but invisible on the live page (BLD-997 follow-up)',
    type: 'ERROR', urgency: 'P0', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 1,
    detail: 'Owner-reported P0: the BLD-997 Academy banner is "not showing" on the live site. It was NOT a failed deploy or a feature flag -- components/academy/AcademyBanner.tsx is on main (5f5fd6a, PR #1773), rendered unconditionally at app/(marketing)/academy/page.tsx:55, and https://kclinics.co.uk/academy returns 200 with the banner markup present. The markup is served as <div class="max-w-2xl" style="opacity:0;transform:translateY(28px)"> -- the site-wide <Reveal> wrapper hands visibility to a client-side intersection observer, and BLD-1171 had already confirmed live that observer can silently never fire. The BLD-1171 mitigation (useViewportFallback) was a ONE-SHOT check 1500ms after mount that only rescued elements already INSIDE the viewport, so anything below the fold had no backstop at all. The banner sits directly under a PageHero whose padding alone is ~340px, putting it exactly in that gap: the hero reveals via the fallback, the banner never does.',
    notes: [
      'Fix (the banner): removed the <Reveal> wrapper from AcademyBanner.tsx so the section renders visible in the server HTML and stays visible whatever happens to JS. This is the page\'s primary marketing message sitting just below the fold -- the one place a JS-gated opacity:0 costs the most. Verified by server-rendering the component directly (react-dom/server via jiti): it emits "Inside the academy" and "See the course range" with no opacity:0 wrapper, against the live page which still serves style="opacity:0;transform:translateY(28px)".',
      'Fix (the class of bug): useViewportFallback in components/motion/Reveal.tsx now runs its OWN IntersectionObserver, independent of framer-motion\'s, firing whenever an element scrolls into view for the life of the page -- so below-the-fold content elsewhere on the site can no longer be stranded the way this banner was. The original in-viewport timer is kept deliberately: it is the only rescue left if IntersectionObserver itself is what misbehaves, and the two fail differently. A missing IntersectionObserver entirely now force-shows rather than hides. Neither mechanism can ever HIDE anything -- the worst case of either misfiring is content revealed slightly early.',
      'NOT visually verified: Chromium cannot egress in this session (ERR_CONNECTION_RESET both direct and via the agent proxy) while curl reaches the site fine -- the strict explicit-proxy case documented in CLAUDE.md. Diagnosis is from the served HTML plus the code; the owner accepted shipping without a browser check. Worth a look at /academy after deploy to confirm, and the Reveal backstop change is the part that most deserves a real browser pass.',
      'Ruled out while diagnosing: the gold "Special offer" promo strip on the same page is absent from the live HTML because no course currently has an active promo (getActivePromo needs promoPrice set AND today inside promoStartAt/promoEndAt) -- correct behaviour, not a bug. The main site homepage has no Academy banner at all, only nav links; BLD-997 was always built on /academy.',
      'Verified: npx tsc --noEmit and npm run build both pass clean (DB sync skipped, no DATABASE_URL in this sandbox).',
    ],
  },
  {
    title: 'Academy homepage banner (BLD-997)', type: 'TASK', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude', pr: PR(1773),
    value: 4, effort: 2,
    detail: 'A prior run left BLD-997 BLOCKED, reading it as needing supplied artwork that was never attached. The owner @-mentioned Claude on the item to unblock it: "You can use our existing website branding and create the banner in the same style" -- so build a homepage banner for the Academy section in the site\'s existing brand language, no photography required.',
    notes: [
      'Built new components/academy/AcademyBanner.tsx, inserted into app/(marketing)/academy/page.tsx directly below the existing PageHero (above the conditional course-promo strip). Mirrors components/home/Hero.tsx\'s signature dark composition -- bg-[var(--color-ink)], a radial gold glow, the KMark monogram (components/brand/marks.tsx) anchored right at low opacity, Fraunces display headline with a text-gold-shimmer accent word, eyebrow line, lede copy and a single gold CTA to #courses -- rather than requiring supplied photography, per the owner\'s note. No CMS/DB model exists for academy homepage marketing content (checked prisma/schema.prisma and app/admin/academy) so this ships as a static section, matching how the rest of the Academy page (pillars, funding, equipment panels) is authored today.',
      'Pre-merge review: rendered the section locally and screenshotted it at 1440px and 390px. Two verbatim duplications with the PageHero directly above it were fixed -- the eyebrow read "K Academy" in both (now "Inside the academy" in the banner), and the gold CTA was a byte-identical "Explore courses" pointing at the same #courses anchor about 150px below the hero\'s own (now "See the course range"). Checked and clear: heading order is h1 (PageHero) then h2 (banner); the decorative KMark is aria-hidden on its wrapper; every text pair clears WCAG AA on ink (gold-soft eyebrow 6.6:1, porcelain headline 13.1:1, 80% porcelain lede 8.9:1, white on gold-deep button 5.3:1); palette is tokens only and the display face is Fraunces. Still open for the owner as a design call, not changed here: the banner is a second full-bleed dark block immediately under the dark PageHero, and inserting it pushes the conditional promo strip about 460px further from the fold.',
    ],
  },
  {
    title: 'Dentistry pages set to noindex despite code comment describing them as pre-launch-indexed (BLD-1250)', type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1776),
    value: 5, effort: 1,
    detail: 'app/(marketing)/dentistry/page.tsx generateMetadata set noindex: !dentistryLive, directly contradicting the adjacent BLD-157 comment on the same lines, which says these pages should stay indexed pre-launch to capture "coming soon" search intent -- the title/description/keywords already swap to coming-soon framing for exactly that reason. Since dentistryLive defaults false (lib/site.ts), the /dentistry hub was always noindexed in production. app/(marketing)/[slug]/page.tsx carried the same line in a different shape (noindex: t.category === \'dentistry\' && !dentistryLive), deindexing every dentistry treatment slug (veneers, teeth-whitening, composite-bonding, implants, etc) -- that one was a deliberate call (BLD-403), not a stray revert, and is reopened here because its stated reason no longer holds; see the review notes below. app/sitemap.ts compounded it by excluding /dentistry and the dentistry slugs from the sitemap whenever dentistryLive was false, so the noindexed pages were also unlisted -- consistent with each other, but consistently wrong.',
    notes: [
      'Fix: removed the noindex: !dentistryLive / noindex: t.category === \'dentistry\' && !dentistryLive lines from both generateMetadata functions (pageMeta()\'s noindex param already defaults to false, lib/seo.tsx) so dentistry pages are indexed unconditionally, matching the BLD-157 intent already documented next to the removed code. Checked components/treatment/TreatmentTemplate.tsx:64 (comingSoon = t.category === \'dentistry\' && !site.dentistryLive) to confirm this is safe: while comingSoon, the CTA is "Register your interest" only, never a booking button -- so indexing pre-launch never sends crawlers or users to a page overclaiming bookability. Did not touch the comingSoon CTA/booking-gating logic, dentistryLive default, or any booking flow. app/sitemap.ts: removed the dentistryLive gating on both the /dentistry static path and the dentistry treatment slugs filter, so the sitemap always lists exactly the URLs that are actually indexable (also dropped the now-unused dentistry/getSiteConfig imports there). next.config.mjs: the BLD-1008 redirect comment for /dentistry-all-treatments explicitly cited /dentistry\'s noindex state as the reason it pointed at /treatments instead -- retargeted it back to /dentistry now that the cited reason no longer holds, updated the comment accordingly.',
      'Verified: npx tsc --noEmit and DATABASE_URL= npx next build both pass clean on the changed files.',
      'Pre-merge review, history traced in git: the /dentistry hub was indexed by an explicit owner decision in BLD-157 (PR #641, 11 Jun -- "Owner\'s choice: keep the Dentistry page indexed... re-target it to intent it can actually satisfy today"), then silently re-noindexed 18 days later by BLD-686 inside a batched perf/SEO commit (bf8bdfea) that never cites BLD-157. That revert is the actual regression this item fixes. The dentistry treatment pages are a separate lineage: BLD-403 (c40f51d2, 17 Jun) noindexed them deliberately, reason given as "inactive booking pages with placeholder CTAs". Checked live before merging -- all 8 dentistry treatment URLs plus /dentistry now render the "Opening soon" badge and a Register-your-interest CTA, no booking button, no pricing section and no Offer in the JSON-LD, so BLD-403\'s stated reason no longer holds and indexing them is safe on that count.',
      'Review fix (one defect found and corrected on the branch): BLD-157\'s bargain is index + honest framing, and only the hub kept the second half. The treatment pages\' metaTitle/metaDescription are static commercial copy in lib/treatments.ts ("Porcelain Veneers London (Islington) | KClinics" / "Bespoke porcelain veneers in Islington, London... at KClinics"), so removing their noindex alone would have published eight SERP listings advertising bookable dental services the clinic cannot deliver until a GDC-registered dentist is in post -- exactly the mismatch BLD-157 set out to avoid, and the kind of claim CAP/GDC advertising rules treat strictly. app/(marketing)/[slug]/page.tsx now applies the hub\'s own swap to dentistry treatments while dentistryLive is false: title "<Treatment> -- Coming Soon | KClinics London" (47-59 chars) and description "Coming soon to KClinics, Islington -- <treatment>. Not bookable yet; join the waiting list and be first to know when our dentistry suite opens." (146-158 chars). Commercial metaTitle/metaDescription return automatically the moment the admin flips dentistryLive. The PageSeo panel override still wins over the swap; a TreatmentContent metaTitle does not, on purpose.',
      'Also checked and clear: sitemap consistency (fetched the live sitemap.xml, 161 URLs -- none noindexed, no canonical mismatches, so adding the 9 dentistry URLs keeps the invariant "everything listed is indexable"); robots.txt does not disallow /dentistry; the 8 treatment pages carry unique benefit/process/FAQ copy, so no thin- or duplicate-content cluster. Unrelated pre-existing defect spotted during that sweep and not touched here: sitemap.xml lists /academy/bundles, which 404s.',
    ],
  },
  {
    title: 'Security batch: Google SSO skipped 2FA enrollment gate, kiosk IP-hash had a hardcoded fallback salt, promo-code delete could destroy redemption records (BLD-1256, BLD-1260, BLD-1259)',
    type: 'ERROR', urgency: 'P0', status: 'SHIPPED', assignee: 'claude',
    value: 8, effort: 2,
    detail: 'Three independent security gaps: a Google SSO admin login went straight to a full session with no totpEnabledAt / is2faRequiredForRole check, unlike the password and passkey login paths; hashIp() in lib/kiosk.ts fell back to a literal string committed in source when neither KIOSK_IP_SALT nor ENCRYPTION_KEY was set, defeating IP pseudonymisation; and deleting a PromoCode cascades onto PromoRedemption (onDelete: Cascade in the schema), permanently destroying redemption/financial audit rows for any code that had been used.',
    notes: [
      'Fix (BLD-1256): app/api/admin/oauth/google/callback/route.ts now mirrors app/api/admin/passkey-login/verify/route.ts -- if the resolved user has no totpEnabledAt and is2faRequiredForRole(user.role) is true, it creates a setup-only session (needsSetup: true) and redirects straight to /admin/profile?setup2fa=1 instead of the normal destination, matching the exact enrollment UX the password and passkey paths already use (middleware then confines a needsSetup session to the profile page until they enrol). A full session is only created on the pre-existing path, unchanged. Logs recordSecurity(\'LOGIN_OK\', ..., { sso: \'google\', setup: true }) on the setup branch instead of recordLogin, matching app/api/admin/login/route.ts\'s setup branch.',
      'Fix (BLD-1260): hashIp() in lib/kiosk.ts now throws in production when neither KIOSK_IP_SALT nor ENCRYPTION_KEY is set, instead of silently falling back to the hardcoded \'k-clinics-kiosk\' string -- same fail-closed pattern as loadActive() in lib/crypto.ts. The hardcoded fallback is kept for non-production (dev/test) use only, so local/CI runs still work without secrets configured.',
      'Fix (BLD-1259): the \'remove\' op in app/api/admin/promotions/route.ts now counts db.promoRedemption rows for the code before calling promoCode.delete, and returns 409 with "This code has been redeemed and can\'t be deleted -- set it to inactive instead" (referencing PromoCode.active) when any exist. The schema\'s onDelete: Cascade on PromoRedemption.promo is untouched -- no schema/migration change, per the no--accept-data-loss deploy gate -- the guard is purely at the application layer, and the delete still proceeds normally for a never-redeemed code.',
      'Closed 11 Aug: all three fixes confirmed already on main (commit 9231173) from a prior run; this board row was left at IN_REVIEW and never flipped. No further code change needed.',
    ],
  },
  {
    title: 'Serverless DB pool silently falls back to unpooled connections without a configured pooler URL (prior cause of connection exhaustion) (BLD-1269)',
    type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1785),
    value: 8, effort: 2,
    detail: 'lib/db.ts resolvePooledUrl() only takes the safe Accelerate/pooler path when PRISMA_DATABASE_URL/ACCELERATE_URL/a prisma+postgres:// URL is present; otherwise every serverless instance opened its own direct pg.Pool -- the exact pattern the code\'s own comments describe as having previously exhausted Postgres\'s connection cap under concurrent traffic + deploys.',
    notes: [
      'Fix: makeClient() now calls warnIfUnpooledInProduction() before falling back to the direct-connection branch. It logs a loud console.error at boot when, outside the Next.js build phase and on Vercel or with NODE_ENV=production, no pooled URL is configured AND the direct URL in use is not a recognised pooler endpoint. Excluded: the build phase (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD from next/constants), since next build sets NODE_ENV=production but is not serving traffic and CI/sandbox builds run with no DATABASE_URL at all.',
      'Review correction (pre-merge): the first cut of this fix THREW instead of logging. That would have taken the whole site down on deploy. lib/db.ts is imported at module scope by effectively every route, page and cron, and the live deployment has no PRISMA_DATABASE_URL/ACCELERATE_URL set -- it reaches Neon over its PgBouncer endpoint (…-pooler.…neon.tech via POSTGRES_PRISMA_URL/DATABASE_URL) with the per-instance max:1 cap, i.e. the direct branch IS the working production path, and it is genuinely pooled at the database rather than by Prisma Accelerate. So the assertion would have fired on every production cold start, turning a capacity risk into an immediate site-wide 500. Changed to a loud log (the same trade-off instrumentation.ts already documents for weak signing secrets), and the check now recognises a -pooler/pgbouncer=true endpoint as pooled so it does not false-alarm on the current configuration.',
      'Verified: npx tsc --noEmit and DATABASE_URL= npx next build both pass clean. The build-phase exclusion was confirmed empirically -- static generation does execute DB queries during next build (visible as prisma connect timeouts in the log) and the guard correctly did not fire.',
      'Closed 13 Aug: confirmed merged to main (PR #1785, sha 05a5cb1970...) via a prior run; this board row was left at IN_REVIEW and never flipped.',
    ],
  },
  {
    title: 'Academy refund flow double-decrements paidPence after a prior partial Stripe-dashboard refund (BLD-1271)',
    type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1785),
    value: 7, effort: 3,
    detail: 'refundEnrolmentPayment (lib/academy-payments.ts) never read the row\'s existing refundedPence before refunding -- it refunded whatever remained unrefunded at Stripe but then unconditionally set refundedPence to the full original amount and decremented enrolment.paidPence by the full amount too. A prior partial refund already reconciled by reconcileEnrolmentPaymentRefund (which correctly decrements paidPence by just its delta) meant a later in-app Refund click double-counted that earlier delta, understating paidPence and overstating the outstanding balance.',
    notes: [
      'Fix: the select now also pulls refundedPence, and the paidPence decrement nets against it (delta = amountPence - refundedPence) instead of always decrementing by the full original amountPence -- mirroring the CAS/delta-aware pattern already used by refundBooking\'s refundableRemaining and by reconcileEnrolmentPaymentRefund itself. refundedPence is still stamped to the full amountPence (this action fully refunds whatever remains at Stripe), only the local paidPence decrement changed.',
      'Review correction (pre-merge): delta is computed from a read taken before the Stripe round-trip, but the claim only CAS\'d on state. A webhook reconciliation landing in that window raises refundedPence while leaving the row PAID, so the state-only CAS would still have succeeded and decremented paidPence by the now-stale, too-large delta -- reintroducing the double-count from the other side. The claim now CAS\'s on refundedPence as well, and a lost race hands the remainder to reconcileEnrolmentPaymentRefund, which re-reads and retries under its own CAS and is idempotent (no-op if the row is already REFUNDED, reconciles only the outstanding delta otherwise). The Stripe refund has already succeeded by then, so that path still returns ok.',
      'Verified: npx tsc --noEmit and DATABASE_URL= npx next build both pass clean.',
      'Closed 13 Aug: confirmed merged to main (PR #1785, sha 05a5cb1970...) via a prior run; this board row was left at IN_REVIEW and never flipped.',
    ],
  },
  {
    title: 'Journal pages still show WordPress nav-chrome pollution: case-sensitive strip missed lower-case labels, and the article body itself carries leftover nav links + a duplicate H1 (BLD-1289, BLD-1290)',
    type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1786),
    value: 6, effort: 3,
    detail: 'Two related regressions on top of the BLD-1182 mitigation. BLD-1289: stripNavChrome() in lib/blog.ts required a literal capitalized "Blog" with no /i flag, but the real WordPress nav-label text is not reliably Title Case -- live rows carry both "Dentistry blog" and "Dentistry Blog" for the same label -- so lower-case rows sailed straight through and the metaDescription on live journal pages (e.g. /journal/how-to-choose-the-right-toothpaste-and-toothbrush) still showed "Dentistry blog How to Choose the Right Toothpaste...". BLD-1290: BLD-1182\'s fix was explicitly scoped to the metaDescription fallback only -- the article body itself (Post.content, rendered via dangerouslySetInnerHTML in app/(marketing)/journal/[slug]/page.tsx) still opens with the raw leaked markup: one or two leftover <p><a href="/category/dentistry-blog/">Dentistry blog</a></p>-style nav links (target 404s live, that taxonomy was never migrated) immediately followed by a second <h1> duplicating the post\'s own title (the template already renders its own H1 from the post title), confirmed live on 65 of 72 /journal/[slug] pages.',
    notes: [
      'Investigation: fetched all 72 live /journal/[slug] pages (via BASE_URL, the sandbox can reach kclinics.co.uk over HTTPS but not the direct Postgres port, so this was done by scraping the rendered dangerouslySetInnerHTML output rather than querying Post.content directly) and inspected the first ~400 chars of each .journal-prose body. 65 of 72 open with the pollution; the other 7 open with ordinary prose. Confirmed exactly three leaked shapes, always at the very start of the string, always directly followed by <h1>...(title)...</h1>: (1) <p><a href="/category/<slug>-blog/">Label Blog</a></p> -- the common case, wrapped + linked; (2) the same <a> without a <p> wrapper (one row: do-hormones-really-affect-hair-regrowth-after-epilation, its second nav item is a bare <a>, not <p>-wrapped); (3) <p>Label Blog</p> with no link at all, plain text (acne-and-post-acne-treatment-modern-methods-and-technologies, beauty-injections-myths-vs-reality, top-10-skincare-mistakes-that-keep-you-looking-older). Category labels observed are only "Cosmetology Blog"/"blog" and "Dentistry Blog"/"blog" (this WP dump only ever had those two blog categories), with the "Blog"/"blog" casing genuinely inconsistent even between the two links on the SAME post.',
      'Fix (BLD-1289): widened stripNavChrome()\'s leading-nav-label regex in lib/blog.ts to accept either casing of the word "Blog" ([Bb]log). Re-verified against both capitalized ("Dentistry Blog") and lower-case ("Dentistry blog") nav-label text, plus the untouched-prose negative case (a "Microneedling is a collagen induction therapy..." style excerpt with no nav chrome).',
      'Pre-merge review, same branch: the first cut widened the regex with the /i flag over the whole pattern rather than [Bb]log, and the note claimed the matched shape was "unchanged". It was not. Under /i the [a-z]+ word bodies also match capitals, so the pattern stopped meaning "a leading run of Title Case words + Blog" and started meaning "any 1-3 words + blog", which matches ordinary prose: "Welcome to our blog ...", "Read our blog for more ..." would each have had their opening words silently deleted from the meta description -- the exact SEO damage the BLD-1182 review note in the same function exists to prevent, on a public page, with nothing to flag it. Only the word "blog" is inconsistently cased in the WordPress dump (live rows carry "Cosmetology Blog Dentistry blog" on the SAME post); the category word is Title Case in all 72 live rows, so [Bb]log is the whole of the widening needed.',
      'Pre-merge review, same branch: accepting a lower-case "blog" still leaves the label strip too blunt to run on its own -- "Our blog is where we share...", "This blog explains...", "The blog covers..." are all "<Capitalized word> blog " and would still lose their opening words. The two steps of stripNavChrome are therefore now ONE decision instead of two: the nav labels are removed only when the post\'s own title follows them, which is the complete confirmed shape of the leak ("{labels} {Title} {real excerpt}") and is not something ordinary prose reproduces. The no-title legacy path is unchanged. Verified by scraping all 72 live /journal/[slug] pages: all 11 polluted meta descriptions are cleaned (the same 11 the looser pattern caught, so nothing is given up on real data), the other 61 rows are byte-identical, and none of the prose false positives above is touched.',
      'Fix (BLD-1290): added stripDuplicateWpChrome(html, title) to lib/blog.ts and wired it into getBlogPost() around rewriteMigratedImageSrcs(sanitizeHtml(r.content)) -- a render-time sanitization step, not a DB backfill (deploys run prisma db push without --accept-data-loss and an unattended content-mutating backfill script is materially riskier to verify than a pure function). It is deliberately narrow to the confirmed shape: step 1 unconditionally peels off a leading run (capped at 4) of nav items matching one of the three observed shapes -- a /category/*-blog/ href is never legitimate body content on this site, and the plain-text variant must be the ENTIRE contents of its own <p> (not just a prefix), so a real sentence that happens to mention "blog" is never eaten. Step 2 only runs if step 1 actually matched something, and only strips a bare leading <h1> that remains when its text loosely matches (first-5-normalised-words prefix, tolerant of punctuation/entity differences) the post\'s own title -- gating on BOTH the nav-chrome match AND the title match means an admin-authored post that legitimately opens with its own heading (no nav-chrome ahead of it) is never touched, and even a WP-imported post whose real body happens to open with an unrelated <h1> is left alone.',
      'Verification: replayed the exact scraped shape from all 72 live pages through the (plain-JS re-implementation of the) function -- 65/65 polluted rows had the nav chrome correctly stripped and 0/7 clean rows were touched (0 false positives across the full live corpus). Using each row\'s own <h1> text as a stand-in for the real DB title (the true r.title should match at least as well), 65/65 also had the duplicate H1 stripped. Additionally checked conservative negative cases by hand: a post that legitimately opens with its own <h1> and no nav-chrome ahead of it is untouched; a real link to an unrelated /category/injectables early in prose is untouched; prose that merely mentions the word "blog" mid-sentence (not as an isolated <=30-char opening label) is untouched; and nav-chrome followed by an H1 whose text does NOT match the given title has the nav chrome stripped but the H1 deliberately left in place.',
      'Verified: npx tsc --noEmit and DATABASE_URL= npm run build both pass clean.',
      'Pre-merge CodeQL alert (high severity, double escaping or unescaping): normalizeForTitleMatch() chained sequential .replace() calls to decode HTML entities, with &amp; decoded after the named/numeric entities -- CodeQL flags that shape because an earlier replacement\'s output can be re-matched by a later pattern. Not independently exploitable here (the function\'s output only feeds an internal word-equality comparison, never rendered HTML, and any stray "&" left over is stripped two lines later by the [^a-z0-9 ] filter regardless), but the chained-replace pattern is genuinely fragile, so replaced it with a single non-overlapping regex pass over a lookup table -- every entity is matched and decoded exactly once, so no replacement\'s output is ever visible to a later one. Re-verified against sample titles with &amp;, &#8217;, &ndash; and a synthetic double-encoded &amp;amp; case (degrades safely to a stray "amp" token, same as before -- never corrupts or produces unexpected characters). npx tsc --noEmit and DATABASE_URL= npx next build both pass clean.',
      'Closed 13 Aug: confirmed merged to main (PR #1786, sha 4f4f5a9da9...) via a prior run; this board row was left at IN_REVIEW and never flipped.',
    ],
  },
  {
    title: 'Finance correctness batch: BNPL course total not netted for the item discount, cash/voucher refund retries skip the cap re-check, lost chargebacks never reconcile enrolments/gift vouchers (BLD-1286, BLD-1287, BLD-1288)',
    type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1787),
    value: 8, effort: 3,
    detail: 'Three independent finance-correctness gaps found together: (BLD-1286) courseTotalPence() read the primary bookingItem\'s raw pricePence, which is gross of the item\'s own discountPence (the automatic welcome/offer/promo discount applied at booking time) -- every other reader of this pair (receiptDetail, gamification, appointment-session-server) nets pricePence - discountPence, so a BNPL link minted for a discounted course quoted the undiscounted price. (BLD-1287) refundBooking\'s CAS retry loop for cash/ext_*/voucher-paid bookings (no Stripe ground truth to reconcile against) blindly re-added the requested amount to whatever refundedPence it re-read on a lost-race retry, without re-checking the amount against chargedPence -- a concurrent refund attempt (double-click, two staff) landing in that window could push the recorded refund total above what was actually charged. (BLD-1288) the charge.dispute.closed webhook handler\'s lost-chargeback auto-reconciliation only matched a booking or a shop order; a lost chargeback on a gift-card purchase or an academy enrolment payment logged an audit entry + Sentry alert but left the voucher\'s spendable balance and the enrolment\'s paidPence/course access completely untouched even though Stripe had clawed the money back.',
    notes: [
      'Fix (BLD-1286): lib/booking-actions.ts courseTotalPence() now selects the primary item\'s discountPence alongside pricePence and computes grossPence as Math.max(0, pricePence - discountPence) instead of the raw pricePence; the legacy no-line-item fallback (booking.pricePence, already net from creation) is unchanged. app/api/admin/bookings/bnpl-link/route.ts\'s gross-vs-gross comparison comment is updated to note it is now an exact comparison, not an approximation. app/admin/bookings/clinical-actions.ts overrideBookingPrice() also now resets the primary item\'s discountPence to 0 when staff type in a new agreed price -- otherwise the stale discount would net a second time against the very figure staff just overrode.',
      'Fix (BLD-1287): the cash/voucher branch of refundBooking\'s CAS retry loop in lib/booking-actions.ts now re-reads refundedPence and chargedPence on every attempt and mirrors the Stripe-ground-truth branch\'s own early-exit + cap -- if the freshly re-read refundedPence already meets or exceeds chargedPence the loop exits as fully refunded with no further write, otherwise the new total is capped at Math.min(already + amount, chargedPence) rather than added unconditionally.',
      'Pre-merge review, same branch (BLD-1287): the new cap check closes the money hole it targets -- walked through two concurrent full refunds on a cash booking, where the loser now re-reads refundedPence at the cap and stops instead of doubling it -- but the early exit it added dropped out of the loop and fell through into the side-effect block with nothing written. Both "nothing left to record" exits (the new cash/voucher one and the pre-existing Stripe-ground-truth delta <= 0 one) mean a concurrent writer has already reconciled the money AND run the side-effects: the charge.refunded webhook skips any refund carrying metadata.bookingId, so for an in-app refund this function is the only side-effect runner and the loser is a pure duplicate. Falling through raised a second Xero credit note, sent the client a second refund email, fired a second GA4 refund event and wrote a second PAYMENT_REFUNDED audit entry for one movement of money -- and on a cash refund, where no Stripe call happened at all, told the second member of staff the refund had succeeded. Both exits now return { ok: true, refundedPence } directly: the booking is genuinely refunded to that total, there is simply nothing further for this call to do. Fixing only the new branch would have left the asymmetry with the branch it is meant to mirror, so both were changed together.',
      'Fix (BLD-1288): app/api/stripe/webhook/route.ts\'s charge.dispute.closed handler\'s lost-chargeback branch now falls through to a gift-voucher-purchase lookup (by stripePaymentIntentId) and then an EnrolmentPayment lookup once booking and order have both been ruled out, mirroring the same fallback chain the charge.refunded handler already uses for a dashboard refund. A matched voucher purchase is debited via the existing debitVoucherForPurchaseRefund() (CAS on GiftVoucher.purchaseRefundedPence, capped at face value, cancels the card once fully refunded) instead of re-crediting it. A matched enrolment payment is reconciled via the existing reconcileEnrolmentPaymentRefund() (CAS on EnrolmentPayment.refundedPence, decrements Enrolment.paidPence, flips to REFUNDED once fully reconciled) with the dispute amount added to the existing watermark, since that helper expects a cumulative total. Both paths log their own PAYMENT_REFUNDED audit entry (or rely on the helper\'s own, for the enrolment case) alongside the existing PAYMENT_DISPUTED entry already logged for every dispute event.',
      'Reviewed and NOT changed, residual risk accepted (BLD-1288): the dispute-lost voucher and enrolment paths add dispute.amount to the existing watermark, so a Stripe REDELIVERY of the same charge.dispute.closed event (the handler throws, and dispute events are in the critical list, so any transient failure after the money branch triggers one) would add it a second time. For a full-value chargeback -- effectively every real one -- both paths clamp at the record\'s own amountPence, so the redelivery is a no-op. Only a PARTIAL dispute could over-debit, and only on redelivery. Closing it properly needs a per-dispute watermark column; the pre-existing booking branch immediately above uses the identical additive-plus-cap shape, so this is consistent with the handler it sits in rather than a new gap. Logged as-is rather than adding a schema field unattended.',
      'Verified: npx tsc --noEmit and DATABASE_URL= npx next build both pass clean.',
      'Closed 13 Aug: confirmed merged to main (PR #1787, sha b518e4bc79...) via a prior run; this board row was left at IN_REVIEW and never flipped.',
    ],
  },
  {
    title: 'Unoptimized multi-megabyte source images in public/treatments bloat build and image-optimization cost (BLD-1270)',
    type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1788),
    value: 8, effort: 3,
    detail: 'public/treatments/ was 167MB with 183 PNG/JPEG source files over 200KB (30+ over 1MB, e.g. ppm.png 2.38MB, photo-block-1.png 1.9MB) -- these are the sources next/image optimizes on request, so oversized originals mean slower first-optimization latency, higher Vercel image-optimization cost and a bloated repo.',
    notes: [
      'Fix: added scripts/optimize-treatment-images.mjs, a re-runnable batch pass that recompresses every source over 200KB down to JPEG (quality 82, mozjpeg, resized to a 2400px long-edge ceiling if larger); public/treatments/manifest.json is regenerated from the folder by the existing scripts/gen-image-manifest.mjs prebuild step. Skips any basename that exists under more than one extension in the folder (e.g. both 1.png and 1.jpg -- 134 such collisions; converting one could silently shadow or collide with the other, and DB-authored WordPress-imported article HTML can reference either by exact original filename via resolveMigratedImage), and skips any source with real alpha transparency (JPEG has none, flattening would visibly change the image). 75 of 1253 files qualified and converted cleanly: 56.4MB -> 6.5MB. Folder total: 167MB -> 117MB.',
      'Format choice, pre-merge correction: the first cut targeted WebP (quality 82), which shrank the same 103 unambiguous files from 63.9MB to 5.1MB -- a better ratio than JPEG -- but broke the production build. lib/og.tsx\'s Open Graph card renderer (Satori/resvg, via next/og) embeds these same treatment/journal images directly as data-URI <img> tags, and that renderer cannot decode WebP raster images: prerendering /laser-hair-removal/opengraph-image failed with "TypeError: u2 is not iterable". JPEG is supported by both next/image and next/og, so it is the only format a batch pass can safely target without knowing in advance which files a future OG card will reference. All WebP output was discarded and the batch re-run as JPEG.',
      'Every converted filename\'s extension change is propagated to import/slug-image-map.json (2 entries), the hardcoded articleMap in lib/treatment-images.ts (1 entry) and the inline Article.image in lib/articles.ts (1 entry) by the script itself, so no explicit reference breaks. lib/treatment-images.ts#resolve() also has a basename-only fallback (used only when the exact filename isn\'t found, and only for basenames that map to exactly one present file) so DB-authored WordPress article content -- which still cites the pre-conversion filename via resolveMigratedImage and can\'t be edited from a build script -- keeps resolving to the recompressed file.',
      'Pre-merge review (PR #1788): the basename fallback described above was missing from lib/treatment-images.ts (only the one-line articleMap edit had landed) and lib/articles.ts still named Laser-Hair-Removal-1-1.png, so it was added/fixed on the branch, together with three hardening changes to the script -- it now also rewrites lib/articles.ts, writes converted output via a temp file (writing dest then unlinking src deletes the output when a source and its destination differ only in extension case, as on macOS), and requires an in-place re-encode to save at least 10% so re-runs stop pushing already-optimised JPEGs through another generation of lossy encoding.',
      'Pre-merge verification: all 88 changed images were diffed against their pre-conversion originals -- max mean absolute greyscale difference 1.12/255 (visually identical), dimensions preserved except four 2401px sources capped to 2400, all sources sRGB with no ICC profile, no non-default EXIF orientation, none grew. All 28 converted sources that carried an alpha channel were fully opaque (0.000% non-opaque pixels), and every file skipped for transparency has 2.3-75% fully transparent pixels, so nothing was flattened. A crawl of all 179 sitemap URLs plus 129 journal posts found exactly two live references to converted files (Laser-Hair-Removal-1-1.png, Anti-Cellulite-Programs.png), both covered by the map rewrites, and zero unresolved wp-content image URLs.',
      'Verified: npx tsc --noEmit and DATABASE_URL_UNPOOLED= DATABASE_URL= POSTGRES_URL_NON_POOLING= POSTGRES_PRISMA_URL= POSTGRES_URL= npm run build both pass clean, including /laser-hair-removal/opengraph-image and the rest of the OG-image route manifest that failed under the WebP attempt.',
      'Closed 13 Aug: confirmed merged to main (PR #1788, sha 2e864ee...) via a prior run; this board row was left at IN_REVIEW and never flipped.',
    ],
  },
  {
    title: 'NPS detractor comments strip client/booking identity, blocking follow-up (BLD-1305)',
    type: 'TASK', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude', pr: PR(1789),
    value: 7, effort: 2,
    detail: 'lib/nps.ts npsSummary() built the comments array shown at /admin/nps as {score, comment, treatment, at} only, dropping the clientId/bookingId that NpsResponse actually stores, so negative written feedback from real clients (detractor scores) could not be traced back to the client for follow-up.',
    notes: [
      'Fix: npsSummary() now selects clientId, bookingId and the related client\'s first/last name alongside the existing fields, and returns them on each comment row. /admin/nps shows the client name, linked to /admin/clients/[id], on each comment. clientId can be null on an anonymised/deleted client (schema onDelete: SetNull), in which case the name shows unlinked.',
      'Review correction (pre-merge): the first cut gated only the LINK on clients.view and fell through to rendering the client\'s name as plain text without it. The name is the PII, not the anchor. /admin/nps is reachable on reviews.manage alone -- no default role holds reviews.manage without clients.view, but a custom permGrant/permRevoke pair can produce exactly that, and such a viewer cannot act on the follow-up anyway. Both branches are now gated on clients.view together.',
      'Checked for wider exposure: npsSummary() has exactly one consumer (app/admin/nps/page.tsx, itself gated on reviews.manage) -- it is not reachable from any API route or public page, so the added client fields do not widen any other surface.',
      'Verified: npx tsc --noEmit and DATABASE_URL_UNPOOLED= DATABASE_URL= POSTGRES_URL_NON_POOLING= POSTGRES_PRISMA_URL= POSTGRES_URL= npm run build both pass clean.',
    ],
  },
  {
    title: 'Staff creation lets a non-owner self-escalate to ADMIN via the role field; a 2FA-enrollment-pending session could call any permitted admin API route (BLD-1303, BLD-1306)',
    type: 'ERROR', urgency: 'P0', status: 'IN_REVIEW', assignee: 'claude',
    value: 9, effort: 3,
    detail: 'Two independent auth gaps found together in the audit. BLD-1303: the "Create new" branch of app/api/admin/staff/route.ts only blocked role: \'OWNER\' for a non-owner actor -- the privilege-escalation clamp (clampGrant) applies only to permGrant/permRevoke, never to role -- so a non-owner holding only staff.manage (e.g. a FRONT_DESK delegate) could POST {role: \'ADMIN\'} and create a brand-new account with near-total permissions (clinical records, client export/delete, finance) that the actor itself never held. The update path (~L108) already required actor.role === \'OWNER\' to change a role; creation never mirrored it. BLD-1306: all three login paths (password, passkey, Google SSO) mint a needsSetup: true session when 2FA is required but not yet enrolled. middleware.ts confines that session to the /admin/profile *page* for navigation only -- getSession()/requirePermission() in lib/auth.ts never checked needsSetup, and none of the ~143 /admin API route handlers did either, so a user who had just entered a valid password (or completed passkey/SSO) but not yet enrolled TOTP could call any permitted /api/admin/* endpoint directly, bypassing only the page redirect.',
    notes: [
      'Fix (BLD-1303): app/api/admin/staff/route.ts\'s create branch now applies, at role level, the same rule clampGrant (~L35) already applies at permission level -- you may not create an account that can do something you cannot. A non-OWNER actor may only create a role whose roleDefaults() set is a subset of their own effectivePermissions(), and may never create an OWNER regardless. permGrant/permRevoke stay clamped by clampGrant as before.',
      'Review correction (pre-merge, BLD-1303): the first cut of this gate was `role !== actor.role && actor.role !== \'OWNER\'` -- exact-peer-only. That does close the escalation hole, but it also breaks the legitimate delegation flow it was supposed to leave alone: an OWNER grants staff.manage to a practice manager precisely so they can onboard new staff, and exact-peer-only means an ADMIN delegate can create ONLY other ADMINs (and a FRONT_DESK delegate only other FRONT_DESK accounts) -- so routine onboarding of a receptionist or practitioner 403s, and the single role such a delegate is still allowed to mint is the highest non-owner one. components/admin/StaffManager.tsx (~L206) still offers every non-OWNER role in the dropdown to a non-owner, so this surfaced as a dead-end 403 in the UI with no explanation. Replaced with the subset test above: ADMIN -> PRACTITIONER/FRONT_DESK/STAFF all pass (strict subsets of ADMIN), FRONT_DESK -> ADMIN still 403s. Deliberately not a role ranking -- the roles are not totally ordered (PRACTITIONER holds clients.clinical.view that FRONT_DESK lacks; FRONT_DESK holds bookings.charge/schedule.manage that PRACTITIONER lacks), so a rank would let a FRONT_DESK delegate mint a PRACTITIONER and hand out clinical access it never had. The subset test errs only toward refusing (e.g. a FRONT_DESK delegate cannot create STAFF, because STAFF carries timetracking.use and FRONT_DESK does not) -- a false refusal is recoverable, a false grant is not.',
      'Fix (BLD-1306): lib/auth.ts\'s getSession() -- the single choke point nearly every /admin API route already calls, either directly or via requirePermission()/sessionCan() -- now takes an allowPendingSetup argument (default false) and returns null for a needsSetup: true session unless the caller opts in with getSession(true). Since requirePermission() and every direct sessionCan(session, key) caller (~39 route files that check a permission without going through requirePermission) both start from getSession(), this closes the gap centrally instead of patching route handlers individually. Session identity for a pending-setup user is still real (JWT verified, account active, epoch matches) -- only the "permitted API route" surface is cut off, matching the page-level confinement middleware.ts already enforces.',
      'Three call sites explicitly opt in with getSession(true) because they must keep working for a pending session: app/api/admin/2fa/route.ts (the 2FA-setup endpoint itself -- begin/confirm/disable), app/admin/profile/page.tsx (the one page middleware routes a pending session to, so it can render the "set up 2FA" prompt and know who it is), and app/api/admin/session/route.ts\'s signOutEverywhere op (a pure session-termination control -- it only ever revokes access, never grants it -- so it stays reachable exactly like /api/admin/logout, which needs no session at all). Every other consumer -- whoami, status, notifications, team-chat, exports, integrations, etc. -- now correctly 401s for a pending session, which is the intended fix: "any permitted API route" was the actual bug.',
      'Deliberately left blocked rather than special-cased further: app/api/admin/profile/route.ts\'s updateProfile/changePassword ops (the ProfileEditor form rendered on the same confinement page) and the OWNER-only passkey-registration endpoints also rendered there. The finding scopes the carve-out to "the 2FA-setup and logout endpoints"; these are neither, so a pending session gets a 401 from them until enrolment completes -- a narrower, more defensible allow-list than guessing at every UI affordance the page happens to render. Neither is a lockout: enrolling 2FA takes seconds and re-issues a full session, after which both work normally.',
      'Review correction (pre-merge, BLD-1306): app/admin/profile/page.tsx rendered ProfileEditor (and, for an OWNER, PasskeyManager) above the 2FA card, so a pending user\'s first sight of their confinement page was two forms that now answer "Not signed in." on submit -- on a page they are visibly signed in to. Both are now hidden while session.needsSetup is true, leaving the enrolment card as the one actionable thing on the page. Nothing else on the shell breaks: AdminShell\'s /api/admin/badges poll, NotificationBell and TeamChatProvider all already swallow a non-ok response and degrade to zero counts, sessionPermissions() returns [] so the sidebar renders empty (correct -- the session may not reach those pages anyway), and sign-out still works because /api/admin/logout takes no session at all.',
      'Walked the real pending-2FA journey end to end against the code: login (password/passkey/SSO) mints needsSetup -> middleware redirects every /admin path to /admin/profile?setup2fa=1 -> the page loads via getSession(true) -> TwoFactorSetup posts begin then confirm to /api/admin/2fa (getSession(true)) -> confirm calls createSession() WITHOUT needsSetup, clearing the gate -> the next request is a full session. No step in that chain depends on a route that now 401s. Also confirmed the change cannot touch non-staff sessions: getClientSession()/getAcademySession() are separate functions on separate cookies and secrets, and neither reads needsSetup.',
      'Verified: npx tsc --noEmit and DATABASE_URL_UNPOOLED= DATABASE_URL= POSTGRES_URL_NON_POOLING= POSTGRES_PRISMA_URL= POSTGRES_URL= npm run build both pass clean.',
    ],
  },
  {
    title: 'Kiosk AI-analysis flow fails on photo upload / sessions stick at ACTIVE — Blob store is provisioned public-only (BLD-1304) [BLOCKED: owner must re-provision the Blob store]',
    type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 9, effort: 2, needs: 'OWNER',
    ask: 'The kiosk AI photo feature cannot work until you change one storage setting. Code alone cannot fix it. 1) Go to vercel.com and sign in. 2) Click the team named KAUL, then click the project named k-clinics. 3) Click the Storage tab along the top. 4) Click the Blob store shown in the list. 5) Check its access setting -- right now the store is public, and kiosk photos are only allowed to be saved privately. 6) A Blob store\'s access tier is fixed when it is created, so if there is no option to switch it to private, click Storage -> Create -> Blob instead, choose Private access, and connect the new store to the k-clinics project. That replaces the BLOB_READ_WRITE_TOKEN variable for you -- do not edit any environment variable by hand, and leave every other variable alone. 7) Redeploy the project (Deployments tab -> the three dots on the newest deployment -> Redeploy). Done when: someone can scan the kiosk QR code, take a photo, and see a result card, and the "kiosk photo upload disabled" alerts stop arriving in Sentry. Until this is done the kiosk politely tells visitors "Photo analysis is temporarily unavailable. Please ask a member of staff." -- that is deliberate: the alternative was storing visitors\' face photos on public, unauthenticated URLs, which reverses the privacy decision made in BLD-798 and is not something to change without your say-so.',
    detail: 'Reproduced live: node scripts/visual-qa.mjs against https://kclinics.co.uk found the kiosk photo upload (POST /api/kiosk/sessions/[token]/photo) returning 500, so the session never got a photoUrl, analysis was never kicked off, and the session sat at ACTIVE forever (the client\'s 90s poll timeout in components/kiosk/KioskSessionFlow.tsx degrades gracefully, but the underlying upload never succeeds). Vercel runtime error logs (mcp__Vercel__get_runtime_errors) pinpointed the exact throw: "[kiosk] blob upload failed: Vercel Blob: Cannot use private access on a public store. The store must be configured with private access." -- the single Blob store connected to this project (BLOB_READ_WRITE_TOKEN) is provisioned public-only, but both kiosk upload routes call put(..., { access: \'private\' }) unconditionally (BLD-798 moved kiosk selfies to private storage), so every upload threw before a photo was ever stored. This is a store-provisioning mismatch, not a recent code regression -- lib/kiosk.ts\'s BLD-1260 fail-closed IP-salt change (the other recent kiosk-adjacent fix) was checked and is unrelated; it derives cleanly from HEALTH_ENCRYPTION_KEY/ADMIN_JWT_SECRET in production and never throws on this path.',
    notes: [
      'Fix (partial, code side): added putKioskBlob() to lib/kiosk-blob.ts as the single upload choke point for both kiosk routes. It uploads with access: \'private\' and, on this exact "private access on a public store" error, throws a distinct KioskBlobStorePublicOnlyError. app/api/kiosk/sessions/[token]/photo/route.ts and .../photos/route.ts catch that specific error and return 503 with "Photo analysis is temporarily unavailable. Please ask a member of staff." (the kiosk client renders the message verbatim) plus a fatal Sentry event tagged cause: blob-store-public-only, ref: BLD-1304. Every other upload failure keeps its existing generic 500. Once the store is private, putKioskBlob() succeeds and none of this fires.',
      'Review decision (13 Aug, pre-merge) -- the build agent\'s original fix fell back to put(..., { access: \'public\' }) on this error so the feature would work again tonight. That was rejected at the review gate and replaced with the fail-loud path above. Reasons: (1) BLD-798 moved kiosk selfies to private storage precisely because they "were public, unauthenticated URLs viewable by anyone for 30 days" (photo-view/route.ts\'s own comment) -- a public fallback recreates exactly the state that ticket was raised to fix, on biometric photos of real visitors. (2) The fallback\'s stated mitigation, that the pathname embeds a high-entropy session token, does not hold: randomToken(10) is ~50 bits and lib/kiosk.ts calls this same token "short, brute-forceable", which is why BLD-1052 made the read relay require the paired 166-bit secret AND rate-limit it; a raw public blob URL has no secret, no rate limit, no expiry check and no revocation, so it sits strictly below the bar an earlier board item already set for reading the same image. The token is also displayed in-clinic as a QR/URL on the kiosk screen, so it is not a secret. (3) There is no urgency that would justify the trade: the Vercel runtime logs show exactly two failed uploads in seven days, both from the visual-QA harness\'s own test sessions (tokens q59mzxg6gj and vsk92nbed4, followed by /api/kiosk/test-cleanup) -- no genuine visitor traffic was affected. Reversing a deliberate privacy decision on biometric data is an owner call, and a privacy regression cannot be un-shipped, so the feature stays honestly broken until the store is re-provisioned.',
      'Same access:\'private\' put() pattern also exists in lib/portfolio-blob.ts (BLD-740, academy trainee portfolio photos) and fails the same way against this store, so academy portfolio uploads are almost certainly broken live too. Left unfixed here (outside this ticket\'s scope) -- the same store re-provisioning fixes both; worth its own ticket if it is not covered by that.',
      'Verified: npx tsc --noEmit and DATABASE_URL_UNPOOLED= DATABASE_URL= POSTGRES_URL_NON_POOLING= POSTGRES_PRISMA_URL= POSTGRES_URL= npm run build both pass clean.',
    ],
  },
  {
    title: 'Accessibility/security hardening batch: intake questionnaire labels, llms.txt dentistry gate, 2FA rate limit, admin focus indicators (PRJ-1118.2, PRJ-1118.5, PRJ-1118.6, PRJ-1118.7)',
    type: 'ERROR', urgency: 'P0', status: 'SHIPPED', assignee: 'claude', pr: PR(1793),
    value: 8, effort: 2,
    detail: 'Four small, independent findings from the 2026-08-14 audit, batched into one PR. PRJ-1118.2: components/portal/AssessmentRunner.tsx renders longtext/date/text intake questions with only a placeholder -- no accessible name, so a screen-reader user filling out the clinical questionnaire hears only "text field". PRJ-1118.5: app/llms.txt/route.ts listed every dentistry treatment unconditionally, never checking the dentistryLive flag every other surface gates on, so an AI answer engine would tell users a GDC-regulated service is bookable before launch. PRJ-1118.6: the 2FA enrolment confirm op (POST /api/admin/2fa) had no rate limit, unlike the sibling disable op (BLD-875), for the identical brute-force risk. PRJ-1118.7: PriceOverride.tsx, SessionRunner.tsx (checkout charge amount) and BrandKitManager.tsx set outline-none on bare inputs with no focus replacement -- keyboard focus was invisible on the exact fields staff use to key in a payment amount.',
    notes: [
      'Fix (PRJ-1118.2): gave the question h2 an id (q-${current.id}) in AssessmentRunner.tsx and wired aria-labelledby to it on the longtext/date/text Field() inputs, so a screen reader announces the actual question text.',
      'Fix (PRJ-1118.5): app/llms.txt/route.ts now gates the Dentistry section on site.dentistryLive, matching every other consumer of that flag (treatment pages, /dentistry hub, JSON-LD) -- when not live it points readers at the /dentistry page to register interest instead of listing bookable treatments.',
      'Fix (PRJ-1118.6): app/api/admin/2fa/route.ts\'s confirm op now calls the same enforceRateLimit wrapper the disable op already uses (8 attempts / 300s, admin scope, key twofa-confirm), closing the brute-force gap on the enrolment code check.',
      'Fix (PRJ-1118.7): added the repo\'s existing focus-visible:ring-2 focus-visible:ring-[var(--color-gold)] convention (already used elsewhere, e.g. components/portal/ReferralCard.tsx) to the bare outline-none inputs in PriceOverride.tsx, SessionRunner.tsx and BrandKitManager.tsx.',
      'Verified: npx tsc --noEmit and DATABASE_URL_UNPOOLED= DATABASE_URL= POSTGRES_URL_NON_POOLING= POSTGRES_PRISMA_URL= POSTGRES_URL= npm run build both pass clean.',
    ],
  },
  {
    title: 'Gift voucher stranded on NO_SHOW; job-application CVs and homework files orphaned in Blob storage after deletion/erasure (PRJ-1118.12, BLD-1309)',
    type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 6, effort: 2,
    detail: 'Two independent correctness/reliability findings from the 2026-08-13/14 audits, batched into one PR. PRJ-1118.12: the voucher reservation made at booking time (app/api/admin/bookings/session/route.ts) was only released by cancelBooking() (guarded on !booking.chargedAt); setBookingStatus(\'NO_SHOW\') never touched giftVoucherPence/giftVoucherCode, so a no-show with a partial voucher applied permanently lost that balance -- not returned to the client, not recorded as clinic revenue either. BLD-1309: app/api/cron/daily/route.ts\'s GDPR retention sweep deletes JobApplication rows but never called Blob del() on cvUrl, and eraseStudentData (app/admin/actions.ts) cleared HomeworkSubmission.files without deleting the underlying Blob URLs first -- candidate CVs (name, history, sometimes health disclosures in cover notes) and trainee homework files persisted indefinitely in third-party storage after the referencing record was gone or erased.',
    notes: [
      'Fix (PRJ-1118.12): app/admin/bookings/actions.ts\'s setBookingStatus() NO_SHOW branch now releases a reserved-but-unconsumed gift-voucher application, mirroring cancelBooking()\'s BLD-882 guard exactly -- discriminated on chargedAt (a booking already charged before the no-show consumed its voucher as part of that settled sale; that case is a refund decision, not automatic) and re-credited via creditVoucher with a REWARD_REDEEMED audit entry.',
      'Fix (BLD-1309, job applications): app/api/cron/daily/route.ts now shortlists the cvUrl of every JobApplication row about to be purged by the existing 6/12-month retention sweep, then calls Vercel Blob del() on those URLs AFTER the deleteMany has run -- and only for URLs no surviving row still references, so a failed purge (or a row an admin moved out of the purge set mid-run) can never be left pointing at a CV that no longer downloads. Deletes are chunked for the first-run backlog. Best-effort: a Blob delete failure is logged and does not block the DB purge.',
      'Fix (BLD-1309, academy homework): app/admin/actions.ts\'s eraseStudentData() now captures every affected HomeworkSubmission.files URL before the erasure transaction clears the column, and deletes them from Blob storage once the transaction commits -- same best-effort, non-blocking pattern.',
      'Verified: npx tsc --noEmit and DATABASE_URL_UNPOOLED= DATABASE_URL= POSTGRES_URL_NON_POOLING= POSTGRES_PRISMA_URL= POSTGRES_URL= npm run build both pass clean.',
    ],
  },
  {
    title: 'Kiosk card typesets the brand name as text, admin profile skips a heading level, gallery image API fetches both blobs to serve one, kiosk-cleanup cron has no heartbeat (BLD-1312, PRJ-1118.3, PRJ-1118.1, BLD-1272)',
    type: 'ERROR', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 5, effort: 2,
    detail: 'Four small, independent findings batched into one PR. BLD-1312: app/api/kiosk/results/[id]/card/route.tsx (the Instagram-native 4:5 kiosk share card, the highest-exposure external branded asset in the product) rendered "K CLINICS -- ISLINGTON, LONDON" as typed uppercase Geist text instead of the real K monogram + CLINICS wordmark, breaking the CLAUDE.md brand rule that forbids typesetting the brand name as text to emulate the logo -- lib/og.tsx already does this correctly via the base64 mark/wordmark assets. PRJ-1118.3: app/admin/profile/page.tsx went h1 -> h3 ("Sessions") with the only h2 ("My performance") appearing later inside a conditional block, breaking the document outline for screen readers. PRJ-1118.1: app/api/gallery/[id]/[side]/route.ts\'s findUnique had no select, so every request pulled both beforeImage and afterImage BYTEA columns out of Postgres even though the handler only ever returns one side. BLD-1272: app/api/cron/kiosk-cleanup/route.ts (the daily GDPR purge of visitor selfie photos) wrote no heartbeat, unlike cron/daily and cron/dispatch, so a silently-unfiring purge -- a PII retention breach -- went undetected with no alert.',
    notes: [
      'Fix (BLD-1312): imported K_MARK_LIGHT_B64/K_WORDMARK_LIGHT_B64 from lib/brand-email-assets.ts (the same porcelain-on-dark variant lib/og.tsx already uses, which matches this card\'s dark INK background) and replaced the typed brand-name line with the real mark + wordmark <img> lockup, same Satori/ImageResponse pattern as lib/og.tsx. "Islington, London" is location copy, not the brand name, so it stays as text underneath the marks.',
      'Fix (PRJ-1118.3): changed the "Sessions" heading from h3 to h2. Checked its subtree (SignOutEverywhere.tsx) for descendant headings to demote -- it has none, so no further shift was needed; the resulting outline is h1 -> h2 Sessions -> h2 My performance -> h3 Points breakdown / Recent activity, no gap.',
      'Fix (PRJ-1118.1): app/api/gallery/[id]/[side]/route.ts now branches on the validated side param before querying, each branch selecting only published, consent and that side\'s image + mime columns (beforeImage/beforeType or afterImage/afterType) -- the unrequested side\'s blob is never read out of Postgres.',
      'Fix (BLD-1272): app/api/cron/kiosk-cleanup/route.ts now upserts a cron_kiosk_cleanup_last Setting row on every successful run, mirroring exactly how cron_daily_last and cron_dispatch_last are written. lib/api-health.ts\'s getCronStaleness() reads it alongside the other two heartbeats (26h max age, consistent with the daily-cadence cron_daily_last check) and folds it into checkCron()\'s traffic light and detail line; app/api/health/route.ts\'s report.cron now also carries kioskCleanupLastRun/kioskCleanupOk and factors it into the overall staleness alert the same way the existing two heartbeats already do.',
      'Review pass (BLD-1272): folding the new heartbeat into the alert flag exactly like the other two would have paged for up to a day after this deploy. cron_daily_last and cron_dispatch_last already exist in production, so their "row missing" case never happens; cron_kiosk_cleanup_last does not exist until the first 03:30 run, and /api/health turns a stale flag into a 503 plus a Sentry error and an ops-webhook message every five minutes with no dedupe watermark. getCronStaleness now counts the kiosk heartbeat as stale only once it has been written at least once -- a never-written heartbeat still reports kioskCleanupOk false and shows amber with "kiosk cleanup never" on /admin/api-health and /admin/status, but does not fire the pager. After the first run it behaves identically to the other two.',
      'Verified: npx tsc --noEmit and npm run build both pass clean (DB sync skipped, no DATABASE_URL in this sandbox).',
    ],
  },
  {
    title: 'Session replay captures shop checkout PII unmasked; no DSAR/export path for Academy students (BLD-1314, BLD-1311)',
    type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 2,
    detail: 'Two independent, non-owner-gated privacy/GDPR findings from the Build board, batched into one PR. BLD-1314: components/marketing/BehaviorRecorder.tsx excludes /admin, /account, /book and /booking from rrweb session-replay capture (personal data entered there) but never added /shop -- the shop checkout (components/shop/CheckoutForm.tsx) collects name, email, phone, full address and DOB. maskAllInputs: true masks input values but not text rendered to the page, and no kc-mask class was applied anywhere in the checkout flow, so any PII echoed as page text on a recorded shop route would have been captured into stored replays. Already flagged as a MEDIUM finding in audit/08-frontend-xss.md. BLD-1311: eraseStudentData (app/admin/actions.ts) implements GDPR Art.17 erasure for academy trainees, but no equivalent Art.15 subject-access export existed for a trainee\'s own data -- only the client-side SAR export (/api/admin/clients/[id]/export) existed.',
    notes: [
      'Fix (BLD-1314): added /shop to the recorder\'s exclusion regex in components/marketing/BehaviorRecorder.tsx -- now /^\\/(admin|account|book|booking|shop)(\\/|$)/ -- so the recorder never starts on any /shop route (cart, checkout, confirmation). Simpler and more robust than hunting for every PII text node, per the regex already excluding whole route trees the same way for booking/account. Updated audit/08-frontend-xss.md to mark the finding resolved with a one-line note (both the summary bullet and the full write-up).',
      'Fix (BLD-1311): added GET /api/admin/academy/students/[id]/export, mirroring /api/admin/clients/[id]/export\'s structure (auth check, rate limit, DATA_EXPORTED audit log via logAudit, JSON attachment response). Gated on settings.manage -- the same permission eraseStudentData and every other academy admin write endpoint (app/api/admin/academy/route.ts, .../homework/route.ts) already require. Exports the same data surface eraseStudentData touches or anonymises: the student record (minus passwordHash/resetTokenHash/resetTokenExp), enrolments, funding applications, lesson progress/playback/notes/comments, course reviews, flashcard reviews, forum threads/posts, portfolio entries, exercise/demo/quiz/practice attempts, quiz attempt grants, point events, badges, daily activity and homework submissions. Admin-only endpoint -- no student-facing self-service export UI built, matching the ticket\'s scope.',
      'Review pass: the funding-application query matched only studentId, so pre-account enquiries (studentId still null, matched by email) were missing from the export even though eraseStudentData redacts exactly those rows as the same subject. The export now matches on studentId OR the original email, case-insensitively, so the Art. 15 export and the Art. 17 erasure cover the same records.',
      'Verified: npx tsc --noEmit and DATABASE_URL_UNPOOLED= DATABASE_URL= POSTGRES_URL_NON_POOLING= POSTGRES_PRISMA_URL= POSTGRES_URL= npm run build both pass clean.',
    ],
  },
  {
    title: 'Shop/gift-voucher/academy checkouts fire no begin_checkout pixel; shop product pages fire no view_item pixel (BLD-1310, BLD-1293)',
    type: 'TASK', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 5, effort: 2,
    detail: 'Two independent conversion-tracking gaps. BLD-1310: components/booking/BookingFlow.tsx fires GA4 begin_checkout (on the time-to-upsell step) and Meta InitiateCheckout (on reaching the Stripe payment step) via raw window.gtag/window.fbq calls -- the three other Stripe checkout surfaces had no equivalent, only a final trackPurchase() on success, so ad platforms never saw a checkout-start event for shop orders, gift vouchers or academy course payments, undercounting funnel drop-off and starving retargeting/lookalike audiences of that signal. BLD-1293: app/(marketing)/[slug]/page.tsx renders <ViewItemTracker> on every treatment detail page (GA4 view_item + Meta ViewContent, lib/analytics-events.ts trackViewItem, consent-gated); app/(marketing)/shop/[slug]/page.tsx has full Product JSON-LD but never rendered the tracker, so shop product-detail views were invisible to both platforms despite the component already existing and being one prop away.',
    notes: [
      'Fix (BLD-1310): added the same raw gtag(\'event\', \'begin_checkout\', ...) + fbq(\'track\', \'InitiateCheckout\', ...) pair BookingFlow.tsx uses, fired the moment each flow\'s own clientSecret arrives and its stage moves to the Stripe payment step (never on mount) -- components/shop/CheckoutForm.tsx startCheckout() (value = the server\'s totalPence for the order, items = cart lines with slug/name/qty), components/gift/GiftVoucherFlow.tsx start() (value = voucher amount incl. any physical-card fee, item = the package slug/name or a generic gift-voucher id for an open-amount card), components/academy/EnrolmentCheckout.tsx start() (value = the actual charge amount returned by the server -- full fee or deposit -- item = courseSlug/courseTitle). Not routed through lib/analytics-events.ts: BookingFlow.tsx itself calls gtag/fbq directly for this pair rather than through the ga4()/meta() consent-gated helper, so the new calls mirror that exact existing pattern rather than introducing a second style.',
      'Fix (BLD-1293): added <ViewItemTracker id={p.slug} name={p.name} category="shop" valuePence={p.pricePence} /> to app/(marketing)/shop/[slug]/page.tsx, rendered right after the JsonLd block, matching the treatment page\'s placement and prop shape exactly.',
      'Review pass: three corrections before merge. (1) The shop pixel took its value from the local estTotal (cart subtotal + shipping), which over-reports every gift-card order and any cart the server re-prices, and would not match the purchase event that uses /api/shop/confirm\'s totalPence -- it now uses the totalPence /api/shop/checkout returns, falling back to estTotal only if the field is absent. (2) Shop item ids were productIds while the new view_item tracker on the product page sends slugs, so the two ends of the funnel could not be joined in GA4 or matched to a Meta catalogue -- both now send the slug. (3) The academy payment step has a "Change" button back to the choice screen, so start() can run twice in one visit (deposit then full) and fired begin_checkout each time; it is now guarded by a ref so only the first fires, and its item id is the course slug rather than the per-learner enrolmentId, which was unique on every event.',
      'Verified: npx tsc --noEmit and npm run build both pass clean.',
    ],
  },
  {
    title: 'Meta Purchase events mislabelled as in-store, tracking IDs can go dark with no warning, Treatment Finder skips server-side Lead, homework grading and time-off decisions never notify (BLD-1295, BLD-1254, PRJ-1118.9, BLD-1296, PRJ-1118.8)',
    type: 'ERROR', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 6, effort: 3,
    detail: 'Five independent findings, batched into one PR under a tracking + notifications theme. BLD-1295: lib/conversions.ts metaPurchase() hardcoded actionSource: \'physical_store\' on every server-side Meta CAPI Purchase event, but every sendPurchase() call site (bookings, shop, gift vouchers, academy course fees) is a website checkout -- there is no in-clinic point-of-sale flow at all -- so every server-side Purchase was misattributed away from the website channel that actually drove it, undermining Meta\'s ROAS/attribution model. BLD-1254: lib/tracking.ts\'s getTrackingConfig() falls back to a hardcoded default Meta Pixel ID, but GA4 and Google Ads IDs have no such floor, and the class of risk (every ad-tracking provider ID cleared, e.g. via Admin -> SEO -> "Tracking & pixels") had no operator-visible signal beyond a per-field dot on that one settings page -- nobody looks at it unless they already suspect a problem. PRJ-1118.9: components/finder/TreatmentFinder.tsx\'s "Email me my results" step fired the browser-side trackLead() pixel but /api/finder-lead never called sendLead(), so the Treatment Finder -- one of the site\'s primary lead-gen surfaces -- never produced a server-side CAPI/GA4 Lead conversion, unlike ConsultForm, EnquiryForm and GroupBookingForm which all pair a browser Lead with a deduped server-side one. BLD-1296: app/api/admin/academy/homework/route.ts sets a HomeworkSubmission\'s status/feedback when a tutor grades it but never notified the student -- unlike notifyStudentReply() (lib/lms.ts), which already emails a student when a trainer answers their lesson question. PRJ-1118.8: app/api/admin/time-off/route.ts\'s approve/decline branch updates the StaffTimeOff row and logs an audit event but never told the requesting staff member the outcome -- the sibling "request" branch already pings approvers via notifyStaffByPermission, so the notification plumbing existed on one side of the flow only.',
    notes: [
      'Fix (BLD-1295): removed the actionSource: \'physical_store\' override in metaPurchase() so it falls through to metaEvent()\'s existing website default -- the same default every other CAPI event in the file (Lead, Schedule) already relies on, and the only one the browser Pixel has any concept of. Updated the misleading comment above metaEvent() that had described physical_store as real in-clinic behaviour.',
      'Fix (BLD-1254): added a checkTracking() probe to lib/api-health.ts\'s Marketing category (the traffic-light /admin/api-health page, linked from /admin/status), following the exact precedent already set by checkTwilio() there -- amber, not grey, on total blackout ("staff could otherwise assume [it]\'s going out" is the Twilio comment; here it\'s "no ad-tracking IDs configured -- GA4, Google Ads and the Meta Pixel are ALL off"). Reuses lib/tracking.ts\'s existing getTrackingConfig()/hasAnyTracking() rather than re-deriving config. A normal partial config (e.g. no Google Ads yet) stays green -- only a full loss of all three providers raises the warning, keeping the signal proportional and low-noise. No new alerting subsystem: this rides the health page + amber convention that already exists for exactly this class of "silently misconfigured" issue.',
      'Fix (PRJ-1118.9): mirrored the PRJ-1060.9 GroupBookingForm pattern exactly. app/api/finder-lead/route.ts now accepts an optional client-generated eventId, calls sendLead() (consent parsed from the request\'s cookie header via consentFromCookieHeader, same as /api/consult) after the results email sends, and echoes the eventId back. TreatmentFinder.tsx generates a crypto.randomUUID() eventId before the fetch and passes it to trackLead() alongside the server-echoed id, so the browser Lead pixel and the server-side CAPI/GA4 Lead de-duplicate on the same event id. No email is forwarded to Meta\'s advanced matching -- this form\'s consent line covers only the results send, not marketing, unlike ConsultForm which gates email on an explicit marketingOptIn field that Treatment Finder never collects.',
      'Fix (BLD-1296): added notifyHomeworkGraded(submissionId) to lib/lms.ts, structurally identical to notifyStudentReply() -- same emailShell template, same best-effort try/catch, same fire-and-forget call convention (const { fn } = await import(\'@/lib/lms\'); fn(id).catch(() => {});) already used at its call site in app/api/admin/lms/route.ts. Distinguishes APPROVED / NEEDS_REVISION / REVIEWED with outcome-specific subject and copy, includes the tutor\'s feedback text when present, and skips SUBMITTED (the pre-grade state) so re-saving without changing status never re-notifies. Wired into app/api/admin/academy/homework/route.ts right after the status update.',
      'Fix (PRJ-1118.8): app/api/admin/time-off/route.ts\'s approve/decline branch now calls notifyStaffById(row.staffId, {...}, session.sub) after the status update and audit log -- the same lib/notifications.ts mechanism (in-app + email per the recipient\'s own prefs) the request branch already uses via notifyStaffByPermission, just targeted at the specific requester by id rather than broadcast to everyone holding schedule.manage. Title states the outcome plainly ("Your time-off request was approved" / "...was declined"); body includes the kind, date range and the manager\'s review note when one was given.',
      'Verified: npx tsc --noEmit and npm run build both pass clean.',
    ],
  },
  {
    title: 'Google Places rating fetch and ops-alert webhook fetch had no timeout; ~14 API catch blocks swallowed errors with no logging (BLD-1313, PRJ-1118.10, BLD-1257)',
    type: 'ERROR', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 4, effort: 2,
    detail: 'Three small, independent reliability findings batched into one PR. BLD-1313: lib/reviews-aggregate.ts\'s googlePlacesSource() (the live Google Places fallback used when no review history has been imported yet) called fetch() against maps.googleapis.com with no timeout, so a hung/slow upstream could stall the homepage rating widget indefinitely instead of falling through to the honest no-Google-source state. PRJ-1118.10: the ops-alert webhook POST (CRON_ALERT_WEBHOOK_URL) is duplicated at four call sites -- app/api/health/route.ts, app/api/cron/daily/route.ts, app/api/cron/dispatch/route.ts, app/api/cron/kiosk-cleanup/route.ts -- and none of the four bounded the fetch, so a hung Slack/Discord/Make endpoint could stall the exact requests (the health probe Vercel Cron polls, and the daily/dispatch/kiosk-cleanup runners) that exist to catch outages. BLD-1257: an audit sweep of app/api/**/*.ts found 14 catch blocks that return a generic 500 with no console.error (or any other log) first, so the underlying exception left no trace in Vercel logs -- only the generic client-facing message survived.',
    notes: [
      'Fix (BLD-1313): added signal: AbortSignal.timeout(8_000) to the maps.googleapis.com/maps/api/place/details fetch in lib/reviews-aggregate.ts. The existing catch already returns null on any failure (network error, non-OK response, or now a timeout), which the caller (_getReviewAggregate) already treats as "no Google source" -- internal reviews and any already-imported Google history are unaffected, no new fallback path needed.',
      'Fix (PRJ-1118.10): added the same signal: AbortSignal.timeout(8_000) to the ops-webhook fetch at all four call sites, matching the AbortSignal.timeout(N) pattern already used throughout lib/ (lib/api-health.ts, lib/xero.ts, lib/google-business.ts, etc.) rather than introducing a new shared helper -- no fetchWithTimeout utility exists in this repo; every external call bounds itself inline the same way. Each site\'s existing try/catch already swallows the send failure as non-fatal (an alert is best-effort by design), so a timeout now behaves exactly like any other delivery failure.',
      'Fix (BLD-1257): added a console.error(\'[route-tag] <action> failed\', e) line immediately before the return in each of the 14 catch blocks, matching the majority convention already used elsewhere in app/api (bracketed route tag, past-tense action, the raw error object, e.g. \'[badges] failed\', \'[compliance] op failed\'). Two bare catch {} blocks (app/api/admin/rooms/prep/route.ts, both POST branches) were changed to catch (e) {} so the error could be logged -- no other behaviour, response body or status code changed anywhere. Files touched: app/api/admin/facility/route.ts, app/api/admin/rooms/prep/route.ts (x3), app/api/admin/media/route.ts, app/api/admin/preferences/route.ts, app/api/admin/build/upload/route.ts, app/api/admin/bookings/before-photo/[id]/route.ts, app/api/admin/pages/route.ts, app/api/dentistry-interest/route.ts, app/api/booking/intent/route.ts, app/api/account/assessment/route.ts, app/api/build/migrate-wp/route.ts, app/api/newsletter/route.ts.',
      'Verified: npx tsc --noEmit and npm run build both pass clean (DB sync skipped, no DATABASE_URL in this sandbox).',
    ],
  },
  {
    title: 'Checkout screen locks out every payment method (incl. cash) after "Mark completed"; phone-booking flow has no package/course picker (BLD-1249, BLD-1268)',
    type: 'ERROR', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 3,
    detail: 'Two independent owner-reported, user-blocking findings, batched into one PR. BLD-1249: components/admin/session/SessionRunner.tsx\'s CheckoutStep gates every payment button (Charge the saved card, Create a payment link, Take payment on terminal, Record cash, Record as paid via Treatwell) on booking.finishedAt alone, which is normally stamped by the live session\'s "End treatment" step (app/admin/bookings/clinical-actions.ts finishAppointment). But app/admin/bookings/actions.ts\'s setBookingStatus(\'COMPLETED\') -- the plain "Mark completed" button on the ordinary booking detail page (components/admin/BookingActions.tsx), used whenever staff complete a visit outside the full live-session runner -- only ever wrote status, never finishedAt. A booking completed that way stayed COMPLETED with finishedAt permanently null, so every payment button on the checkout screen (cash included) stayed disabled with no way to unstick it -- reported as "click Record cash and nothing happens." BLD-1268: the public /book flow (components/booking/BookingFlow.tsx) lets a client pick a package/course tier (variant.courses, e.g. 1/3/6 sessions, each its own bundle price) via explicit tier buttons once a variant is chosen. The staff "New phone booking" modal (components/admin/NewBookingButton.tsx) already sends variantId + sessions to createManualBooking (app/admin/bookings/create-action.ts), which already prices a matching course tier correctly -- but the modal only offered a blind "number of sessions" text field with no visibility into what packages actually exist or what they cost, because lib/services.ts\'s loadBookingTreatments() (the data source for that modal) stripped each variant\'s courses field entirely before handing it to the client. Staff had no way to see or select a treatment\'s configured packages when booking a caller in.',
    notes: [
      'Fix (BLD-1249): app/admin/bookings/actions.ts\'s setBookingStatus() now stamps finishedAt (and actualMinutes, computed off startedAt when available) the first time a booking is marked COMPLETED from this action, mirroring finishAppointment() exactly -- so the two "this visit is done" paths agree on the one field checkout actually gates on. "Reset to confirmed" (the existing undo for a mis-clicked completion) now also clears finishedAt/actualMinutes, so re-completing later re-derives them instead of leaving stale values from the reset booking. No schema change -- finishedAt/actualMinutes already exist on Booking and are already read this way elsewhere (app/admin/page.tsx\'s "payments to take" widget already filters on finishedAt).',
      'Add (BLD-1249): a "Card Terminal" manual payment method, added alongside Cash and Treatwell in SessionRunner.tsx\'s checkout method picker -- purely a record-keeping option for a standalone card machine that is not wired into Stripe Terminal (distinct from the existing "Terminal" tab, which only appears once a real Stripe Terminal device is registered and actually charges it). Follows the Cash pattern exactly end to end: same op:\'external\' API call with channel:\'card-terminal\' (app/api/admin/bookings/session/route.ts\'s existing generic external-channel handler, no server changes needed beyond the audit-log label), same disabled/busy wiring, same "records the sale, nothing is charged here" copy. The channel is tagged ext_card-terminal on chargePaymentIntentId, so it is automatically excluded from the day-close "card takings" figure (lib/day-close.ts already excludes every ext_* channel, matching how cash is treated) and refunds it exactly like cash (lib/booking-actions.ts\'s refund path is already channel-agnostic on the ext_ prefix).',
      'Fix (BLD-1268): lib/services.ts\'s BookingTreatment type and loadBookingTreatments() now carry each variant\'s courses (session-count/total-price tiers) through to the phone-booking modal -- previously dropped. components/admin/NewBookingButton.tsx now shows a "Single session or a package?" tier picker (Single + one button per configured course, each labelled with its session count and bundle price) whenever the selected variant has configured tiers, setting the same `sessions` value createManualBooking already prices correctly. A treatment/variant with no configured tiers keeps the old plain "number of sessions" field unchanged -- no picker is forced where no packages exist. Sessions resets to 1 whenever the treatment or variant selection changes, so a leftover count from a different variant\'s tier can\'t silently carry over.',
      'Verified: npx tsc --noEmit and npm run build both pass clean (DB sync skipped, no DATABASE_URL in this sandbox).',
    ],
  },
  {
    title: 'Shared Dialog component renders its panel under its own backdrop, unclickable in production (BLD-1362)',
    type: 'ERROR', urgency: 'P0', status: 'IN_REVIEW', assignee: 'claude',
    value: 8, effort: 1,
    detail: 'components/ui/Dialog.tsx rendered the backdrop as fixed inset-0 but left the panel wrapper static (no relative/z-index). A positioned element (the backdrop) paints above a non-positioned sibling regardless of DOM order, so every click inside the panel landed on the backdrop\'s onClick={onClose} instead of the panel content -- confirmed live via elementFromPoint against the deployed CSS. At least two production callers passed no className override and were affected today: components/admin/ReplayList.tsx:135 and components/admin/EditClientDetails.tsx:63 -- any button/input inside those dialogs was unpressable, closeable only via backdrop click or the browser back gesture.',
    notes: [
      'Fix (BLD-1362): the panel wrapper in components/ui/Dialog.tsx now always carries relative z-10, with any caller-supplied className appended rather than replacing the base classes (previously a caller className fully replaced the (empty) base string). Grepped every consumer of Dialog.tsx (20 files) -- only three actually render the <Dialog> component (CampaignComposer.tsx, EditClientDetails.tsx, ReplayList.tsx); the other seventeen only use the headless useDialogBehaviours/useBodyScrollLock hooks and build their own markup, unaffected by this change. Checked all three real callers\' panel markup for conflicting position/z-index/overflow -- none found. Removed the redundant per-caller workaround in CampaignComposer.tsx (className="relative z-10", added locally during the BLD-1352 review since it landed before this shared fix), now redundant with the shared fix applying unconditionally.',
      'Verified: npx tsc --noEmit and npm run build both pass clean.',
    ],
  },
  {
    title: 'Admin login page skipped the strict admin CSP; CallRecord.notes stored in plaintext unlike its sibling fields (BLD-1280, BLD-1360)',
    type: 'ERROR', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 5, effort: 2,
    detail: 'Two independent, non-owner-gated security/privacy findings, batched into one PR. BLD-1280: middleware.ts early-returned for pathname === \'/admin/login\' before the nonce/strict-dynamic CSP block ran, so /admin/login never got the strict per-request-nonce Content-Security-Policy the rest of /admin uses -- it fell through to the public CSP (unsafe-inline, no nonce) on the single highest-value page in the app (credential/2FA entry). The login page\'s own source has no third-party inline scripts that would need an exemption, so this was an oversight, not a deliberate carve-out. BLD-1360: CallRecord.notes (prisma/schema.prisma, a free-text staff note) was written/read as plain text in app/api/admin/calls/route.ts, while every structurally identical field on the same CallRecord model (transcript, recordingUrl, raw) was already wrapped in encClinical/decClinical (lib/yay.ts). A staff note like "client mentioned a reaction to filler last week" sat unencrypted in the database.',
    notes: [
      'Fix (BLD-1280): middleware.ts\'s /admin branch no longer early-returns for /admin/login before the CSP block. It still skips the session-redirect and 2FA-redirect checks for that one path (isLogin short-circuits both -- login IS the page those redirects send an unauthenticated visitor to, so gating it the same way would be a redirect loop), but execution now always reaches the per-request-nonce adminCsp() block, so /admin/login gets the identical strict script-src (nonce + strict-dynamic, no unsafe-inline) every other /admin page gets. Grepped app/admin/login/page.tsx, components/admin/AdminLoginForm.tsx and components/portal/AuthShell.tsx for inline <script>/dangerouslySetInnerHTML -- none found, so no hash/nonce exemption was needed.',
      'Fix (BLD-1360): app/api/admin/calls/route.ts now imports encClinical alongside the existing decClinical import. The \'note\' op\'s update() wraps the incoming text in encClinical(...) before writing CallRecord.notes. Both read sites now decrypt: the \'list\' op\'s row mapper (notes: decClinical(c.notes)) and the \'get\' op\'s response, which previously spread ...c unmodified -- notes: decClinical(c.notes) now overrides the spread, matching the recordingUrl/transcript overrides already on the same line. No schema change and no backfill script: decClinical already tolerates legacy plaintext (tries to decrypt, returns the value as-is on failure per lib/clinical-crypto.ts), so existing plaintext notes rows keep displaying correctly -- only new/updated notes get encrypted going forward. Checked every other read/write of CallRecord.notes (lib/yay.ts ingestCall, app/admin/actions.ts GDPR erasure, the SAR export route) -- none of them read or write actual note content (erasure only nulls it; the export route\'s callRecords select never included notes), so no other call site needed touching.',
      'Verified: npx tsc --noEmit and npm run build both pass clean.',
    ],
  },
  {
    title: 'Gold accent text/icons fail AA contrast on light surfaces across ~35 customer-facing sites; cookie-consent banner clips "Reject non-essential" on mobile (BLD-1274, BLD-1355)',
    type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 6, effort: 3,
    detail: 'Two independent, non-owner-gated brand/accessibility findings from the Build board, batched into one PR. BLD-1274: --color-gold (#a98a6d) was used directly as TEXT/ICON colour on the --color-porcelain/--color-bone light surfaces in dozens of call sites across components/ and app/ (measured ~2.75:1 and ~2.54:1, below the 4.5:1/3:1 AA thresholds) -- app/globals.css already had the correct AA-safe pattern for .eyebrow (swap to --color-gold-deep) but most components never followed it. BLD-1355: on a 375x812 mobile viewport, components/legal/CookieConsent.tsx\'s first-load banner (bottom-3, max-h-[38vh], overflow-y-auto) packed a long policy paragraph above a flex-wrap button row, so "Reject non-essential" wrapped onto its own row right at/past the visible edge while "Accept all" stayed fully visible and visually primary above it -- steering mobile visitors toward accepting tracking. (PRJ-1032.35, off-palette hex literals on KVision.tsx/GetMyPlanBand.tsx/LiveCompanion.tsx/room-display, was also investigated -- already fully resolved in a prior commit, see notes; no code changed here.)',
    notes: [
      'Fix (BLD-1274): swapped text-[var(--color-gold)]/fill/stroke/color:var(--color-gold) to --color-gold-deep at every call site confirmed to sit on a light (porcelain/bone) surface -- components/ui/TreatmentCard.tsx (hover heading), components/ui/Stars.tsx (default colorClass -- the two dark-section callers, Hero.tsx and Testimonials.tsx, already pass an explicit gold-soft override so were unaffected), components/booking/BookingFlow.tsx (3 inline star glyphs), components/layout/Header.tsx (mega-menu arrow), components/layout/Footer.tsx logo hover, components/reviews/ReviewForm.tsx (star rating input), components/kiosk/ResultCard.tsx, components/motion/BackToTop.tsx, components/cms/SectionRenderer.tsx (FAQ chevron + marquee accent), plus the confirmed-light call sites across app/(marketing)/{refer-a-friend,team,membership,clinics,gift-vouchers,pricing,academy,academy/funding,academy/[slug],academy/[slug]/taster}, app/account/{page,assessments,aftercare,rewards}, and components/academy/{CoursePlayer,CourseReviewPrompt,DailyGoal,PracticeRunner}, components/portal/AssessmentRunner. Each site was checked individually against its actual rendered background (sibling ink/ink-soft/porcelain/bone tokens, not assumed) before swapping -- dark-surface uses (Footer, Header\'s transparent-hero state, Testimonials, PinnedExperience, LiveCompanion, the academy ImmersiveCourse/ExplainerPlayer/KCelebration dark shell, HomeworkPanel\'s existing tone system, AuthShell\'s dark aside) were deliberately left on --color-gold, which already clears AA there.',
      'Refactor (BLD-1274): components/ui/Marquee.tsx, components/academy/KMascot.tsx (KMascot only -- KSpeech/KCelebration are dark-only, untouched) and the .logo/.logo__k hover rule in app/globals.css are each reused on both light and dark surfaces by different callers, so a single hardcoded gold class could not be swapped safely either way. Added an accentClassName prop (Marquee, threaded to its Item), a tone prop (KMascot, default dark preserving existing behaviour), and a .logo--mono class (Logo.tsx, set only when mono is passed) respectively, each defaulting to the existing dark-safe gold and set to gold-deep/gold-soft only from the specific light-surface callers (homepage + CMS marquee bands, PracticeRunner\'s light result card, the default non-mono Logo used on porcelain headers).',
      'Skipped (BLD-1274): ~13 remaining sites are all inside /admin (ForumModeration, RichTextField, BlockEditor, SessionRunner, PageBuilder, DayCloseRunner, CallLog, admin/profile, admin/reviews, admin/rewards, admin/page, admin/clients/[id]) -- an internal staff tool, not the public/customer-facing surfaces this ticket prioritised, and several sit inside admin\'s own light/dark theme toggle (data-theme) where --color-gold and --color-porcelain both flip together, needing per-theme verification each. Left for a follow-up pass.',
      'Verified (PRJ-1032.35): investigated per the batch instructions -- app/globals.css already carries the full --color-night-* token set, and components/ai/KVision.tsx, components/home/GetMyPlanBand.tsx, components/live/LiveCompanion.tsx and app/room-display/[token]/page.tsx already reference them exclusively (only var(--color-gold,#a98a6d) fallbacks remain, and #a98a6d already matches the real palette gold). This was fully resolved by a prior commit (5ca00d8); no code changed here.',
      'Fix (BLD-1355): components/legal/CookieConsent.tsx now shows a short one-line summary with a "Learn more" toggle that expands the full policy paragraph inline, instead of always rendering the long copy -- keeping the collapsed banner well short of the viewport on a 375x812 screen. Raised the container\'s mobile max-height from 38vh to 85vh (a safety margin, not the primary fix) and changed the button row from flex-wrap to flex-col (stacked, full-width, equal padding) below the sm breakpoint, switching to flex-row from sm: up -- so "Accept all" and "Reject non-essential" are always two clearly separate, equally-sized, equally reachable tap targets, never dependent on how they happen to wrap. Reject non-essential\'s border was also darkened (color-line to color-ink) so it reads as an equally real button, not a ghost link, alongside the solid Accept all.',
      'Investigated (BLD-1356): the mismatched "LEVEL 3" badge / "VTCT Level 5 Beauty Therapy Diploma" title on /academy is live admin-managed data, not a code bug -- prisma/schema.prisma\'s Course model stores title and level as independent, unrelated String fields with no derivation between them, scripts/seed-academy.mjs (the only in-repo course seed) has no course by that title at all, and app/(marketing)/academy/page.tsx renders {c.level} directly with no separate hardcoded array. No safe production DB write available from this sandbox, so no code change was made -- a step-by-step fix-it note for the Academy admin course editor (components/admin/AcademyManager.tsx\'s Courses > Edit > Level field) was written for the board comment thread instead.',
      'Verified: npx tsc --noEmit and npm run build both pass clean.',
    ],
  },
  {
    title: 'Sentry silently no-ops without SENTRY_DSN, its client SDK dominated marketing-page JS, replay ran at 100% sample rate, booking-funnel stages had zero analytics (BLD-1273, BLD-1241, BLD-1276, BLD-1255)',
    type: 'TASK', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 5, effort: 3,
    detail: 'Four independent, non-owner-gated reliability/performance/analytics findings, batched into one PR. BLD-1273: every Sentry.captureException/captureMessage call across app/api/** and lib/** (dozens of sites) becomes a silent no-op whenever SENTRY_DSN isn\'t set in the live Vercel env -- only a boot-time console.warn, no persisted trace, and no visibility on the health page. BLD-1241: instrumentation-client.ts called Sentry.init() unconditionally on every page load including anonymous marketing traffic; the resulting chunk (~563KB raw / ~177KB brotli) was the single largest JS chunk on the homepage, roughly half its total compressed JS. BLD-1276: components/marketing/BehaviorRecorder.tsx set SAMPLE = 1, so rrweb\'s mutation-observer/DOM-snapshot recorder ran continuously for the FULL session on every analytics-consenting marketing visitor. BLD-1255: components/booking/BookingFlow.tsx fired zero analytics events on stage transitions (service -> variant -> time -> upsell -> account -> card) before begin_checkout, leaving the earliest, highest-drop-off steps invisible.',
    notes: [
      'Fix (BLD-1273): added lib/error-log-fallback.ts -- a best-effort logErrorFallback() that only does anything when SENTRY_DSN is absent (Sentry already has the error otherwise), persisting a rotating 30-entry buffer to the existing Setting key-value table (no new table) and best-effort POSTing a summary to CRON_ALERT_WEBHOOK_URL when configured, reusing the exact ops-alert pattern already used by app/api/health and the cron routes. Wired into instrumentation.ts\'s onRequestError -- the single highest-leverage integration point, since Next.js already calls it for every otherwise-unhandled server/edge request error -- rather than touching all ~50 individual try/catch call sites, which would be disproportionate for a P2 finding. Added checkSentry() to lib/api-health.ts (the /admin/api-health traffic light), following the exact checkTracking/checkTwilio config-presence convention already there: amber (not grey) when SENTRY_DSN and/or NEXT_PUBLIC_SENTRY_DSN are missing, since a total loss of error reporting is the same class of "staff could assume it\'s on" misconfiguration those checks already flag.',
      'Fix (BLD-1241): instrumentation-client.ts now dynamically imports @sentry/nextjs and calls Sentry.init() only once the browser is idle (requestIdleCallback, 5s timeout fallback) or the visitor first interacts (pointerdown/keydown/scroll), except on /admin routes, which stay eager -- staff-reported bugs are exactly where Sentry visibility matters most, and admin traffic is a tiny fraction of total page loads so the payload cost there is immaterial. A small pre-init buffer captures window error/unhandledrejection events during the deferred window and replays them into Sentry once it loads, so a short deferral does not silently drop an early-load crash on public pages -- it is only delayed until Sentry finishes loading.',
      'Fix (BLD-1276): changed BehaviorRecorder.tsx\'s SAMPLE constant from 1 (100%) to 0.08 (8%) -- still a representative sample for heatmap/replay review while cutting the recording cost roughly 12x. One-line change, no other logic touched.',
      'Fix (BLD-1255): added a useEffect on BookingFlow.tsx\'s stage state that fires window.gtag?.(\'event\', \'booking_stage\', { stage }) on every stage change (including the stage the visitor lands on). Mirrors this file\'s existing raw gtag calls for begin_checkout/add_payment_info exactly rather than routing through lib/analytics-events.ts\'s ga4() helper, which this file does not use -- keeping one style, not introducing a second. Consent-gated the same implicit way as every other gtag call here: window.gtag only exists once components/marketing/TrackingScripts.tsx has loaded the script, which it only does after analytics consent.',
      'Review pass (Opus, max effort): found and fixed two real issues. logErrorFallback had no throttle, so an error storm would amplify into a DB round-trip plus an outbound webhook POST per failing request; added a 60s per-signature throttle and cut the webhook timeout from 8s to 2.5s. The deferred import(\'@sentry/nextjs\') had no .catch(), which could raise an unhandled rejection with nothing left to report it; added the catch.',
      'Verified: npx tsc --noEmit and npm run build both pass clean (DB sync skipped, no DATABASE_URL in this sandbox; static generation logged the expected Prisma connection-timeout retries with no DB configured, matching every prior sandbox build in this backlog).',
    ],
  },
  {
    title: 'SERP-length meta titles/descriptions trimmed, careers "Apply for this role" now seeds the right role reliably; abandoned shop-order recovery email reviewed, left off pending owner go-ahead (BLD-1278, BLD-1279, PRJ-1034.12)',
    type: 'TASK', urgency: 'P3', status: 'IN_REVIEW', assignee: 'claude',
    value: 4, effort: 2,
    detail: 'Three independent, non-owner-gated marketing/content/UX fixes batched into one PR. BLD-1278: the shop abandoned-cart recovery email (lib/automations.ts abandonedOrders(), lib/email.ts tmplAbandonedOrder()) was already built and already reviewed (BLD-1204) to exclude POS/till sale rows and blank emails, with copy matching the live abandoned-booking flow -- but lib/settings.ts shipped abandoned_order_recovery off with only a "ships dark, owner enables after review" comment. PRJ-1034.12 (partial fix already on main): each vacancy card\'s "Apply for this role" link already carried ?role=<vacancyId>#apply and ApplyForm.tsx already read it on mount, which only covers a fresh page load -- a same-page click (the vacancy list and the form share one /careers page) is a query-only client navigation that never remounts the already-mounted form, so the mount-only effect never re-fires. BLD-1279: 14 marketing pages had a meta description and/or title over Google\'s SERP truncation length.',
    notes: [
      'Fix (BLD-1278): confirmed via automations.ts\'s abandonedOrders() and its BLD-1204 review fix (scoped to stripePaymentIntentId not null + non-empty email, so only genuine abandoned web checkouts qualify, never in-clinic till sales) and tmplAbandonedOrder()\'s copy in lib/email.ts that the automation itself is production-ready. Left abandoned_order_recovery set to false in lib/settings.ts rather than flipping it: this sends real, unrecallable emails to customers on the next daily cron once enabled, which is an owner call, not something an autonomous run should decide unilaterally -- flagged back to the board for an explicit owner go-ahead. Flip the one line in lib/settings.ts (abandoned_order_recovery) to true to enable once approved.',
      'Fix (PRJ-1034.12): added components/careers/ApplyRoleLink.tsx, a small client component wrapping each vacancy card\'s Apply link. Its onClick dispatches a kclinics:apply-role CustomEvent carrying the vacancy id, alongside the unchanged href/hash navigation; ApplyForm.tsx now also listens for that event and updates the selected role immediately, so a click while already on /careers (the common path) pre-fills correctly, not just a fresh/bookmarked page load. The existing mount-time query-param read is untouched.',
      'Fix (BLD-1279): trimmed the meta description (and, where also over budget, the title) defined via pageMeta({...}) in each route\'s own page.tsx (lib/seo.tsx): /book, /academy/funding, /academy, /clinics, /team, /pricing, /membership, /offers, /consultation, /packages, /ai-consultation, /journal, /about, /group-bookings -- descriptions now roughly 135-160 characters (front-loaded keyword/USP, kept as complete sentences) and titles 60 characters or under. All 14 pages in the ticket\'s list are static code-defined metadata; none were CMS/DB-driven, so nothing was skipped.',
      'Review pass (Opus, max effort): independently re-verified the abandoned-order automation\'s email scoping and consent gating and found it correct, but agreed enabling it live is an owner decision, not a build-time one -- confirmed the setting ships off in the final diff. All other fixes reviewed with no changes needed.',
      'Verified: npx tsc --noEmit and npm run build both pass clean.',
    ],
  },
  {
    title: 'Orders admin has no search/filter, shared text-input focus ring is border-only, undefined --color-surface leaves workspace cards transparent, CMS images have no reserved dimensions (BLD-1211, BLD-1210, PRJ-1118.4, BLD-1258)',
    type: 'TASK', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 5, effort: 3,
    detail: 'Four independent, non-owner-gated admin-UX/accessibility/performance findings, batched into one PR. BLD-1211: app/admin/orders/page.tsx loaded only the latest 200 non-pending orders with a flat take and no query params, and components/admin/OrdersManager.tsx had no search box or status filter, so finding a specific past order by customer/order number became impossible once volume passed the 200-row cap. BLD-1210: the shared "field" input style repeated across ~95 admin/booking-flow files sets outline-none and shows focus only via focus:border-[var(--color-gold)] on a 1px border -- no ring/box-shadow, unlike buttons across the same codebase, which already use focus-visible:ring-2 focus-visible:ring-[var(--color-gold)] (WCAG 2.4.7). PRJ-1118.4: components/admin/WorkspaceClient.tsx and WorkspaceSeatAudit.tsx used bg-[var(--color-surface)], but only --color-surface-alt is defined in app/globals.css, so the custom property resolved to nothing and card/input backgrounds on the seat-management page were effectively transparent. BLD-1258: the image block in blocksToHtml() (lib/blocks.ts) -- used for journal articles and page-builder richText sections sitewide -- emitted a raw <img src loading="lazy"> with no width/height, so every embedded content image could shift layout on load (CLS).',
    notes: [
      'Fix (BLD-1211): added listOrders() to lib/crm-data.ts, matching listClients()\'s existing search+filter+real-pagination shape (count + skip/take, with the same "requested page landed past the last page" re-fetch guard). app/admin/orders/page.tsx now reads q/status/page from searchParams and calls it instead of a flat db.order.findMany({ take: 200 }); added status tabs (All/Pending/Paid/Fulfilled/Refunded/Cancelled -- All keeps the original default of hiding Pending) using the same Link-based tab pattern as /admin/bookings, the shared PageSearch component for the search box (order number, name or email), and Prev/Next pagination matching /admin/clients. OrdersManager.tsx gained an optional emptyHint prop so a filtered-empty result reads "No orders match" instead of the unfiltered "No orders yet" copy.',
      'Fix (BLD-1210): there was no single shared component defining this style -- it is duplicated as a literal Tailwind string across ~95 files (some as a local `const field = \'...\'`, some inlined directly in className). Grepped every literal occurrence of focus:border-[var(--color-gold)] and appended focus-visible:ring-2 focus-visible:ring-[var(--color-gold)] immediately after it in each one via a scripted pass (103 files, 159 occurrences), matching the exact ring utility/colour already used on buttons and on components/portal/ReferralCard.tsx -- purely additive, the existing border-colour transition is untouched.',
      'Fix (PRJ-1118.4): grepped every --color-surface usage app-wide and confirmed --color-surface-alt is the only defined surface token (app/globals.css) and the one already used elsewhere in WorkspaceClient.tsx itself (e.g. bg-[var(--color-surface-alt,#f9f5f0)] on table headers). Changed all 4 bg-[var(--color-surface)] occurrences (3 in WorkspaceClient.tsx, 1 in WorkspaceSeatAudit.tsx) to bg-[var(--color-surface-alt)].',
      'Fix (BLD-1258): confirmed via components/admin/BlockEditor.tsx\'s image-block editor that no width/height/aspect-ratio is ever captured when a block is authored (src/alt/caption only) -- blocksToHtml() is synchronous, so it cannot probe the real image dimensions. Added an inline style="aspect-ratio:16/9;width:100%;height:auto;object-fit:cover;display:block" to the generated <img> tag so the browser reserves a fixed box before the image loads, eliminating CLS at the cost of cropping any image that is not already close to 16:9 -- an acceptable trade for editorial content images, and self-contained in lib/blocks.ts so any future consumer of blocksToHtml() output gets the protection without needing to remember matching CSS (existing .journal-prose img/figure rules and border-radius/margin are untouched).',
      'Verified: npx tsc --noEmit and npm run build both pass clean.',
    ],
  },
  {
    title: 'Homepage above-the-fold slider: 3 sections showcasing the business, with a video slot',
    type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 8, effort: 4,
    detail: 'Owner request (BLD-1348). Replace the single static homepage hero with an above-the-fold slider of three slides showcasing the elements of the business, including a video slot whose film the owner will supply later. Built: components/home/HeroSlider.tsx replaces components/home/Hero.tsx (deleted -- it was only imported by the homepage). Slide 1 is the previous hero verbatim (the clinic; the page LCP); slide 2 is K Academy (accredited training, CTAs to /academy and /academy/funding); slide 3 is the clinic film ("One address. Every kind of confidence.", CTAs to /ai-consultation and /about) -- it plays the owner-supplied video muted/looping when a URL is set, and shows the branded GenerativeArt until then. The video URL and optional poster are a new SiteConfig.hero section (lib/site-config.ts), editable at Admin -> Site -> "Homepage hero video", so the film goes live by pasting a URL -- no deploy. Storage decision validated by recon: all site video already lives on Vercel Blob URLs and the CSP media-src already allows https:.',
    notes: [
      'Architecture keeps the two properties the old hero was designed around. (1) The fold never depends on JS -- the BLD-997 lesson: slide 1 is the active slide in the server-rendered HTML with the same CSS-only entrance animations (.rise/.reveal-mask), so a dead hydration still shows the old static hero, never a blank fold. Verified by server-rendering the component: slide 1 visible, slides 2-3 invisible+inert, one h1, LCP heading present. (2) The fold stays light -- no framer-motion import; the crossfade is a pure CSS opacity/visibility transition and the client shell is a small index/timer component.',
      'Rotation: 7s auto-advance; hover and keyboard focus each hold their own pause (separate flags -- a shared one let a departing mouse resume rotation under a focused keyboard user); a visible pause/play toggle satisfies WCAG 2.2.2 for touch users; any manual navigation (arrows, dots, swipe) stops rotation and the play control genuinely restarts it, so the toggle icon always tells the truth. prefers-reduced-motion disables auto-advance and film autoplay entirely. Swipe is axis-aware (|dx| >= 48 and |dx| > 1.5|dy|) so a diagonal page-scroll flick never changes slides.',
      'Adversarial review (4 lenses x verify pass, 17 agents): 18 raw findings, 6 confirmed against the tree, all addressed. (a) Outgoing slide stole clicks for the full 900ms crossfade -- visibility stays computed visible until a transition ENDS, and the later-DOM slide hit-tests on top; a Playwright repro in the review confirmed a tap on the incoming CTA navigating to the outgoing slide\'s href. Fixed with pointer-events-none on inactive slides (applies instantly) plus z-[1] on the active one. (b) Outgoing slide\'s links stayed tabbable during the crossfade and the visibility flip destroyed focus -- fixed with inert on inactive slides. (c) The film scrim failed WCAG 1.4.3 over bright footage (recomputed at ~2.5-2.8:1 desktop, ~1.75:1 mobile right-edge) -- fixed with a flat 0.55 mobile layer and a desktop gradient holding a 0.38 floor; nothing else guards against a white film frame since the dark artwork masks it today. (d) A configured poster downloaded on every homepage visit while slide 3 was hidden (browsers fetch poster eagerly on element insertion; preload="none" governs media data only). (e) LCP: Chrome keeps registering larger candidates until first input/scroll, so the 7s advance -- and worse, a full-bleed film frame at ~14s -- would become the reported LCP of every interaction-free session. (d)+(e) share one fix: the <video> mounts only after BOTH its slide has shown AND the visitor has interacted (pointerdown/keydown/wheel/touchstart/scroll, once+passive) -- the arming event is the event that finalises LCP, so the film can never re-register it; idle sessions rotating to slide 3 see the branded artwork, which is CSS gradients and text, not LCP candidates. Slides 2-3 headings are also capped at 4rem (h1 runs to 5.5rem) so the 7s text paint is strictly smaller. (f) A save from a stale admin tab whose bundle predates the hero field would silently wipe it (the editor posts the whole config) -- the site API now carries forward any stored top-level key missing from the payload; a tab that knows a key always sends it, so deliberate clearing is unaffected. Known residual, documented not fixed: concurrent-tab last-write-wins on a key BOTH tabs know -- pre-existing editor-wide behaviour for every field, recoverable via the SiteConfigRevision rollback.',
      'A11y beyond the fixes: aria-roledescription carousel/slide with positional labels, aria-live off while rotating and polite when paused/stopped (APG pattern), aria-current on dots, 24px dot hit targets (WCAG 2.5.8) with the 8px pill as the visual inside, dot contrast raised to white/45, controls aligned to container-lux so they track the slide copy gutter exactly.',
      'Failure modes: an unplayable video URL sets videoFailed via onError and the slide falls back to the branded artwork rather than a black pane; play() rejection (autoplay blocked) is swallowed and the poster/fallback stays.',
      'NOT visually verified: Chromium cannot egress in this session (ERR_CONNECTION_RESET direct and via proxy; curl reaches the site fine -- the strict explicit-proxy case in CLAUDE.md). Verification was tsc + production build + direct server-rendering of the component asserting the visibility/inert/h1/LCP invariants. Worth a real-browser pass on /: slide transitions, the controls row on mobile widths, and the film slide once the owner supplies a URL.',
    ],
  },
  {
    title: 'Team feedback on BLOCKED and SHIPPED board items is invisible to routine sessions, so it never gets actioned',
    type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude', pr: PR(1814),
    value: 8, effort: 2,
    detail: 'Owner-reported (BLD-1368): the team had left feedback against many blocked items and none of them moved. Root cause: lib/build-board.ts routineQueue() only fetched assignee=claude items in TRIAGE/IN_PROGRESS/IN_REVIEW. Status-BLOCKED items were excluded entirely (the response field named blocked is dependency-blocked actionable work, a different thing), and SHIPPED items -- where sign-off feedback lands, 743 awaiting at the time -- were only a count. A staff comment on either kind was structurally unreachable by any autonomous session. Verified empirically before the fix: paging the entire live queue returned zero human comments across all 75 visible items, while the board actually held 37 status-BLOCKED items, five of them carrying direct staff/owner feedback dating back to 19 June.',
    notes: [
      'Fix: routineQueue gains a read-only feedback lane -- every status-BLOCKED item (any assignee, since feedback often reassigns) plus SHIPPED items with a comment from a human actor (not claude/routine/system) in the last 60 days, capped at 30, each serialized with recentComments so a session reads the feedback directly from the queue. counts gains feedback/blockedStatus; the guidance string directs sessions to work the lane. No write-path change -- the existing update action already accepts moving BLOCKED back to a working status.',
      'Proven immediately after deploy: the first read of the new lane surfaced 39 items (37 status-BLOCKED), five with human feedback that had never been actioned -- BLD-512 (Inna, 19 Jun: canonical support@ address; already fixed in code but never moved -- verified live and marked SHIPPED with a reply), BLD-39 (Inna: QA_TOKEN go-ahead; replied with the one remaining env-var step), BLD-795 (owner P0, already fixed; replied with verification steps), BLD-997 (owner: banner artwork note -- see the separate entry, the offer copy had been dropped by misreading it), and PRJ-1.11 (owner: kiosk leaderboard images uploaded; unblocked to TRIAGE with a scoped plan). BLD-1197 (rotating hero promo) reconciled against the shipped BLD-1348 slider with a three-option ask on the stale June pricing.',
    ],
  },
  {
    title: 'Academy banner missing the actual three-level VTCT offer it was requested for (BLD-997 follow-up)',
    type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 6, effort: 1,
    detail: 'Surfaced by the BLD-1368 feedback lane. BLD-997 asked for a promotional banner: enrol on all three VTCT levels (L2+L3+L4), 3500 with the 5000 original crossed out, save 1500, and an Enrol Now CTA. A prior pass read the owner 10 Aug comment ("no specific artwork for this campaign, use brand style") as replacing the whole offer and shipped a generic brand banner -- the comment only replaced the artwork. The offer copy never reached the page.',
    notes: [
      'Fix: components/academy/AcademyBanner.tsx now renders the offer in the same ink/gold brand treatment -- crossed-out 5000 original (del with screen-reader Was/Now context so the two prices do not read as one number), 3500 in the display face, a Save 1500 badge, and Enrol now linking to #courses (no bundle exists in live data to deep-link: the Learning pathways section renders empty on the live page). Still server-rendered visible with no Reveal wrapper (the BLD-997 visibility lesson). Prices are owner-stated on the item and re-affirmed 10 Aug; they live in this file if the campaign changes.',
      'Verified: npx tsc --noEmit and npm run build pass clean; edge middleware bundle clean of node:util/types (BLD-1365 regression check). Not visually verified -- no browser egress from this environment.',
    ],
  },
  {
    title: 'No notifications reach staff for new consultation requests',
    type: 'ERROR', urgency: 'P0', status: 'SHIPPED', assignee: 'claude',
    value: 9, effort: 3,
    detail: 'Owner-reported P0 (BLD-1345). A new consultation request (POST /api/consult, the only writer of Consultation rows -- every public form, /consultation, /contact, group booking and franchise enquiry, funnels through it) reached staff through exactly one channel a person actually sees: a single email to CLINIC_NOTIFY_EMAIL || site.email, a shared inbox rather than the individuals who work the enquiries. Three compounding gaps. (1) The per-user email copy never fired: CATEGORY_DEFAULTS in lib/notifications.ts sets email:false for every category including messages, and maybeEmail() returns early unless a user has manually opted that category into email, which nobody had -- so no named staff member was ever emailed about an enquiry. (2) Web-push is inert: lib/push.ts no-ops until VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY are set, and they are not. (3) The in-app StaffNotification row was therefore the only per-person signal, it only started being written on 2026-08-05 (commit f071d29), and it is visible only while signed into the admin with the bell open. The audience was also gated on clients.view alone rather than the consultation-specific consultations.view, so a staff member granted consultation access without client browsing was silently excluded.',
    notes: [
      'Fix (notifications): lib/notifications.ts NotifInput gains an `email?: boolean` channel flag. When set, emailWanted() flips the category default on for that one notification (prefs.email?.[c] ?? true) instead of falling back to CATEGORY_DEFAULTS -- an explicit per-user preference still wins in both directions, so anyone who has deliberately switched the category off keeps it off. Nothing else changes: notifications that do not set the flag behave exactly as before, so no other call site starts emailing.',
      'Fix (audience): notifyStaffByPermission() now accepts string | string[] and matches on ANY of the given permissions, so a notification reaches everyone who can act on it rather than only the holders of one key. app/api/consult/route.ts targets [\'consultations.view\', \'clients.view\'] and passes email: true. Body stays the existing non-clinical summary (name, category, up to three treatments) -- the encrypted concerns/message still never leave the consultation page.',
      'Retro push (BLD-1345): new lib/consult-notify-backfill.ts sends the enquiries nobody was told about as ONE summary per recipient -- an email listing the last 90 days (date, name, interest, treatments, status, per-enquiry deep link, up to 100 rows) plus a single in-app row pointing at /admin/consultations. Deliberately not one notification per enquiry: a hundred back-dated rows would bury the bell and tell nobody anything. Recipients resolve at runtime by first-name/mailbox-segment match (never a bare substring, which would catch unrelated names) against the staff the owner named, overridable outright by CONSULT_BACKFILL_EMAILS. When nothing matches it reports a warning rather than falling back to emailing the whole team -- an unexpected blast to every staff account is worse than a reported miss.',
      'Wiring: app/api/cron/daily/route.ts calls backfillConsultNotificationsIfNeeded(), which latches itself off via a consult_notify_backfill_v1 Setting row so staff are not re-notified nightly -- but only latches once emailed > 0, so a first run that matched nobody stays pending and retries after CONSULT_BACKFILL_EMAILS is set rather than silently consuming the one-shot. app/api/admin/maintenance/backfill-consult-notifications (settings.manage, audit-logged, accepts an explicit emails[]) triggers the same job on demand so the owner need not wait for the cron.',
      'Not verified against production: this sandbox has no DB egress (raw Postgres TCP is not proxied -- direct connections time out) and the QA admin credentials were rejected by the live login, so the diagnosis is from code and git history rather than from inspecting live StaffNotification/AdminUser rows. The retro push is written to run in production, where it has the access this session did not.',
      'Verified: npx tsc --noEmit and npm run build both pass clean (DB sync skipped, no DATABASE_URL in this sandbox). npm run lint is broken repo-wide and unrelated -- Next 16 removed `next lint` and no eslint.config.js exists.',
    ],
  },
  {
    title: 'Prepaid course sessions are invisible in the public booking flow',
    type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 8, effort: 4,
    detail: 'Owner-reported (BLD-1346). A client who has bought a multi-session course could only spend those prepaid sessions when a staff member booked them in by phone: app/admin/bookings/create-action.ts accepts usePackageBookingId and creates the visit at GBP 0 linked to the purchase (BLD-1014), and components/admin/NewBookingButton.tsx shows the balance. The public account booking flow (components/booking/BookingFlow.tsx -> POST /api/booking/start) had no equivalent -- bookingStartSchema had no usePackageBookingId and the route never read clientPackages() -- so a client with 5 of 6 sessions left who booked online was quoted and charged the full single-session price again, with no sign anywhere in the flow that they had a balance.',
    notes: [
      'Fix: new GET /api/account/packages returns the SIGNED-IN client\'s own course balances (id from the session, never the request, so there is nothing to enumerate), pre-filtered to packages that are paid and still have sessions left. BookingFlow.tsx loads it once when authed, finds the one package matching the treatment being booked, and offers "Use one of your prepaid sessions -- nothing to pay" on the option step. Selecting it forces sessions back to 1, hides the course-purchase tiers (buying a course and spending one are mutually exclusive) and hides the promo field (a promo only ever discounts the primary treatment, which is GBP 0 here, so the field would just look broken).',
      'Server-side authority: /api/booking/start re-validates everything the browser sent -- the package belongs to THIS client, matches THIS treatment slug, has sessionsRemaining > 0, and is actually paid. The paid check is deliberately stricter than the staff flow, which can knowingly book against an unpaid package; on the client-facing path an unpaid purchase would hand out free visits. sessions > 1 and CONSULTATION are both rejected. The client sends only an id and can never price their own booking.',
      'Pricing: `base` becomes 0 when a package is used, which self-skips the offer, welcome-discount and promo blocks below it (each already guarded on base > 0), so no discount is burned on a free visit. The primary line item\'s discountPence is forced to 0 as well -- a fixed-amount offer would otherwise leave a phantom discount on a GBP 0 line that misreports on receipts. Add-ons taken in the same slot are still priced and charged normally: the package covers the primary treatment only.',
      'Display: money() renders GBP 0 as "On consultation", which is right for a treatment priced at assessment and wrong for a session already paid for -- a totalLabel now says "Nothing to pay -- prepaid session" in that case, on both the time step and the order summary, and the summary shows which course the session came off.',
      'Concurrency: the balance check reads a DERIVED total outside the booking transaction, so two submissions at once could each see the last session free and both spend it. The Serializable transaction that holds the slot now recounts occupancy inside itself via a new exported packageOccupancyWhere() -- the same predicate the derived view uses, not a second drifting copy -- and aborts with a clear "no sessions left" error rather than a misleading "that time was just taken".',
      'Verified: npx tsc --noEmit and npm run build both pass clean (DB sync skipped, no DATABASE_URL in this sandbox). Not exercised against real data -- this sandbox has no DB egress, so the flow was not run end to end.',
    ],
  },
  {
    title: 'A no-show is never charged, and a prepaid course session missed or late-cancelled costs the client nothing',
    type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 8, effort: 4,
    detail: 'Owner-reported (BLD-1347). Two linked holes against the published 24-hour policy (lib/info-pages.ts: cancellations within 24 hours, or non-attendance, incur the full treatment fee). (1) setBookingStatus(bookingId, NO_SHOW) set the status, sent a rebooking email, notified the diary and released a gift voucher -- it never charged the card on file. lib/outstanding.ts then reported the full price as an outstanding debt that blocked online rebooking (BLD-1066), but no money was ever taken, and there was no waive path on the no-show branch at all (feeWaived is only ever written by cancelBooking), so the debt could not be cleared except by charging manually. cancelBooking already auto-charges the identical fee for a late cancellation, so the two paths disagreed. (2) A session booked against a prepaid course is created at pricePence 0 (the money sits on the purchase booking), and lib/package-sessions.ts did not count CANCELLED or NO_SHOW sessions as used. Combined with the pricePence > 0 guards in outstandingBalance() and in cancelBooking\'s shouldCharge, a client on a prepaid course who no-showed or cancelled inside 24 hours paid nothing AND kept the session -- the balance was never decremented, so the course could be stretched indefinitely by missing appointments.',
    notes: [
      'Fix (no-show fee): new applyNoShowFee() in lib/booking-actions.ts, called from setBookingStatus\'s NO_SHOW branch. How the fee is taken follows how the client paid: a prepaid course session spends one session off their package balance (there is no card charge to make, and the session is the thing of value they consumed); an already-settled booking (earlier charge or BNPL pre-payment) reports alreadyPaid so nothing claims a fee was taken; anything else charges the card on file for the price net of loyalty points already redeemed as money off, the same BLD-733 arithmetic the late-cancel path uses. Never throws -- a payment problem must not stop the appointment being marked -- and a failed charge falls through to the existing derived outstanding balance for follow-up.',
      'Fix (override): setBookingStatus takes an opts.waiveFee, surfaced as a second "No-show -- waive fee" button gated on bookings.charge (waiving money owed is a financial concession, so it needs the payment permission even though marking the no-show itself does not). Waiving writes feeWaived, which clears the derived outstanding balance -- so it reopens the client\'s online booking with nothing else to reset -- and skips both the charge and the session.',
      'Fix (late cancel): cancelBooking now consumes a prepaid session on a cancellation inside 24 hours, under the same policy that charges a fee on a paid booking. Owner decision, asked and confirmed before building: inside 24h the session is spent whether they cancel late or do not turn up. The booking\'s status is untouched -- it stays CANCELLED in the diary.',
      'Accounting: lib/package-sessions.ts now counts a NO_SHOW marked package-consumed as used, alongside the CANCELLED case BLD-1096 added, via a single shared isUsed() predicate so the query filter and the count can never disagree about what "used" means. The mark itself goes through a new consumePackageSession(), which is idempotent (guarded on packageSessionUsedAt: null, so a re-run or a status flipped back and forth cannot deduct twice) and only ever marks a FOLLOW-UP session -- the course purchase booking stays excluded for the BLD-1096 reason that cancelling it drops the whole package from clientPackages(), so marking it would change no balance while claiming a session had been deducted.',
      'Ordering: applyNoShowFee runs LAST in the NO_SHOW branch, after the gift-voucher release, so that release still sees the pre-fee chargedAt its BLD-882 guard depends on -- matching cancelBooking, where the late fee is computed from pricePence and deliberately never spends the voucher.',
      'Guards: a mis-clicked no-show on an appointment still more than 24 hours away charges nothing (isWithin24h). Double-clicking, or resetting to confirmed and re-marking, cannot double-charge -- chargeBooking\'s existing Stripe idempotency key collapses both to one PaymentIntent and its chargedAt re-fetch short-circuits the second. "Reset to confirmed" now also clears packageSessionUsedAt, handing back a session a mis-clicked no-show spent; the manual PackageSessionToggle and the "Package session used" badge were widened from CANCELLED to NO_SHOW so staff can still reverse or re-apply the mark by hand.',
      'Labelling: chargeBooking gained an opts.reason used only for the Stripe description and the receipt subject, so a missed appointment is billed as "Missed appointment fee" rather than "Late-cancellation fee". The idempotency key stays keyed on `late`, so the two can never both charge.',
      'Verified: npx tsc --noEmit and npm run build both pass clean (DB sync skipped, no DATABASE_URL in this sandbox). Not exercised against real data or a real Stripe charge -- this sandbox has no DB egress.',
    ],
  },
  {
    title: 'Signature Facial promo slide on the homepage slider; 2-year consultation-enquiry retention purge (BLD-1197, PRJ-1032.20)',
    type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 6, effort: 2,
    detail: 'Two owner decisions from the 18 Aug blocked-lane sweep, built together. BLD-1197: the rotating-hero capability shipped as BLD-1348; the remaining ask was the Signature Facial promotion slide, held because the June prices needed re-confirmation -- owner confirmed 150/210 stands (18 Aug, in session). PRJ-1032.20: consultation enquiries (including from people who never became clients) were kept indefinitely with the retention schedule marked [OWNER TO CONFIRM]; owner set the window at 2 years if no booking follows (18 Aug, in session).',
    notes: [
      'BLD-1197: HeroSlider gains slide 2 of 4 -- Signature Facial offer, 150 with 210 crossed out (del with screen-reader Was/Now context), Save 60 badge, CTAs to /book?treatment=face-treatments and /face-treatments -- in the same ink/gold treatment as the other slides. Film slide references renumbered (index 2 to 3) in the autoplay/arming effects and aria labels. Heading keeps the 4rem LCP cap. Verified by direct server-render: 4 slides labelled 1-4, slide 1 visible with the only h1, 3 inert, 4 dots, promo copy present.',
      'PRJ-1032.20: the nightly cron retention block now deletes Consultation rows (ConsultationNote cascades) older than 2 years whose client has no bookings at all -- an enquiry that became a client relationship keeps its history. docs/data-protection/retention-schedule.md row updated from [OWNER TO CONFIRM] to the confirmed 2-year window with the decision date. Purge count surfaced in the cron retention summary as enquiries.',
      'Also re-verified during the sweep: BLD-489 (tenant scope on academy route ops) is already fixed in code -- updateEnrolment/removeCohort/removeEnrolment all carry tenantId in their where clauses with the BLD-489 comment; the board item had simply never moved, same pattern as BLD-512. BLD-804 (nonexistent slugs return 200) was investigated and deliberately NOT fixed blind: the route code is orthodox (top-of-page notFound, dynamicParams defaults), and the live 200s point at Next 16 shell-streaming committing the status before the DB lookup resolves -- a robust fix needs a preview-deploy test loop this environment cannot drive (preview URLs are auth-walled).',
      'Verified: npx tsc --noEmit and npm run build pass clean; edge middleware bundle clean of node:util/types.',
    ],
  },
  {
    title: 'Latest News section fed automatically from the Google Business Profile (BLD-481)',
    type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 6, effort: 3,
    detail: 'Owner decision (18 Aug, in session): build the full auto-pull rather than a manual news section. The ask (June): a Latest News section on the website that mirrors whatever the clinic publishes in the Google Business Profile "From the Business" section, pictures included, with no manual re-entry. Key discovery that unblocked it: the existing Google Business connection already carries the business.manage scope (the same one localPosts needs), so no re-consent or new OAuth surface was required -- the earlier blocker note assumed one.',
    notes: [
      'New GbpPost mirror table (additive; resource name as @id, so no @unique added to an existing table -- deploy-gate safe). lib/google-business.ts gains syncGooglePosts() (pages localPosts, upserts, and mirror-deletes rows no longer live on Google so taken-down posts vanish from the site) and latestNews() for the section query. The daily cron syncs posts right after the existing review sync, guarded by the same googleBusinessConnected() check; a failed posts sync logs but does not page -- the section degrades to "no news", never an error.',
      'components/home/LatestNews.tsx renders the three newest LIVE posts as brand-styled cards (topic label, date, summary clamped at 220 chars, image as a plain lazy img since Google CDN hosts are not in next/image remotePatterns, whole card linking to the post CTA or its Google view). Renders null until posts exist, so the homepage is byte-identical until the first sync lands. Placed after the Testimonials section.',
      'Runtime prerequisite, not code: the sync only produces rows once the Google Business connection is live and a location is selected (Admin -> Marketing -> Connections). BLD-636 reports the GA4 side of Google returning 401; if the Business connection is similarly stale, reconnecting it is the one owner step before news appears.',
      'Verified: npx tsc --noEmit and npm run build pass clean; edge bundle clean. Not exercised against the live Google API from this environment.',
    ],
  },
  {
    title: 'Key-rotation sweep only re-encrypted 4 of ~25 encrypted columns — its "0 remaining" key-removal gate was false (BLD-1180)',
    type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 8, effort: 4,
    detail: 'lib/key-rotation.ts tracked only healthAssessment.cipher, booking.clinicalNoteEnc, externalConnection.tokensEnc and managedSecret.valueEnc, while encryptJson/encClinical write to ~25 columns across the codebase (signed consents, AI findings and images, before photos, TOTP secrets, Google refresh tokens, client medical flags/allergies, consultation concerns/messages/medical notes, consultation notes, chat messages, interactions, tasks, follow-ups, incidents, call notes/transcripts/recordings, CallRecord.raw). Following the documented runbook — remove the retired key once the sweep reports 0 remaining — would have silently and permanently destroyed the special-category data still sitting on the old key in every untracked column.',
    notes: [
      'Rewrite: a SWEEP registry of every encrypted column ({model, field, pk, kind json|clinical}), swept generically. Matching is by keyring key-id PREFIX against RETIRED ring keys only (new retiredKeyIds() in lib/crypto.ts) — never plaintext, so the encClinical columns that legally hold legacy plaintext are untouched; the separate clinical-encryption backfill owns upgrading those. "0 remaining" is now a truthful key-removal gate.',
      'Integrity-hashed models handled bespoke: HealthAssessment and SignedConsent recompute integrityHash with the new cipher (the hash binds cipher to metadata — clientId/type/version/questionnaireKey and clientId/templateKey/contentHash respectively), so a re-encrypted row still verifies on read.',
      'CallRecord.raw is a Json column holding an encClinical string (lib/yay.ts) — Prisma cannot prefix-filter Json, so it gets a fetch-then-test pass (NOT { raw: { equals: Prisma.DbNull } }, client-side key-id check).',
      'Double-encryption guard: decClinical returns an undecryptable blob UNCHANGED (its plaintext tolerance); re-encrypting that would wrap ciphertext in ciphertext and turn reads to gibberish. reEncClinical now throws on dec === blob, so such a row stays on the stale count where a human can see it instead of being corrupted.',
      'rotationStatus() pending is a Record keyed by column label; the integrations page renders it generically, so new registry entries surface without UI edits. Each record is isolated — one bad row logs and continues, never aborts the batch.',
      'Verified: npx tsc --noEmit and npm run build pass clean. Not run against real data — no DB egress from this sandbox; the sweep only activates when HEALTH_ENCRYPTION_KEYS_OLD is set (rotationActive()), which it currently is not.',
    ],
  },
  {
    title: 'Staff can retro-link an appointment to a client’s prepaid course so the package balance matches reality (BLD-1375)',
    type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 7, effort: 3,
    detail: 'Owner request via Holly Gillis: all her appointments should come off her fully-paid 6-session package, but sessions booked by phone (or before the course was set up) are ordinary bookings with no packageBookingId, so the derived balance over-counts what is left and each visit looks individually billable. There was no way to attach an existing appointment to a package after the fact.',
    notes: [
      'New linkBookingToPackage / unlinkBookingFromPackage server actions (app/admin/bookings/actions.ts), gated on bookings.manage. Link validation mirrors the client booking flow: the course must be on the SAME client’s account, for the SAME treatment slug; the appointment must not itself be a course purchase, must not already be linked, and must not have its own card charge (linking a separately-charged visit would spend a prepaid session AND keep the money — the error says to refund first).',
      'Balance safety: a live or completed appointment occupies a slot the moment it is linked, so the action recounts occupancy INSIDE a Serializable transaction via the shared packageOccupancyWhere() predicate (same definition the derived balance uses) and refuses when the course is full. A cancelled/missed appointment does not occupy until staff mark it used, so it may link without a free slot (e.g. to record the mark next). Unlink also clears packageSessionUsedAt/By — a mark without a link is meaningless.',
      'UI: PackageLinkControl on the booking detail page — offers matching courses (label, sessions left, unpaid flagged) with a one-click link when the client holds a course for that treatment, and an unlink control on a linked appointment. Both states audit-logged (SESSION_EDITED) and revalidate the booking, the purchase, the diary and the client profile.',
      'For Holly specifically: staff open each of her appointments and click "Link appointment" — completed past visits immediately count as used sessions, upcoming ones as booked, and the package card on her profile shows the corrected remaining count.',
      'Verified: npx tsc --noEmit and npm run build pass clean. Not exercised against real data (no DB egress from this sandbox).',
    ],
  },
  {
    title: 'Academy course card level badge self-heals to match the course title (BLD-1356)',
    type: 'ERROR', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 6, effort: 1,
    detail: 'Live /academy showed one card badged LEVEL 3 directly above the heading "VTCT Level 5 Beauty Therapy Diploma" — Course.level and Course.title are independent admin-entered fields with no derivation between them, so a typo in one publishes a contradiction to every visitor. Staff steps to fix the row were posted on the board 18 Aug 08:58 but the data had not been corrected; admin-credentialed access is not available from this environment to fix the row directly.',
    notes: [
      'Fix: a data-hygiene step in the daily cron — when an active course’s title contains a plain "Level N" AND its level field is itself a plain "Level M" with N ≠ M, the badge is aligned to the title (the title is the qualification’s actual name) and the /academy pages revalidate. Deliberately narrow: a level field that is anything other than a bare "Level N" (or a title with no level in it) is never touched, so descriptive level text cannot be clobbered. Corrections are logged and surfaced in the cron result as courseLevels.',
      'The Level 5 card corrects itself on the next nightly run; the 10-step manual edit on the board remains valid if staff want it fixed sooner.',
    ],
  },
  {
    title: 'Email campaigns silently capped at 5,000 recipients; interrupted sends stranded forever (BLD-1307)',
    type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 7, effort: 3,
    detail: 'deliverCampaign, startAbTest and decideAbTest all fetched recipients with a bare findMany({ take: 5000 }) and no ordering — an audience larger than 5,000 opted-in clients got an arbitrary subset silently mailed while campaign.recipients recorded the truncated count as if it were the whole send. No error, no banner, no log line. Separately, a send interrupted mid-flight (deploy, function timeout) stayed SENDING forever: the double-send claim only re-claims DRAFT/SCHEDULED, so part of the audience was never mailed and nothing could restart it.',
    notes: [
      'Fix: a shared audienceRecipients() cursor-paginates the WHOLE audience (1,000-row pages, bounded memory, stable id ordering) — the cap is gone rather than warned about, which is what the editor UI already promises (it shows countAudience as the audience size). All three send paths use it; decideAbTest\'s hand-rolled "already emailed" exclusion folded into the same helper.',
      'Resume instead of strand: deliverCampaign now excludes anyone who already has an EmailEvent for the campaign (each delivery writes its event immediately), so re-running an interrupted send is safe. dispatchDueCampaigns picks up campaigns stuck in SENDING for >30 minutes and finishes them, recounting campaign.recipients from the per-recipient events so the recorded figure is the true total. An interrupted A/B SAMPLE send (subjectB set, no winner yet) is deliberately NOT auto-resumed — blasting the full audience with variant A would be wrong — it logs for a human instead; a decided winner send resumes with the winning subject.',
      'The audit filed this as an IDEA wanting an owner-reviewed batching plan; built the truncation fix directly because the safe end-state is unambiguous — the marketer already chose the audience and the UI already told them its size, so mailing exactly that audience is the only correct behaviour. Nothing about send volume policy changed: sends still go through the same consent-gated marketableClientWhere().',
      'Verified: npx tsc --noEmit and npm run build pass clean. Not exercised against a live send from this sandbox.',
    ],
  },
  {
    title: 'A fully-refunded academy student kept indefinite course access (BLD-1308)',
    type: 'ERROR', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 7, effort: 2,
    detail: 'refundEnrolmentPayment and reconcileEnrolmentPaymentRefund rolled back paidPence and marked the payment row REFUNDED but never touched Enrolment.status — and studentCanAccess() grants LMS access purely on status (PAID/ENROLLED/COMPLETED), so a student refunded in full kept the whole course forever. The admin Refund button also gave no warning, unlike Cancel which warns about fees.',
    notes: [
      'Fix: revokeAccessIfFullyRefunded(), called from both refund paths (in-app Stripe refund and the dashboard-refund webhook reconciler). It fires ONLY when paidPence has reached 0 and the enrolment is PAID or ENROLLED — then CAS-downgrades to CANCELLED (guarded on status+paidPence, so an instalment payment landing mid-refund keeps access) and audit-logs the auto-revoke.',
      'Judgement calls, resolved conservatively: a PARTIAL refund leaves money on the enrolment, so status (and access) is untouched — whether remaining money still buys access is a staff decision, and the Cancel action remains available. A COMPLETED enrolment is never auto-cancelled — the student finished the course and that record stands; the refund is still audit-logged. If the owner wants a paid-threshold rule instead of the £0 trigger, that is a one-line change in the helper.',
      'UI: the Refund confirm now states the amount and, when the refund returns everything the learner has paid, warns that the enrolment will be cancelled and access removed automatically.',
      'Verified: npx tsc --noEmit and npm run build pass clean. Not exercised against a live Stripe refund from this sandbox.',
    ],
  },
  {
    title: 'Kiosk facial-photo AI consent now records version + source evidence (BLD-1354)',
    type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 7, effort: 2,
    detail: 'KioskSession.consentAt was a bare timestamp stamped before a visitor\'s facial photo went to the AI provider — no record of WHAT wording was agreed or WHERE, unlike the codebase\'s own aiConsultationConsentFields() pattern on the booking-page AI flow, which documents that a bare timestamp is not demonstrable consent (UK GDPR Art. 7 + Art. 9 special-category biometric data). If the kiosk consent copy ever changed there would be no way to prove what an earlier visitor agreed to.',
    notes: [
      'Fix: additive KioskSession.consentVersion/consentSource columns (migration committed, no @unique — deploy-gate safe), a KIOSK_CONSENT_VERSION constant + kioskConsentFields() helper in lib/consent.ts mirroring the AI-consult pattern, stamped at all three consent write sites (v1 single-photo upload, v2 consent step, v2 photo-upload fallback) with distinct sources so the capture surface is provable too.',
      'No consent WORDING changed — the initial version (2026-08-v1) simply pins the copy already live in the kiosk "Quick consent" step, so no owner sign-off was needed to start recording evidence. Any future copy change must bump KIOSK_CONSENT_VERSION (comment at the constant says so).',
      'Verified: npx tsc --noEmit and npm run build pass clean; migration generated offline via prisma migrate diff.',
    ],
  },
  {
    title: 'Health-sensitive treatment page views no longer send the treatment name to Meta/GA4 (BLD-1251)',
    type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 8, effort: 2,
    detail: 'trackViewItem() on every /[slug] treatment page sent the raw treatment name — Dentures, Dental Implant Placement, Intimate Rejuvenation, Body Contouring — to Meta Pixel (content_name) and GA4 (item_name) under generic cookie-banner consent. Tying a named health condition/procedure interest to an identifiable ad profile is UK GDPR Art. 9 special-category territory that generic marketing consent does not cover.',
    notes: [
      'Fix: new adSensitiveTreatment() in lib/treatments.ts — every dentistry page (dental care is health data by definition) plus the explicitly intimate/medical aesthetics subset (intimate-rejuvenation, body-contouring, extendable regex). Sensitive pages still fire their consent-gated view event so remarketing audiences and conversion counting keep working, but with the label generalised to the category ("Dentistry treatment"/"Aesthetics treatment"), the id set to the category, and no price (a distinctive price would fingerprint the treatment). Non-sensitive aesthetics pages keep full per-treatment granularity, so most ad-reporting detail is preserved.',
      'The audit offered two routes — generalise the label OR add a dedicated Art.9 consent gate. Chose generalisation for the sensitive subset: it removes the special-category data from the transfer entirely (no consent wording for the owner to sign off, no consent-rate hit to campaign volume), which is strictly safer than asking visitors to consent to health-data ad sharing.',
      'Scope: browser-side view_item/ViewContent (the audited surface). Booking-flow events carry the treatment via the URL the pixel sees regardless; if the owner wants those generalised too it is a follow-up decision, noted on the board.',
      'Verified: npx tsc --noEmit and npm run build pass clean.',
    ],
  },
  {
    title: 'Gallery before/after photos encrypted at rest with keyring + self-healing backfill (BLD-1041)',
    type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 7, effort: 4,
    detail: 'GalleryItem.beforeImage/afterImage were raw Bytes columns — draft/unpublished cases under staff review and clientId-linked real patient photos sat cleartext in the primary DB, unlike the parallel BeforePhoto.dataEnc model, undermining the "clinical photos are always encrypted" posture the rest of the schema establishes.',
    notes: [
      'New binary keyring primitives in lib/crypto.ts: encryptBytes/decryptBytes/isEncryptedBytes/bytesKeyId — AES-256-GCM with the same versioned ring as encryptJson, in a self-describing binary format ("KCB1" magic + keyId + iv + tag + ct) stored in the SAME Bytes column, so no schema change and no destructive migration. decryptBytes passes legacy plaintext through unchanged (the decClinical tolerance), so reads work identically before, during and after migration.',
      'Write paths (admin gallery create/update) now encrypt; the serve route decrypts (and 404s rather than streams an undecryptable blob). A nightly self-healing backfill (lib/gallery-encrypt-backfill.ts, 40 rows/run — images are MB-scale) upgrades legacy rows in place, CAS-guarded on updatedAt so an admin replacing an image mid-backfill is never clobbered, and latches off via a Settings key after a clean pass — the BLD-248 pattern.',
      'Key rotation: gallery photos joined the BLD-1180 sweep as a bespoke client-side-tested pass (Prisma cannot prefix-filter Bytes), with a galleryPhotos pending count in rotationStatus — so the "0 remaining" key-removal gate covers them too. Plaintext rows never enter the sweep; they are the backfill\'s job.',
      'Verified: npx tsc --noEmit and npm run build pass clean. Backfill and render not exercised against live data (no DB egress from this sandbox); the serve route\'s plaintext tolerance means an unmigrated row renders exactly as before.',
    ],
  },
  {
    title: 'Late-cancel and reschedule fees now net an applied gift voucher, and consume it (BLD-1236)',
    type: 'ERROR', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 7, effort: 2,
    detail: 'cancelBooking()\'s late fee and rescheduleBooking()\'s 4th-reschedule fee netted only pointsRedeemedPence, never giftVoucherPence, while the staff till (chargeBookingAction) nets both. The reschedule case was a genuine client loss: that fee sets chargedAt (it IS the booking\'s settlement), after which the still-attached voucher reservation could never be consumed (till refuses a charged booking) NOR returned (the BLD-882 cancel guard sees chargedAt set) — the client paid full price and lost the voucher value entirely.',
    notes: [
      'Fix: both fees net giftVoucherPence exactly like the till. In cancelBooking a fee that actually lands now CONSUMES the voucher — the BLD-882 return is skipped via a feeApplied flag (not `charged === 0`: chargeBooking(0) reports ok when credits cover the whole fee, so a voucher fully covering the fee counts as consumed too). A failed, pending, waived or alreadyPaid outcome still returns the reservation as before. The BLD-915 points-refund guard moved to the same feeApplied flag for the identical £0-remainder edge.',
      'Deliberately NOT changed: applyNoShowFee (the no-show branch releases the voucher reservation BEFORE the fee under its own documented ordering, so the fee correctly bills the un-netted price — the client keeps the voucher value on the voucher instead; net client cost identical), and the fee maths already netted points everywhere.',
      'Verified: npx tsc --noEmit and npm run build pass clean.',
    ],
  },
  {
    title: 'A lost chargeback on a shop order now re-credits the gift card it consumed (BLD-1237)',
    type: 'ERROR', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 6, effort: 1,
    detail: 'The webhook\'s dispute-lost order branch set status REFUNDED and restocked, but never selected giftCardCode/giftCardPence and never called creditVoucher — unlike the charge.refunded reconciliation, which credits the gift-card portion back. An order part-paid with a gift card only ever disputed the CARD portion, so the consumed gift-card value simply vanished.',
    notes: [
      'Fix: the dispute-lost order query selects the gift-card fields and re-credits behind the same atomic status-claim (status != REFUNDED → REFUNDED) that guards restocking, so a redelivered dispute event cannot double-credit. Audit summary notes the re-credit.',
      'Verified: npx tsc --noEmit and npm run build pass clean. Not exercised against a live Stripe dispute.',
    ],
  },
  {
    title: 'Kiosk/AI-consultation photo remove control visible on touch; analysis progress announced to screen readers (BLD-1292, BLD-1275)',
    type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 6, effort: 1,
    detail: 'BLD-1292: the uploaded-photo ✕ button in KVision was opacity-0 with group-hover reveal only — on the touch-first /ai-consultation and kiosk surfaces there is no hover, so the control was present and tappable but invisible. BLD-1275: the kiosk analysing spinner and rotating status copy had no role="status"/aria-live, so assistive-tech users got no indication analysis started or finished (WCAG 4.1.3).',
    notes: [
      'BLD-1292: the remove button is now visible by default and slightly larger (h-7); pointer:fine media override restores the tidy hover/focus-within reveal on mouse devices only.',
      'BLD-1275: the analysing step and the result-loading branch are role="status" aria-live="polite" regions; the spinner and the 3-second rotating micro-copy are aria-hidden so the announcement is the heading once, not a line every rotation.',
      'Verified: npx tsc --noEmit and npm run build pass clean.',
    ],
  },
  {
    title: 'npm audit CI check green again — deepmerge-ts advisory resolved via override (BLD-1366)',
    type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 4, effort: 1,
    detail: 'The security workflow\'s `npm audit --omit=dev --audit-level=high` failed on every PR regardless of diff: GHSA-ggr8-5vv4-36mx (deepmerge-ts < 8.0.0, stack exhaustion on recursive object graphs, HIGH) reached the lockfile via prisma → @prisma/config → deepmerge-ts@7.1.5, and no prisma release carried the fixed major yet. Not in the required-checks set, so merges proceeded — but a permanently red check trains everyone to ignore CI.',
    notes: [
      'Fix: package.json overrides pin deepmerge-ts to ^8.0.1 (the advisory\'s fixed version). Verified the Prisma CLI still works under the override — prisma generate and prisma migrate diff (both load prisma.config.ts through @prisma/config\'s deepmerge usage) run clean — and `npm audit --omit=dev --audit-level=high` reports 0 vulnerabilities.',
      'The override is removable once prisma ships a release depending on deepmerge-ts >= 8.',
    ],
  },
  {
    title: 'Database residency verified as UK (Neon, AWS eu-west-2) and guarded by a nightly region check (BLD-1277)',
    type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 7, effort: 1,
    detail: 'docs/data-protection/processors.md self-flagged the primary Postgres host — every client, booking and encrypted health record — as [OWNER TO CONFIRM: which provider + region], and nothing in code verified residency, so a well-meaning migration to a US endpoint would silently move special-category data across borders.',
    notes: [
      'Verified from the production DATABASE_URL host (*.eu-west-2.aws.neon.tech): the database is Neon on AWS eu-west-2 (London) — UK residency, no cross-border transfer for data at rest. Processors register row updated with the fact, the verification date and the Neon DPA link.',
      'Guard: the daily cron now parses the DATABASE_URL hostname and fails the run (alert-only — existing cron alerting pages; nothing is blocked) if it matches none of the approved region substrings. Approved list defaults to eu-west-2 and is overridable via DB_APPROVED_REGIONS when the owner sanctions a move.',
      'Verified: npx tsc --noEmit and npm run build pass clean.',
    ],
  },
  {
    title: 'Health assessments gain the 8-year clinical retention purge, gated on an owner toggle (PRJ-1069.10)',
    type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 6, effort: 2,
    detail: 'The nightly retention sweep purges SignedConsent and BeforePhoto after 8 years, but HealthAssessment — the raw encrypted allergy/medication/condition/pregnancy answers, the most sensitive category in the database — was exempt, so historic health answers were kept indefinitely by default, against the retention schedule\'s own stated 8-year basis.',
    notes: [
      'The audit required owner sign-off before deleting real health data, so the purge ships OFF by default behind a new admin setting ("Purge old health assessments (8-year clinical window)", settings.manage surface) — the owner flipping the toggle IS the sign-off, and the retention schedule row now says exactly that.',
      'Scope is deliberately more conservative than the adjacent consent/photo purges: rows older than 8 years AND belonging to clients with no treatment inside the window (the schedule\'s "8 years from last treatment" trigger) — an active client\'s history is never touched. Purge count surfaced in the cron retention summary as assessments.',
      'Verified: npx tsc --noEmit and npm run build pass clean. No data deleted until the owner enables the setting.',
    ],
  },
  {
    title: 'Academy portfolio photos of real clients reachable by erasure and SAR via a staff client link (BLD-1291)',
    type: 'TASK', urgency: 'P1', status: 'SHIPPED', assignee: 'claude',
    value: 8, effort: 4,
    detail: 'PortfolioEntry stores fully identifying before/after clinical photos of real clients with only a free-text clientRef ("Client A") — neither eraseClientData nor the SAR export could find them, and consent rests on a trainee tick-box attestation rather than a record from the photographed person. Built the reachability half; the consent-capture redesign remains an owner decision.',
    notes: [
      'Schema: additive nullable PortfolioEntry.clientId FK to Client (SetNull on client delete, indexed; migration committed, no @unique). Staff link a case to the real client from the portfolio review screen (Admin → Academy → Portfolio) by pasting the client\'s CRM email — a dashed warning box shows on any case with photos that has no link, and a linked case shows the covered-by-erasure/SAR state with an Unlink control. Server resolves the email, audit-logs link and unlink (NOTE_ADDED with the client id), gated on settings.manage like the rest of the review surface. Trainees never see or search the clinic client list — the link is staff-only by design.',
      'Erasure: eraseClientData now calls erasePortfolioForClient() after the main transaction — deletes every linked case AND its photo files from the blob store (best-effort with the count of failed file deletions surfaced in the CLIENT_ERASED audit note for manual follow-up; the DB rows are gone regardless).',
      'SAR: the Art. 15 export gains an academyPortfolioCases section (title, treatment, dates, photo count, consent-attestation timestamp, trainee email) for every linked case.',
      'Deliberately NOT built (owner decision, stays open on the board): replacing the trainee self-attestation with a SignedConsent-style record captured from the photographed person — that is consent DESIGN for special-category biometric data. Also note the structural limit: only cases staff have linked are reachable; existing unlinked cases need a one-time linking pass, which the review screen\'s warning boxes now drive.',
      'Verified: npx tsc --noEmit and npm run build pass clean; migration generated offline. Blob deletion not exercised from this sandbox.',
    ],
  },
  {
    title: 'Fully refunded package purchases no longer count as spendable sessions (BLD-1380)',
    type: 'ERROR', urgency: 'P1', status: 'IN_REVIEW', assignee: 'claude',
    value: 8, effort: 3,
    detail: 'clientPackages() (lib/package-sessions.ts) computed paid as Boolean(chargedAt || prepaidAt) and never checked refundedPence, so a fully refunded course purchase still showed full sessions remaining and /api/account/packages let the client keep booking and spending sessions after getting their money back.',
    notes: [
      'Fix: clientPackages() now also selects chargedPence/refundedPence and excludes a purchase from paid once refundedPence >= chargedPence, mirroring the fully-refunded check already used by refundBooking()/refundableRemaining() in lib/booking-actions.ts. A partial refund still leaves the purchase paid and spendable, matching existing partial-refund handling elsewhere.',
      'Review fix: the first cut collapsed two different states into paid=false, so every surface rendering that flag labelled a refunded course as money still owed - the client portal showed "Payment pending" (uk: "Очікує оплати") on their own dashboard, and staff saw "Not yet paid". PackageView now carries a separate refunded flag and the four render sites (app/account/page.tsx, app/admin/clients/[id]/page.tsx, components/admin/PackageLinkControl.tsx, components/admin/NewBookingButton.tsx) show a neutral "Refunded" instead. Spendability is unchanged: paid stays false, so /api/account/packages and /api/booking/start still refuse the sessions.',
      'Known gap, not addressed here: a BNPL/Klarna course records money on prepaidAt/prepaidPence and has no chargePaymentIntentId, so a Stripe-dashboard refund of one never writes refundedPence and this check cannot see it. Pre-existing - refundBooking() already refuses prepaid bookings outright. Worth its own item.',
      'Verified: npx tsc --noEmit and npm run build pass clean.',
    ],
  },
  {
    title: 'Cron-alert webhook fetch in api-health now bounded, matching its sibling routes (BLD-1382)',
    type: 'ERROR', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 6, effort: 1,
    detail: 'app/api/admin/api-health/route.ts posted to CRON_ALERT_WEBHOOK_URL with no AbortSignal.timeout, unlike the identical alert-fetch in cron/daily, cron/dispatch and cron/kiosk-cleanup, which all added an 8s bound after a hung webhook previously stalled a request indefinitely (PRJ-1118.10). This route was missed, and it fires exactly when a critical outage is detected.',
    notes: [
      'Fix: added signal: AbortSignal.timeout(8_000) to match the sibling routes exactly.',
      'Verified: npx tsc --noEmit and npm run build pass clean.',
    ],
  },
  {
    title: 'Homepage \'15% off\' hero CTA now routes straight to instant signup (BLD-1383)',
    type: 'TASK', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 6, effort: 1,
    detail: 'The homepage hero\'s \'Free consultation - 15% off your first visit\' link (components/home/HeroSlider.tsx) pointed to /consultation, a staff-follow-up lead form, while the discount is actually granted instantly by creating a free account (lib/client-auth.ts grants a one-time 15% first-treatment discount on signup). High-intent visitors clicking the discount promise were routed into the slower staff-follow-up funnel instead of the self-serve path that delivers it immediately.',
    notes: [
      'Fix: the hero link now points at /book (the same self-serve booking/signup route used elsewhere in the hero) instead of /consultation. The standalone /consultation page and form are untouched for visitors who want a conversation first.',
      'Verified: npx tsc --noEmit and npm run build pass clean.',
    ],
  },
  {
    title: 'Gift-card strap-line moved out of the logo lock-up; kiosk score rings fit mobile; account portal skip link; web-push sends bounded (BLD-1239, BLD-1294, BLD-1297, BLD-1209)',
    type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 6, effort: 2,
    detail: 'Four small audit fixes batched. BLD-1239: the gift-card preview rendered "Aesthetics · Laser · London" directly beneath the K mark — the exact strap-line-under-the-logo pattern docs/BRAND_GUIDELINES.md forbids, live on the buyer-facing customiser. BLD-1294: two fixed 140px score rings + a 32px gap (312px) overflowed the max-w-md p-6 shareable kiosk result card at 320–390px viewports — the mobile-first viral surface. BLD-1297: the 12 Aug audit claim ("no skip link anywhere") was already stale for the marketing and admin layouts, but the client account portal genuinely had none. BLD-1209: webpush.sendNotification had no timeout and is awaited from the Stripe webhook dispute handler and the daily cron via notifyStaffByPermission — one unresponsive push endpoint could stall the whole notify call.',
    notes: [
      'BLD-1239: descriptor moved to the card footer above the voucher code, out of the logo lock-up. The emailShell header carries a similar descriptor 18px under the wordmark — that layout was part of the owner-reviewed email rebuild, so it was left untouched and flagged on the board for a brand call rather than changed unilaterally.',
      'BLD-1294: rings are h-28 (112px) below sm and 140px above, gap-4 on mobile; the SVG scales via its viewBox so the ring geometry is unchanged. Score numeral steps down one size on mobile to stay inside the smaller ring.',
      'BLD-1297: skip link + <main id="main"> landmark added to app/account/layout.tsx, mirroring the marketing/admin pattern; the account 404 page\'s own <main> became a div so the landmark stays unique. The kiosk layout is deliberately untouched — it is a chrome-less device surface with no nav to skip. PRJ-1118.11 investigated in the same pass: code-splitting PinnedExperience would NOT remove motion/react from the homepage bundle (Reveal/ScrollReveal/CountUp import it statically on the same page), so the audit\'s suggested fix is a placebo — noted on that item instead of shipping indirection.',
      'BLD-1209: each webpush.sendNotification is wrapped in a 10s bounded race (mirroring lib/booking-actions.ts bestEffort); the 404/410 subscription pruning is preserved, a timeout simply falls through as a failed best-effort send.',
      'Verified: npx tsc --noEmit and npm run build pass clean.',
    ],
  },
  {
    title: 'Lint gate restored post-Next 16; abandoned shop orders release gift-card reservations; error text unified on the theme token (BLD-1214, BLD-1253, BLD-1261, BLD-1246)',
    type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 6, effort: 3,
    detail: 'BLD-1214: package.json lint still shelled to `next lint`, removed in Next 16 — npm run lint errored before running a single rule, so no session had lint-checked its changes since the upgrade. BLD-1253: the shop checkout uses a plain PaymentIntent (never auto-expires), so an abandoned checkout left the order PENDING forever with any reserveVoucher() gift-card decrement permanently stranded — bookings have had this sweep since PRJ-1043.3, orders did not. BLD-1261: 40+ files hardcoded #b23b3b / #c0392b for error text instead of the --color-blush-deep token used correctly in 125+ others. BLD-1246 (TreatmentCard hover-title gold contrast) was found already fixed on main — the title uses gold-deep; only a mixed border uses gold, a non-text surface.',
    notes: [
      'BLD-1214: new flat eslint.config.mjs built on eslint-config-next v16\'s native flat-config array; eslint added as an explicit devDependency; lint script is now `eslint .`. The react-hooks v6 compiler-era rules (set-state-in-effect, purity, refs, static-components, immutability, preserve-manual-memoization) fire ~150 times on pre-existing code that `next lint` never checked — they stay ON as warnings so new code holds the line without erroring every session on old patterns. The 10 genuine errors were fixed: 7 unescaped entities escaped, 2 legitimate <a>-to-API-route links (SAR download, OAuth redirect — <Link> would be wrong there) inline-disabled with reasons. npm run lint exits 0.',
      'BLD-1253: releaseAbandonedPendingOrders() in lib/shop.ts, run from the daily cron — cancels web-checkout orders stuck PENDING >7 days (well past the 2–72h recovery-email window; same stripePaymentIntentId-not-null discriminator the automation uses, so POS orders are untouched), cancels the PaymentIntent at Stripe FIRST so a payment cannot land after the order is cancelled, CAS-claims the status so a concurrent webhook finalisation wins, re-credits the gift card via the shared undoVoucherReservation(), and audit-logs each re-credit. PENDING orders never decremented stock, so nothing restocks.',
      'BLD-1261: every #b23b3b / #c0392b replaced with var(--color-blush-deep) across 43 files (tailwind arbitrary values, opacity modifiers, color-mix expressions, inline CSS) — error states are now theme-aware in both light and dark palettes.',
      'Verified: npx tsc --noEmit clean, npm run lint exits 0 (201 warnings visible for incremental cleanup), npm run build clean, edge bundle clean.',
    ],
  },
  {
    title: 'Bundle applications carry the pathway price claim end-to-end; clinical-data views audited at the flagged decrypt sites (BLD-1393, BLD-1240, BLD-1392)',
    type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 7, effort: 3,
    detail: 'BLD-1393: the academy bundle page advertised a pathway price and "Save £X", but its only CTA led to a per-course application with no bundleId anywhere in the checkout chain — the moment a bundle went live, applicants would be mis-sold into full-price single-course enrolment. BLD-1240/BLD-1392 (same finding from two audits): decClinical() decrypts Art. 9 health data at 15+ display sites but only two ever wrote a view-audit row, so the "who viewed whose medical record" trail barely existed.',
    notes: [
      'BLD-1393: the bundle CTA now tags the application (?bundle=<slug>, read client-side in ApplyForm so the ISR course page shell stays static, Suspense-bounded). The apply API validates the claim server-side (bundle exists, is active, and contains the applied course — a spoofed slug is ignored, never parroted), then records it in Enrolment.notes with the bundle price and an instruction to apply the pathway pricing via the agreed-fee field, and flags it in the staff notification + email. Bundle page copy now says explicitly that the team applies the bundle price at enrolment. Deliberately NOT built (product decision, still open on the ticket): a self-serve bundle-priced checkout; the recorded claim + agreed-fee flow makes the promise honest today.',
      'BLD-1240/1392: new lib/clinical-view-audit.ts — auditClinicalView(), a shared fire-and-forget emission throttled to one row per (viewer, client, surface) per hour per instance (cold starts duplicate rather than drop, the right failure direction for an audit trail). Adopted at the four flagged sites: global admin search (consultation snippets), the clinician dashboard focus card (allergies/medical flag), the consultation detail page, and the booking detail allergy note. Calls/health-assessments already audited. Remaining sites (chat admin, incidents) can adopt the same one-liner incrementally — the architectural pattern the audits asked sign-off on now exists and is proven.',
      'Verified: npx tsc --noEmit clean, npm run build clean, edge bundle clean.',
    ],
  },
  {
    title: 'Promotional pricing for academy course bundles; real review rating on the homepage trust strip (BLD-1376, BLD-1159)',
    type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 6, effort: 3,
    detail: 'BLD-1376 (owner request): bundles could only show a standard price — no limited-time offers. BLD-1159: the homepage trust strip listed only self-declared credentials while the real aggregate review rating already existed elsewhere on the page.',
    notes: [
      'BLD-1376: CourseBundle gains promoPrice/promoStartAt/promoEndAt (additive migration, mirrors the Course promo fields from BLD-490; the shared getActivePromo() decides what is live, so bundle and course promos can never disagree on timing semantics). Admin: the bundle editor (Admin → Academy → Bundles) gains "Promo price £" + start/end date fields; clearing the promo price ends the promo without touching the standard price. Public: the bundle detail page shows the promo price with the standard price struck through, a "Special offer" chip and savings vs booking separately; the academy catalogue card shows promo + struck standard price. The BLD-1393 application tagging records the effective (promotional) bundle price so staff quote the promo correctly. "Buy 2 / buy 3 for £X" deals need no new machinery — create a bundle with those courses and set its price (now promo-able).',
      'BLD-1159: the trust strip pulls getReviewAggregate() (Google + verified internal, same source as the hero) and shows "{avg} ★ / N verified client reviews" as a fourth cell — only once real reviews exist, so the strip never fabricates. Third-party marks (CQC, Save Face…) remain owner-gated per the component\'s own rule: never list a credential before it is granted.',
      'BLD-1279 verified already fixed on main during the same pass — every flagged meta description now measures 134–155 chars and titles ≤60 in code AND on the live pages (an earlier SEO batch trimmed them); board row was stale.',
      'Verified: npx tsc --noEmit clean, npm run build clean, edge bundle clean; migration generated offline.',
    ],
  },
  {
    title: 'Admin review star ratings announced to screen readers (BLD-1262)',
    type: 'TASK', urgency: 'P3', status: 'SHIPPED', assignee: 'claude',
    value: 3, effort: 1,
    detail: 'The admin reviews Stars component rendered raw ★/☆ glyphs distinguished only by colour — screen readers announced five star characters and low-vision staff had no numeric fallback (WCAG). The glyph run is now aria-hidden inside a span whose aria-label reads "N out of 5 stars" (or "No rating").',
    notes: [
      'Also verified in the same pass: PRJ-1034.12 (careers Apply seeds the selected role) was already fixed on main by the BLD-1372 batch — ApplyForm reads ?role= and validates it against the vacancy list; board row closed as delivered.',
      'Verified: npx tsc --noEmit and npm run build pass clean.',
    ],
  },
  {
    title: 'Account portal duplicate main landmark fixed; kiosk reward claim gets an explicit opt-in tick; reschedule offers the waitlist; offer countdowns surfaced (BLD-1420, BLD-1421, BLD-1422, BLD-1423)',
    type: 'TASK', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 6, effort: 3,
    detail: 'Four conversion/a11y fixes from the live Build & Issues board. BLD-1423: components/portal/PortalShell.tsx rendered its own <main id="main"> nested inside the one app/account/layout.tsx already provides, duplicating the DOM id the skip-link targets and breaking AT landmark navigation. BLD-1420: components/kiosk/ClaimReward.tsx implied marketing consent from passive "by continuing you agree" text, with no tick-box and no way to decline it — unlike EnquiryForm/GiftVoucherFlow/GroupBookingForm\'s explicit, off-by-default marketingOptIn checkbox — and lib/kiosk.ts#claimKioskDiscount hard-coded marketingOptIn: true on every new client it created regardless of what (if anything) the visitor agreed to. BLD-1421: the reschedule flow in app/(marketing)/booking/manage/ManageClient.tsx dead-ended on "No availability... please call us" with no waitlist option, while the fresh-booking flow (BookingFlow.tsx) offers WaitlistCTA in the identical no-slots situation. BLD-1422: OffersStrip and AnnouncementBar both already fetch endAt for every live promotion but never rendered it — no expiry/urgency signal anywhere on / or /pricing/offers despite the data already being on hand.',
    notes: [
      'BLD-1423: the inner <main id="main" className="flex-1 py-9 md:py-14"> in PortalShell.tsx is now a plain <div> with the same className; the outer app/account/layout.tsx <main id="main"> remains the one landmark for every /account/* page.',
      'BLD-1420: ClaimReward.tsx gains a checkbox (default unchecked) using the same accent-[var(--color-gold)] + wording pattern as EnquiryForm, and sends marketingOptIn in the POST body to /api/kiosk/results/[id]/claim. The route passes it through to claimKioskDiscount(resultId, email, firstName, marketingOptIn), which now creates a brand-new client with marketingOptIn set to whatever the visitor actually ticked, stamping marketingConsentFields(\'kiosk\') only when true — an existing client\'s own preference is still never overwritten by an unverified kiosk-typed email (BLD-892), unchanged.',
      'BLD-1421: WaitlistCTA is now exported from components/booking/BookingFlow.tsx (its client prop narrowed to {firstName, email} so callers without a full signed-in ClientInfo, like the token-based manage page, aren\'t forced to fabricate one). app/(marketing)/booking/manage/page.tsx now selects the client\'s firstName/email alongside the booking and passes them through; ManageClient.tsx renders WaitlistCTA in its no-slots reschedule branch with the booking\'s treatmentSlug/treatmentTitle and the chosen rescheduleDate, the same shape BookingFlow.tsx already passes.',
      'BLD-1422: new lib/offer-countdown.ts#offerCountdownLabel(endAt) — deliberately not server-only so both the async server component OffersStrip and the \'use client\' AnnouncementBar can import it — returns "Ends today" / "Ends tomorrow" / "Ends in N days" by calendar-date difference (stable through the day), or null for a missing/already-past endAt so nothing renders (no crash, no "Ends never"). OffersStrip shows it as a small pill beside each offer\'s discount badge; AnnouncementBar shows it as a pill beside the message, both using existing --color-gold tokens, no raw hex.',
      'BLD-1423 follow-up (review fix): removing the nested <main> alone left the portal\'s own skip link pointing at #main, which is the outer app/account/layout.tsx landmark wrapping this whole shell — following it landed above the portal navigation and skipped nothing. The content wrapper now carries id="portal-content" (tabIndex -1, no extra tab stop) and the portal skip link targets that, so it actually jumps past the header and nav. Still exactly one <main id="main"> per /account page.',
      'BLD-1421 follow-up (review fix): importing WaitlistCTA from BookingFlow.tsx pulled that whole module into the manage-booking page\'s client bundle — Turbopack did not tree-shake it, so the page grew from 326 KB to 391 KB of client chunks and started shipping @stripe/react-stripe-js on a page clients open from a link in every confirmation email. WaitlistCTA moved to its own components/booking/WaitlistCTA.tsx; BookingFlow.tsx and ManageClient.tsx both import it from there. No behaviour or markup change.',
      'Verified: npx tsc --noEmit and npm run build pass clean.',
    ],
  },
  {
    title: 'Confirmation guard on destructive medical-record clears; audit trail on gift-voucher redeem/cancel (BLD-1414, BLD-1416)',
    type: 'ERROR', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 5, effort: 2,
    detail: 'BLD-1414: MedicalFlagEditor and PatchTestEditor wiped a client medical-flag/patch-test record on a bare onClick with no confirmation, unlike every other destructive admin action in the codebase. BLD-1416: the gift-vouchers admin route redeemed and cancelled voucher balances with no logAudit call, unlike every other money-mutating admin handler.',
    notes: [
      'BLD-1414: components/admin/MedicalFlagEditor.tsx and components/admin/PatchTestEditor.tsx each gain a clear() wrapper that runs window.confirm(...) before calling save(\'\')/save(null), matching the existing guard style (e.g. TwoFactorSetup.tsx\'s disable(), CredentialsManager.tsx\'s clear()) — the Clear button now calls the guarded wrapper instead of save directly. No other behaviour changed.',
      'BLD-1416: app/api/admin/gift-vouchers/route.ts\'s redeem and cancel branches now call logAudit with action REWARD_REDEEMED, matching the established convention for every other gift-voucher balance change in the codebase (app/api/admin/bookings/session/route.ts, lib/shop.ts, lib/booking-actions.ts, the Stripe webhook). Actor/actorRole come from the staff session, summary embeds the voucher code, amount and an optional staff-supplied reason, and meta carries voucherCode/amountPence/reason for the audit trail.',
      'BLD-1416 follow-up (review fix): the redeem audit first recorded the amount the staff member typed, not the amount actually deducted — redeemVoucher() caps the deduction at the live balance, so a £100 entry against a £30 card redeemed £30 while the audit row claimed £100. redeemVoucher() now returns redeemedPence (the capped figure) and the route audits that; the requested figure is kept in meta.requestedPence only when the two differ.',
      'Verified: npx tsc --noEmit and npm run build pass clean.',
    ],
  },
  {
    title: 'Clinical-view audit gap closed at 3 more decrypt sites; chat transcripts gated on clinical permission; PII scrubbed from 3 more error logs; Google Workspace admin split into its own OWNER-only permission (BLD-1419, BLD-1415, BLD-1417, BLD-1413)',
    type: 'ERROR', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 7, effort: 3,
    detail: 'BLD-1419: three more decClinical()-for-display sites never called the auditClinicalView() helper introduced for the BLD-1240/1392 batch — the admin dashboard next-arrival card, the clinical task detail on the Tasks board, and the live treatment-session screen (SessionRunner\'s data feed). BLD-1415: ChatMessage.body is Art. 9 clinical data (visitors routinely disclose symptoms/medical history to the AI concierge), but the chat route decrypted it for any staff with plain clients.view, the same class of gap already fixed for call transcripts (calls.view for the log, clients.clinical.view for the recording/transcript). BLD-1417: account/assessment, dentistry-interest and newsletter still did console.error(\'...\', e) — e can echo the just-submitted health-assessment answers or an email address straight into Vercel logs. BLD-1413: every Google Workspace admin route (create/suspend accounts, alias, group membership, seat audit) was gated on the generic settings.manage — any staff member granted that one permission for, say, editing clinic hours could also mint or suspend Google accounts and manage Google Group membership, a blast radius comparable to a financial export or key rotation.',
    notes: [
      'BLD-1419: added the same one-line auditClinicalView({ actor, actorRole, clientId, surface, bookingId? }) call (lib/clinical-view-audit.ts, dynamic-imported) used at the four existing sites, at: app/admin/page.tsx (next-arrival allergies/medicalFlag, surface "admin-dashboard"), app/admin/tasks/page.tsx (per clinical task in the shape() mapper, surface "tasks-board"), and app/admin/bookings/[id]/session/page.tsx (the page that decrypts allergyNote/medicalFlag/clinicalNote and feeds them into SessionRunner as props, surface "session-runner"). The audit helper itself is unchanged.',
      'BLD-1415: app/api/admin/chat/route.ts now computes canClinical = sessionCan(session, \'clients.clinical.view\') alongside the existing clients.view gate (mirroring the calls route\'s split). The "list" op\'s preview snippet only decrypts when canClinical (empty string otherwise, same redaction shape as calls\' recordingUrl); the "messages" (thread-read) op now hard-403s without canClinical before touching any message body, then calls auditClinicalView() on decrypt — only for chats with a clientId (signed-in visitors); anonymous chats have none to audit against.',
      'BLD-1417: all three routes now log console.error(\'[route] failed:\', (e as Error)?.message) and separately Sentry.captureException(e, { tags: { area: \'route\' } }), the exact pattern already used at app/api/account/signup/route.ts and 7 other sites — the full exception (and whatever PII it echoes) still reaches Sentry, only the truncated message reaches the shared Vercel log stream.',
      'BLD-1413: added workspace.manage to lib/permissions.ts under Administration (sensitive: true, mirrors security.manage\'s shape) and excluded it from ROLE_DEFAULTS.ADMIN alongside staff.manage/settings.manage/security.manage — OWNER-only by default, grantable per-staff like any other permission. Every sessionCan(session, \'settings.manage\') gate under app/api/admin/integrations/google-workspace/** (users create/suspend, aliases, groups create, group members add/remove, seat-audit, test) now checks workspace.manage instead; the app/admin/workspace page gate and its nav entry (lib/admin-nav.ts) were switched too, so a settings.manage holder without workspace.manage no longer sees a nav link into a page whose every API call would 403. The Workspace user-create route now runs the client-supplied password through isBreachedPassword() before calling createWorkspaceUser() — identical check, error copy and fail-open-on-HIBP-outage behaviour as app/api/admin/staff/route.ts and lib/client-auth.ts. Deliberately out of scope for this pass: a WebAuthn/passkey step-up requirement on top of workspace.manage — that is a larger, separate feature and was not built here.',
      'Verified: npx tsc --noEmit and npm run build pass clean.',
    ],
  },
  {
    title: 'Kiosk analysis sessions no longer wedge in analyzing forever; IndexNow wired to journal publishing (BLD-1418, BLD-1424)',
    type: 'ERROR', urgency: 'P2', status: 'IN_REVIEW', assignee: 'claude',
    value: 6, effort: 3,
    detail: 'BLD-1418: app/api/kiosk/sessions/[token]/analyze/route.ts claims a session by flipping stage to analyzing then runs the AI call via after() inside a 60s function; if that background call is platform-killed rather than throwing, lib/kiosk.ts\'s own catch (which resets stage to failed) never runs, so the row is stuck claimed forever and every retry no-ops against the stale claim. BLD-1424: lib/indexnow.ts\'s indexNow() is called from the reviews, staff, seo and academy admin routes but never from app/api/admin/posts/route.ts, the journal\'s admin route and the site\'s most frequently updated content type.',
    notes: [
      'BLD-1418: added KioskSession.analyzingSince (nullable DateTime, additive schema change) stamped whenever a session is claimed into analyzing. The claim query in the analyze route now also accepts a session already in stage analyzing if analyzingSince is older than 90s (well past the 60s maxDuration, so a session still claimed by then is dead, not slow) — a client retry after a wedge self-recovers immediately. app/api/cron/kiosk-cleanup/route.ts (existing daily GDPR sweep) gained a third pass that flips any session still stuck in analyzing after 10 minutes to status ANALYSIS_FAILED / stage failed, matching lib/kiosk.ts\'s own failure shape exactly — the backstop for sessions nobody retries.',
      'BLD-1424: app/api/admin/posts/route.ts now fires indexNow([\'/journal\', `/journal/${slug}`]) on create and update, only when the post\'s status is PUBLISHED, and only after the DB write has succeeded (inside the try, after revalidation).',
      'Pre-merge review fixes: (1) a NULL analyzingSince never satisfies a `lt` filter, so both the re-claim and the cron sweep gained an explicit null branch gated on updatedAt — without it the rows that matter most stayed wedged: sessions already in analyzing when the column ships (it backfills NULL) and any set to analyzing through the public stage route, which stamps nothing. (2) The cron sweep no longer marks a session ANALYSIS_FAILED when a KioskResult already exists for it (killed between the result write and the session write in runKioskAnalysisV2); those are completed to ANALYZED / reveal instead, so a good result is not reported as a failure. (3) The IndexNow ping runs inside after() rather than as a bare floating promise, which the platform can freeze the moment the response is sent.',
      'Verified: npx tsc --noEmit and npm run build pass clean.',
    ],
  },
  {
    title: 'Treatment pages show treatment-specific testimonial quotes alongside the star rating (BLD-1447)',
    type: 'TASK', urgency: 'P2', status: 'SHIPPED', assignee: 'claude',
    value: 7, effort: 3,
    detail: 'lib/reviews-aggregate.ts already tags each internal ReviewCard with a treatment field and returns the full cards array from getReviewAggregate(), but components/treatment/TreatmentTemplate.tsx already destructured it into treatment-matched cards, only with a bug: when zero cards named the exact treatment (the common case for less-reviewed treatments), it fell back to rendering quotes for unrelated treatments under that treatment\'s rating — a customer\'s Botox review appearing on the Laser Hair Removal page, for example, which misrepresents what the quote is about.',
    notes: [
      'components/treatment/TreatmentTemplate.tsx: testimonialCards now filters aggregate.cards to card.treatment === t.title (exact match) and slices to the first 2, with no fallback to aggregate\'s general card pool — when nothing matches, testimonialCards is empty and the existing `{testimonialCards.length > 0 && ...}` guard renders nothing extra, leaving the star rating (rating.average/rating.count) as the only thing shown, exactly as before. Matching cards render as blockquote cards directly under the star-rating link, reusing the existing rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5 card pattern already used elsewhere on the page (e.g. the pricing-status card), each showing a per-card Stars rating, the quote body and the author — no placeholder text, no fabricated content, only real cards returned by getReviewAggregate().',
      'Verified: npx tsc --noEmit and npm run build pass clean.',
    ],
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
