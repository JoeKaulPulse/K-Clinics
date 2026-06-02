// Read-only: where do real client names live in the dump? PII-free — prints
// counts + masked shapes only, so we can fix the name derivation precisely.
//   node scripts/migrate-wp/diagnose-names.mjs scripts/migrate-wp/data/full-dump.sql
import { streamDump, normEmail } from './lib-dump.mjs';

const file = process.argv[2] || 'scripts/migrate-wp/data/full-dump.sql';
const users = new Map();      // id -> { display, login, email }
const meta = new Map();       // id -> { key: val }
const NAME_META = ['first_name', 'last_name', 'billing_first_name', 'billing_last_name'];

await streamDump(file, {
  wantRows: (t) => /(^|_)users$/i.test(t) || /(^|_)usermeta$/i.test(t),
  onRows: (t, rows) => {
    if (/(^|_)users$/i.test(t)) for (const r of rows) users.set(r.ID ?? r.id, { display: r.display_name, login: r.user_login, email: normEmail(r.user_email) });
    else for (const r of rows) { if (NAME_META.includes(r.meta_key)) { const m = meta.get(r.user_id) || {}; m[r.meta_key] = r.meta_value; meta.set(r.user_id, m); } }
  },
});

const ne = (v) => v != null && String(v).trim() !== '';
const looksLikeName = (s) => ne(s) && /[a-z]/i.test(s) && !/^[a-z0-9._-]+@/.test(s) && (/\s/.test(s) || !/\d/.test(s));
const shape = (v) => ne(v) ? String(v).replace(/[0-9]/g, '9').replace(/[A-Za-z]/g, 'x').replace(/[^\x00-\x7F]/g, '¤').slice(0, 24) : '∅';

let hasMetaName = 0, hasBilling = 0, displayUsable = 0, onlyEmail = 0;
const badShapes = new Map();
for (const [id, u] of users) {
  const m = meta.get(id) || {};
  const metaName = ne(m.first_name) || ne(m.last_name);
  const billing = ne(m.billing_first_name) || ne(m.billing_last_name);
  if (metaName) hasMetaName++;
  if (billing) hasBilling++;
  if (!metaName && !billing) {
    if (looksLikeName(u.display)) displayUsable++;
    else { onlyEmail++; const s = shape(u.display) || shape(u.email); badShapes.set(s, (badShapes.get(s) || 0) + 1); }
  }
}
const n = (x) => x.toLocaleString('en-GB');
console.log(`\n=== Name sources across ${n(users.size)} users ===`);
console.log(`  proper first/last name (usermeta) : ${n(hasMetaName)}`);
console.log(`  billing first/last name           : ${n(hasBilling)}`);
console.log(`  no meta name, but display looks real: ${n(displayUsable)}`);
console.log(`  ⚠ no real name anywhere (handle/email only): ${n(onlyEmail)}`);
if (badShapes.size) {
  console.log(`\n  masked shapes of the "no real name" cases (x=letter, 9=digit):`);
  for (const [s, c] of [...badShapes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`    ${String(c).padStart(4)}  ${s}`);
}
console.log('');
