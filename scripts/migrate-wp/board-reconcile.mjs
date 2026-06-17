// Board reconcile: advance DUPLICATE re-logs to SHIPPED so the Build & Issues
// board reflects reality. The routine audits re-logged many findings under fresh
// refs, so the board carries 2-3 open items per real issue. Any open item whose
// title back-references another item — "… (BLD-394)" — is a re-log of BLD-394.
//
// What it does:
//   • Reads every open board item straight from the DB (TRIAGE/IN_PROGRESS/
//     IN_REVIEW/BLOCKED) — same DB the importers use (needs DATABASE_URL).
//   • For each open item whose title cites "(BLD-yyy)", looks up BLD-yyy and
//     compares titles. A CLEAN duplicate (near-identical title) is advanced to
//     SHIPPED via the queue API. A CONTINUATION (title says "phase/slice/Sx/
//     part/batch/remaining…") or a low-similarity match is SKIPPED for your
//     manual review — never auto-shipped.
//   • SHIPPED is NOT closed: it still needs your admin sign-off, and it's fully
//     reversible (reopen any item from the board). Advancing also closes the
//     item's mirror GitHub issue (board.updateBuildItem side-effect).
//
//   node scripts/migrate-wp/board-reconcile.mjs          # DRY RUN — lists everything, changes nothing
//   node scripts/migrate-wp/board-reconcile.mjs --post   # advance the clean duplicates to SHIPPED
//
// Needs DATABASE_URL (read), and BASE_URL + BOARD_QUEUE_TOKEN (to --post).
// Idempotent: re-running skips items already SHIPPED/CLOSED.

import './lib-env.mjs';
import { PrismaClient } from '@prisma/client';

const OPEN = ['TRIAGE', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED'];
// Title signals that an item is a follow-on SLICE, not a pure duplicate.
const CONTINUATION = /\b(phase|phases|slice|slices|part\s*\d|parts|stage\s*\d|batch|follow-?up|residual|remaining|continuation|s[1-9](?:\s*-\s*s?[1-9])?)\b/i;
const BACKREF = /\((BLD-\d+(?:\.\d+)*)\)/i;
const SIM_THRESHOLD = 0.7;

const norm = (t) => String(t)
  .replace(/\[(?:BLD|PRJ)-\d+(?:\.\d+)*\]/gi, ' ')
  .replace(/\((?:BLD|PRJ)-\d+(?:\.\d+)*\)/gi, ' ')
  .replace(/\[P[0-3]\]/gi, ' ')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = (s) => new Set(norm(s).split(' ').filter((w) => w.length > 2));
function jaccard(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0; for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

async function makeDb() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) { console.error('No DATABASE_URL / POSTGRES_URL in the environment.'); process.exit(1); }
  if (/^prisma(\+postgres)?:\/\//.test(url)) {
    const { withAccelerate } = await import('@prisma/extension-accelerate');
    return new PrismaClient({ accelerateUrl: url }).$extends(withAccelerate());
  }
  const { Pool } = await import('pg');
  const { PrismaPg } = await import('@prisma/adapter-pg');
  return new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: url })) });
}

const db = await makeDb();
const all = await db.buildItem.findMany({ select: { id: true, ref: true, title: true, status: true } });
const byRef = new Map(all.filter((i) => i.ref).map((i) => [i.ref, i]));
const open = all.filter((i) => OPEN.includes(i.status));

const dupes = [];   // clean duplicates → advance
const review = [];  // continuation / ambiguous → manual
for (const it of open) {
  const m = it.title.match(BACKREF);
  if (!m) continue;
  const cited = m[1];
  if (it.ref === cited) continue;               // self-reference
  if (CONTINUATION.test(it.title)) { review.push({ it, cited, reason: 'continuation/slice' }); continue; }
  const canon = byRef.get(cited);
  if (!canon) { review.push({ it, cited, reason: `cited ${cited} not found` }); continue; }
  const sim = jaccard(it.title, canon.title);
  if (sim >= SIM_THRESHOLD) dupes.push({ it, cited, sim });
  else review.push({ it, cited, reason: `title similarity ${sim.toFixed(2)} < ${SIM_THRESHOLD}` });
}

console.log(`Open board items: ${open.length}`);
console.log(`Clean duplicate re-logs to advance → SHIPPED: ${dupes.length}`);
console.log(`Skipped for your review (continuation / ambiguous): ${review.length}`);
console.log('='.repeat(72));
for (const d of dupes) console.log(`SHIP  ${(d.it.ref || '(no ref)').padEnd(10)} re-log of ${d.cited.padEnd(9)} — ${d.it.title.slice(0, 76)}`);
if (review.length) {
  console.log('\n--- skipped (review by hand) ---');
  for (const r of review) console.log(`SKIP  ${(r.it.ref || '(no ref)').padEnd(10)} [${r.reason}] — ${r.it.title.slice(0, 70)}`);
}

if (!process.argv.includes('--post')) {
  console.log('\n(dry run — pass --post to advance the clean duplicates to SHIPPED)');
  await db.$disconnect();
} else {
  const base = process.env.BASE_URL, token = process.env.BOARD_QUEUE_TOKEN;
  if (!base || !token) { console.error('\nNeed BASE_URL and BOARD_QUEUE_TOKEN to --post.'); await db.$disconnect(); process.exit(1); }
  let ok = 0, fail = 0;
  console.log(`\nAdvancing ${dupes.length} duplicates to SHIPPED…`);
  for (const d of dupes) {
    if (!d.it.ref) { console.log(`✗ skip (no ref): ${d.it.title.slice(0, 60)}`); fail++; continue; }
    const res = await fetch(`${base.replace(/\/$/, '')}/api/build/queue`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update', ref: d.it.ref, status: 'SHIPPED',
        comment: `Auto-reconcile: duplicate re-log of ${d.cited} — advanced to SHIPPED for your sign-off. If this is genuinely separate work, reopen it.`,
      }),
    }).then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) }));
    if (res.ok) { ok++; console.log(`✓ ${d.it.ref} → SHIPPED`); }
    else { fail++; console.log(`✗ ${d.it.ref}: ${res.error || 'failed'}`); }
    await new Promise((r) => setTimeout(r, 150));
  }
  console.log(`\nDone. Advanced ${ok}, failed ${fail}. Review the SHIPPED items on the board and sign off to close.`);
  await db.$disconnect();
}
