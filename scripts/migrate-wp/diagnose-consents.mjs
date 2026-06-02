// Read-only: do the clinical records (sign_table consents, care plans, recs)
// link to a client? Checks whether their id_user matches a wp_users.ID with an
// email. PII-free (counts only). node scripts/migrate-wp/diagnose-consents.mjs <dump.sql>
import { streamDump, normEmail } from './lib-dump.mjs';
const file = process.argv[2] || 'scripts/migrate-wp/data/full-dump.sql';
const userEmail = new Map();   // wp id -> email
const tables = { sign_table: [], care_plan: [], care_plan_dent: [], recommendation: [] };
await streamDump(file, {
  wantRows: (t) => /(^|_)users$/i.test(t) || t in tables,
  onRows: (t, rows) => {
    if (/(^|_)users$/i.test(t)) for (const r of rows) userEmail.set(String(r.ID ?? r.id), normEmail(r.user_email));
    else if (t in tables) for (const r of rows) tables[t].push(String(r.id_user));
  },
});
const num = (n) => n.toLocaleString('en-GB');
console.log(`\n=== Clinical record → client linkage (via id_user → wp_users.ID → email) ===`);
console.log(`  wp_users with an email: ${num([...userEmail.values()].filter(Boolean).length)} / ${num(userEmail.size)}\n`);
let unlinkedTotal = 0;
for (const [t, ids] of Object.entries(tables)) {
  if (!ids.length) continue;
  const matchId = ids.filter((i) => userEmail.has(i)).length;
  const withEmail = ids.filter((i) => userEmail.get(i)).length;
  const unlinked = ids.length - withEmail;
  unlinkedTotal += unlinked;
  console.log(`  ${t.padEnd(16)} rows=${String(ids.length).padStart(4)}  id_user matches a user=${String(matchId).padStart(4)}  resolves to email=${String(withEmail).padStart(4)}  → unlinked=${unlinked}`);
}
console.log(`\n  total clinical records that can't reach a client: ${num(unlinkedTotal)}`);
console.log(`  (id_user with no matching wp_users.ID = the record points at a user that wasn't in the export / was deleted)\n`);
