import 'server-only';

// Google Business Profile integration for publishing reviews. INERT until
// credentials are supplied — the in-house review system is fully functional
// without it; this layer simply mirrors approved reviews to Google when wired.
//
//   GOOGLE_BUSINESS_ACCOUNT_ID
//   GOOGLE_BUSINESS_LOCATION_ID
//   GOOGLE_PLACE_ID                 (for the public "write a review" deep link)
//   plus the shared Google OAuth creds (GOOGLE_CLIENT_ID/SECRET) + a connection
//
// Note: Google's API does not allow *creating* third-party reviews on a
// business's behalf. The compliant pattern (implemented here) is: collect the
// review in our own system, and for happy clients deep-link them to Google's
// own "write a review" page. This module also exposes a read sync for importing
// Google reviews back into our dashboard once connected.

export function googleBusinessConfigured(): boolean {
  return Boolean(process.env.GOOGLE_BUSINESS_ACCOUNT_ID && process.env.GOOGLE_BUSINESS_LOCATION_ID);
}

/** Mark an approved review as "encouraged to Google" + return the deep link.
 *  Real publishing happens client-side via the Google write-review URL. */
export async function googleWriteReviewUrl(): Promise<string | null> {
  const placeId = process.env.GOOGLE_PLACE_ID;
  if (!placeId) return null;
  return `https://search.google.com/local/writereview?placeid=${placeId}`;
}

/** Import recent Google reviews into our dashboard (no-op until connected). */
export async function syncGoogleReviews(): Promise<{ ok: boolean; imported: number; detail?: string }> {
  if (!googleBusinessConfigured()) {
    return { ok: false, imported: 0, detail: 'Google Business not configured.' };
  }
  // Real implementation: use the Business Profile API
  // (accounts/{a}/locations/{l}/reviews) with the stored OAuth token, then
  // upsert into our Review table. Left as a guarded no-op until creds exist.
  return { ok: true, imported: 0, detail: 'Connected — sync not yet run.' };
}
