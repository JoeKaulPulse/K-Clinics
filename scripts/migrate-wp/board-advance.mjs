// Board advance: move items that are DONE-but-stuck-in-TRIAGE to SHIPPED, and
// (optionally) enable the GitHub mirror so the ~295 stale open issues self-close.
//
// Why: board-status showed the DB board is healthy (339 SHIPPED) but a handful of
// already-shipped items never left TRIAGE, and github_mirror_enabled is off so the
// mirror issue list is stale. This fixes both — safely.
//
//   node scripts/migrate-wp/board-advance.mjs                 # DRY RUN (changes nothing)
//   node scripts/migrate-wp/board-advance.mjs --post          # advance the curated items to SHIPPED
//   node scripts/migrate-wp/board-advance.mjs --enable-mirror # turn the GitHub mirror on (self-heals stale issues)
//
// SHIPPED still needs your admin sign-off to CLOSE and is reversible. Needs
// DATABASE_URL (read + the mirror toggle), and BASE_URL + BOARD_QUEUE_TOKEN (--post).

import './lib-env.mjs';
import { PrismaClient } from '@prisma/client';

// Curated — NOT heuristic. Tier A: verified done in code this session. Tier B:
// self-declared shipped / routine-run log entries (records of completed runs).
const VERIFIED = {
  'BLD-392': 'Marketing opt-in defaults false — SignupWizard.tsx:23',
  'BLD-393': 'Gift-card balance restored on refund — admin/orders/route.ts:38',
  'BLD-394': 'logAudit logs failures (no longer silent) — lib/audit.ts catch',
  'BLD-406': 'Consultation 15 min + sub-service variant dropdown — create-action.ts:73',
  'BLD-407': 'Lesson PDF upload + learner download — CurriculumManager / ImmersiveCourse',
  'BLD-411': 'Shop confirm returns 402 with no PaymentIntent — shop/confirm/route.ts:19',
};
const LOGS = {
  'BLD-361': 'BLD-355 shipped note', 'BLD-434': 'Self-titled SHIPPED (LMS PDF XSS fix)',
  'BLD-283': 'Routine run log', 'BLD-284': 'Routine run log', 'BLD-287': 'Session merge summary',
  'BLD-305': 'Routine run log', 'BLD-356': 'Routine run log', 'BLD-357': 'Routine run log',
  'BLD-358': 'Routine run log', 'BLD-359': 'Routine run log', 'BLD-360': 'Routine run log',
  'BLD-362': 'Routine run log', 'BLD-363': 'Routine run log', 'BLD-364': 'Routine run log',
  'BLD-365': 'Routine run log', 'BLD-370': 'Routine run log', 'BLD-404': 'Routine run log',
  'BLD-425': 'Routine deploy log', 'BLD-432': 'Run summary log', 'BLD-433': 'Routine run log',
};
const CURATED = { ...VERIFIED, ...LOGS };
const OPEN = ['TRIAGE', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED'];

async function makeDb() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) { console.error('No DATABASE_URL / POSTGRES_URL.'); process.exit(1); }
  if (/^prisma(\+postgres)?:\/\//.test(url)) {
    const { withAccelerate } = await import('@prisma/extension-accelerate');
    return new PrismaClient({ accelerateUrl: url }).$extends(withAccelerate());
  }
  const { Pool } = await import('pg');
  const { PrismaPg } = await import('@prisma/adapter-pg');
  return new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: url })) });
}

const db = await makeDb();

if (process.argv.includes('--enable-mirror')) {
  await db.setting.upsert({
    where: { key: 'github_mirror_enabled' },
    update: { value: 'true', updatedBy: 'reconcile-script' },
    create: { key: 'github_mirror_enabled', value: 'true', updatedBy: 'reconcile-script' },
  });
  const stale = await db.buildItem.count({ where: { status: { in: ['SHIPPED', 'CLOSED'] }, githubNumber: { not: null }, githubClosed: false } });
  console.log(`github_mirror_enabled = true. The app will self-close ~${stale} stale mirror issues (governed/rate-limited) on the next board load / cron.`);
  await db.$disconnect();
  process.exit(0);
}

const rows = await db.buildItem.findMany({ where: { ref: { in: Object.keys(CURATED) } }, select: { ref: true, title: true, status: true } });
const found = new Map(rows.map((r) => [r.ref, r]));
const toAdvance = rows.filter((r) => OPEN.includes(r.status));

console.log('=== curated done/log items ===');
for (const ref of Object.keys(CURATED)) {
  const r = found.get(ref);
  const tier = VERIFIED[ref] ? 'VERIFIED' : 'LOG';
  if (!r) { console.log(`  ${ref.padEnd(9)} (not found on board)`); continue; }
  const act = OPEN.includes(r.status) ? '→ SHIPPED' : '(already ' + r.status + ', skip)';
  console.log(`  ${ref.padEnd(9)} ${tier.padEnd(9)} ${r.status.padEnd(8)} ${act.padEnd(20)} ${CURATED[ref]}`);
}
console.log(`\nWould advance ${toAdvance.length} open item(s) to SHIPPED.`);

if (!process.argv.includes('--post')) {
  console.log('\n(dry run — pass --post to advance; --enable-mirror to fix the stale GitHub issues)');
  await db.$disconnect();
} else {
  const base = process.env.BASE_URL, token = process.env.BOARD_QUEUE_TOKEN;
  if (!base || !token) { console.error('\nNeed BASE_URL and BOARD_QUEUE_TOKEN to --post.'); await db.$disconnect(); process.exit(1); }
  let ok = 0, fail = 0;
  for (const r of toAdvance) {
    const res = await fetch(`${base.replace(/\/$/, '')}/api/build/queue`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', ref: r.ref, status: 'SHIPPED', comment: `Reconcile: already done — ${CURATED[r.ref]}. Advanced to SHIPPED for sign-off.` }),
    }).then((x) => x.json()).catch((e) => ({ ok: false, error: String(e) }));
    if (res.ok) { ok++; console.log(`✓ ${r.ref} → SHIPPED`); } else { fail++; console.log(`✗ ${r.ref}: ${res.error || 'failed'}`); }
    await new Promise((x) => setTimeout(x, 150));
  }
  console.log(`\nDone. Advanced ${ok}, failed ${fail}. Sign off on the board to close them.`);
  await db.$disconnect();
}
