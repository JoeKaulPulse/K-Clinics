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
  { name: 'DEEPL_API_KEY', label: 'DeepL API key', group: 'Translation', help: 'deepl.com/pro-api' },
  { name: 'GOOGLE_TRANSLATE_KEY', label: 'Google Translate key', group: 'Translation' },
  // Ads — Meta / Google
  { name: 'GOOGLE_ADS_DEVELOPER_TOKEN', label: 'Google Ads developer token', group: 'Ads' },
  { name: 'GOOGLE_ADS_CUSTOMER_ID', label: 'Google Ads customer ID', group: 'Ads' },
  { name: 'GOOGLE_ADS_LOGIN_CUSTOMER_ID', label: 'Google Ads login customer ID', group: 'Ads' },
  { name: 'GOOGLE_ADS_CONVERSION_ACTION_ID', label: 'Google Ads conversion action ID', group: 'Ads', help: 'Google Ads → Goals → Conversions → your "Imported"/offline action. The numeric id (ctId) in the page URL. Enables value-based offline conversions from charged bookings.' },
  // Analytics — GA4 Data API + Search Console reporting
  { name: 'GA4_PROPERTY_ID', label: 'GA4 property ID (numeric)', group: 'Analytics', help: 'GA4 → Admin → Property settings → Property ID. A number like 123456789 — NOT the G-XXXX tag. Powers the Performance "traffic by channel" widget.' },
  { name: 'SEARCH_CONSOLE_SITE', label: 'Search Console property (optional)', group: 'Analytics', help: 'Optional. For a Domain property enter sc-domain:kclinics.co.uk; otherwise it defaults to the site URL.' },
  // OAuth client credentials — set here, then click Connect on the relevant page.
  { name: 'GOOGLE_CLIENT_ID', label: 'Google OAuth client ID', group: 'OAuth · Google', help: 'console.cloud.google.com → Credentials. Powers Google Ads/Analytics/Search. (Calendar/Business still read hosting env.)' },
  { name: 'GOOGLE_CLIENT_SECRET', label: 'Google OAuth client secret', group: 'OAuth · Google' },
  { name: 'XERO_CLIENT_ID', label: 'Xero client ID', group: 'OAuth · Xero', help: 'developer.xero.com/app/manage' },
  { name: 'XERO_CLIENT_SECRET', label: 'Xero client secret', group: 'OAuth · Xero' },
  { name: 'TRUELAYER_CLIENT_ID', label: 'TrueLayer client ID', group: 'OAuth · Bank', help: 'console.truelayer.com' },
  { name: 'TRUELAYER_CLIENT_SECRET', label: 'TrueLayer client secret', group: 'OAuth · Bank' },
  // Payments — hosting-managed by design: the publishable key is baked into the
  // browser bundle at BUILD TIME and can't be served from the DB, so payments
  // always need both keys in env + a redeploy. Shown read-only for reference.
  { name: 'STRIPE_SECRET_KEY', label: 'Stripe secret key', group: 'Payments', envOnly: true, help: 'Set in hosting env — payments need both keys + a redeploy.' },
  { name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', label: 'Stripe publishable key', group: 'Payments', envOnly: true, help: 'Build-time browser key — must be in hosting env (cannot be set in-app).' },
];

const MANAGEABLE = new Set(SECRET_DEFS.filter((d) => !d.envOnly).map((d) => d.name));

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
  return env && env.length > 0 ? env : undefined;
}

/** Convenience for `Boolean(await getSecret(name))`. */
export async function hasSecret(name: string): Promise<boolean> {
  return Boolean(await getSecret(name));
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
