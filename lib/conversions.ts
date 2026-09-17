import 'server-only';
import crypto from 'node:crypto';
import { crmEnabled } from '@/lib/crm';
import { uploadGoogleAdsConversion, uploadGoogleAdsConversionAdjustment, googleAdsConversionsConfigured } from '@/lib/google-ads-conversions';

// Server-side conversion events. When a booking is charged we report the sale to
// GA4 (Measurement Protocol) and Meta (Conversions API) using server-held
// secrets — reliable, ad-blocker-proof and privacy-respectful (email is hashed,
// never sent in clear). Complements the browser pixels; deduped by booking id.

const TRACKING_KEY = 'tracking_config';      // public IDs (shared with pixels)
const SECRETS_KEY = 'conversion_secrets';    // server-only secrets

const sha256 = (s: string) => crypto.createHash('sha256').update(s.trim().toLowerCase()).digest('hex');

async function readJson(key: string): Promise<Record<string, string>> {
  try {
    const { db } = await import('@/lib/db');
    const row = await db.setting.findUnique({ where: { key } });
    return row?.value ? (JSON.parse(row.value) as Record<string, string>) : {};
  } catch { return {}; }
}

// Status-only, and every reader is a page render (/admin/seo), so this must not
// be able to throw: readJson already swallows its own DB errors, and
// googleAdsConversionsConfigured is caught here for the same reason. It reaches
// the DB via getConnection -> db.externalConnection.findUnique, which is NOT
// wrapped upstream (unlike getSecret, whose loadAll falls back to env on any DB
// error), so an unreachable DB or a missing ExternalConnection table would
// reject this Promise.all and take the whole SEO page down with it — a DB blip
// must degrade the Google Ads line to "not configured", not 500 the page.
export async function conversionStatus(): Promise<{ ga4: boolean; meta: boolean; googleAds: boolean }> {
  if (!crmEnabled) return { ga4: false, meta: false, googleAds: false };
  const [ids, secrets, googleAds] = await Promise.all([
    readJson(TRACKING_KEY),
    readJson(SECRETS_KEY),
    googleAdsConversionsConfigured().catch(() => false),
  ]);
  return { ga4: Boolean(ids.ga4Id && secrets.ga4ApiSecret), meta: Boolean(ids.metaPixelId && secrets.metaCapiToken), googleAds };
}

// GA4 is analytics-purpose, Meta is marketing-purpose (same split as the browser
// pixels in lib/analytics-events.ts / components/marketing/TrackingScripts.tsx) —
// every send* function below takes the visitor's cookie-banner choice and skips
// the platform they didn't consent to. Omitted/undefined = not consented (fail
// closed), so a call site that forgets to thread consent through never over-sends.
type ConsentInput = { analyticsConsent?: boolean; marketingConsent?: boolean };

// PRJ-1200.4: the extra Meta CAPI user_data fields beyond a hashed email — the
// visitor's own _fbc/_fbp Pixel cookies (read off the live request) and the
// request's IP/user-agent. Every one is optional and additive: a call site
// that can't supply one (no live request, e.g. a webhook-driven send) simply
// omits it and metaEvent() falls back to hashed-email-only matching exactly as
// before, never a regression.
type MetaMatchInput = { fbc?: string | null; fbp?: string | null; clientIp?: string | null; userAgent?: string | null };

type PurchaseInput = ConsentInput & MetaMatchInput & { bookingId: string; valuePence: number; clientId?: string | null; email?: string | null; campaign?: string | null; gclid?: string | null };

/** Fire a Purchase conversion to GA4 + Meta (each gated on its own consent
 *  purpose), and (when a GCLID was captured) an offline conversion to Google
 *  Ads for value-based bidding. Best-effort. */
export async function sendPurchase(input: PurchaseInput): Promise<void> {
  if (!crmEnabled || input.valuePence <= 0) return;
  try {
    const [ids, secrets] = await Promise.all([readJson(TRACKING_KEY), readJson(SECRETS_KEY)]);
    const value = input.valuePence / 100;
    const clientId = input.clientId || input.bookingId;
    await Promise.allSettled([
      input.analyticsConsent && ids.ga4Id && secrets.ga4ApiSecret ? ga4Purchase(ids.ga4Id, secrets.ga4ApiSecret, clientId, value, input) : null,
      input.marketingConsent && ids.metaPixelId && secrets.metaCapiToken ? metaPurchase(ids.metaPixelId, secrets.metaCapiToken, value, input) : null,
      // Google Ads offline conversion (no-ops unless a GCLID + conversion action are present).
      // Ad-platform, same purpose as Meta — gated on marketing consent too.
      input.marketingConsent && input.gclid ? uploadGoogleAdsConversion({ gclid: input.gclid, valuePence: input.valuePence, bookingId: input.bookingId }) : null,
    ].filter(Boolean) as Promise<unknown>[]);
  } catch (e) {
    console.error('[conversions] send failed:', (e as Error)?.message);
  }
}

/** Fire a GA4 `refund` conversion (analytics-consent gated) so ad/analytics
 *  ROAS nets out refunds, and (when a GCLID was captured) a Google Ads
 *  conversion-ADJUSTMENT (marketing-consent gated) so Smart Bidding stops
 *  optimising toward the original booking's full, now-refunded value — mirrors
 *  the offline-conversion upload sendPurchase() already does on the way in
 *  (PRJ-1200.3). (Meta has no standard refund event, so we skip it there.)
 *  `adjustedValuePence` is the booking's net value AFTER this refund (and any
 *  earlier ones) — 0 on a full refund retracts the original conversion
 *  entirely; a partial refund restates it down to what's left. */
export async function sendRefund(input: ConsentInput & { bookingId: string; valuePence: number; clientId?: string | null; gclid?: string | null; adjustedValuePence?: number }): Promise<void> {
  if (!crmEnabled || input.valuePence <= 0) return;
  try {
    await Promise.allSettled([
      input.analyticsConsent ? sendGa4Refund(input) : null,
      input.marketingConsent && input.gclid && input.adjustedValuePence != null
        ? uploadGoogleAdsConversionAdjustment({ gclid: input.gclid, bookingId: input.bookingId, adjustedValuePence: input.adjustedValuePence })
        : null,
    ].filter(Boolean) as Promise<unknown>[]);
  } catch (e) {
    console.error('[conversions] refund send failed:', (e as Error)?.message);
  }
}

async function sendGa4Refund(input: { bookingId: string; valuePence: number; clientId?: string | null }) {
  const [ids, secrets] = await Promise.all([readJson(TRACKING_KEY), readJson(SECRETS_KEY)]);
  if (!ids.ga4Id || !secrets.ga4ApiSecret) return;
  await ga4Event(ids.ga4Id, secrets.ga4ApiSecret, input.clientId || input.bookingId, 'refund', { currency: 'GBP', value: input.valuePence / 100, transaction_id: input.bookingId });
}

// ── Generic low-level senders — one code path for every event ──

/** GA4 Measurement Protocol event. */
async function ga4Event(measurementId: string, apiSecret: string, clientId: string, name: string, params: Record<string, unknown>) {
  const body = { client_id: clientId, events: [{ name, params }] };
  await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000),
  });
}

/** Meta Conversions API event. `eventId` MUST match the browser pixel's eventID
 *  so Meta de-duplicates the browser + server copies. action_source defaults to
 *  `website` — every event this file sends originates from an online checkout
 *  or web form, so callers should not override it to `physical_store` unless a
 *  genuine in-clinic point-of-sale flow is added.
 *
 *  PRJ-1200.4: fbc/fbp (the visitor's own Pixel cookies) and client_ip_address/
 *  client_user_agent are the fields Meta's Event Match Quality score weighs
 *  most heavily alongside a hashed email — sending only `em` left EMQ (and so
 *  ad-optimisation accuracy) well below what the same visitor's browser Pixel
 *  event already achieves. All four are optional: a caller with no live
 *  request to read them from (e.g. a webhook-driven send) just omits them. */
async function metaEvent(pixelId: string, token: string, eventName: string, eventId: string, opts: MetaMatchInput & { value?: number; email?: string | null; actionSource?: string; sourceUrl?: string | null }) {
  const user_data: Record<string, string | string[]> = {};
  if (opts.email) user_data.em = [sha256(opts.email)];
  if (opts.fbc) user_data.fbc = opts.fbc;
  if (opts.fbp) user_data.fbp = opts.fbp;
  // clientIp comes from lib/security/guard's clientIp(), which returns the
  // literal sentinel 'unknown' when no forwarding header is present. That is not
  // an IP address — send it and Meta is being handed a junk match signal (and
  // can reject the parameter), so drop it rather than guess.
  if (opts.clientIp && opts.clientIp !== 'unknown') user_data.client_ip_address = opts.clientIp;
  if (opts.userAgent) user_data.client_user_agent = opts.userAgent;
  const body = {
    data: [{
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      action_source: opts.actionSource ?? 'website',
      event_id: eventId,
      ...(opts.sourceUrl ? { event_source_url: opts.sourceUrl } : {}),
      user_data,
      ...(opts.value != null ? { custom_data: { currency: 'GBP', value: opts.value } } : {}),
    }],
  };
  await fetch(`https://graph.facebook.com/v23.0/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(token)}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000),
  });
}

async function ga4Purchase(measurementId: string, apiSecret: string, clientId: string, value: number, input: PurchaseInput) {
  await ga4Event(measurementId, apiSecret, clientId, 'purchase', { currency: 'GBP', value, transaction_id: input.bookingId, ...(input.campaign ? { campaign: input.campaign } : {}) });
}

async function metaPurchase(pixelId: string, token: string, value: number, input: PurchaseInput) {
  // Every sendPurchase() call site (bookings, shop, gift vouchers, academy) is a
  // website checkout, so action_source is left to metaEvent's `website` default
  // (matching the browser Pixel, which has no concept of in-clinic POS at all) —
  // do NOT hardcode `physical_store` here.
  await metaEvent(pixelId, token, 'Purchase', input.bookingId, { value, email: input.email, fbc: input.fbc, fbp: input.fbp, clientIp: input.clientIp, userAgent: input.userAgent });
}

/** Lead — an enquiry/consultation request (top of funnel; no monetary value).
 *  Best-effort, never throws. `eventId` de-dupes with the browser Pixel. */
export async function sendLead(input: ConsentInput & MetaMatchInput & { eventId: string; clientId?: string | null; email?: string | null; sourceUrl?: string | null }): Promise<void> {
  if (!crmEnabled) return;
  try {
    const [ids, secrets] = await Promise.all([readJson(TRACKING_KEY), readJson(SECRETS_KEY)]);
    const clientId = input.clientId || input.eventId;
    await Promise.allSettled([
      input.marketingConsent && ids.metaPixelId && secrets.metaCapiToken ? metaEvent(ids.metaPixelId, secrets.metaCapiToken, 'Lead', input.eventId, { email: input.email, sourceUrl: input.sourceUrl, fbc: input.fbc, fbp: input.fbp, clientIp: input.clientIp, userAgent: input.userAgent }) : null,
      input.analyticsConsent && ids.ga4Id && secrets.ga4ApiSecret ? ga4Event(ids.ga4Id, secrets.ga4ApiSecret, clientId, 'generate_lead', { currency: 'GBP', value: 0 }) : null,
    ].filter(Boolean) as Promise<unknown>[]);
  } catch (e) {
    console.error('[conversions] lead failed:', (e as Error)?.message);
  }
}

/** Schedule — a booking was placed (pre-charge). De-dupes with the browser Pixel
 *  via the booking id; the matching Purchase fires later when the card is charged. */
export async function sendSchedule(input: ConsentInput & MetaMatchInput & { bookingId: string; valuePence: number; clientId?: string | null; email?: string | null; campaign?: string | null }): Promise<void> {
  if (!crmEnabled) return;
  try {
    const [ids, secrets] = await Promise.all([readJson(TRACKING_KEY), readJson(SECRETS_KEY)]);
    const value = Math.max(0, input.valuePence) / 100;
    const clientId = input.clientId || input.bookingId;
    await Promise.allSettled([
      input.marketingConsent && ids.metaPixelId && secrets.metaCapiToken ? metaEvent(ids.metaPixelId, secrets.metaCapiToken, 'Schedule', input.bookingId, { value, email: input.email, fbc: input.fbc, fbp: input.fbp, clientIp: input.clientIp, userAgent: input.userAgent }) : null,
      input.analyticsConsent && ids.ga4Id && secrets.ga4ApiSecret ? ga4Event(ids.ga4Id, secrets.ga4ApiSecret, clientId, 'begin_checkout', { currency: 'GBP', value, ...(input.campaign ? { campaign: input.campaign } : {}) }) : null,
    ].filter(Boolean) as Promise<unknown>[]);
  } catch (e) {
    console.error('[conversions] schedule failed:', (e as Error)?.message);
  }
}
