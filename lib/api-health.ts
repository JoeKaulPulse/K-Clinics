import 'server-only';
import { db } from '@/lib/db';
import { site } from '@/lib/site';
import { getSecret } from '@/lib/secrets';

// API health — live, read-only probes of every external API and the key
// internal endpoints, for the /admin/api-health traffic-light page. Unlike
// lib/platform-status.ts (which checks configuration presence), every probe
// here makes a REAL call — an invalid key, a revoked token, a sunset API
// version or a down provider all show red even though the env var is set.
//
// Rules for probes:
// - Read-only and zero-side-effect (balance reads, domain lists, OPTIONS,
//   token refreshes that the normal flow would perform anyway).
// - Never throw: every failure becomes a light + a plain-English detail.
// - Always time-boxed (AbortSignal timeouts + an outer per-check guard), so
//   the whole report completes in seconds even when a provider hangs.

export type Light = 'green' | 'amber' | 'red' | 'grey';

export type ApiHealthCheck = {
  id: string;
  label: string;
  category: string;
  /** The real call this check makes, shown on the page for transparency. */
  probe: string;
  /** Critical checks colour the overall banner harder. */
  critical?: boolean;
};

export type ApiHealthResult = ApiHealthCheck & {
  light: Light;
  /** One-line human status, e.g. "OK · 2 verified domains". */
  detail: string;
  latencyMs: number | null;
  /** Extra context lines (what to do next, secondary signals). */
  info?: string[];
  /** ISO timestamp this light has held since (carried across runs). */
  since: string;
};

export type ApiHealthReport = {
  generatedAt: string;
  env: string;
  commit: string;
  durationMs: number;
  overall: Light;
  counts: Record<Light, number>;
  checks: ApiHealthResult[];
};

const RANK: Record<Light, number> = { red: 3, amber: 2, grey: 1, green: 0 };
const worst = (lights: Light[]): Light => lights.reduce<Light>((acc, l) => (RANK[l] > RANK[acc] ? l : acc), 'green');
const has = (v?: string | null) => Boolean(v && v.length > 0);
const ago = (d: Date | null) => {
  if (!d) return 'never';
  const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  if (s < 90) return `${s}s ago`;
  if (s < 5400) return `${Math.round(s / 60)}m ago`;
  if (s < 172800) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};

type Outcome = { light: Light; detail: string; latencyMs?: number | null; info?: string[] };

/** Timed fetch that returns the response + elapsed ms; throws on network error/timeout. */
async function timed(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<{ res: Response; ms: number }> {
  const { timeoutMs = 8000, ...rest } = init;
  const t = Date.now();
  const res = await fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' });
  return { res, ms: Date.now() - t };
}

const netFail = (e: unknown): Outcome => ({
  light: 'red',
  detail: (e as Error)?.name === 'TimeoutError' ? 'Timed out — provider not responding' : `Unreachable (${(e as Error)?.message?.slice(0, 80) || 'network error'})`,
});

// ── Individual checks ─────────────────────────────────────────────────────────

async function checkDatabase(): Promise<Outcome> {
  try {
    const t = Date.now();
    const clients = await db.client.count();
    const ms = Date.now() - t;
    return { light: ms > 1500 ? 'amber' : 'green', detail: `Connected · ${clients.toLocaleString('en-GB')} clients`, latencyMs: ms, info: ms > 1500 ? ['Queries are slow — check the pool / region.'] : undefined };
  } catch (e) {
    return { light: 'red', detail: `Query failed — ${(e as Error)?.message?.slice(0, 100)}` };
  }
}

async function checkPublicApi(): Promise<Outcome> {
  try {
    const { res, ms } = await timed(`${site.url.replace(/\/$/, '')}/api/health`, { timeoutMs: 10_000 });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.ok) return { light: ms > 2500 ? 'amber' : 'green', detail: `Public API answering (HTTP ${res.status})`, latencyMs: ms };
    return { light: 'red', detail: `HTTP ${res.status} — ${j.database === 'error' ? 'database unreachable from the live site' : 'health endpoint reports a problem'}`, latencyMs: ms };
  } catch (e) { return netFail(e); }
}

async function checkBlob(): Promise<Outcome> {
  if (!has(process.env.BLOB_READ_WRITE_TOKEN)) return { light: 'grey', detail: 'Not configured — uploads (media, screenshots, kiosk photos) disabled' };
  try {
    const t = Date.now();
    const { list } = await import('@vercel/blob');
    await list({ limit: 1 });
    return { light: 'green', detail: 'Store reachable, token accepted', latencyMs: Date.now() - t };
  } catch (e) {
    const msg = (e as Error)?.message || '';
    return { light: 'red', detail: /access|token|401|403/i.test(msg) ? 'Token rejected — re-issue BLOB_READ_WRITE_TOKEN' : `Store unreachable (${msg.slice(0, 80)})` };
  }
}

async function checkRedis(): Promise<Outcome> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!has(url) || !has(token)) return { light: 'grey', detail: 'Not configured — rate limiting falls back to Postgres' };
  try {
    const { res, ms } = await timed(`${url!.replace(/\/$/, '')}/ping`, { headers: { Authorization: `Bearer ${token}` }, timeoutMs: 5000 });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.result === 'PONG') return { light: 'green', detail: 'PONG', latencyMs: ms };
    return { light: 'red', detail: res.status === 401 ? 'Token rejected' : `Unexpected reply (HTTP ${res.status})`, latencyMs: ms };
  } catch (e) { return netFail(e); }
}

async function checkStripe(): Promise<Outcome> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!has(key)) return { light: 'red', detail: 'STRIPE_SECRET_KEY not set — payments are down' };
  try {
    const { res, ms } = await timed('https://api.stripe.com/v1/balance', { headers: { Authorization: `Bearer ${key}` } });
    if (res.ok) {
      const mode = key!.startsWith('sk_live') ? 'live' : key!.startsWith('sk_test') ? 'TEST mode' : 'key';
      return {
        light: 'green', detail: `Key valid (${mode}) · balance endpoint OK`, latencyMs: ms,
        info: has(process.env.STRIPE_WEBHOOK_SECRET) ? undefined : ['STRIPE_WEBHOOK_SECRET missing — payment webhooks are being rejected.'],
      };
    }
    if (res.status === 401) return { light: 'red', detail: 'Secret key rejected (401) — revoked or wrong account', latencyMs: ms };
    return { light: res.status >= 500 ? 'red' : 'amber', detail: `Stripe answered HTTP ${res.status}`, latencyMs: ms };
  } catch (e) { return netFail(e); }
}

async function checkResend(): Promise<Outcome> {
  // Owner-manageable secret (Credentials manager) — resolve via getSecret, not
  // bare env, or a DB-stored key would show a false "not set" here.
  const key = await getSecret('RESEND_API_KEY');
  if (!has(key)) return { light: 'red', detail: 'RESEND_API_KEY not set — no email can send' };
  try {
    const { res, ms } = await timed('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${key}` } });
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      const domains = (j.data ?? []) as { name?: string; status?: string }[];
      const verified = domains.filter((d) => d.status === 'verified');
      const light: Light = verified.length > 0 ? 'green' : 'amber';
      return {
        light, latencyMs: ms,
        detail: verified.length > 0 ? `Key valid · ${verified.length}/${domains.length} sending domain${domains.length === 1 ? '' : 's'} verified` : `Key valid but no verified sending domain (${domains.length} pending)`,
        info: verified.length === 0 ? ['Verify the mail domain in Resend or all sends will fail.'] : undefined,
      };
    }
    if (res.status === 401) return { light: 'red', detail: 'API key rejected (401)', latencyMs: ms };
    return { light: 'amber', detail: `Resend answered HTTP ${res.status}`, latencyMs: ms };
  } catch (e) { return netFail(e); }
}

async function checkTwilio(): Promise<Outcome> {
  const sid = await getSecret('TWILIO_ACCOUNT_SID');
  const tok = await getSecret('TWILIO_AUTH_TOKEN');
  if (!has(sid) || !has(tok)) return { light: 'grey', detail: 'Not configured — SMS reminders off (email-only)' };
  try {
    const auth = Buffer.from(`${sid}:${tok}`).toString('base64');
    const { res, ms } = await timed(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, { headers: { Authorization: `Basic ${auth}` } });
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      const active = j.status === 'active';
      return { light: active ? 'green' : 'amber', detail: active ? `Account active${has(await getSecret('TWILIO_FROM')) ? '' : ' — but TWILIO_FROM missing'}` : `Account status: ${j.status}`, latencyMs: ms };
    }
    return { light: 'red', detail: res.status === 401 ? 'Credentials rejected (401)' : `Twilio answered HTTP ${res.status}`, latencyMs: ms };
  } catch (e) { return netFail(e); }
}

async function checkTranslation(): Promise<Outcome> {
  const deeplKey = await getSecret('DEEPL_API_KEY');
  const gKey = await getSecret('GOOGLE_TRANSLATE_KEY');
  if (!has(deeplKey) && !has(gKey)) return { light: 'grey', detail: 'Not configured — health-form answers stay untranslated' };
  if (has(deeplKey)) {
    const host = process.env.DEEPL_API_FREE === 'true' ? 'api-free.deepl.com' : 'api.deepl.com';
    try {
      const { res, ms } = await timed(`https://${host}/v2/usage`, { headers: { Authorization: `DeepL-Auth-Key ${deeplKey}` } });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        const used = Number(j.character_count ?? 0); const limit = Number(j.character_limit ?? 0);
        const nearCap = limit > 0 && used / limit > 0.9;
        return { light: nearCap ? 'amber' : 'green', detail: `DeepL key valid · ${used.toLocaleString('en-GB')}/${limit ? limit.toLocaleString('en-GB') : '∞'} chars used`, latencyMs: ms, info: nearCap ? ['Over 90% of the DeepL quota used this period.'] : undefined };
      }
      if (res.status === 401 || res.status === 403) return { light: 'red', detail: `DeepL key rejected (${res.status})`, latencyMs: ms };
      return { light: 'amber', detail: `DeepL answered HTTP ${res.status}`, latencyMs: ms };
    } catch (e) { return netFail(e); }
  }
  try {
    const { res, ms } = await timed(`https://translation.googleapis.com/language/translate/v2/languages?key=${encodeURIComponent(gKey!)}&target=en`);
    if (res.ok) return { light: 'green', detail: 'Google Translate key valid', latencyMs: ms };
    return { light: 'red', detail: `Google Translate answered HTTP ${res.status}`, latencyMs: ms };
  } catch (e) { return netFail(e); }
}

async function checkAnthropic(): Promise<Outcome> {
  const key = await getSecret('ANTHROPIC_API_KEY');
  if (!has(key)) return { light: 'amber', detail: 'ANTHROPIC_API_KEY not set — kiosk AI, K Vision, chat assist & marketing AI are off' };
  try {
    const { res, ms } = await timed('https://api.anthropic.com/v1/models?limit=1', {
      headers: { 'x-api-key': key!, 'anthropic-version': '2023-06-01' },
    });
    if (res.ok) return { light: 'green', detail: 'API key valid · models endpoint OK', latencyMs: ms };
    if (res.status === 401) return { light: 'red', detail: 'API key rejected (401) — AI features are failing', latencyMs: ms };
    if (res.status === 429) return { light: 'amber', detail: 'Rate-limited (429) — key valid but throttled', latencyMs: ms };
    return { light: res.status >= 500 ? 'amber' : 'red', detail: `Anthropic answered HTTP ${res.status}`, latencyMs: ms };
  } catch (e) { return netFail(e); }
}

async function checkDeepgram(): Promise<Outcome> {
  const key = await getSecret('DEEPGRAM_API_KEY');
  if (!has(key)) return { light: 'grey', detail: 'Not configured — clinical voice-note transcription off' };
  try {
    const { res, ms } = await timed('https://api.deepgram.com/v1/projects', { headers: { Authorization: `Token ${key}` } });
    if (res.ok) return { light: 'green', detail: 'API key valid · projects endpoint OK', latencyMs: ms };
    if (res.status === 401 || res.status === 403) return { light: 'red', detail: `API key rejected (${res.status}) — voice transcription failing`, latencyMs: ms };
    return { light: 'amber', detail: `Deepgram answered HTTP ${res.status}`, latencyMs: ms };
  } catch (e) { return netFail(e); }
}

async function checkXero(): Promise<Outcome> {
  try {
    const { xeroConfigured, getXeroCashPence } = await import('@/lib/xero');
    const { isConnected } = await import('@/lib/oauth-connections');
    if (!(await xeroConfigured())) return { light: 'grey', detail: 'Not configured — add Xero OAuth credentials' };
    if (!(await isConnected('xero'))) return { light: 'amber', detail: 'Credentials present — not connected yet', info: ['Connect via Finance → Controls (OAuth).'] };
    const t = Date.now();
    const r = await getXeroCashPence();
    const ms = Date.now() - t;
    if (r.ok) return { light: 'green', detail: 'Token refresh + BankSummary read OK', latencyMs: ms };
    return { light: 'red', detail: 'Connected but the API read failed — token likely expired', latencyMs: ms, info: ['Reconnect Xero from Finance → Controls.'] };
  } catch (e) { return { light: 'red', detail: `Check failed — ${(e as Error)?.message?.slice(0, 80)}` }; }
}

async function checkTrueLayer(): Promise<Outcome> {
  try {
    const { trueLayerConfigured, getBankCashPence } = await import('@/lib/truelayer');
    const { isConnected } = await import('@/lib/oauth-connections');
    if (!(await trueLayerConfigured())) return { light: 'grey', detail: 'Not configured — add TrueLayer credentials' };
    if (!(await isConnected('truelayer'))) return { light: 'amber', detail: 'Credentials present — bank not linked yet' };
    const t = Date.now();
    const r = await getBankCashPence();
    const ms = Date.now() - t;
    if (r.ok) return { light: 'green', detail: 'Token refresh + accounts read OK', latencyMs: ms };
    return { light: 'red', detail: 'Connected but the accounts read failed — bank consent may have expired (90-day re-auth)', latencyMs: ms };
  } catch (e) { return { light: 'red', detail: `Check failed — ${(e as Error)?.message?.slice(0, 80)}` }; }
}

async function checkGoogleBusiness(): Promise<Outcome> {
  try {
    const gb = await import('@/lib/google-business');
    if (!(await gb.googleOAuthConfigured())) return { light: 'grey', detail: 'Not configured — Google reviews sync off' };
    if (!(await gb.googleBusinessConnected())) return { light: 'amber', detail: 'Credentials present — not connected', info: ['Connect from Reviews → Google.'] };
    const t = Date.now();
    const r = await gb.listBusinessLocations();
    const ms = Date.now() - t;
    if (r.status === 'ok') return { light: 'green', detail: 'Token valid · Business Profile API OK', latencyMs: ms };
    if (r.status === 'pending') return { light: 'amber', detail: 'Connected — Google has not granted Business Profile API access yet', latencyMs: ms };
    if (r.status === 'none') return { light: 'amber', detail: 'Connected but no business locations visible', latencyMs: ms };
    return { light: 'red', detail: r.message || 'Business Profile API error', latencyMs: ms };
  } catch (e) { return { light: 'red', detail: `Check failed — ${(e as Error)?.message?.slice(0, 80)}` }; }
}

async function checkGoogleCalendar(): Promise<Outcome> {
  try {
    const { googleConfigured, googleEnabled } = await import('@/lib/google-calendar');
    if (!googleEnabled()) return { light: 'grey', detail: (await googleConfigured()) ? 'Parked — GOOGLE_INTEGRATION_ENABLED is off (clinic on Hostinger)' : 'Parked — not configured' };
    const staff = await db.adminUser.count({ where: { googleRefreshToken: { not: null }, active: true } });
    return { light: staff > 0 ? 'green' : 'amber', detail: staff > 0 ? `${staff} staff calendar${staff === 1 ? '' : 's'} connected` : 'Enabled but no staff connected yet' };
  } catch (e) { return { light: 'grey', detail: `Could not read — ${(e as Error)?.message?.slice(0, 60)}` }; }
}

async function checkCalDav(): Promise<Outcome> {
  const url = process.env.HOSTINGER_CALDAV_URL;
  const user = process.env.HOSTINGER_CALDAV_USER;
  const pass = process.env.HOSTINGER_CALDAV_PASS;
  if (!has(url) || !has(user) || !has(pass)) return { light: 'grey', detail: 'Not configured — bookings don’t push to the clinic calendar' };
  try {
    const auth = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
    const { res, ms } = await timed(url!, { method: 'OPTIONS', headers: { authorization: auth } });
    if (res.status === 401 || res.status === 403) return { light: 'red', detail: `Credentials rejected (${res.status})`, latencyMs: ms };
    if (res.status === 404) return { light: 'red', detail: 'Calendar collection not found (404) — check HOSTINGER_CALDAV_URL', latencyMs: ms };
    if (res.ok || res.status === 207) {
      const dav = res.headers.get('dav') || '';
      return { light: 'green', detail: `Server answering${dav.includes('calendar-access') ? ' · CalDAV confirmed' : ''}`, latencyMs: ms };
    }
    return { light: 'amber', detail: `Server answered HTTP ${res.status}`, latencyMs: ms };
  } catch (e) { return netFail(e); }
}

async function checkYay(): Promise<Outcome> {
  if (!has(process.env.YAY_WEBHOOK_SECRET)) return { light: 'grey', detail: 'Not configured — call logging off' };
  try {
    const last = await db.callRecord.findFirst({ orderBy: { startedAt: 'desc' }, select: { startedAt: true } });
    const apiCreds = has(process.env.YAY_AUTH_RESELLER) && has(process.env.YAY_AUTH_PASSWORD);
    if (!last) return { light: 'amber', detail: 'Webhook secured — no call events received yet', info: ['Point the yay.com Call Ended + Voicemail webhooks at /api/integrations/yay.'] };
    const age = Date.now() - last.startedAt.getTime();
    const light: Light = age < 14 * 86400000 ? 'green' : 'amber';
    return { light, detail: `Last call event ${ago(last.startedAt)}${apiCreds ? ' · click-to-dial enabled' : ''}`, info: light === 'amber' ? ['No calls logged in 2 weeks — check the yay webhook config.'] : undefined };
  } catch (e) { return { light: 'grey', detail: `Could not read call log — ${(e as Error)?.message?.slice(0, 60)}` }; }
}

// Keep in step with the Graph version pinned in lib/ad-spend.ts /
// lib/conversions.ts / lib/marketing-connections.ts (currently v23.0).
const META_GRAPH_VERSION = 'v23.0';

async function checkMeta(): Promise<Outcome> {
  try {
    const { getConnection } = await import('@/lib/oauth-connections');
    const conn = await getConnection('meta');
    if (!conn?.tokens.access) return { light: 'grey', detail: 'Not connected — ad spend & CAPI off' };
    const { res, ms } = await timed(`https://graph.facebook.com/${META_GRAPH_VERSION}/me?fields=id`, { headers: { Authorization: `Bearer ${conn.tokens.access}` } });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.id) return { light: 'green', detail: `Access token valid (Graph ${META_GRAPH_VERSION})`, latencyMs: ms };
    const msg = j?.error?.message || `HTTP ${res.status}`;
    return { light: 'red', detail: `Token rejected — ${String(msg).slice(0, 90)}`, latencyMs: ms, info: ['Reconnect Meta in Marketing → Connections.'] };
  } catch (e) { return netFail(e); }
}

/** Refresh-token grant for the marketing Google connection — mirrors the
 *  closure in lib/ad-spend.ts googleSpend(). */
async function refreshGoogleTokens(refreshToken: string): Promise<{ access: string; refresh?: string; expiresAt: number | null } | null> {
  const id = await getSecret('GOOGLE_CLIENT_ID'), secret = await getSecret('GOOGLE_CLIENT_SECRET');
  if (!id || !secret) return null;
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const j = await res.json().catch(() => null);
    if (!j?.access_token) return null;
    // Google doesn't return a new refresh_token on refresh — keep the existing one.
    return { access: String(j.access_token), refresh: refreshToken, expiresAt: j.expires_in ? Date.now() + Number(j.expires_in) * 1000 : null };
  } catch { return null; }
}

async function checkGoogleAds(): Promise<Outcome> {
  try {
    const { getConnection, validAccessToken } = await import('@/lib/oauth-connections');
    const conn = await getConnection('google');
    if (!conn) return { light: 'grey', detail: 'Not connected — Google ad spend off' };
    const t = Date.now();
    // Real call: a refresh-token grant against oauth2.googleapis.com — the same
    // exchange every spend sync performs. Proves client id/secret + grant.
    const fresh = conn.tokens.refresh ? await refreshGoogleTokens(conn.tokens.refresh) : null;
    const ms = Date.now() - t;
    if (fresh) {
      await validAccessToken('google', async () => fresh); // persists if expired
      const devToken = has(await getSecret('GOOGLE_ADS_DEVELOPER_TOKEN'));
      const customer = has(await getSecret('GOOGLE_ADS_CUSTOMER_ID')) || has(conn.accountRef);
      const missing = [!devToken && 'GOOGLE_ADS_DEVELOPER_TOKEN', !customer && 'GOOGLE_ADS_CUSTOMER_ID'].filter(Boolean) as string[];
      return { light: missing.length ? 'amber' : 'green', detail: missing.length ? `OAuth healthy but missing ${missing.join(' + ')}` : 'OAuth refresh OK · spend sync ready', latencyMs: ms };
    }
    if (!conn.tokens.refresh) return { light: 'amber', detail: 'Connected without a refresh token — reconnect to enable automatic renewal', latencyMs: ms };
    return { light: 'red', detail: 'Refresh-token grant failed — access revoked or client secret changed', latencyMs: ms, info: ['Reconnect Google in Marketing → Connections.'] };
  } catch (e) { return netFail(e); }
}

async function checkTikTok(): Promise<Outcome> {
  try {
    const { getConnection } = await import('@/lib/oauth-connections');
    const conn = await getConnection('tiktok');
    if (!conn?.tokens.access) return { light: 'grey', detail: 'Not connected — TikTok ad spend off' };
    const { res, ms } = await timed('https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/', { headers: { 'Access-Token': conn.tokens.access } });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.code === 0) return { light: 'green', detail: `Token valid · ${(j.data?.list ?? []).length} advertiser account(s)`, latencyMs: ms };
    return { light: 'red', detail: `TikTok API error — ${String(j.message || `HTTP ${res.status}`).slice(0, 80)}`, latencyMs: ms };
  } catch (e) { return netFail(e); }
}

async function checkGa4(): Promise<Outcome> {
  try {
    const ids = await db.setting.findUnique({ where: { key: 'tracking_config' } });
    const secrets = await db.setting.findUnique({ where: { key: 'conversion_secrets' } });
    const ga4Id = ids?.value ? (JSON.parse(ids.value).ga4Id as string | undefined) : undefined;
    const apiSecret = secrets?.value ? (JSON.parse(secrets.value).ga4ApiSecret as string | undefined) : undefined;
    if (!ga4Id || !apiSecret) return { light: 'grey', detail: 'Not configured — server-side conversions off' };
    // The /debug/ endpoint validates the payload WITHOUT recording an event.
    const { res, ms } = await timed(`https://www.google-analytics.com/debug/mp/collect?measurement_id=${encodeURIComponent(ga4Id)}&api_secret=${encodeURIComponent(apiSecret)}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client_id: 'api.health.check', events: [{ name: 'health_check' }] }),
    });
    const j = await res.json().catch(() => ({}));
    const msgs = (j.validationMessages ?? []) as { description?: string }[];
    if (res.ok && msgs.length === 0) return { light: 'green', detail: 'Measurement Protocol accepts our payload', latencyMs: ms, info: ['Debug endpoint — validates reachability + payload; the API secret itself is only fully verified on live events.'] };
    if (res.ok) return { light: 'amber', detail: `Validation: ${msgs[0]?.description?.slice(0, 90) || 'payload warning'}`, latencyMs: ms };
    return { light: 'red', detail: `GA4 answered HTTP ${res.status}`, latencyMs: ms };
  } catch (e) { return netFail(e); }
}

async function checkGithub(): Promise<Outcome> {
  try {
    const { getGithubConfig } = await import('@/lib/build-board');
    const cfg = await getGithubConfig();
    if (!cfg) return { light: 'grey', detail: 'Not connected — board works standalone (no GitHub mirror)' };
    const { res, ms } = await timed(`https://api.github.com/repos/${cfg.repo}`, { headers: { Authorization: `Bearer ${cfg.token}`, Accept: 'application/vnd.github+json' } });
    if (res.ok) {
      const remaining = res.headers.get('x-ratelimit-remaining');
      return { light: 'green', detail: `${cfg.repo} reachable`, latencyMs: ms, info: remaining ? [`${remaining} API calls remaining this hour.`] : undefined };
    }
    if (res.status === 401) return { light: 'red', detail: 'Token rejected (401) — App key or PAT invalid', latencyMs: ms };
    if (res.status === 404) return { light: 'red', detail: `Repo ${cfg.repo} not found or token lacks access`, latencyMs: ms };
    return { light: 'amber', detail: `GitHub answered HTTP ${res.status}`, latencyMs: ms };
  } catch (e) { return netFail(e); }
}

async function checkCron(): Promise<Outcome> {
  try {
    const read = async (key: string) => {
      const r = await db.setting.findUnique({ where: { key } });
      return r?.value ? new Date(r.value) : null;
    };
    const daily = await read('cron_daily_last');
    const dispatch = await read('cron_dispatch_last');
    const dailyOk = daily && Date.now() - daily.getTime() < 26 * 3600000;
    const dispatchOk = dispatch && Date.now() - dispatch.getTime() < 30 * 60000;
    const light: Light = dailyOk && dispatchOk ? 'green' : (daily || dispatch) ? 'amber' : 'red';
    return {
      light,
      detail: `Daily ${ago(daily)} · dispatcher ${ago(dispatch)}`,
      info: light !== 'green' ? ['Reminders, follow-ups and scheduled sends depend on these runners (Vercel cron).'] : undefined,
    };
  } catch (e) { return { light: 'grey', detail: `Could not read heartbeats — ${(e as Error)?.message?.slice(0, 60)}` }; }
}

async function checkIndexNow(): Promise<Outcome> {
  const key = process.env.INDEXNOW_KEY;
  if (!has(key)) return { light: 'grey', detail: 'Not configured — instant search-engine pings off' };
  try {
    const { res, ms } = await timed(`${site.url.replace(/\/$/, '')}/indexnow-key.txt`, { timeoutMs: 6000 });
    const body = (await res.text().catch(() => '')).trim();
    if (res.ok && body === key) return { light: 'green', detail: 'Key file served and matches', latencyMs: ms };
    if (res.ok) return { light: 'amber', detail: 'Key file served but does NOT match INDEXNOW_KEY — pings are rejected', latencyMs: ms };
    return { light: 'red', detail: `Key file missing (HTTP ${res.status})`, latencyMs: ms };
  } catch (e) { return netFail(e); }
}

async function checkWeather(): Promise<Outcome> {
  try {
    const { res, ms } = await timed('https://api.open-meteo.com/v1/forecast?latitude=51.5416&longitude=-0.1022&current=temperature_2m&forecast_days=1', { timeoutMs: 5000 });
    const j = await res.json().catch(() => ({}));
    const temp = j?.current?.temperature_2m;
    if (res.ok && typeof temp === 'number') return { light: 'green', detail: `OK · ${temp}°C in Islington`, latencyMs: ms };
    return { light: 'amber', detail: `Unexpected reply (HTTP ${res.status})`, latencyMs: ms };
  } catch (e) { return netFail(e); }
}

async function checkHibp(): Promise<Outcome> {
  try {
    const { res, ms } = await timed('https://api.pwnedpasswords.com/range/21BD1', { timeoutMs: 5000 });
    if (res.ok) return { light: 'green', detail: 'Range query OK', latencyMs: ms };
    return { light: 'amber', detail: `HTTP ${res.status} — breach checks fail open (signups unaffected)`, latencyMs: ms };
  } catch { return { light: 'amber', detail: 'Unreachable — breach checks fail open (signups unaffected)' }; }
}

// ── Registry ──────────────────────────────────────────────────────────────────

type Def = ApiHealthCheck & { run: () => Promise<Outcome> };

const CHECKS: Def[] = [
  { id: 'database', label: 'Database (Postgres)', category: 'Core', critical: true, probe: 'Prisma client count query', run: checkDatabase },
  { id: 'public-api', label: 'Public site & API', category: 'Core', critical: true, probe: `GET ${site.url}/api/health`, run: checkPublicApi },
  { id: 'blob', label: 'File storage (Vercel Blob)', category: 'Core', probe: 'Blob list (limit 1)', run: checkBlob },
  { id: 'redis', label: 'Rate limiting (Upstash Redis)', category: 'Core', probe: 'GET …upstash.io/ping', run: checkRedis },
  { id: 'cron', label: 'Scheduled jobs (Vercel cron)', category: 'Core', critical: true, probe: 'Heartbeats written by /api/cron/daily + /api/cron/dispatch', run: checkCron },

  { id: 'stripe', label: 'Payments (Stripe)', category: 'Payments', critical: true, probe: 'GET api.stripe.com/v1/balance', run: checkStripe },

  { id: 'resend', label: 'Email (Resend)', category: 'Communications', critical: true, probe: 'GET api.resend.com/domains', run: checkResend },
  { id: 'twilio', label: 'SMS (Twilio)', category: 'Communications', probe: 'GET api.twilio.com account', run: checkTwilio },
  { id: 'translation', label: 'Translation (DeepL / Google)', category: 'Communications', probe: 'GET deepl.com/v2/usage (or Google languages)', run: checkTranslation },
  { id: 'yay', label: 'Telephony (yay.com)', category: 'Communications', probe: 'Webhook freshness — latest CallRecord', run: checkYay },

  { id: 'anthropic', label: 'AI (Anthropic Claude)', category: 'AI', probe: 'GET api.anthropic.com/v1/models', run: checkAnthropic },
  { id: 'deepgram', label: 'Voice transcription (Deepgram)', category: 'AI', probe: 'GET api.deepgram.com/v1/projects', run: checkDeepgram },

  { id: 'xero', label: 'Accounting (Xero)', category: 'Finance', probe: 'OAuth refresh + BankSummary report', run: checkXero },
  { id: 'truelayer', label: 'Bank feed (TrueLayer)', category: 'Finance', probe: 'OAuth refresh + accounts list', run: checkTrueLayer },

  { id: 'meta', label: 'Meta (Facebook/Instagram)', category: 'Marketing', probe: 'GET graph.facebook.com/me with stored token', run: checkMeta },
  { id: 'google-ads', label: 'Google Ads', category: 'Marketing', probe: 'OAuth refresh-token grant', run: checkGoogleAds },
  { id: 'tiktok', label: 'TikTok Ads', category: 'Marketing', probe: 'GET advertiser list with stored token', run: checkTikTok },
  { id: 'ga4', label: 'GA4 conversions', category: 'Marketing', probe: 'POST GA4 /debug/mp/collect (validates, records nothing)', run: checkGa4 },

  { id: 'google-business', label: 'Google Business Profile', category: 'Scheduling & Reviews', probe: 'Accounts + locations list with stored token', run: checkGoogleBusiness },
  { id: 'gcal', label: 'Google Calendar', category: 'Scheduling & Reviews', probe: 'Config + connected staff (parked)', run: checkGoogleCalendar },
  { id: 'caldav', label: 'Clinic calendar (CalDAV)', category: 'Scheduling & Reviews', probe: 'OPTIONS on the CalDAV collection', run: checkCalDav },

  { id: 'github', label: 'GitHub (board mirror)', category: 'Platform', probe: 'GET api.github.com/repos/{repo}', run: checkGithub },
  { id: 'indexnow', label: 'IndexNow (SEO pings)', category: 'Platform', probe: 'GET /indexnow-key.txt + key match', run: checkIndexNow },
  { id: 'weather', label: 'Weather (Open-Meteo)', category: 'Platform', probe: 'GET api.open-meteo.com forecast', run: checkWeather },
  { id: 'hibp', label: 'Breached-password check (HIBP)', category: 'Platform', probe: 'GET api.pwnedpasswords.com/range', run: checkHibp },
];

const LAST_KEY = 'api_health_last';

/** Guard any check with an outer timeout so one hung promise can't stall the report. */
function guard(p: Promise<Outcome>, ms = 15_000): Promise<Outcome> {
  return Promise.race([
    p.catch((e): Outcome => ({ light: 'red', detail: `Check crashed — ${(e as Error)?.message?.slice(0, 80)}` })),
    new Promise<Outcome>((resolve) => setTimeout(() => resolve({ light: 'red', detail: 'Check timed out (15s guard)' }), ms)),
  ]);
}

export async function getLastApiHealthReport(): Promise<ApiHealthReport | null> {
  try {
    const row = await db.setting.findUnique({ where: { key: LAST_KEY } });
    return row?.value ? (JSON.parse(row.value) as ApiHealthReport) : null;
  } catch { return null; }
}

/** Run every probe (in parallel) and persist the report for the next page load. */
export async function runApiHealth(): Promise<ApiHealthReport> {
  const started = Date.now();
  const previous = await getLastApiHealthReport();
  const prevById = new Map((previous?.checks ?? []).map((c) => [c.id, c]));

  const outcomes = await Promise.all(CHECKS.map((c) => guard(c.run())));

  const now = new Date().toISOString();
  const checks: ApiHealthResult[] = CHECKS.map((c, i) => {
    const o = outcomes[i];
    const prev = prevById.get(c.id);
    return {
      id: c.id, label: c.label, category: c.category, probe: c.probe, critical: c.critical,
      light: o.light, detail: o.detail, latencyMs: o.latencyMs ?? null, info: o.info,
      since: prev && prev.light === o.light ? prev.since : now,
    };
  });

  const counts = checks.reduce(
    (a, ch) => { a[ch.light] += 1; return a; },
    { green: 0, amber: 0, red: 0, grey: 0 } as Record<Light, number>,
  );

  const report: ApiHealthReport = {
    generatedAt: now,
    env: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
    durationMs: Date.now() - started,
    overall: worst(checks.map((c) => c.light)),
    counts,
    checks,
  };

  try {
    await db.setting.upsert({
      where: { key: LAST_KEY },
      update: { value: JSON.stringify(report), updatedBy: 'api-health' },
      create: { key: LAST_KEY, value: JSON.stringify(report), updatedBy: 'api-health' },
    });
  } catch { /* report still returned */ }

  return report;
}
