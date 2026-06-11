// Step 3b: import staff (sotrudniki) as practitioner accounts + assign their
// past appointments to them.
//
//   Dry run:   node scripts/migrate-wp/migrate-staff.mjs --file data/full-dump.sql --dry-run
//   Commit:    DATABASE_URL=... node scripts/migrate-wp/migrate-staff.mjs --file data/full-dump.sql --commit
//   In-process: await run({ file, commit, log })
//
// sotrudniki / sotrudniki_dent → AdminUser (role PRACTITIONER, isClinician, no
// usable login until they set a password). grafik.id_sotrudnik → the booking's
// practitionerId, matched via the [wp:grafik#id] marker in the booking notes.
// Re-runnable: upserts staff by email; never modifies an existing account.

import './lib-env.mjs';
import { pathToFileURL } from 'node:url';
import { streamDump, normEmail } from './lib-dump.mjs';
import { openDb } from './lib-db.mjs';

const slug = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');

export async function run({ file, commit = false, log = console.log } = {}) {
  if (!file) throw new Error('Provide a dump file.');
  const num = (n) => n.toLocaleString('en-GB');

  const staff = new Map();   // "table:id" -> { fname, lname, email, dent }
  const apptStaff = [];      // { marker, key }

  const want = (t) => ['sotrudniki', 'sotrudniki_dent', 'grafik', 'grafik_dent'].includes(t);
  await streamDump(file, {
    wantRows: want,
    onRows: (t, rows) => {
      if (t === 'sotrudniki' || t === 'sotrudniki_dent') { const dent = t === 'sotrudniki_dent'; for (const r of rows) staff.set(`${t}:${r.id}`, { fname: (r.fname || '').trim(), lname: (r.lname || '').trim(), email: normEmail(r.email), dent }); }
      else if (t === 'grafik' || t === 'grafik_dent') { const dent = t === 'grafik_dent'; for (const r of rows) { if (r.id_sotrudnik == null) continue; apptStaff.push({ marker: `[wp:${dent ? 'grafik_dent' : 'grafik'}#${r.id}]`, key: `${dent ? 'sotrudniki_dent' : 'sotrudniki'}:${r.id_sotrudnik}` }); } }
    },
  });

  const staffList = [...staff.entries()].map(([key, s]) => ({ key, ...s }));
  log('\n=== WordPress staff → practitioners ===');
  log(`Staff (sotrudniki + dent)              : ${num(staffList.length)}`);
  log(`Appointments referencing a staff member: ${num(apptStaff.filter((a) => staff.has(a.key)).length)}`);

  if (!commit) { log('\nDRY RUN — nothing written. Re-run with --commit (and DATABASE_URL) to import.\n'); return { staff: staffList.length, written: 0 }; }

  const db = await openDb();
  const bcrypt = (await import('bcryptjs')).default;
  const crypto = await import('node:crypto');
  let created = 0, linked = 0, skipped = 0;
  const idByKey = new Map();
  try {
    for (const s of staffList) {
      const name = `${s.fname} ${s.lname}`.trim() || 'Practitioner';
      const email = s.email || `${slug(name) || 'staff'}.${s.key.split(':')[1]}@imported.kclinics.local`;
      const before = await db.adminUser.findUnique({ where: { email }, select: { id: true } });
      const u = await db.adminUser.upsert({
        where: { email },
        update: {}, // never modify an existing account (role / password / name preserved)
        create: {
          email, name, role: 'PRACTITIONER', isClinician: true, active: true,
          title: s.dent ? 'Dentist' : 'Practitioner',
          // Unusable random password — they set a real one via password reset.
          passwordHash: bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 11),
        },
      });
      idByKey.set(s.key, u.id);
      if (!before) created++;
    }
    for (const a of apptStaff) {
      const pid = idByKey.get(a.key);
      if (!pid) { skipped++; continue; }
      const bk = await db.booking.findFirst({ where: { notes: { contains: a.marker } }, select: { id: true, practitionerId: true } });
      if (!bk) { skipped++; continue; }
      if (bk.practitionerId === pid) continue;
      await db.booking.update({ where: { id: bk.id }, data: { practitionerId: pid } });
      linked++;
    }
    log(`\n✓ Staff: ${num(created)} created (of ${num(staffList.length)}). Bookings linked to a practitioner: ${num(linked)} (skipped ${num(skipped)}).\n`);
    return { staff: staffList.length, created, linked, skipped };
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
  await run({ file, commit: args.includes('--commit') });
}
