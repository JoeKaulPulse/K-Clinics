// ClinicOS scope-validity guard (BLD-300/301).
//
// The tenant-scope filter (lib/tenant-scope.ts) is injected into queries with loose
// typing, so `tsc` cannot catch a filter the generated Prisma client REJECTS at
// runtime. That gap took the live Academy down once: after Ring 1c made `tenantId`
// NOT NULL, the scope still injected `{ tenantId: null }`, which Prisma rejects
// ("Argument `tenantId` is missing") — so every scoped Academy read threw and the
// course list went empty. tsc was green; the hand-rolled isolation test didn't use
// the real client.
//
// This guard constructs a scoped read for every Academy model against the REAL
// generated client and fails on a PrismaClientValidationError. No database is used:
// Prisma validates args and throws the ValidationError BEFORE it connects, so we
// race each query against a short window — a fast ValidationError = a broken filter;
// reaching the window (still trying to connect) = the filter is valid. Connections
// target a dead port so nothing real is hit.

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { ACADEMY_TENANT_MODELS, applyTenantScope } from '../lib/tenant-scope.ts';

const db = new PrismaClient({
  adapter: new PrismaPg(new pg.Pool({ connectionString: 'postgresql://probe:probe@127.0.0.1:1/probe', connectionTimeoutMillis: 4000, max: 1 })),
});
const READ_OPS = ['findMany', 'findFirst', 'count'];
const WINDOW_MS = 3000; // validation throws well within this; a pending connect = valid

const isValidationError = (e) => e?.constructor?.name === 'PrismaClientValidationError';
const raceValidation = (run) => Promise.race([run, new Promise((r) => setTimeout(() => r('window'), WINDOW_MS))]);

// Warm up the WASM engine AND self-test the detector: a deliberately-invalid query
// (unknown field) MUST surface as a ValidationError within the window. If it does
// not, the engine's first-query init is slower than the window — which could let a
// real broken filter falsely pass — so fail loudly instead of trusting the result.
const selfTest = await raceValidation(
  Promise.resolve()
    .then(() => db.course.findMany({ where: { __definitely_not_a_field__: 1 } }))
    .then(() => 'no-error', (e) => (isValidationError(e) ? 'caught' : 'other-error')),
);
if (selfTest !== 'caught') {
  console.log(`❌ guard self-test failed (got "${selfTest}") — validation is slower than ${WINDOW_MS}ms or the detector is broken; raise WINDOW_MS.`);
  process.exit(2);
}

const probes = [...ACADEMY_TENANT_MODELS].flatMap((model) =>
  READ_OPS.map((op) => {
    const args = applyTenantScope(model, op, { where: {} }, 'tenant-probe');
    const ran = Promise.resolve()
      .then(() => db[model][op](args))
      .then(() => null, (e) => (e?.constructor?.name === 'PrismaClientValidationError' ? { model, op, msg: String(e.message).replace(/\s+/g, ' ').slice(0, 160) } : null));
    const timer = new Promise((r) => setTimeout(() => r(null), WINDOW_MS));
    return Promise.race([ran, timer]);
  }),
);

const fails = (await Promise.all(probes)).filter(Boolean);

if (fails.length) {
  for (const f of fails) console.log(`   ✗ ${f.model}.${f.op}: ${f.msg}`);
  console.log(`\n❌ ${fails.length} scoped Academy query/queries are rejected by Prisma validation — the injected tenant filter is invalid for the current schema.`);
  process.exit(1);
}
console.log(`✓ scoped reads valid against the generated client for all ${ACADEMY_TENANT_MODELS.size} Academy models (${READ_OPS.length} ops each)`);
process.exit(0);
