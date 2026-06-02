// Step 3: import operational history — appointments, reviews and loyalty.
//
//   Dry run (no DB):   node scripts/migrate-wp/migrate-history.mjs --file data/full-dump.sql --dry-run
//   Commit (needs DB): DATABASE_URL=... node scripts/migrate-wp/migrate-history.mjs --file data/full-dump.sql --commit
//
//   grafik / grafik_dent  → Booking   (status COMPLETED, or CANCELLED if del=1)
//   review_user           → Review    (published testimonials)
//   bonus                 → ClientPoints (imported loyalty ledger)
//
// Clients must be imported first (migrate.mjs) — we link by matching the old
// user's email to the new Client. Re-runnable: skips rows already imported.

import { streamDump, normEmail, parseDate } from './lib-dump.mjs';

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const file = opt('--file') || args.find((a) => a.endsWith('.sql'));
const commit = args.includes('--commit');
if (!file) { console.error('Provide --file <dump.sql>'); process.exit(1); }
const num = (n) => n.toLocaleString('en-GB');
const slug = (s) => String(s || 'treatment').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'treatment';

// ── gather ──────────────────────────────────────────────────────────────────
const userEmail = new Map();   // wp user id -> email
const usluga = new Map();       // id -> treatment title
const staff = new Map();        // id -> "First Last"
const grafik = [];              // appointment rows (+ dent flag)
const reviews = [];
const loyalty = [];

const want = (t) => /(^|_)(users|uslugi|sotrudniki|sotrudniki_dent|grafik|grafik_dent|review_user|bonus)$/i.test(t);

await streamDump(file, {
  wantRows: want,
  onRows: (t, rows) => {
    // Custom tables have no wp_ prefix but DO contain underscores, so match by
    // exact name (only wp_users gets the prefix-tolerant test).
    if (/(^|_)users$/i.test(t)) for (const r of rows) userEmail.set(r.ID ?? r.id, normEmail(r.user_email));
    else if (t === 'uslugi') for (const r of rows) usluga.set(r.id, (r.name1 || r.name || '').trim() || `Service ${r.id}`);
    else if (t === 'sotrudniki' || t === 'sotrudniki_dent') for (const r of rows) staff.set(`${t}:${r.id}`, `${r.fname || ''} ${r.lname || ''}`.trim());
    else if (t === 'grafik' || t === 'grafik_dent') { const dent = t === 'grafik_dent'; for (const r of rows) grafik.push({ ...r, dent }); }
    else if (t === 'review_user') for (const r of rows) reviews.push(r);
    else if (t === 'bonus') for (const r of rows) loyalty.push(r);
  },
});

// ── build records ─────────────────────────────────────────────────────────
function startFrom(dat, tim) {
  if (!dat) return null;
  const hh = String(Math.max(0, Math.min(23, parseInt(tim, 10) || 0))).padStart(2, '0');
  const d = new Date(`${String(dat).slice(0, 10)}T${hh}:00:00Z`);
  return isNaN(d.getTime()) ? null : d;
}

const bookings = [];
let bkNoClient = 0;
for (const g of grafik) {
  const email = userEmail.get(g.id_user);
  const startAt = startFrom(g.dat, g.tim);
  if (!startAt) continue;
  const title = (g.dent ? '[Dentistry] ' : '') + (usluga.get(g.id_usluga) || `Service ${g.id_usluga}`);
  const practitioner = staff.get(`${g.dent ? 'sotrudniki_dent' : 'sotrudniki'}:${g.id_sotrudnik}`);
  const cancelled = String(g.del) === '1';
  const noteParts = [];
  if (g.info) noteParts.push(String(g.info));
  if (cancelled && g.prichina) noteParts.push(`Cancelled: ${g.prichina}`);
  if (practitioner) noteParts.push(`Practitioner: ${practitioner}`);
  if (g.photo) noteParts.push(`Photo: ${g.photo}`);
  noteParts.push(`[wp:${g.dent ? 'grafik_dent' : 'grafik'}#${g.id}]`);
  bookings.push({
    email, title, slug: slug(title), startAt,
    pricePence: Math.round((parseFloat(g.cost) || 0) * 100),
    status: cancelled ? 'CANCELLED' : 'COMPLETED',
    notes: noteParts.join(' · ').slice(0, 2000),
  });
  if (!email) bkNoClient++;
}

const revRecs = [];
for (const r of reviews) {
  const email = userEmail.get(r.id_user);
  if (!r.message) continue;
  revRecs.push({ email, body: String(r.message).slice(0, 4000), treatmentTitle: usluga.get(r.id_uslugi) || null, submittedAt: parseDate(r.dat) });
}

const ptRecs = [];
for (const b of loyalty) {
  const email = userEmail.get(b.id_user);
  const pts = Math.round(parseFloat(b.bonus) || 0);
  if (!pts) continue;
  ptRecs.push({ email, points: pts, createdAt: parseDate(b.dat), src: `bonus#${b.id}` });
}

// ── report ────────────────────────────────────────────────────────────────
console.log('\n=== WordPress history → bookings / reviews / loyalty ===');
console.log(`Appointments : ${num(bookings.length)}  (cancelled ${num(bookings.filter((b) => b.status === 'CANCELLED').length)}; no matching user ${num(bkNoClient)})`);
console.log(`Reviews      : ${num(revRecs.length)}`);
console.log(`Loyalty pts  : ${num(ptRecs.length)} entries`);
console.log(`Services seen: ${num(usluga.size)}   Staff seen: ${num(staff.size)}`);

if (!commit) { console.log('\nDRY RUN — nothing written. Re-run with --commit (and DATABASE_URL) to import.\n'); process.exit(0); }

// ── commit ──────────────────────────────────────────────────────────────────
const { PrismaClient } = await import('@prisma/client');
const db = new PrismaClient();
const byEmail = new Map();
for (const c of await db.client.findMany({ select: { id: true, email: true } })) byEmail.set(c.email, c.id);
const cid = (email) => (email ? byEmail.get(email) : null);

let bk = 0, rv = 0, pt = 0, skipped = 0;
try {
  for (const b of bookings) {
    const clientId = cid(b.email);
    if (!clientId) { skipped++; continue; }
    const dup = await db.booking.findFirst({ where: { clientId, startAt: b.startAt, treatmentTitle: b.title }, select: { id: true } });
    if (dup) continue;
    const endAt = new Date(b.startAt.getTime() + 60 * 60000);
    await db.booking.create({ data: { clientId, treatmentSlug: b.slug, treatmentTitle: b.title, startAt: b.startAt, endAt, durationMin: 60, pricePence: b.pricePence, status: b.status, notes: b.notes, createdAt: b.startAt } });
    bk++;
  }
  for (const r of revRecs) {
    const clientId = cid(r.email);
    if (!clientId) { skipped++; continue; }
    const dup = await db.review.findFirst({ where: { clientId, body: r.body }, select: { id: true } });
    if (dup) continue;
    await db.review.create({ data: { clientId, body: r.body, treatmentTitle: r.treatmentTitle, status: 'PUBLISHED', channel: 'EMAIL', displayConsent: true, submittedAt: r.submittedAt, requestedAt: r.submittedAt, createdAt: r.submittedAt || undefined } });
    rv++;
  }
  for (const p of ptRecs) {
    const clientId = cid(p.email);
    if (!clientId) { skipped++; continue; }
    const dup = await db.clientPoints.findFirst({ where: { clientId, reason: { contains: p.src } }, select: { id: true } });
    if (dup) continue;
    await db.clientPoints.create({ data: { clientId, points: p.points, category: 'MANUAL', reason: `Imported loyalty (WordPress) [${p.src}]`, awardedBy: 'import', createdAt: p.createdAt || undefined } });
    pt++;
  }
  console.log(`\n✓ Created: ${num(bk)} bookings, ${num(rv)} reviews, ${num(pt)} loyalty entries. Skipped (no matching client): ${num(skipped)}.\n`);
} finally {
  await db.$disconnect();
}
