// ClinicOS RLS-seam guard (BLD-301, Ring 1d).
//
// Exercises the pure half of the RLS GUC seam (lib/tenant-tx.ts) with no database
// and no build — `node` runs this directly. It locks down the two properties that
// keep the seam safe to ship ahead of the RLS enable:
//   1. the flag defaults OFF, so production sets no GUC and opens no extra
//      transaction (withTenantTx is a passthrough) — i.e. a true no-op until RLS;
//   2. the GUC statement matches the policy contract in 0002_academy_rls.sql:
//      it sets `app.tenant_id`, TRANSACTION-LOCAL (set_config(…, true)), with the
//      tenant id BOUND ($1) not interpolated (no SQL injection). A drift here =
//      either a prod behaviour change or an RLS policy that never matches.
//
// Run: `node scripts/test-rls-seam.mjs`

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { academyRlsEnabled, tenantGucStatement } from '../lib/tenant-tx.ts';

let checks = 0;
const check = (label, fn) => { fn(); checks++; console.log(`  ✓ ${label}`); };

console.log('RLS-seam guard (BLD-301)');

// 1. Flag is OFF unless ACADEMY_RLS === '1' — production no-op by default.
check('academyRlsEnabled defaults OFF', () => {
  const prev = process.env.ACADEMY_RLS;
  try {
    delete process.env.ACADEMY_RLS;
    assert.equal(academyRlsEnabled(), false, 'unset must be OFF');
    process.env.ACADEMY_RLS = '0';
    assert.equal(academyRlsEnabled(), false, "'0' must be OFF");
    process.env.ACADEMY_RLS = 'true';
    assert.equal(academyRlsEnabled(), false, "only the exact string '1' enables it");
    process.env.ACADEMY_RLS = '1';
    assert.equal(academyRlsEnabled(), true, "'1' enables it");
  } finally {
    if (prev === undefined) delete process.env.ACADEMY_RLS;
    else process.env.ACADEMY_RLS = prev;
  }
});

// 2. GUC statement is transaction-local, parameterised, and names app.tenant_id.
check('tenantGucStatement is transaction-local + parameterised', () => {
  const { sql, params } = tenantGucStatement('tenant-xyz');
  assert.match(sql, /set_config\(/i, 'must call set_config');
  assert.match(sql, /'app\.tenant_id'/, "must set the 'app.tenant_id' GUC");
  assert.match(sql, /,\s*true\)/, 'third arg must be true → transaction-local (safe under PgBouncer)');
  assert.match(sql, /\$1/, 'tenant id must be bound as $1, not interpolated');
  assert.ok(!sql.includes('tenant-xyz'), 'tenant id must NOT be inlined into the SQL');
  assert.deepEqual(params, ['tenant-xyz'], 'tenant id is passed as a bound parameter');
});

// 3. The GUC name we SET must be exactly the one the RLS policy READS, or every
//    Academy query returns zero rows the moment RLS is enabled.
check('GUC name matches the policy in 0002_academy_rls.sql', () => {
  const { sql } = tenantGucStatement('t');
  const policy = readFileSync(new URL('../prisma/platform-migrations/ring1/0002_academy_rls.sql', import.meta.url), 'utf8');
  assert.match(policy, /current_setting\('app\.tenant_id', true\)/, 'policy must read app.tenant_id transaction-locally');
  const gucName = sql.match(/'(app\.[a-z_]+)'/)?.[1];
  assert.equal(gucName, 'app.tenant_id', 'the GUC the seam sets must be the one the policy reads');
});

console.log(`\n${checks} RLS-seam checks passed.`);
