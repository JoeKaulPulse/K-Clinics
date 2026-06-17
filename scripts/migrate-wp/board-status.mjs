// Board status diagnostic (READ-ONLY — changes nothing). Shows the real state of
// the Build & Issues board straight from the DB, so we stop reasoning from the
// stale GitHub mirror. Needs DATABASE_URL.
//
//   node scripts/migrate-wp/board-status.mjs
//
// Prints: status counts, the actual OPEN backlog (the real work), the count of
// stale GitHub mirrors (items shipped/closed in the board whose GitHub issue is
// still open), and whether github_mirror_enabled is on.

import './lib-env.mjs';
import { PrismaClient } from '@prisma/client';

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
const all = await db.buildItem.findMany({
  select: { ref: true, title: true, status: true, urgency: true, githubNumber: true, githubClosed: true, reportedBy: true, updatedAt: true },
  orderBy: [{ status: 'asc' }, { urgency: 'asc' }, { updatedAt: 'desc' }],
});

const counts = {};
for (const i of all) counts[i.status] = (counts[i.status] || 0) + 1;
console.log(`Total BuildItems: ${all.length}`);
console.log('=== status counts ===');
for (const [s, n] of Object.entries(counts).sort()) console.log(`  ${s.padEnd(12)} ${n}`);

const OPEN = ['TRIAGE', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED'];
const open = all.filter((i) => OPEN.includes(i.status));
console.log(`\n=== OPEN backlog (the real remaining work): ${open.length} ===`);
for (const i of open) {
  console.log(`  ${(i.ref || '-').padEnd(10)} ${i.status.padEnd(11)} ${(i.urgency || '').padEnd(3)} ${i.title.slice(0, 82)}${i.reportedBy ? '  [' + i.reportedBy + ']' : ''}`);
}

const stale = all.filter((i) => (i.status === 'SHIPPED' || i.status === 'CLOSED') && i.githubNumber && !i.githubClosed);
console.log(`\n=== Stale GitHub mirrors (board=shipped/closed, issue still OPEN): ${stale.length} ===`);
const mirror = await db.setting.findUnique({ where: { key: 'github_mirror_enabled' } }).catch(() => null);
console.log(`github_mirror_enabled: ${mirror ? mirror.value : '(unset → off)'}`);
console.log('\n(If stale mirrors is high and mirroring is off, enabling it lets the app self-heal the issue list.)');

await db.$disconnect();
