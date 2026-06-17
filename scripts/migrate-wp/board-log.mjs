// One-off: logs this session's WordPress-import cleanup work to the Build & Issues
// board via the token-authed queue (POST $BASE_URL/api/build/queue).
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
