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
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
  } catch (e) {
    console.error('[conversions] refund send failed:', (e as Error)?.message);
  }
}

async function ga4Purchase(measurementId: string, apiSecret: string, clientId: string, value: number, input: PurchaseInput) {
  const body = {
    client_id: clientId,
    events: [{ name: 'purchase', params: { currency: 'GBP', value, transaction_id: input.bookingId, ...(input.campaign ? { campaign: input.campaign } : {}) } }],
  };
  await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}

async function metaPurchase(pixelId: string, token: string, value: number, input: PurchaseInput) {
  const user_data: Record<string, string[]> = {};
  if (input.email) user_data.em = [sha256(input.email)];
  const body = {
    data: [{
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'physical_store',
      event_id: input.bookingId, // dedup with the browser pixel
      user_data,
      custom_data: { currency: 'GBP', value },
    }],
  };
  await fetch(`https://graph.facebook.com/v19.0/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(token)}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}
