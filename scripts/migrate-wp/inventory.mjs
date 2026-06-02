// Step 1 of the migration: take inventory of a WordPress/WooCommerce dump.
//
// Reads a mysqldump .sql file and prints — with NO personal data — every table,
// its row count, and what we think it is. Crucially it flags non-empty tables we
// don't recognise, so nothing from the "mess of plugins" gets silently dropped.
//
// Run on YOUR machine (where the dump file is), e.g.:
//   node scripts/migrate-wp/inventory.mjs scripts/migrate-wp/data/full-dump.sql
//
// The output is safe to paste back into the chat.

import { streamDump, normEmail } from './lib-dump.mjs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/migrate-wp/inventory.mjs <path-to-dump.sql>');
  process.exit(1);
}

// Categorisation by table-name prefix/pattern (prefix-agnostic: matches wp_,
// wp_2_, or any custom prefix by looking at the suffix).
const suffix = (t) => t.replace(/^[a-z0-9]+_/i, '');
const CATEGORIES = [
  ['WordPress core', /^(users|usermeta|posts|postmeta|terms|term_|comments|commentmeta|options|links)$/i],
  ['WooCommerce', /^(wc_|woocommerce_|order_items?|order_itemmeta)/i],
  ['Forms — Gravity Forms', /^(gf_|rg_)/i],
  ['Forms — CF7 / Flamingo', /^(cf7|flamingo|wpcf7)/i],
  ['Forms — WPForms', /^wpforms/i],
  ['Forms — Forminator', /^frmt_|^forminator/i],
  ['Forms — Fluent Forms', /^fluentform/i],
  ['Forms — Ninja Forms', /^nf3?_|^ninja_forms/i],
  ['Bookings', /^(appointments?|bookings?|booking_|bkap_|tm_|amelia|wpamelia)/i],
];
function categorise(table) {
  const s = suffix(table);
  for (const [name, re] of CATEGORIES) if (re.test(s) || re.test(table)) return name;
  return null; // unknown / custom — needs review
}

const counts = new Map();   // table -> rows
const cat = new Map();      // table -> category
const userEmails = new Set();
const orderEmails = new Set();

// Tables we sample to estimate how many real people we'll end up with.
const wantRows = (t) => /(^|_)users$/i.test(t) || /(^|_)postmeta$/i.test(t) || /(^|_)wc_order_addresses$/i.test(t) || /(^|_)wc_customer_lookup$/i.test(t);

await streamDump(file, {
  wantRows,
  onSchema: (t) => { if (!cat.has(t)) cat.set(t, categorise(t)); },
  onCount: (t, n) => counts.set(t, (counts.get(t) || 0) + n),
  onRows: (t, rows) => {
    const s = suffix(t);
    if (s === 'users') for (const r of rows) { const e = normEmail(r.user_email); if (e) userEmails.add(e); }
    else if (s === 'postmeta') for (const r of rows) { if (r.meta_key === '_billing_email') { const e = normEmail(r.meta_value); if (e) orderEmails.add(e); } }
    else if (s === 'wc_order_addresses') for (const r of rows) { const e = normEmail(r.email); if (e) orderEmails.add(e); }
    else if (s === 'wc_customer_lookup') for (const r of rows) { const e = normEmail(r.email); if (e) orderEmails.add(e); }
  },
});

// Make sure tables that only appeared in INSERTs still get categorised.
for (const t of counts.keys()) if (!cat.has(t)) cat.set(t, categorise(t));

const all = [...counts.entries()].sort((a, b) => b[1] - a[1]);
const totalRows = all.reduce((s, [, n]) => s + n, 0);
const people = new Set([...userEmails, ...orderEmails]);

const pad = (s, w) => String(s).padEnd(w);
const num = (n) => n.toLocaleString('en-GB');

console.log('\n=== WordPress dump inventory ===');
console.log(`File: ${file}`);
console.log(`Tables: ${counts.size}   Total rows: ${num(totalRows)}\n`);

console.log('People estimate (distinct emails, PII-free count only):');
console.log(`  registered users : ${num(userEmails.size)}`);
console.log(`  order/customer   : ${num(orderEmails.size)}`);
console.log(`  → unique clients : ${num(people.size)}\n`);

console.log(`${pad('rows', 10)}  ${pad('category', 26)} table`);
console.log('-'.repeat(70));
for (const [t, n] of all) {
  console.log(`${pad(num(n), 10)}  ${pad(cat.get(t) || '⚠ UNKNOWN — review', 26)} ${t}`);
}

const review = all.filter(([t, n]) => n > 0 && !cat.get(t));
if (review.length) {
  console.log('\n⚠  NON-EMPTY TABLES WE DON\'T RECOGNISE (so we don\'t lose anything):');
  for (const [t, n] of review) console.log(`   • ${t} — ${num(n)} rows`);
  console.log('   → paste these back; I\'ll map each one before any import.');
}
console.log('');
