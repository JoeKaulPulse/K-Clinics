import 'server-only';

// ClinicOS multi-tenancy — tenant resolver (see docs/PLATFORM_SAAS_PLAN.md, BLD-35).
// K Clinics is tenant #1. The Academy tables carry a `tenantId` (NOT NULL as of
// Ring 1c); this resolves the current tenant for the db query-scoping extension
// (lib/tenant-scope.ts) and writes. Single tenant today → always the default, so
// the live site is byte-for-byte unchanged. The Ring 0 self-healing backfill has
// retired: with tenantId NOT NULL no row can be tenant-less, and every create is
// stamped (the extension + explicit writes), so there is nothing left to backfill.

const DEFAULT_SLUG = 'kclinics';
const DEFAULT_NAME = 'K Clinics';

// Per-instance caches. These are warmed once per lambda; the multi-tenant flag
// flips only when a second Tenant row is created (onboarding tenant #2), so the
// single-tenant fast path below stays cheap.
let defaultIdCache: string | null = null;
let multiTenantCache: boolean | null = null;
const hostIdCache = new Map<string, string | null>();

/** Ensure the default (K Clinics) tenant row exists; returns its id. */
export async function ensureDefaultTenant(): Promise<string> {
  if (defaultIdCache) return defaultIdCache;
  const { db } = await import('@/lib/db');
  const host = (process.env.NEXT_PUBLIC_SITE_URL || 'https://kclinics.co.uk')
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
  const t = await db.tenant.upsert({
    where: { slug: DEFAULT_SLUG },
    update: {},
    create: { slug: DEFAULT_SLUG, name: DEFAULT_NAME, host },
  });
  defaultIdCache = t.id;
  return t.id;
}

/** Whether more than one tenant exists. Cached; while it is false we never touch
 *  request headers, so the single-tenant deployment behaves exactly as before. */
async function hasMultipleTenants(): Promise<boolean> {
  if (multiTenantCache !== null) return multiTenantCache;
  const { db } = await import('@/lib/db');
  const n = await db.tenant.count().catch(() => 1);
  multiTenantCache = n > 1;
  return multiTenantCache;
}

/** Reset the per-instance multi-tenant flag — call after creating a tenant so the
 *  resolver starts honouring the host. (Caches are per-lambda anyway; this just
 *  avoids waiting for a cold start after onboarding tenant #2.) */
export function invalidateTenantCache(): void {
  multiTenantCache = null;
  hostIdCache.clear();
}

/** The request host, lower-cased and port-stripped, or null when there is no
 *  request scope (cron, build, scripts) — in which case we fall back to default. */
async function requestHost(): Promise<string | null> {
  try {
    const { headers } = await import('next/headers');
    const h = await headers();
    const host = h.get('x-forwarded-host') || h.get('host');
    return host ? host.toLowerCase().replace(/:\d+$/, '') : null;
  } catch {
    return null;
  }
}

/** Resolve a tenant id from a hostname (custom domain / subdomain). Cached per host. */
async function tenantIdByHost(host: string): Promise<string | null> {
  if (hostIdCache.has(host)) return hostIdCache.get(host)!;
  const { db } = await import('@/lib/db');
  const t = await db.tenant.findFirst({ where: { host, active: true }, select: { id: true } }).catch(() => null);
  const id = t?.id ?? null;
  hostIdCache.set(host, id);
  return id;
}

/** The current tenant id.
 *
 *  Single tenant (today) → the default tenant id, resolved without reading the
 *  request, so the live site is byte-for-byte unchanged. Once a second tenant is
 *  onboarded the resolver branches on the request host (custom domain /
 *  subdomain → Tenant), falling back to the default when the host is unknown or
 *  there is no request scope. A per-tenant JWT claim is a Ring 2 refinement
 *  (the academy token carries no tenant claim yet — see PLATFORM_SAAS_PLAN.md). */
export async function currentTenantId(): Promise<string> {
  const defId = await ensureDefaultTenant();
  if (!(await hasMultipleTenants())) return defId;
  const host = await requestHost();
  if (host) {
    const resolved = await tenantIdByHost(host);
    if (resolved) return resolved;
  }
  return defId;
}
