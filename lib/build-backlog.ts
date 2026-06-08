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
};

// Who can unblock an input-required task. Resolved to an actual user from the
// live roster: OWNER → the account owner (business/admin/DNS decisions);
// CLINICAL → the most senior practising clinician (treatment/pricing calls).
export type OwnerInputRole = 'OWNER' | 'CLINICAL';

/** Value-to-effort ratio — higher is done sooner. */
export const vToE = (it: { value?: number; effort?: number }): number | null =>
  it.value && it.effort ? Math.round((it.value / it.effort) * 100) / 100 : null;

const PR = (n: number) => `https://github.com/JoeKaulPulse/K-Clinics/pull/${n}`;

export const BUILD_BACKLOG: BacklogItem[] = [
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
    title: 'Adopt the board as the work portal + migrate backlog', type: 'TASK', urgency: 'P2', status: 'IN_PROGRESS',
    detail: 'Seed the session backlog here with statuses + decision notes; add an "assigned to me" view; create a task before any future work and log actions against it.',
    notes: ['This item is itself logged here. Going forward: create a board item (or GitHub issue) before starting, and record decisions as comments.'],
  },
  {
    title: 'Email lifecycle: post-course check-in, NPS, membership renewal', type: 'TASK', urgency: 'P3', status: 'TRIAGE', assignee: 'claude',
    detail: 'Remaining lifecycle emails/automations, to be built opt-in (default OFF) like the others.',
  },
  {
    title: 'Self-serve reschedule flow + confirmation email', type: 'TASK', urgency: 'P3', status: 'BLOCKED', assignee: 'claude',
    value: 6, effort: 5, needs: 'OWNER',
    ask: 'Decide whether clients can reschedule their own appointments online, or whether it stays staff-handled by phone. If self-serve, tell me your rules — e.g. minimum notice (24/48h), how many times a booking may be moved, and whether a deposit transfers. Reply with your choice and rules and I’ll build it, including the reschedule-confirmation email.',
    detail: 'There is no self-serve reschedule today (clients are pointed to call). Building the reschedule action is a prerequisite for a reschedule-confirmation email.',
    notes: ['Question for the owner: do you want clients to self-reschedule online, or keep it staff-handled? Blocked pending that decision.'],
  },
  {
    title: 'Build board phase 2: public roadmap + release announcements', type: 'IDEA', urgency: 'P3', status: 'TRIAGE', assignee: 'claude',
    value: 4, effort: 6,
    detail: 'Public "coming soon"/changelog fed by items flagged public, and auto-drafted on-brand release announcements when a feature ships.',
  },
  {
    title: 'Verify mail.kclinics.co.uk in Resend (sending + inbound)', type: 'TASK', urgency: 'P1', status: 'BLOCKED',
    value: 7, effort: 1, needs: 'OWNER',
    ask: 'In Resend → Domains, add the domain mail.kclinics.co.uk and copy the DNS records it generates. In your DNS host, add the DKIM TXT record(s) + the SPF record (sending), and the MX + CNAME + CAA records (Resend Inbound, for replies). Then press Verify in Resend. Reply here when every row shows ✓ (propagation can take a few hours) and I’ll switch chat email fully live — both sending and threaded inbound replies.',
    detail: 'Chat email sends from chat@mail.kclinics.co.uk and replies route via Resend Inbound — both need mail.kclinics.co.uk verified (DKIM/SPF for sending; CNAME+CAA+MX for inbound).',
    notes: ['Owner action with the new DNS access — tracked on the Go-live page (with-owner filter). Blocked until DNS verified.'],
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
];

// Bumps whenever the backlog set changes, so the lazy auto-seed re-runs after a
// deploy and picks up newly-added items (the seed itself is deduped by title).
export const BACKLOG_VERSION = `v1:${BUILD_BACKLOG.length}`;
