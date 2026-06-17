import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { tenantScopeFilter, applyTenantScope } from './lib/tenant-scope.ts';
const db = new PrismaClient({ adapter: new PrismaPg(new pg.Pool({})) });
console.log('tenantScopeFilter:', JSON.stringify(tenantScopeFilter('abc')));
console.log('applyTenantScope combined:', JSON.stringify(applyTenantScope('course','findMany',{where:{active:true}},'abc').where));
try { await db.course.findMany(applyTenantScope('course','findMany',{where:{active:true}},'abc')); console.log('query: reached DB layer (valid)'); }
catch (e) { console.log('query:', e.constructor.name, '-', String(e.message).replace(/\s+/g,' ').slice(0,120)); }
process.exit(0);
