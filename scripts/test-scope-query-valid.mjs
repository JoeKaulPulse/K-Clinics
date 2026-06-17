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
