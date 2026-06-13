import 'server-only';
import crypto from 'node:crypto';
import { crmEnabled } from '@/lib/crm';

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

export async function conversionStatus(): Promise<{ ga4: boolean; meta: boolean }> {
  if (!crmEnabled) return { ga4: false, meta: false };
  const [ids, secrets] = await Promise.all([readJson(TRACKING_KEY), readJson(SECRETS_KEY)]);
  return { ga4: Boolean(ids.ga4Id && secrets.ga4ApiSecret), meta: Boolean(ids.metaPixelId && secrets.metaCapiToken) };
}

type PurchaseInput = { bookingId: string; valuePence: number; clientId?: string | null; email?: string | null; campaign?: string | null };

/** Fire a Purchase conversion to GA4 + Meta (best-effort, never throws). */
export async function sendPurchase(input: PurchaseInput): Promise<void> {
  if (!crmEnabled || input.valuePence <= 0) return;
  try {
    const [ids, secrets] = await Promise.all([readJson(TRACKING_KEY), readJson(SECRETS_KEY)]);
    const value = input.valuePence / 100;
    const clientId = input.clientId || input.bookingId;
    await Promise.allSettled([
      ids.ga4Id && secrets.ga4ApiSecret ? ga4Purchase(ids.ga4Id, secrets.ga4ApiSecret, clientId, value, input) : null,
      ids.metaPixelId && secrets.metaCapiToken ? metaPurchase(ids.metaPixelId, secrets.metaCapiToken, value, input) : null,
    ].filter(Boolean) as Promise<unknown>[]);
  } catch (e) {
    console.error('[conversions] send failed:', (e as Error)?.message);
  }
}

/** Fire a GA4 `refund` conversion (best-effort) so ad/analytics ROAS nets out
 *  refunds. (Meta has no standard refund event, so we skip it there.) */
export async function sendRefund(input: { bookingId: string; valuePence: number; clientId?: string | null }): Promise<void> {
  if (!crmEnabled || input.valuePence <= 0) return;
  try {
    const [ids, secrets] = await Promise.all([readJson(TRACKING_KEY), readJson(SECRETS_KEY)]);
    if (!ids.ga4Id || !secrets.ga4ApiSecret) return;
    const body = {
      client_id: input.clientId || input.bookingId,
      events: [{ name: 'refund', params: { currency: 'GBP', value: input.valuePence / 100, transaction_id: input.bookingId } }],
    };
    await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(ids.ga4Id)}&api_secret=${encodeURIComponent(secrets.ga4ApiSecret)}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    console.error('[conversions] refund send failed:', (e as Error)?.message);
  }
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
 *  `website`; an in-clinic charge passes `physical_store`. */
async function metaEvent(pixelId: string, token: string, eventName: string, eventId: string, opts: { value?: number; email?: string | null; actionSource?: string; sourceUrl?: string | null }) {
  const user_data: Record<string, string[]> = {};
  if (opts.email) user_data.em = [sha256(opts.email)];
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
  await metaEvent(pixelId, token, 'Purchase', input.bookingId, { value, email: input.email, actionSource: 'physical_store' });
}

/** Lead — an enquiry/consultation request (top of funnel; no monetary value).
 *  Best-effort, never throws. `eventId` de-dupes with the browser Pixel. */
export async function sendLead(input: { eventId: string; clientId?: string | null; email?: string | null; sourceUrl?: string | null }): Promise<void> {
  if (!crmEnabled) return;
  try {
    const [ids, secrets] = await Promise.all([readJson(TRACKING_KEY), readJson(SECRETS_KEY)]);
    const clientId = input.clientId || input.eventId;
    await Promise.allSettled([
      ids.metaPixelId && secrets.metaCapiToken ? metaEvent(ids.metaPixelId, secrets.metaCapiToken, 'Lead', input.eventId, { email: input.email, sourceUrl: input.sourceUrl }) : null,
      ids.ga4Id && secrets.ga4ApiSecret ? ga4Event(ids.ga4Id, secrets.ga4ApiSecret, clientId, 'generate_lead', { currency: 'GBP', value: 0 }) : null,
    ].filter(Boolean) as Promise<unknown>[]);
  } catch (e) {
    console.error('[conversions] lead failed:', (e as Error)?.message);
  }
}

/** Schedule — a booking was placed (pre-charge). De-dupes with the browser Pixel
 *  via the booking id; the matching Purchase fires later when the card is charged. */
export async function sendSchedule(input: { bookingId: string; valuePence: number; clientId?: string | null; email?: string | null; campaign?: string | null }): Promise<void> {
  if (!crmEnabled) return;
  try {
    const [ids, secrets] = await Promise.all([readJson(TRACKING_KEY), readJson(SECRETS_KEY)]);
    const value = Math.max(0, input.valuePence) / 100;
    const clientId = input.clientId || input.bookingId;
    await Promise.allSettled([
      ids.metaPixelId && secrets.metaCapiToken ? metaEvent(ids.metaPixelId, secrets.metaCapiToken, 'Schedule', input.bookingId, { value, email: input.email }) : null,
      ids.ga4Id && secrets.ga4ApiSecret ? ga4Event(ids.ga4Id, secrets.ga4ApiSecret, clientId, 'begin_checkout', { currency: 'GBP', value, ...(input.campaign ? { campaign: input.campaign } : {}) }) : null,
    ].filter(Boolean) as Promise<unknown>[]);
  } catch (e) {
    console.error('[conversions] schedule failed:', (e as Error)?.message);
  }
}
