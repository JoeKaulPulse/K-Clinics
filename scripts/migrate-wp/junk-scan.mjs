// READ-ONLY junk scan. Buckets every client (test / seeded-spam / review / real),
// protects anyone with real activity (a booking, payment, portal login, visit or
// loyalty points), prints safe counts, and writes the FULL candidate list to
// scripts/migrate-wp/data/junk-candidates.csv (git-ignored) for you to review in
// Numbers/Excel. DELETES NOTHING — this is the review step.
//
//   DATABASE_URL=... node scripts/migrate-wp/junk-scan.mjs
//
// After you've reviewed the CSV and confirmed, a separate purge step removes only
// the buckets you approve and still skips anyone marked has_activity.

import './lib-env.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openDb } from './lib-db.mjs';

// Common consumer mailbox providers (UK-weighted). A real client almost always
// uses one of these; an unknown domain is flagged for a human look, not deleted.
const MAINSTREAM = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'outlook.co.uk', 'hotmail.com', 'hotmail.co.uk',
  'live.com', 'live.co.uk', 'msn.com', 'icloud.com', 'me.com', 'mac.com', 'yahoo.com', 'yahoo.co.uk',
  'ymail.com', 'rocketmail.com', 'aol.com', 'proton.me', 'protonmail.com', 'pm.me', 'gmx.com', 'gmx.co.uk',
  'mail.com', 'zoho.com', 'fastmail.com', 'btinternet.com', 'sky.com', 'virginmedia.com', 'talktalk.net',
  'ntlworld.com', 'blueyonder.co.uk', 'tiscali.co.uk', 'hotmail.fr', 'yahoo.fr', 'orange.fr',
]);

// Keyboard rows (EN + RU) for detecting mashed input.
const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890', 'йцукенгшщзхъ', 'фывапролджэ', 'ячсмитьбю'];

export function looksMash(s) {
  const t = String(s || '').toLowerCase().replace(/[^a-zа-яё0-9]/g, '');
  if (!t) return false;
  if (/(.)\1{2,}/.test(t)) return true;                 // 3+ of the same char (www, ttt, aaaa)
  if (/^(test|demo)\d*$/.test(t)) return true;
  for (const r of ROWS) {                               // a 4+ contiguous keyboard run anywhere
    for (let i = 0; i + 4 <= r.length; i++) {
      const run = r.slice(i, i + 4);
      if (t.includes(run) || t.includes([...run].reverse().join(''))) return true;
    }
  }
  if (t.length >= 3 && t.length <= 8) {                 // whole token IS a short row slice (asd, qwe, zxc)
    for (const r of ROWS) { if (r.includes(t) || [...r].reverse().join('').includes(t)) return true; }
  }
  if (t.length >= 5) {                                  // every char from one keyboard row (rtyert, qwert)
    for (const r of ROWS) { if ([...t].every((ch) => r.includes(ch))) return true; }
  }
  return false;
}

export function classify(name, email, tags = []) {
  const domain = (email.split('@')[1] || '');
  const local = (email.split('@')[0] || '');
  if (tags.some((t) => /test|likely-test/i.test(t))) return 'test';
  if (/\btest\b|\bdemo\b/i.test(name)) return 'test';
  if (looksMash(name) || looksMash(local)) return 'test';
  const mainstream = MAINSTREAM.has(domain);
  const dotName = /^\p{L}+[.\-_]\p{L}+/u.test(name) && !/\s/.test(name.trim()); // "First.Last" with no space
  const randomSub = /^[a-z0-9]{2,6}\.[a-z0-9-]+\.[a-z]{2,6}$/.test(domain) && !/^(www|mail|email|smtp|m|e)\./.test(domain);
  const junkDomain = /vovk\.store$/.test(domain) || randomSub || (!mainstream && /\.(store|mom|gy|ru|ty|rt|tu|yu|tk|ml|ga|cf|xyz)$/.test(domain));
  if (junkDomain) return 'seeded';
  if (dotName && !mainstream) return 'seeded';
  if (domain && !mainstream) return 'review';
  return 'real';
}

export async function run({ log = console.log } = {}) {
  const db = await openDb();
  const n = (x) => Number(x).toLocaleString('en-GB');
  try {
    const clients = await db.client.findMany({
      select: {
        firstName: true, lastName: true, email: true, phone: true, tags: true, source: true,
        passwordHash: true, stripeCustomerId: true, lastVisitAt: true, membership12moPence: true, createdAt: true,
        _count: { select: { bookings: true, points: true } },
      },
    });
    const counts = { real: 0, test: 0, seeded: 0, review: 0, protectedActive: 0 };
    const rows = [];
    for (const c of clients) {
      const name = `${c.firstName || ''} ${c.lastName || ''}`.trim();
      const bucket = classify(name, (c.email || '').toLowerCase(), c.tags || []);
      const hasActivity = c._count.bookings > 0 || c._count.points > 0 || !!c.passwordHash || !!c.stripeCustomerId || !!c.lastVisitAt || (c.membership12moPence || 0) > 0;
      if (bucket === 'real') { counts.real++; continue; }
      if (hasActivity) counts.protectedActive++; else counts[bucket]++;
      rows.push({
        bucket, activity: hasActivity ? 'YES' : '',
        firstName: c.firstName || '', lastName: c.lastName || '', email: c.email || '', phone: c.phone || '',
        signup: c.createdAt ? new Date(c.createdAt).toISOString().slice(0, 10) : '', tags: (c.tags || []).join('|'),
      });
    }

    // Write the full candidate list to a git-ignored file for review (contains PII).
    const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, 'junk-candidates.csv');
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    rows.sort((a, b) => a.bucket.localeCompare(b.bucket) || b.signup.localeCompare(a.signup));
    const lines = ['bucket,has_activity_DO_NOT_DELETE,firstName,lastName,email,phone,signup,tags'];
    for (const r of rows) lines.push([r.bucket, r.activity, r.firstName, r.lastName, r.email, r.phone, r.signup, r.tags].map(esc).join(','));
    fs.writeFileSync(outFile, lines.join('\n'));

    log('\n=== CLIENT JUNK SCAN (read-only) ===');
    log(`Total clients: ${n(clients.length)}`);
    log(`  Real (kept, not listed):                         ${n(counts.real)}`);
    log('  Deletion candidates (no real activity):');
    log(`     test    — keyboard-mash / TEST-tagged:        ${n(counts.test)}`);
    log(`     seeded  — disposable-domain accounts:         ${n(counts.seeded)}`);
    log(`     review  — other non-standard email:           ${n(counts.review)}`);
    log(`  Junk-looking BUT has activity (PROTECTED):       ${n(counts.protectedActive)}`);
    log(`\nFull list written to: ${outFile}`);
    log('Open it in Numbers/Excel and review. NOTHING was deleted.');
    log('This file holds client data — keep it on your machine; don’t commit or share it.');
    return { total: clients.length, ...counts, outFile };
  } finally {
    await db.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await run({});
