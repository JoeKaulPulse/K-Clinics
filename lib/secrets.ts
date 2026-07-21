import 'server-only';
import { db } from '@/lib/db';
import { encryptJson, decryptJson } from '@/lib/crypto';

// Owner-managed credential store. Integration secrets can be entered in the admin
// (/admin/settings/credentials) instead of hosting env vars; they're encrypted at
// rest and this resolver prefers them over process.env, with env as a fallback so
// nothing regresses for keys that aren't set in-app. Values are never returned to
// the client — only their presence/source.

// ── Catalog of secrets the owner can manage in-app, grouped by integration. ──
// `envOnly` keys are core/runtime (read synchronously at boot) — shown read-only.
export type SecretDef = { name: string; label: string; group: string; help?: string; envOnly?: boolean };

export const SECRET_DEFS: SecretDef[] = [
  // Email
  { name: 'RESEND_API_KEY', label: 'Resend API key', group: 'Email', help: 'resend.com → API Keys' },
  { name: 'EMAIL_FROM', label: 'From address', group: 'Email', help: 'e.g. KClinics <hello@mail.kclinics.co.uk>' },
  { name: 'EMAIL_REPLY_TO', label: 'Reply-to address', group: 'Email' },
  // SMS
  { name: 'TWILIO_ACCOUNT_SID', label: 'Twilio Account SID', group: 'SMS', help: 'console.twilio.com' },
  { name: 'TWILIO_AUTH_TOKEN', label: 'Twilio Auth Token', group: 'SMS' },
  { name: 'TWILIO_FROM', label: 'Twilio from number', group: 'SMS' },
  // AI & voice
  { name: 'ANTHROPIC_API_KEY', label: 'Anthropic (Claude) API key', group: 'AI & voice', help: 'console.anthropic.com' },
  { name: 'DEEPGRAM_API_KEY', label: 'Deepgram API key', group: 'AI & voice', help: 'console.deepgram.com' },
  // Translation
  { name: 'DEEPL_API_KEY', label: 'DeepL API key', group: 'Translation', help: 'No longer used — translation runs on Google. Safe to clear.' },
  { name: 'GOOGLE_TRANSLATE_KEY', label: 'Google Translate key', group: 'Translation', help: 'Google Cloud Console → APIs & Services → Credentials → Create credentials → API key. FIRST enable “Cloud Translation API” (APIs & Services → Library). If it is rejected: the API is not enabled, or the key is restricted — set Application restrictions = None and API restrictions = Cloud Translation API only. Use a plain API key, not an OAuth client.' },
  // Ads — Meta / Google
  { name: 'GOOGLE_ADS_DEVELOPER_TOKEN', label: 'Google Ads developer token', group: 'Ads', help: 'Only from a Google Ads MANAGER (MCC) account → Tools & Settings → Setup → API Center. New tokens start in “Test” mode — apply for “Basic access” to use live data. One token covers all your accounts; it is NOT a per-account number.' },
  { name: 'GOOGLE_ADS_CUSTOMER_ID', label: 'Google Ads customer ID', group: 'Ads', help: 'The 10-digit ID (no dashes) of the Ads account that holds your campaigns — shown top-right at ads.google.com next to the account name.' },
  { name: 'GOOGLE_ADS_LOGIN_CUSTOMER_ID', label: 'Google Ads login customer ID', group: 'Ads', help: 'Different from the customer ID above. ONLY needed if you reach the account through a manager (MCC) account — then put the MANAGER’s 10-digit ID here. If you sign in directly to a single account with no manager, leave this blank.' },
  { name: 'GOOGLE_ADS_CONVERSION_ACTION_ID', label: 'Google Ads conversion action ID', group: 'Ads', help: 'Google Ads → Goals → Conversions → your "Imported"/offline action. The numeric id (ctId) in the page URL. Enables value-based offline conversions from charged bookings.' },
  // Analytics — GA4 Data API + Search Console reporting
  { name: 'GA4_PROPERTY_ID', label: 'GA4 property ID (numeric)', group: 'Analytics', help: 'GA4 → Admin → Property settings → Property ID. A number like 123456789 — NOT the G-XXXX tag. Powers the Performance "traffic by channel" widget.' },
  { name: 'SEARCH_CONSOLE_SITE', label: 'Search Console property (optional)', group: 'Analytics', help: 'Optional. For a Domain property enter sc-domain:kclinics.co.uk; otherwise it defaults to the site URL.' },
  // Reviews — public Google rating + recent reviews via the Places API (no OAuth)
  { name: 'GOOGLE_PLACE_ID', label: 'Google Place ID', group: 'Reviews', help: 'Find it at developers.google.com/maps/documentation/places/web-service/place-id (search your clinic). Shows your live Google rating + recent reviews on the site immediately — no approval needed.' },
  { name: 'GOOGLE_PLACES_API_KEY', label: 'Google Places API key', group: 'Reviews', help: 'Google Cloud → Credentials → API key, with the “Places API” enabled. Pairs with the Place ID above.' },
  // OAuth client credentials — set here, then click Connect on the relevant page.
  { name: 'GOOGLE_CLIENT_ID', label: 'Google OAuth client ID', group: 'OAuth · Google', help: 'console.cloud.google.com → Credentials. Powers Google Ads/Analytics/Search. (Calendar/Business still read hosting env.)' },
  { name: 'GOOGLE_CLIENT_SECRET', label: 'Google OAuth client secret', group: 'OAuth · Google' },
  { name: 'XERO_CLIENT_ID', label: 'Xero client ID', group: 'OAuth · Xero', help: 'developer.xero.com/app/manage' },
  { name: 'XERO_CLIENT_SECRET', label: 'Xero client secret', group: 'OAuth · Xero' },
  { name: 'TRUELAYER_CLIENT_ID', label: 'TrueLayer client ID', group: 'OAuth · Bank', help: 'console.truelayer.com' },
  { name: 'TRUELAYER_CLIENT_SECRET', label: 'TrueLayer client secret', group: 'OAuth · Bank' },
  // Google Workspace Directory API (BLD-312) — service account + domain-wide delegation.
  // See docs/GOOGLE_WORKSPACE_MIGRATION.md §10.1 for the one-off setup steps.
  { name: 'GOOGLE_WORKSPACE_SA_KEY', label: 'Workspace service-account key (JSON)', group: 'Google Workspace', help: 'Paste the full JSON key downloaded from Google Cloud Console → IAM & Admin → Service Accounts → Keys. The key must have domain-wide delegation enabled with the Directory API scopes.' },
  { name: 'GOOGLE_WORKSPACE_ADMIN_EMAIL', label: 'Workspace admin email to impersonate', group: 'Google Workspace', help: 'The super-admin email the service account will impersonate, e.g. admin@kclinics.co.uk. This user must have the Admin SDK Directory API access.' },
  { name: 'GOOGLE_WORKSPACE_CUSTOMER_ID', label: 'Workspace customer ID (optional)', group: 'Google Workspace', help: 'Optional. If set, replaces "my_customer" in Directory API calls. Find it at admin.google.com → Account → Account settings → Customer ID.' },
  // Payments — hosting-managed by design: the publishable key is baked into the
  // browser bundle at BUILD TIME and can't be served from the DB, so payments
  // always need both keys in env + a redeploy. Shown read-only for reference.
  { name: 'STRIPE_SECRET_KEY', label: 'Stripe secret key', group: 'Payments', envOnly: true, help: 'Set in hosting env — payments need both keys + a redeploy.' },
  { name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', label: 'Stripe publishable key', group: 'Payments', envOnly: true, help: 'Build-time browser key — must be in hosting env (cannot be set in-app).' },
];

const MANAGEABLE = new Set(SECRET_DEFS.filter((d) => !d.envOnly).map((d) => d.name));

// Built-in fallback values for non-credential config, used by getSecret when
// neither a managed value nor an env var is set. NOT secrets — an owner-set value
// or env var overrides them. Kept separate from SECRET_DEFS so the value is never
// included in secretStatus()/returned to the client.
const SECRET_DEFAULTS: Record<string, string> = {
  // K Clinics outbound SMS sender (Twilio). Used ONLY to text clients — server-side
  // sending identifier, never surfaced publicly (the public number is site.phone).
  TWILIO_FROM: '+447828877444',
};

// Short in-memory cache (per server instance) so hot paths (every email/SMS send)
// don't hit the DB each time. Eventual consistency within the TTL is fine.
let cache: Map<string, string> | null = null;
let cacheAt = 0;
const TTL_MS = 30_000;

async function loadAll(): Promise<Map<string, string>> {
  if (cache && Date.now() - cacheAt < TTL_MS) return cache;
  const m = new Map<string, string>();
  try {
    const rows = await db.managedSecret.findMany();
    for (const r of rows) {
      try { const v = decryptJson<string>(r.valueEnc); if (typeof v === 'string' && v) m.set(r.name, v); } catch { /* skip undecryptable */ }
    }
  } catch { /* table/db unavailable — fall back to env entirely */ }
  cache = m; cacheAt = Date.now();
  return m;
}

export function invalidateSecretCache() { cache = null; cacheAt = 0; }

/** Resolve a secret: owner-managed value first, else process.env, else undefined. */
export async function getSecret(name: string): Promise<string | undefined> {
  if (MANAGEABLE.has(name)) {
    const v = (await loadAll()).get(name);
    if (v) return v;
  }
  const env = process.env[name];
  if (env && env.length > 0) return env;
  return SECRET_DEFAULTS[name]; // built-in default (e.g. the SMS sender number), else undefined
}

/** Convenience for `Boolean(await getSecret(name))`. */
export async function hasSecret(name: string): Promise<boolean> {
  return Boolean(await getSecret(name));
}

// ── Per-tenant secrets (R15 groundwork, BLD-302) ─────────────────────────────
// Multi-tenant ClinicOS will need the same key (e.g. a JWT signing secret) to
// hold a DIFFERENT value per tenant. Rather than a destructive composite-PK
// change, a tenant-scoped value is stored under a namespaced key while global
// values keep the bare name — so `name @id` still enforces uniqueness. (No
// tenantId column: that would pull ManagedSecret into the tenant-isolation
// auto-scope and hide the global no-tenant rows — see the schema comment.)
//
// NOTE: nothing in the auth-verify hot path uses this yet — token verification
// still reads process.env in lib/auth-edge.ts (edge runtime can't query the DB).
// These resolvers exist so the per-tenant store is ready when that path moves
// off the edge. Resolution order: tenant-scoped value → global managed/env value.
const TENANT_PREFIX = 't:';
const scopedName = (tenantId: string, name: string) => `${TENANT_PREFIX}${tenantId}:${name}`;

/** Resolve a secret for a tenant: the tenant-scoped value if set, else the
 *  global value (managed → env → default), exactly as getSecret resolves it. */
export async function getTenantSecret(name: string, tenantId: string | null | undefined): Promise<string | undefined> {
  if (tenantId) {
    const v = (await loadAll()).get(scopedName(tenantId, name));
    if (v) return v;
  }
  return getSecret(name);
}

/** Set a tenant-scoped secret (server-only; encrypted at rest). */
export async function setTenantSecret(name: string, value: string, tenantId: string, actor: string): Promise<void> {
  if (!tenantId) throw new Error('tenantId is required for a tenant-scoped secret.');
  const valueEnc = encryptJson(value); // throws if no encryption key configured
  const key = scopedName(tenantId, name);
  await db.managedSecret.upsert({
    where: { name: key },
    update: { valueEnc, updatedBy: actor },
    create: { name: key, valueEnc, updatedBy: actor },
  });
  invalidateSecretCache();
}

/** Remove a tenant-scoped secret (falls back to the global value thereafter). */
export async function clearTenantSecret(name: string, tenantId: string): Promise<void> {
  await db.managedSecret.deleteMany({ where: { name: scopedName(tenantId, name) } });
  invalidateSecretCache();
}

export async function setSecret(name: string, value: string, actor: string): Promise<void> {
  if (!MANAGEABLE.has(name)) throw new Error('This key is managed in hosting and cannot be set here.');
  const valueEnc = encryptJson(value); // throws if no encryption key configured
  await db.managedSecret.upsert({
    where: { name },
    update: { valueEnc, updatedBy: actor },
    create: { name, valueEnc, updatedBy: actor },
  });
  invalidateSecretCache();
}

export async function clearSecret(name: string): Promise<void> {
  await db.managedSecret.deleteMany({ where: { name } });
  invalidateSecretCache();
}

export type SecretStatus = SecretDef & { source: 'app' | 'env' | 'unset'; updatedBy?: string | null; updatedAt?: string | null };

/** Status of every catalogued secret — presence + source only, never the value. */
export async function secretStatus(): Promise<SecretStatus[]> {
  const rows = await db.managedSecret.findMany({ select: { name: true, updatedBy: true, updatedAt: true } }).catch(() => [] as { name: string; updatedBy: string | null; updatedAt: Date }[]);
  const inApp = new Map(rows.map((r) => [r.name, r]));
  return SECRET_DEFS.map((d) => {
    const appRow = inApp.get(d.name);
    const source: 'app' | 'env' | 'unset' = (!d.envOnly && appRow) ? 'app' : (process.env[d.name] ? 'env' : 'unset');
    return { ...d, source, updatedBy: appRow?.updatedBy ?? null, updatedAt: appRow?.updatedAt ? appRow.updatedAt.toISOString() : null };
  });
}
