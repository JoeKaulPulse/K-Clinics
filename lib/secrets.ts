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
  // Workspace directory management (BLD-312) — service account + domain-wide delegation.
  { name: 'GOOGLE_WORKSPACE_SA_KEY', label: 'Workspace service-account key (JSON)', group: 'Workspace · Google', help: 'Paste the entire service-account JSON key. Google Cloud → IAM & Admin → Service accounts → Keys → Add key (JSON). The service account needs domain-wide delegation for the admin.directory scopes. Full setup: docs/WORKSPACE_ADMIN_SDK_SETUP.md.' },
  { name: 'GOOGLE_WORKSPACE_ADMIN_EMAIL', label: 'Workspace admin to impersonate', group: 'Workspace · Google', help: 'A super-admin address the service account acts as, e.g. webmaster@kclinics.co.uk.' },
  { name: 'GOOGLE_WORKSPACE_CUSTOMER_ID', label: 'Workspace customer ID (optional)', group: 'Workspace · Google', help: 'Leave blank to use “my_customer” (your own Workspace).' },
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
