// Post-import CLEANUP — fixes corruption the import left behind that --repair
// does NOT cover. Two jobs, both DRY-RUN by default (print only; pass --commit to
// write). Operates directly on the database; no dump file needed.
//
//   Dry run (safe, writes nothing):
//     DATABASE_URL=... node scripts/migrate-wp/cleanup.mjs
//   Commit:
//     DATABASE_URL=... node scripts/migrate-wp/cleanup.mjs --commit
//   In-process (server runner): await run({ commit, log })
//
// 1) MOJIBAKE — names/notes stored double-encoded (UTF-8 bytes read as Latin-1),
//    e.g. Cyrillic names showing as accented-Latin gibberish. The dump reader
//    decodes UTF-8 with no fix-up, so re-importing won't help; we re-decode the
//    stored value. CONSERVATIVE: only source='wordpress' clients, only when
//    mojibake markers are present AND the re-decode strictly improves and loses
//    no data. Touches firstName / lastName / notes (plaintext). allergies &
//    medicalFlag are encrypted at rest and are left untouched.
//
// 2) DUPLICATE imported assessments — rows that share the SAME client + SAME
//    source row id (literal re-import stacking, e.g. the same skin quiz listed
//    several times). Keeps the earliest, deletes the rest. Rows from DIFFERENT
//    source ids (genuine separate submissions) are never collapsed — so the
//    dry-run also tells you which of the two your duplicates are.
//
// NOT handled here (need their own steps): junk medicalFlag values like the
// hand-entered one in the screenshot (not imported — clear it on the client page),
// and wrong-field mapping (data-specific — share examples and we map a fix).

import './lib-env.mjs';
import { pathToFileURL } from 'node:url';
import { openDb } from './lib-db.mjs';

// ── mojibake detection + repair ──────────────────────────────────────────────
// Markers left when UTF-8 is mis-decoded as Latin-1: a high-Latin lead byte
// (00C2/C3 Latin, 00C4/C5, 00D0/D1 Cyrillic, 00E2 smart-quote lead) followed by a
// UTF-8 continuation byte shown as Latin-1 (U+0080..U+00BF).
const MOJI_MARK = /[ÂÃÄÅÐÑâ][-¿]/;
// Count chars that are typical mojibake artefacts (continuation bytes shown as
// Latin-1, plus the common lead bytes). A correct re-decode collapses these into
// real multi-byte codepoints (> 0xFF), so the count drops sharply.
const garbage = (s) => [...s].filter((c) => {
  const n = c.codePointAt(0);
  return (n >= 0x80 && n <= 0xBF) || n === 0xC2 || n === 0xC3 || n === 0xD0 || n === 0xD1 || n === 0xE2;
}).length;

export function demojibake(s) {
  if (!s || !MOJI_MARK.test(s)) return null;             // no markers -> leave as-is
  for (const ch of s) if (ch.codePointAt(0) > 0xFF) return null; // not pure Latin-1 -> re-decode would lose data
  let fixed;
  try { fixed = Buffer.from(s, 'latin1').toString('utf8'); } catch { return null; }
  if (fixed === s || fixed.includes('�')) return null; // unchanged or produced replacement chars -> abort
  if (garbage(fixed) >= garbage(s)) return null;             // not an improvement -> abort
  return fixed;
}

const MOJI_FIELDS = ['firstName', 'lastName', 'notes'];

export async function run({ commit = false, log = console.log } = {}) {
  const db = await openDb();
  const n = (x) => Number(x).toLocaleString('en-GB');
  try {
    // ── 1) mojibake ──────────────────────────────────────────────────────────
    log('\n=== MOJIBAKE (double-encoded text) ===');
    // Imported clients only; the field set is tiny so we scan them all in JS
    // rather than guessing markers in a SQL filter (which could miss some).
    const clients = await db.client.findMany({ where: { source: 'wordpress' }, select: { id: true, firstName: true, lastName: true, notes: true } });
    let fixedClients = 0, fixedFields = 0;
    const sample = [];
    for (const c of clients) {
      const patch = {};
      for (const f of MOJI_FIELDS) {
        const fix = demojibake(c[f]);
        if (fix != null) { patch[f] = fix; fixedFields++; if (sample.length < 12) sample.push(`${f}: ${JSON.stringify(c[f])} -> ${JSON.stringify(fix)}`); }
      }
      if (Object.keys(patch).length === 0) continue;
      fixedClients++;
      if (commit) await db.client.update({ where: { id: c.id }, data: patch });
    }
    log(`Imported (source=wordpress) clients scanned: ${n(clients.length)}`);
    log(`Clients ${commit ? 'fixed' : 'that WOULD be fixed'}: ${n(fixedClients)}  (fields: ${n(fixedFields)})`);
    for (const s of sample) log('  ' + s);
    if (sample.length === 0) log('  (no confidently-fixable mojibake found in name/notes fields)');

    // ── 2) duplicate imported assessments ──────────────────────────────────────
    log('\n=== DUPLICATE IMPORTED ASSESSMENTS (same client + same source row) ===');
    const rows = await db.healthAssessment.findMany({
      where: { summary: { path: ['imported'], equals: true } },
      select: { id: true, clientId: true, questionnaireKey: true, summary: true, submittedAt: true },
    });
    const groups = new Map(); // `${clientId}|${src}` -> rows[]
    let noSrc = 0;
    for (const r of rows) {
      const src = r.summary && typeof r.summary === 'object' ? r.summary.src : null;
      if (!src) { noSrc++; continue; }
      const k = `${r.clientId}|${src}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r);
    }
    const toDelete = [];
    let dupGroups = 0;
    for (const list of groups.values()) {
      if (list.length <= 1) continue;
      dupGroups++;
      list.sort((a, b) => (new Date(a.submittedAt) - new Date(b.submittedAt)) || (a.id < b.id ? -1 : 1));
      for (const r of list.slice(1)) toDelete.push(r.id);
    }
    // How the skin quizzes specifically break down (answers "are the 6 identical?").
    const quizByClient = new Map();
    for (const r of rows) if ((r.questionnaireKey || '').startsWith('imported-skin-quiz')) {
      const src = r.summary && typeof r.summary === 'object' ? r.summary.src : null;
      const a = quizByClient.get(r.clientId) || []; a.push(src); quizByClient.set(r.clientId, a);
    }
    let quizSameSrc = 0, quizDistinct = 0;
    for (const srcs of quizByClient.values()) {
      if (srcs.length <= 1) continue;
      if (new Set(srcs).size < srcs.length) quizSameSrc++; else quizDistinct++;
    }
    log(`Imported assessment rows: ${n(rows.length)}  (with no source marker: ${n(noSrc)})`);
    log(`Client+source groups with literal duplicates: ${n(dupGroups)}  -> rows ${commit ? 'deleted' : 'that WOULD be deleted'}: ${n(toDelete.length)}`);
    log(`Skin-quiz: clients whose multiple quizzes are TRUE duplicates (same source): ${n(quizSameSrc)}; DISTINCT submissions (kept): ${n(quizDistinct)}`);
    if (commit && toDelete.length) {
      for (let i = 0; i < toDelete.length; i += 200) await db.healthAssessment.deleteMany({ where: { id: { in: toDelete.slice(i, i + 200) } } });
    }

    log(commit ? '\nCleanup committed.\n' : '\nDRY RUN - nothing written. Re-run with --commit to apply.\n');
    return { mojibakeClients: fixedClients, mojibakeFields: fixedFields, duplicatesFound: toDelete.length, duplicatesRemoved: commit ? toDelete.length : 0 };
  } finally {
    await db.$disconnect();
  }
}

// ── CLI ─────────────────────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await run({ commit: process.argv.includes('--commit') });
}
