// Step 1c: profile the SHAPE of the data in the custom tables — PII-free.
//
// For each column it shows how many rows are filled and the most common value
// *patterns* with every digit masked to 9 and every letter to x (non-Latin →
// ¤). So a date column shows "9999-99-99 99:99:99", an email shows
// "xxxx@xxxx.xxx" — enough to build the importer, with NO real values revealed.
//
//   node scripts/migrate-wp/profile.mjs scripts/migrate-wp/data/full-dump.sql
//   node scripts/migrate-wp/profile.mjs <dump.sql> grafik sign_table skviz   # specific tables
//
// Safe to paste back.

import { streamDump } from './lib-dump.mjs';

const file = process.argv[2];
if (!file) { console.error('Usage: node scripts/migrate-wp/profile.mjs <dump.sql> [table ...]'); process.exit(1); }

const DEFAULT = ['grafik', 'grafik_dent', 'review_user', 'bonus', 'sign_table', 'care_plan', 'care_plan_dent', 'recommendation', 'skviz', 'wp_db7_forms', 'emails', 'photos', 'giftcards', 'uslugi', 'sotrudniki', 'sotrudniki_dent', 'wp_e_submissions_values'];
const wanted = process.argv.slice(3);
const want = (t) => (wanted.length ? wanted : DEFAULT).includes(t);

function shape(v) {
  if (v === null || v === undefined) return '∅';
  const s = String(v);
  if (s === '') return '⌀empty';
  const len = s.length;
  let m = s.replace(/[0-9]/g, '9').replace(/[A-Za-z]/g, 'x').replace(/[^\x00-\x7F]/g, '¤');
  if (m.length > 50) m = m.slice(0, 47) + `…(len=${len})`;
  return m;
}

const prof = new Map(); // table -> { count, cols: Map<col, {filled, shapes: Map}> }

await streamDump(file, {
  wantRows: want,
  onRows: (t, rows) => {
    let p = prof.get(t); if (!p) prof.set(t, (p = { count: 0, cols: new Map() }));
    for (const r of rows) {
      p.count++;
      for (const [col, v] of Object.entries(r)) {
        if (col === '__row') continue;
        let c = p.cols.get(col); if (!c) p.cols.set(col, (c = { filled: 0, shapes: new Map() }));
        if (v !== null && v !== undefined && String(v) !== '') c.filled++;
        const sh = shape(v);
        c.shapes.set(sh, (c.shapes.get(sh) || 0) + 1);
      }
    }
  },
});

console.log('\n=== DATA SHAPE PROFILE (masked — no real values) ===');
for (const t of (wanted.length ? wanted : DEFAULT)) {
  const p = prof.get(t);
  if (!p) { console.log(`\n## ${t}: (not found / empty)`); continue; }
  console.log(`\n## ${t}  — ${p.count} rows`);
  for (const [col, c] of p.cols) {
    const top = [...c.shapes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
      .map(([s, n]) => `${s}×${n}`).join('  |  ');
    console.log(`   ${col.padEnd(16)} filled ${String(c.filled).padStart(4)}/${p.count}   ${top}`);
  }
}
console.log('');
