#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Restore a full export (produced by Settings → Data export, or GET
// /api/admin/export) into the database pointed at by DATABASE_URL.
//
// Usage:
//   DATABASE_URL=postgres://…  node scripts/restore.mjs path/to/export.json [--dry-run] [--yes]
//
//   --dry-run   Validate + report counts, write nothing.
//   --yes       Skip the confirmation prompt (for non-interactive runs).
//
// Safety & behaviour:
//   • Idempotent — uses createMany({ skipDuplicates }), so re-running won't
//     duplicate rows; run against a FRESH (empty) database for a clean restore.
//   • Schema-driven (Prisma DMMF): every model in the file is restored, and
//     each field is converted back to its real type (Dates from ISO strings,
//     Bytes from base64, BigInt from strings).
//   • Models are inserted in foreign-key dependency order; rows within a
//     self-referencing table are ordered so parents precede children.
//   • Encrypted fields restore as their original ciphertext — set the SAME
//     encryption keys (crypto keyring env vars) in the new environment.
//   • Media binaries live in Vercel Blob; copy that store across separately
//     (the MediaAsset rows here only hold the URLs/pathnames).
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs';
import readline from 'node:readline';
import { PrismaClient, Prisma } from '@prisma/client';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
const assumeYes = args.includes('--yes');

if (!file) {
  console.error('Usage: DATABASE_URL=… node scripts/restore.mjs <export.json> [--dry-run] [--yes]');
  process.exit(1);
}

const delegate = (model) => model.charAt(0).toLowerCase() + model.slice(1);
const models = Prisma.dmmf.datamodel.models;
const byName = new Map(models.map((m) => [m.name, m]));

// ── Topological order of models by FK dependencies (parents before children) ──
function modelOrder() {
  const deps = new Map(models.map((m) => [m.name, new Set()]));
  for (const m of models) {
    for (const f of m.fields) {
      // A relation field that holds the FK (relationFromFields) means this model
      // depends on the referenced model. Ignore self-references for ordering.
      if (f.kind === 'object' && f.relationFromFields?.length && f.type !== m.name && byName.has(f.type)) {
        deps.get(m.name).add(f.type);
      }
    }
  }
  const order = [];
  const done = new Set();
  let progress = true;
  while (order.length < models.length && progress) {
    progress = false;
    for (const m of models) {
      if (done.has(m.name)) continue;
      if ([...deps.get(m.name)].every((d) => done.has(d))) { order.push(m.name); done.add(m.name); progress = true; }
    }
  }
  // Any remaining models are part of an inter-model cycle — append them; FK
  // checks may need a second pass, but this is rare for this schema.
  for (const m of models) if (!done.has(m.name)) order.push(m.name);
  return order;
}

// ── Order rows of a self-referencing table so parents precede children ──
function orderRows(model, rows) {
  const selfFks = model.fields
    .filter((f) => f.kind === 'object' && f.type === model.name && f.relationFromFields?.length)
    .flatMap((f) => f.relationFromFields);
  if (selfFks.length === 0) return rows;
  const idField = model.fields.find((f) => f.isId)?.name;
  if (!idField) return rows;
  const present = new Set(rows.map((r) => r[idField]));
  const placed = new Set();
  const out = [];
  let progress = true;
  while (out.length < rows.length && progress) {
    progress = false;
    for (const r of rows) {
      if (placed.has(r[idField])) continue;
      const ready = selfFks.every((fk) => r[fk] == null || !present.has(r[fk]) || placed.has(r[fk]));
      if (ready) { out.push(r); placed.add(r[idField]); progress = true; }
    }
  }
  for (const r of rows) if (!placed.has(r[idField])) out.push(r); // cycle fallback
  return out;
}

// ── Convert a row's scalar values back to their real types ──
function makeConverter(model) {
  const fieldMap = new Map(model.fields.filter((f) => f.kind !== 'object').map((f) => [f.name, f]));
  return (row) => {
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      const f = fieldMap.get(k);
      if (!f) continue; // not a column (relation/unknown) — skip
      if (v == null) { out[k] = v; continue; }
      if (f.type === 'DateTime') out[k] = f.isList ? v.map((x) => new Date(x)) : new Date(v);
      else if (f.type === 'Bytes') out[k] = v && v.__bytes_base64__ ? Buffer.from(v.__bytes_base64__, 'base64') : v;
      else if (f.type === 'BigInt') out[k] = f.isList ? v.map((x) => BigInt(x)) : BigInt(v);
      else out[k] = v; // String/Int/Float/Boolean/Decimal/Json/enum/arrays
    }
    return out;
  };
}

async function main() {
  const payload = JSON.parse(readFileSync(file, 'utf8'));
  const data = payload?.data;
  if (!data || typeof data !== 'object') { console.error('Not a valid export file (missing "data").'); process.exit(1); }
  console.log(`Export: ${payload.meta?.format || 'unknown'} · taken ${payload.meta?.exportedAt || '?'} · ${Object.keys(data).length} models`);

  const order = modelOrder();
  const target = (process.env.DATABASE_URL || '').replace(/:[^:@/]+@/, ':****@');
  console.log(`Target DATABASE_URL: ${target || '(unset!)'}`);
  if (dryRun) console.log('DRY RUN — no rows will be written.\n');

  if (!dryRun && !assumeYes) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ans = await new Promise((res) => rl.question('Type "RESTORE" to write all data into the target database: ', res));
    rl.close();
    if (ans.trim() !== 'RESTORE') { console.log('Aborted.'); process.exit(0); }
  }

  const prisma = new PrismaClient();
  let totalRows = 0, totalWritten = 0;
  try {
    for (const name of order) {
      const rows = data[name];
      if (!Array.isArray(rows) || rows.length === 0) continue;
      const model = byName.get(name);
      if (!model) { console.warn(`! Skipping unknown model in file: ${name}`); continue; }
      const convert = makeConverter(model);
      const ordered = orderRows(model, rows).map(convert);
      totalRows += ordered.length;
      if (dryRun) { console.log(`  ${name}: ${ordered.length} rows (dry-run)`); continue; }

      const repo = prisma[delegate(name)];
      let written = 0;
      for (let i = 0; i < ordered.length; i += 500) {
        const chunk = ordered.slice(i, i + 500);
        try {
          const r = await repo.createMany({ data: chunk, skipDuplicates: true });
          written += r.count;
        } catch (e) {
          // Fall back to row-by-row so one bad row doesn't lose the whole chunk.
          for (const row of chunk) {
            try { await repo.create({ data: row }); written++; }
            catch (e2) { console.warn(`  ! ${name} row failed: ${(e2.message || e2).slice(0, 140)}`); }
          }
        }
      }
      totalWritten += written;
      console.log(`  ${name}: ${written}/${ordered.length} written`);
    }
    console.log(`\n${dryRun ? 'Would restore' : 'Restored'} ${dryRun ? totalRows : totalWritten}/${totalRows} rows across ${order.length} models.`);
    if (!dryRun) console.log('Done. Verify the new environment, and remember to set the encryption keys + copy the Vercel Blob media.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error('Restore failed:', e); process.exit(1); });
