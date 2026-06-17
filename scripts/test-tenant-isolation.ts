// ClinicOS tenant-isolation guard (BLD-300, Ring 0.2).
//
// Runs in CI with no database and no test runner — `node` runs this TypeScript
// directly (v22+ type-stripping). It exercises the pure scoping logic in
// lib/tenant-scope.ts that the live Prisma extension (lib/db.ts) relies on, and
// fails the build if isolation regresses:
//   1. the scoped-model set drifts from the schema (a new Academy model with a
//      tenantId column that nobody scoped — exactly the R12 leak the plan warns of);
//   2. a read stops getting the tenant filter, or a create stops being stamped;
//   3. one tenant's filter starts matching another tenant's rows.
//
// Run: `node scripts/test-tenant-isolation.ts`

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ACADEMY_TENANT_MODELS, applyTenantScope, isAcademyModel, tenantScopeFilter, modelKey } from '../lib/tenant-scope.ts';

let checks = 0;
const check = (label: string, fn: () => void) => {
  fn();
  checks++;
  console.log(`  ✓ ${label}`);
};

// A minimal Prisma `where` evaluator for AND/OR/NOT + field equality (null-aware),
// so we can prove a tenant's injected filter matches the right rows and only those.
type Where = Record<string, unknown> | null | undefined;
function matchesWhere(where: Where, row: Record<string, unknown>): boolean {
  if (where == null) return true;
  return Object.entries(where).every(([key, val]) => {
    if (key === 'AND') return (val as Where[]).every((w) => matchesWhere(w, row));
    if (key === 'OR') return (val as Where[]).some((w) => matchesWhere(w, row));
    if (key === 'NOT') return !matchesWhere(val as Where, row);
    return row[key] === val;
  });
}

const TID = 'T1';

console.log('tenant-isolation guard (BLD-300)');

// 1. The scoped-model set must equal exactly the schema models that carry a
//    nullable tenantId. This is the headline guard: add tenantId to a new Academy
//    model and forget to scope it → this fails.
check('ACADEMY_TENANT_MODELS matches the tenantId columns in schema.prisma', () => {
  const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
  const fromSchema = new Set<string>();
  const modelRe = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
  let m: RegExpExecArray | null;
  while ((m = modelRe.exec(schema))) {
    const [, name, body] = m;
    if (/\n\s*tenantId\s+String/.test(body)) fromSchema.add(modelKey(name));
  }
  const expected = [...ACADEMY_TENANT_MODELS].sort();
  const actual = [...fromSchema].sort();
  assert.deepEqual(actual, expected, `schema tenantId models ${JSON.stringify(actual)} != ACADEMY_TENANT_MODELS ${JSON.stringify(expected)}`);
});

// 2. Model gate.
check('isAcademyModel gates Academy vs core models', () => {
  assert.equal(isAcademyModel('AcademyStudent'), true);
  assert.equal(isAcademyModel('course'), true);
  assert.equal(isAcademyModel('Booking'), false);
  assert.equal(isAcademyModel('Client'), false);
  assert.equal(isAcademyModel('Tenant'), false);
  assert.equal(isAcademyModel(undefined), false);
});

// 3. Reads / bulk writes get the tenant filter, AND-combined with any caller filter.
check('where-scoped operations inject the tenant filter', () => {
  for (const op of ['findFirst', 'findMany', 'count', 'aggregate', 'groupBy', 'updateMany', 'deleteMany']) {
    const bare = applyTenantScope('course', op, undefined, TID);
    assert.deepEqual(bare.where, tenantScopeFilter(TID), `${op}: bare where`);

    const input = { where: { active: true } };
    const out = applyTenantScope('course', op, input, TID);
    assert.deepEqual(out.where, { AND: [{ active: true }, tenantScopeFilter(TID)] }, `${op}: combined where`);
    assert.deepEqual(input, { where: { active: true } }, `${op}: input not mutated`);
  }
});

// 4. Creates are stamped (without overwriting a caller-supplied tenantId).
check('create / createMany stamp tenantId', () => {
  const single = applyTenantScope('course', 'create', { data: { title: 'x' } }, TID);
  assert.equal((single.data as Record<string, unknown>).tenantId, TID);

  const keep = applyTenantScope('course', 'create', { data: { title: 'x', tenantId: 'KEEP' } }, TID);
  assert.equal((keep.data as Record<string, unknown>).tenantId, 'KEEP');

  const many = applyTenantScope('lessonProgress', 'createMany', { data: [{ a: 1 }, { a: 2, tenantId: 'X' }] }, TID);
  assert.deepEqual(many.data, [{ a: 1, tenantId: TID }, { a: 2, tenantId: 'X' }]);
});

// 5. upsert stamps the create branch only; unique where + update are untouched.
check('upsert stamps create, leaves where/update alone', () => {
  const out = applyTenantScope('academyStudent', 'upsert', { where: { email: 'e' }, create: { email: 'e' }, update: { x: 1 } }, TID);
  assert.equal((out.create as Record<string, unknown>).tenantId, TID);
  assert.deepEqual(out.where, { email: 'e' });
  assert.deepEqual(out.update, { x: 1 });
});

// 6. by-unique ops are deliberately left unchanged (Ring 1 RLS is their backstop).
check('findUnique / update / delete are not rewritten', () => {
  for (const op of ['findUnique', 'findUniqueOrThrow', 'update', 'delete']) {
    const input = { where: { id: 'abc' } };
    const out = applyTenantScope('course', op, input, TID);
    assert.deepEqual(out, { where: { id: 'abc' } }, op);
  }
});

// 7. Cross-tenant isolation: a tenant's filter matches its own rows + legacy NULLs,
//    and NEVER another tenant's stamped rows.
check('a tenant filter excludes another tenant rows', () => {
  const rows = [
    { id: 'a', tenantId: 'T1' },
    { id: 'b', tenantId: 'T2' },
    { id: 'c', tenantId: null },
  ];
  const scopeFor = (t: string) => applyTenantScope('course', 'findMany', undefined, t).where as Where;

  const t1 = rows.filter((r) => matchesWhere(scopeFor('T1'), r)).map((r) => r.id);
  const t2 = rows.filter((r) => matchesWhere(scopeFor('T2'), r)).map((r) => r.id);

  assert.deepEqual(t1, ['a', 'c'], 'T1 sees its own row + legacy NULL, not T2');
  assert.deepEqual(t2, ['b', 'c'], 'T2 sees its own row + legacy NULL, not T1');
  assert.ok(!t1.includes('b'), 'T1 must not see T2 data');
  assert.ok(!t2.includes('a'), 'T2 must not see T1 data');
});

console.log(`\n${checks} isolation checks passed.`);
