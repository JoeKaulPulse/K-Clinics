// READ-ONLY corruption audit for the WordPress-imported data. SELECT only — no
// writes. Reports aggregate shapes (counts, distinct flag values, duplicate
// stacking) so we can see exactly what the import left behind without decrypting
// any clinical content. Run: node scripts/migrate-wp/audit-corruption.mjs
import './lib-env.mjs';
import { openDb } from './lib-db.mjs';

const db = await openDb();
const n = (x) => x.toLocaleString('en-GB');
try {
  console.log('\n=== CLIENTS ===');
  const total = await db.client.count();
  console.log('Total clients:', n(total));
  // Source / tag distribution (how many came from the import).
  const bySource = await db.client.groupBy({ by: ['source'], _count: { _all: true } }).catch(() => []);
  for (const s of bySource) console.log(`  source=${s.source ?? '(null)'} : ${n(s._count._all)}`);

  console.log('\n=== medicalFlag (the "debil" panel) ===');
  // medicalFlag is ENCRYPTED at rest (lib/clinical-crypto) and is only ever written
  // by staff in the admin UI — no importer sets it. So this reports SCOPE only
  // (how many clients carry a flag, and how many of those are imported clients);
  // review the actual flag text on the client pages in admin (it's decrypted there).
  const flaggedTotal = await db.client.count({ where: { medicalFlag: { not: null } } }).catch(() => 0);
  const flaggedImported = await db.client.count({ where: { medicalFlag: { not: null }, source: 'wordpress' } }).catch(() => 0);
  console.log(`Clients with a medicalFlag set: ${n(flaggedTotal)}  (of those, source=wordpress: ${n(flaggedImported)})`);
  console.log('  Note: medicalFlag is hand-entered via admin, never imported — review/clear values on the client page.');
  // Allergies free-text: how many set, and how many look like junk (very short / no letters).
  const allergyCount = await db.client.count({ where: { allergies: { not: null } } }).catch(() => 0);
  console.log(`Clients with allergies text: ${n(allergyCount)}`);

  console.log('\n=== HEALTH ASSESSMENTS ===');
  const haTotal = await db.healthAssessment.count();
  console.log('Total health assessments:', n(haTotal));
  const byKey = await db.healthAssessment.groupBy({ by: ['questionnaireKey'], _count: { _all: true } }).catch(() => []);
  for (const k of byKey.sort((a, b) => b._count._all - a._count._all)) console.log(`  ${n(k._count._all).padStart(6)} × ${k.questionnaireKey}`);

  // Duplicate stacking: imported assessments grouped by client, and whether the
  // duplicates share the SAME src marker (true re-import dup) or distinct srcs
  // (separate legacy submissions). summary is JSON: { imported, src }.
  console.log('\n=== IMPORTED-ASSESSMENT STACKING ===');
  const imported = await db.healthAssessment.findMany({
    where: { questionnaireKey: { startsWith: 'imported-' } },
    select: { clientId: true, questionnaireKey: true, summary: true },
  }).catch((e) => { console.log('  findMany failed:', e.message); return []; });
  const perClientKey = new Map();   // `${clientId}|${baseKey}` -> [src...]
  for (const a of imported) {
    const baseKey = (a.questionnaireKey || '').split('@')[0];
    const src = (a.summary && typeof a.summary === 'object') ? a.summary.src ?? null : null;
    const mk = `${a.clientId}|${baseKey}`;
    if (!perClientKey.has(mk)) perClientKey.set(mk, []);
    perClientKey.get(mk).push(src);
  }
  let stackedGroups = 0, trueDupRows = 0, distinctMultiRows = 0, clientsWithStack = new Set();
  for (const [mk, srcs] of perClientKey) {
    if (srcs.length <= 1) continue;
    stackedGroups++;
    clientsWithStack.add(mk.split('|')[0]);
    const uniq = new Set(srcs);
    if (uniq.size < srcs.length) trueDupRows += srcs.length - uniq.size; // same src repeated = re-import dup
    if (uniq.size > 1) distinctMultiRows += srcs.length;                  // distinct srcs = separate submissions
  }
  console.log(`Client+formtype groups with >1 row : ${n(stackedGroups)}  (distinct clients affected: ${n(clientsWithStack.size)})`);
  console.log(`  rows that are TRUE duplicates (same src repeated): ${n(trueDupRows)}`);
  console.log(`  rows from DISTINCT srcs (separate legacy submissions, not strictly dup): ${n(distinctMultiRows)}`);
  // Rows with NO src marker at all (older importer / hand entry that looks imported).
  const noSrc = imported.filter((a) => !(a.summary && typeof a.summary === 'object' && a.summary.src)).length;
  console.log(`Imported-keyed rows with NO src marker: ${n(noSrc)}`);

  console.log('\n=== LEGACY CONSENTS / CONSULTATIONS ===');
  const legacyConsents = await db.signedConsent.count({ where: { templateKey: 'legacy_wordpress' } }).catch(() => 'n/a');
  console.log('Legacy SignedConsent (templateKey=legacy_wordpress):', typeof legacyConsents === 'number' ? n(legacyConsents) : legacyConsents);
  const wpsign = await db.signedConsent.count({ where: { id: { startsWith: 'wpsign' } } }).catch(() => 'n/a');
  console.log('SignedConsent with wpsign id:', typeof wpsign === 'number' ? n(wpsign) : wpsign);

  console.log('\n=== QUARANTINE ===');
  const q = await db.client.findFirst({ where: { email: 'unmatched.wordpress@imported.kclinics.local' }, select: { id: true, _count: { select: { assessments: true } } } }).catch(() => null);
  if (q) console.log(`Quarantine client present; attached assessments: ${n(q._count.assessments)}`);
  else console.log('No quarantine client found.');
} finally {
  await db.$disconnect();
}
