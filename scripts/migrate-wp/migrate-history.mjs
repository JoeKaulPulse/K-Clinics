// Step 3: import operational history — appointments, reviews and loyalty.
//
//   Dry run (no DB):   node scripts/migrate-wp/migrate-history.mjs --file data/full-dump.sql --dry-run
//   Commit (needs DB): DATABASE_URL=... node scripts/migrate-wp/migrate-history.mjs --file data/full-dump.sql --commit
//   In-process:        await run({ file, commit, refresh, repair, log })
//
//   grafik / grafik_dent  → Booking   (status COMPLETED, or CANCELLED if del=1)
//   review_user           → Review    (published testimonials)
//   bonus                 → ClientPoints (imported loyalty ledger)
//
// Times: grafik.tim is NOT an hour — it's a slot id into `time_consultation`
// (1 = 09:00, 2 = 09:15 … 45 = 20:00, 15-minute steps), stored as clinic local
// time (Europe/London). Both are honoured here; an earlier import treated the
// slot id as an hour-of-day, which is what --repair fixes on existing rows.
//
// Clients must be imported first (migrate.mjs) — we link by matching the old
// user's email to the new Client. Re-runnable: skips rows already imported.
// Reviews/loyalty that can't reach a person land on the quarantine client
// (held for moderation, never auto-published) instead of being dropped.

import './lib-env.mjs';
import { pathToFileURL } from 'node:url';
import { streamDump, normEmail, parseDate } from './lib-dump.mjs';
import { londonToUtc, ensureQuarantineClient } from './lib-import-shared.mjs';
import { openDb } from './lib-db.mjs';

const slug = (s) => String(s || 'treatment').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'treatment';

export async function run({ file, commit = false, refresh = false, repair = false, log = console.log } = {}) {
  if (!file) throw new Error('Provide a dump file.');
  const num = (n) => n.toLocaleString('en-GB');

  // ── gather ────────────────────────────────────────────────────────────────
  const userEmail = new Map();   // wp user id (String) -> email
  const service = new Map();      // service id -> real treatment name (from `price` table)
  const staff = new Map();        // id -> "First Last"
  const slots = new Map();        // time_consultation id -> { hh, mm } (clinic local)
  const grafik = [];              // appointment rows (+ dent flag)
  const reviews = [];
  const loyalty = [];

  // grafik.id_usluga references price.id (confirmed by diagnose-services), and
  // price.name is the real service name (e.g. "Back of Neck 6 session").
  const want = (t) => /(^|_)users$/i.test(t) || ['price', 'sotrudniki', 'sotrudniki_dent', 'grafik', 'grafik_dent', 'review_user', 'bonus', 'time_consultation'].includes(t);

  await streamDump(file, {
    wantRows: want,
    onRows: (t, rows) => {
      // Custom tables have no wp_ prefix but DO contain underscores, so match by
      // exact name (only wp_users gets the prefix-tolerant test).
      if (/(^|_)users$/i.test(t)) for (const r of rows) userEmail.set(String(r.ID ?? r.id), normEmail(r.user_email));
      else if (t === 'price') for (const r of rows) { const n = (r.name || '').trim(); if (n) service.set(String(r.id), n); }
      else if (t === 'sotrudniki' || t === 'sotrudniki_dent') for (const r of rows) staff.set(`${t}:${r.id}`, `${r.fname || ''} ${r.lname || ''}`.trim());
      else if (t === 'time_consultation') for (const r of rows) { const m = String(r.name1 || '').match(/^(\d{1,2}):(\d{2})/); if (m) slots.set(String(r.id), { hh: +m[1], mm: +m[2] }); }
      else if (t === 'grafik' || t === 'grafik_dent') { const dent = t === 'grafik_dent'; for (const r of rows) grafik.push({ ...r, dent }); }
      else if (t === 'review_user') for (const r of rows) reviews.push(r);
      else if (t === 'bonus') for (const r of rows) loyalty.push(r);
    },
  });

  // ── build records ─────────────────────────────────────────────────────────
  // Slot id → clinic-local wall time → UTC. Unknown/zero slot = time not
  // recorded on the old site: keep the visit (the date is real) at 09:00, noted.
  function startFrom(dat, tim) {
    const slot = slots.get(String(tim));
    const at = londonToUtc(dat, slot ? slot.hh : 9, slot ? slot.mm : 0);
    return at ? { at, timeKnown: Boolean(slot) } : null;
  }

  const bookings = [];
  let bkNoClient = 0, bkNoTime = 0;
  for (const g of grafik) {
    const email = userEmail.get(String(g.id_user));
    const start = startFrom(g.dat, g.tim);
    if (!start) continue;
    const title = (g.dent ? '[Dentistry] ' : '') + (service.get(String(g.id_usluga)) || `Service ${g.id_usluga}`);
    const practitioner = staff.get(`${g.dent ? 'sotrudniki_dent' : 'sotrudniki'}:${g.id_sotrudnik}`);
    const cancelled = String(g.del) === '1';
    const marker = `[wp:${g.dent ? 'grafik_dent' : 'grafik'}#${g.id}]`;
    const noteParts = [marker]; // marker first so it's never truncated (used for dedup/refresh)
    if (g.info) noteParts.push(String(g.info));
    if (cancelled && g.prichina) noteParts.push(`Cancelled: ${g.prichina}`);
    if (practitioner) noteParts.push(`Practitioner: ${practitioner}`);
    if (g.photo) noteParts.push(`Photo: ${g.photo}`);
    if (!start.timeKnown) { noteParts.push('Time of day not recorded on the old site (shown as 9:00)'); bkNoTime++; }
    bookings.push({
      email, title, slug: slug(title), startAt: start.at, marker,
      pricePence: Math.round((parseFloat(g.cost) || 0) * 100),
      status: cancelled ? 'CANCELLED' : 'COMPLETED',
      notes: noteParts.join(' · ').slice(0, 2000),
    });
    if (!email) bkNoClient++;
  }

  const revRecs = [];
  for (const r of reviews) {
    if (!r.message) continue;
    const email = userEmail.get(String(r.id_user));
    // No matching account → quarantine client, held as SUBMITTED for moderation
    // (never published with unknown attribution). The reviewer's first name
    // rides along for staff.
    const orphanNote = !email && r.fname ? `(Reviewer on the old site: ${String(r.fname).trim()})\n\n` : '';
    revRecs.push({ email, orphan: !email, body: (orphanNote + String(r.message)).slice(0, 4000), treatmentTitle: service.get(String(r.id_uslugi)) || null, submittedAt: parseDate(r.dat) });
  }

  const ptRecs = [];
  for (const b of loyalty) {
    // bonus.id_user is a varchar in the dump ('17') — normalise before lookup.
    const email = userEmail.get(String(b.id_user ?? '').trim());
    const pts = Math.round(parseFloat(b.bonus) || 0);
    if (!pts) continue;
    ptRecs.push({ email, points: pts, createdAt: parseDate(b.dat), src: `bonus#${b.id}` });
  }

  // ── report ────────────────────────────────────────────────────────────────
  log('\n=== WordPress history → bookings / reviews / loyalty ===');
  log(`Appointments : ${num(bookings.length)}  (cancelled ${num(bookings.filter((b) => b.status === 'CANCELLED').length)}; no matching user ${num(bkNoClient)}; time unknown ${num(bkNoTime)})`);
  log(`Reviews      : ${num(revRecs.length)}  (unattributed → quarantine, held for moderation: ${num(revRecs.filter((r) => r.orphan).length)})`);
  log(`Loyalty pts  : ${num(ptRecs.length)} entries  (linked to a client: ${num(ptRecs.filter((p) => p.email).length)})`);
  log(`Services seen: ${num(service.size)}   Staff seen: ${num(staff.size)}   Time slots: ${num(slots.size)}`);
  if (repair) log('REPAIR mode: previously imported bookings get their start/end times corrected.');

  if (!commit) { log('\nDRY RUN — nothing written. Re-run with --commit (and DATABASE_URL) to import.\n'); return { bookings: bookings.length, written: 0 }; }

  // ── commit ────────────────────────────────────────────────────────────────
  const db = await openDb();
  const byEmail = new Map();
  for (const c of await db.client.findMany({ select: { id: true, email: true } })) byEmail.set(c.email, c.id);
  const cid = (email) => (email ? byEmail.get(email) : null);

  let bk = 0, rv = 0, pt = 0, skipped = 0, retitled = 0, retimed = 0;
  try {
    for (const b of bookings) {
      const clientId = cid(b.email);
      if (!clientId) { skipped++; continue; }
      const endAt = new Date(b.startAt.getTime() + 60 * 60000);
      // Dedup/refresh by the stable wp marker in notes (title can change between runs).
      const dup = await db.booking.findFirst({ where: { clientId, notes: { contains: b.marker } }, select: { id: true, startAt: true } });
      if (dup) {
        const data = {};
        if (refresh || repair) Object.assign(data, { treatmentTitle: b.title, treatmentSlug: b.slug, pricePence: b.pricePence });
        if (repair && dup.startAt.getTime() !== b.startAt.getTime()) { Object.assign(data, { startAt: b.startAt, endAt, durationMin: 60, createdAt: b.startAt, notes: b.notes }); retimed++; }
        if (Object.keys(data).length) { await db.booking.update({ where: { id: dup.id }, data }); if (refresh) retitled++; }
        continue;
      }
      await db.booking.create({ data: { clientId, treatmentSlug: b.slug, treatmentTitle: b.title, startAt: b.startAt, endAt, durationMin: 60, pricePence: b.pricePence, status: b.status, notes: b.notes, createdAt: b.startAt } });
      bk++;
    }
    for (const r of revRecs) {
      const clientId = cid(r.email) || (r.orphan ? await ensureQuarantineClient(db) : null);
      if (!clientId) { skipped++; continue; }
      const dup = await db.review.findFirst({ where: { clientId, body: r.body }, select: { id: true } });
      if (dup) continue;
      await db.review.create({ data: { clientId, body: r.body, treatmentTitle: r.treatmentTitle, status: r.orphan ? 'SUBMITTED' : 'PUBLISHED', channel: 'EMAIL', displayConsent: !r.orphan, submittedAt: r.submittedAt, requestedAt: r.submittedAt, createdAt: r.submittedAt || undefined } });
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
    log(`\n✓ Created: ${num(bk)} bookings${retitled ? `, re-titled ${num(retitled)}` : ''}${retimed ? `, times repaired on ${num(retimed)}` : ''}, ${num(rv)} reviews, ${num(pt)} loyalty entries. Skipped (no matching client): ${num(skipped)}.\n`);
    return { bookings: bk, retimed, reviews: rv, loyalty: pt, skipped };
  } finally {
    await db.$disconnect();
  }
}

// ── CLI ─────────────────────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
  const file = opt('--file') || args.find((a) => a.endsWith('.sql'));
  if (!file) { console.error('Provide --file <dump.sql>'); process.exit(1); }
  await run({ file, commit: args.includes('--commit'), refresh: args.includes('--refresh'), repair: args.includes('--repair') });
}
