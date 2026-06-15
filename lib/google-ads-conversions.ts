import 'server-only';
import { getConnection } from '@/lib/oauth-connections';
import { getSecret } from '@/lib/secrets';
import { googleAccessToken } from '@/lib/google-auth';

// Upload an offline conversion (a charged booking) to Google Ads against the
// GCLID captured at landing, so value-based Smart Bidding optimises for booking
// VALUE — not just click→lead count. Best-effort; never throws.
//
// Prerequisites (same OAuth + dev token as ad-spend sync, PLUS a conversion action):
//   GOOGLE_ADS_DEVELOPER_TOKEN, a connected Google account (token), GOOGLE_ADS_CUSTOMER_ID
//   (or the connection's accountRef), and GOOGLE_ADS_CONVERSION_ACTION_ID — the numeric
//   id of an "Imported / offline" conversion action created in Google Ads. Optional:
//   GOOGLE_ADS_LOGIN_CUSTOMER_ID (manager account). When any is missing this no-ops.

const GOOGLE_ADS_API = 'https://googleads.googleapis.com/v22';

/** Google Ads wants "yyyy-MM-dd HH:mm:ss+00:00" (with a timezone offset). */
function fmtDateTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}+00:00`;
}

/** True when the prerequisites for offline conversion upload are all present. */
export async function googleAdsConversionsConfigured(): Promise<boolean> {
  const [devToken, conn, conversionActionId] = await Promise.all([
    getSecret('GOOGLE_ADS_DEVELOPER_TOKEN'),
    getConnection('google'),
    getSecret('GOOGLE_ADS_CONVERSION_ACTION_ID'),
  ]);
  const customerId = (conn?.accountRef || (await getSecret('GOOGLE_ADS_CUSTOMER_ID')) || '').replace(/-/g, '');
  return Boolean(devToken && conn?.tokens.access && customerId && conversionActionId);
}

export async function uploadGoogleAdsConversion(input: { gclid: string; valuePence: number; bookingId: string; occurredAt?: Date }): Promise<void> {
  try {
    if (!input.gclid || input.valuePence <= 0) return;
    const devToken = await getSecret('GOOGLE_ADS_DEVELOPER_TOKEN');
    const conn = await getConnection('google');
    const customerId = (conn?.accountRef || (await getSecret('GOOGLE_ADS_CUSTOMER_ID')) || '').replace(/-/g, '');
    const conversionActionId = ((await getSecret('GOOGLE_ADS_CONVERSION_ACTION_ID')) || '').replace(/\D/g, '');
    if (!devToken || !conn?.tokens.access || !customerId || !conversionActionId) return; // not configured → no-op

    const accessToken = await googleAccessToken();
    if (!accessToken) return;
    const loginCustomerId = await getSecret('GOOGLE_ADS_LOGIN_CUSTOMER_ID');

    const body = {
      conversions: [{
        gclid: input.gclid,
        conversionAction: `customers/${customerId}/conversionActions/${conversionActionId}`,
        conversionDateTime: fmtDateTime(input.occurredAt ?? new Date()),
        conversionValue: input.valuePence / 100,
        currencyCode: 'GBP',
        orderId: input.bookingId, // de-dupes re-uploads for the same booking
      }],
      partialFailure: true,
    };
    await fetch(`${GOOGLE_ADS_API}/customers/${customerId}:uploadClickConversions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'developer-token': devToken,
        ...(loginCustomerId ? { 'login-customer-id': loginCustomerId.replace(/-/g, '') } : {}),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    console.error('[google-ads] offline conversion failed:', (e as Error)?.message);
  }
}
