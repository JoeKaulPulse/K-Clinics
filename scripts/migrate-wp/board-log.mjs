// One-off: logs this session's work to the Build & Issues board via the
// token-authed queue (POST $BASE_URL/api/build/queue). Carries three items:
// the WordPress-import cleanup, the phone-booking emails + call walkthrough,
// and the P0 backlog audit (15 of 20 P0s already fixed in code — close them).
//
// The Claude web session can't reach kclinics.co.uk (egress allowlist: HTTP 403),
// so this carries the log and can be posted from a machine that CAN reach the site:
//
//   node scripts/migrate-wp/board-log.mjs            # prints the payload only
//   node scripts/migrate-wp/board-log.mjs --post     # sends it to the board
//
// Needs BASE_URL and BOARD_QUEUE_TOKEN in the environment (lib-env loads .env*).
// The board de-dupes by title, so re-running is safe (a second post is skipped).

import './lib-env.mjs';

const items = [
  {
    type: 'TASK',
    urgency: 'P1',
    title: 'WP import cleanup: client junk-record scan + assessment de-dup (awaiting owner review)',
    detail: [
      'Root cause of the "corrupted import" is NOT text-encoding corruption (the mojibake scan found 0). The client list is polluted with junk records:',
      '- Test data: keyboard-mash names (fghdfgh, asd asd, авпвапр…), many TEST/REVIEW-tagged, mostly dated 2 Jun 2026.',
      '- Seeded/spam: realistic First.Last names on disposable domains (*.vovk.store, pewara.genuine.mom…).',
      '- Real clients sit underneath (gmail/icloud/yahoo + phone + OPT-IN).',
      '',
      'Tooling added on branch claude/wonderful-edison-nlgfz0:',
      '- scripts/migrate-wp/junk-scan.mjs (093a5d7): READ-ONLY. Buckets clients test/seeded/review/real; protects any client with real activity (booking/payment/portal login/visit/points); writes a review CSV to git-ignored data/junk-candidates.csv; deletes nothing. Classifier validated against live client samples.',
      '- scripts/migrate-wp/cleanup.mjs (c8e9081): garbled-text recovery (mojibake + HTML entities) and CONTENT-based assessment de-dup (decrypts imported assessments, collapses byte-identical-answer rows per client). Dry-run by default.',
      '',
      'Findings:',
      '- Imported skin quizzes all display the import date — importer set submittedAt=null, which defaulted to now(). The "6 repeats" can only be judged by comparing decrypted answers (handled by the content de-dup).',
      '- "debil"-type medical flags are hand-entered, not imported — clear on the client page.',
      '',
      'Status: PAUSED, awaiting owner. Next: owner runs junk-scan, reviews the CSV, approves which buckets to remove; then build the purge step (delete approved buckets, skip has_activity rows; dry-run then --commit).',
    ].join('\n'),
  },
  {
    type: 'TASK',
    urgency: 'P2',
    title: 'Phone-booking: auto-send booking confirmation + call walkthrough (delivered, awaiting review)',
    detail: [
      'Owner request (WhatsApp): a phone/walk-in booking should send the client the same emails as the online flow, and reception wants a guided walkthrough to log the call and trigger those emails as they go.',
      '',
      'Delivered on branch claude/wonderful-edison-nlgfz0 (PR #1024):',
      '- 0897f3a — createManualBooking now calls notifyBookingConfirmed() like the online flow, so a phone booking auto-sends the booking confirmation, which already carries the "Complete my forms" health-form link (→ /account/assessments). With the account-invite/card link the modal already sends, a new phone client now gets the two-email sequence: create-your-account, then confirmation + health form. No double-send — createManualBooking was not previously a caller.',
      '- 07167dc — the "New phone booking" modal post-booking step is now a "Call walkthrough": the read-to-client script (now mentions the confirmation + health form); the two client emails as explicit steps with live status + Resend; and a "Log the call" step (identity / consent / cancellation-policy ticks + free-text notes) saved to the client record as a CALL interaction. Adds server actions logCallNote + resendBookingConfirmation (both bookings.manage).',
      '',
      'Gates: npx tsc --noEmit and next lint clean. NOT visually verified (no Chromium this session) — needs an eyeball before merge.',
      '',
      'Open question for owner: the confirmation currently fires when the booking is created (status is already CONFIRMED), before any card is saved. If it should instead wait until the card link is used, that is a one-line move.',
    ].join('\n'),
  },
  {
    type: 'TASK',
    urgency: 'P1',
    title: 'P0 backlog audit 2026-06-17: 16 of 20 P0s already fixed in code — close them',
    detail: [
      'Read every open P0 (20) against the current code. 16 are already implemented but the board item was never closed. CLOSE these (ref — proof):',
      '- BLD-411 (#1004) shop/confirm returns 402 when no PaymentIntent — app/api/shop/confirm/route.ts:19.',
      '- BLD-393 (#865) gift-card balance restored on refund via creditVoucher — app/api/admin/orders/route.ts:38.',
      '- BLD-392 (#864) signup marketing opt-in defaults false — components/portal/SignupWizard.tsx:23.',
      '- BLD-159 (#574) kiosk SSE secret-gated + 3-connection cap — app/api/kiosk/sessions/[token]/stream/route.ts:31.',
      '- BLD-192 (#578) staff phone booking uses a 15-min past grace, not the 2h public lead — lib/availability.ts:360 + create-action.ts:104.',
      '- BLD-329 (#863) availability slot maths use Europe/London clinic-time helpers — lib/availability.ts:6.',
      '- BLD-406/BLD-189 (#996/#576) consultation is 15 min + sub-service variant dropdown is live — create-action.ts:73. OWNER ACTION: populate variants in Admin > Services.',
      '- BLD-203 (#579) Consultation is bookable in manual booking — app/admin/bookings/page.tsx:60.',
      '- BLD-407 (#997) lesson PDF upload (admin) + learner download — CurriculumManager + ImmersiveCourse.',
      '- BLD-190 (#577) health forms are managed at /admin/health-forms.',
      '- BLD-405 (#995) client form no longer crashes on custom questions — AssessmentRunner option guards. NOTE: the reorder/section FEATURE is still open (see below).',
      '- AUDIT C1 (#452) slot allocation now in a Serializable transaction — app/api/booking/create/route.ts:121.',
      '- AUDIT C2 (#453) right-to-erasure now covers every table — app/admin/actions.ts:50.',
      '- AUDIT C3 (#454) special-category HEALTH free-text encrypted at rest — lib/clinical-crypto.ts (encClinical at every write; decClinical at every read, tolerant of legacy plaintext), backfill script + admin UI present. Audited 2026-06-17: no read-side ciphertext leak (crm-data + dashboard decrypt; my-day/calendar/search are presence-only; reception view omits clinical data). The Art.9 exposure is closed. NOTE: DOB/phone-at-rest is the only remaining slice — see below.',
      '- (#341) deploy resilience: withDbRetry wraps the booking/client hot paths + lib/db.ts pooler.',
      '',
      'GENUINELY OPEN (5) — none is a quick fix:',
      '- #454 remainder: encrypt DOB/phone at rest. These are ORDINARY contact PII (not Art.9 health, which is now done). Large surface — phone drives SMS sends, client search (contains), display, Stripe customer, dedupe — so encrypting breaks search/SMS unless done deterministically. Own scoped project + design decision, not a quick win.',
      '- BLD-138 (#514) clinician appointment-view — large feature/epic, needs scoping.',
      '- BLD-187 (#575) WordPress re-migrate — in flight (cleanup tooling shipped; awaiting owner review of junk-scan CSV).',
      '- BLD-405 (#995) reorder questions + move between sections — admin feature, not yet built.',
      '- BLD-423 (#1005) health record shows "debil" / not rendering — needs the screenshot + the live record to reproduce.',
      '',
      'Epic #451 (Security & Compliance Remediation): its Critical findings C1, C2 and C3-health are all done. Only the DOB/phone-at-rest remainder (above) is outstanding — keep the epic open solely as the tracker for that one slice, or close it and track DOB/phone on its own.',
    ].join('\n'),
  },
];

const payload = { action: 'create', items };

if (!process.argv.includes('--post')) {
  console.log(JSON.stringify(payload, null, 2));
  console.log('\n(print only — pass --post to send to the board)');
} else {
  const base = process.env.BASE_URL;
  const token = process.env.BOARD_QUEUE_TOKEN;
  if (!base || !token) { console.error('Need BASE_URL and BOARD_QUEUE_TOKEN in the environment.'); process.exit(1); }
  const res = await fetch(`${base.replace(/\/$/, '')}/api/build/queue`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  console.log('HTTP', res.status);
  console.log(JSON.stringify(json, null, 2));
  if (!res.ok || json.ok === false) process.exit(1);
}
