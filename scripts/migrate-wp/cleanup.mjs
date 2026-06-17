// Post-import CLEANUP — fixes corruption the import left behind that --repair
// does NOT cover. DRY-RUN by default (print only; pass --commit to write).
// Operates directly on the database; no dump file needed.
//
//   Dry run:  DATABASE_URL=... [HEALTH_ENCRYPTION_KEY=...] node scripts/migrate-wp/cleanup.mjs
//   Commit:   add --commit
//
// 1) GARBLED NAMES/notes — recovered two ways, only when it strictly improves and
//    loses no data: (a) double-encoded UTF-8 (mojibake) re-decoded; (b) HTML
//    entities (&#1076; / &amp;) decoded back to real characters. source='wordpress'
//    only; touches firstName / lastName / notes (plaintext). Encrypted fields
//    (allergies, medicalFlag) are never touched.
//
// 2) DUPLICATE imported assessments — CONTENT-based: decrypts each imported
//    assessment and collapses rows whose ANSWERS are byte-identical for the same
//    client (e.g. the same skin quiz imported several times under different source
//    rows, all stamped with the import date). Keeps the earliest, deletes the rest.
//    Rows with genuinely different answers are always kept. Needs
//    HEALTH_ENCRYPTION_KEY; without it this step is skipped (names still run).
//
// NOT handled here: junk medicalFlag values (hand-entered, not imported — clear on
// the client page) and wrong-field mapping (share examples and we map a fix).

import './lib-env.mjs';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { openDb } from './lib-db.mjs';

// ── garbled-text repair ──────────────────────────────────────────────────────
const MOJI_MARK = /[ÂÃÄÅÐÑâ][-¿]/; // Latin-1 lead byte + continuation byte
const garbage = (s) => [...s].filter((c) => {
  const n = c.codePointAt(0);
  return (n >= 0x80 && n <= 0xBF) || n === 0xC2 || n === 0xC3 || n === 0xD0 || n === 0xD1 || n === 0xE2;
}).length;

// (a) Mojibake: UTF-8 bytes mis-decoded as Latin-1.
export function demojibake(s) {
  if (!s || !MOJI_MARK.test(s)) return null;
  for (const ch of s) if (ch.codePointAt(0) > 0xFF) return null;
  let fixed;
  try { fixed = Buffer.from(s, 'latin1').toString('utf8'); } catch { return null; }
  if (fixed === s || fixed.includes('�')) return null;
  if (garbage(fixed) >= garbage(s)) return null;
  return fixed;
}

// (b) HTML entities: &#1076; (decimal), &#x434; (hex), &amp; &lt; &gt; &quot; &apos; &nbsp;.
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export function decodeEntities(s) {
  if (!s || !/&(#\d+|#x[0-9a-f]+|[a-z]+);/i.test(s)) return null;
  let out = s
    .replace(/&#(\d+);/g, (_, d) => { try { return String.fromCodePoint(+d); } catch { return _; } })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return _; } })
    .replace(/&([a-z]+);/gi, (m, name) => NAMED[name.toLowerCase()] ?? m);
  if (out === s || out.includes('�')) return null;
  return out;
}

// Apply whichever recovery improves the value (mojibake first, then entities).
function fixText(s) {
  if (s == null) return null;
  let cur = String(s), changed = false;
  const m = demojibake(cur); if (m != null) { cur = m; changed = true; }
  const e = decodeEntities(cur); if (e != null) { cur = e; changed = true; }
  return changed ? cur : null;
}

const TEXT_FIELDS = ['firstName', 'lastName', 'notes'];

export async function run({ commit = false, log = console.log } = {}) {
  const db = await openDb();
  const n = (x) => Number(x).toLocaleString('en-GB');
  try {
    // ── 1) garbled names/notes ─────────────────────────────────────────────────
    log('\n=== GARBLED NAMES / NOTES (mojibake + HTML entities) ===');
    const clients = await db.client.findMany({ where: { source: 'wordpress' }, select: { id: true, firstName: true, lastName: true, notes: true } });
    let fixedClients = 0, fixedFields = 0;
    const sample = [];
    for (const c of clients) {
      const patch = {};
      for (const f of TEXT_FIELDS) {
        const fix = fixText(c[f]);
        if (fix != null) { patch[f] = fix; fixedFields++; if (sample.length < 12) sample.push(`${f}: ${JSON.stringify(c[f])} -> ${JSON.stringify(fix)}`); }
      }
      if (Object.keys(patch).length === 0) continue;
      fixedClients++;
      if (commit) await db.client.update({ where: { id: c.id }, data: patch });
    }
    log(`Imported (source=wordpress) clients scanned: ${n(clients.length)}`);
    log(`Clients ${commit ? 'fixed' : 'that WOULD be fixed'}: ${n(fixedClients)}  (fields: ${n(fixedFields)})`);
    for (const s of sample) log('  ' + s);
    if (sample.length === 0) log('  (no confidently-recoverable garbling found in name/notes fields)');

    // ── 2) content-duplicate imported assessments ──────────────────────────────
    log('\n=== DUPLICATE IMPORTED ASSESSMENTS (identical answers, same client) ===');
    const rows = await db.healthAssessment.findMany({
      where: { summary: { path: ['imported'], equals: true } },
      select: { id: true, clientId: true, questionnaireKey: true, cipher: true, submittedAt: true },
    });
    let decryptJson = null;
    try { ({ decryptJson } = await import('./lib-crypto.mjs')); } catch { /* no crypto helper */ }
    if (!decryptJson || !process.env.HEALTH_ENCRYPTION_KEY) {
      log(`  Imported assessment rows: ${n(rows.length)}`);
      log('  HEALTH_ENCRYPTION_KEY not available in this run — cannot compare answers, so no de-dupe.');
      log('  (add HEALTH_ENCRYPTION_KEY to your env and re-run to enable answer-based de-dupe.)');
    } else {
      const groups = new Map(); // clientId|baseKey|answersHash -> rows[]
      let decFail = 0;
      for (const r of rows) {
        let answers;
        try { const j = decryptJson(r.cipher); answers = j && typeof j === 'object' && 'answers' in j ? j.answers : j; }
        catch { decFail++; continue; }
        const baseKey = (r.questionnaireKey || '').split('@')[0];
        const h = crypto.createHash('sha256').update(JSON.stringify(answers)).digest('hex');
        const k = `${r.clientId}|${baseKey}|${h}`;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(r);
      }
      const toDelete = [];
      let dupGroups = 0;
      const byType = {};
      for (const [k, list] of groups) {
        if (list.length <= 1) continue;
        dupGroups++;
        const baseKey = k.split('|')[1];
        byType[baseKey] = (byType[baseKey] || 0) + (list.length - 1);
        list.sort((a, b) => (new Date(a.submittedAt) - new Date(b.submittedAt)) || (a.id < b.id ? -1 : 1));
        for (const r of list.slice(1)) toDelete.push(r.id);
      }
      log(`  Imported assessment rows: ${n(rows.length)}  (could not decrypt: ${n(decFail)})`);
      log(`  Sets with identical-answer duplicates: ${n(dupGroups)}  -> rows ${commit ? 'deleted' : 'that WOULD be deleted'}: ${n(toDelete.length)}`);
      for (const [k, v] of Object.entries(byType)) log(`     ${k}: ${n(v)} duplicate row(s)`);
      if (commit && toDelete.length) {
        for (let i = 0; i < toDelete.length; i += 200) await db.healthAssessment.deleteMany({ where: { id: { in: toDelete.slice(i, i + 200) } } });
      }
    }

    log(commit ? '\nCleanup committed.\n' : '\nDRY RUN - nothing written. Re-run with --commit to apply.\n');
    return { textClients: fixedClients, textFields: fixedFields };
  } finally {
    await db.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await run({ commit: process.argv.includes('--commit') });
}
