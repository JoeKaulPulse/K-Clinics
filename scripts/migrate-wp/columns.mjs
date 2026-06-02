// Step 1b: print the COLUMN STRUCTURE of every table (no data, PII-free).
//
// The custom clinic tables have cryptic names; their column names are what let
// us map them safely. This prints `table (rows): col1, col2, …` — paste it back.
//
//   node scripts/migrate-wp/columns.mjs scripts/migrate-wp/data/full-dump.sql
//
// Output contains NO row values — only table + column names + row counts.

import { streamDump } from './lib-dump.mjs';

const file = process.argv[2];
if (!file) { console.error('Usage: node scripts/migrate-wp/columns.mjs <dump.sql>'); process.exit(1); }

// Tables that are pure infrastructure/plugin plumbing — listed last, collapsed.
const NOISE = /(actionscheduler|yoast|revslider|gla_|post_smtp|woocommerce_sessions|wc_admin|wc_product|wc_category|wc_tax|product_download|mailpoet_(scheduled|migration|sending|statistics|newsletter|setting|log)|^[a-z0-9]+_options$|^[a-z0-9]+_links$|qrscannerredirect)/i;

const cols = new Map();   // table -> string[]
const counts = new Map(); // table -> rows

await streamDump(file, {
  onSchema: (t, c) => cols.set(t, c),
  onCount: (t, n) => counts.set(t, (counts.get(t) || 0) + n),
});

const tables = [...cols.keys()].sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0));
const relevant = tables.filter((t) => !NOISE.test(t));
const noise = tables.filter((t) => NOISE.test(t));

const line = (t) => `${t} (${(counts.get(t) || 0).toLocaleString('en-GB')} rows): ${(cols.get(t) || []).join(', ')}`;

console.log('\n=== TABLE STRUCTURES (column names only — no data) ===\n');
console.log('--- relevant / to map ---');
for (const t of relevant) console.log(line(t));
console.log('\n--- plumbing (we ignore these) ---');
for (const t of noise) console.log(t);
console.log('');
