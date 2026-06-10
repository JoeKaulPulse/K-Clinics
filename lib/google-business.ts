import 'server-only';
import { db } from '@/lib/db';
import { saveConnection, getConnection, validAccessToken, disconnect, type Tokens } from '@/lib/oauth-connections';

// Google Business Profile ("My Business") integration.
//
// Two capabilities:
//   1. PUBLIC display of Google reviews + rating on the site — handled by the
//      Places API in lib/reviews-aggregate.ts (GOOGLE_PLACES_API_KEY). Cheaper,
//      no OAuth, but limited to ~5 reviews.
//   2. ADMIN management (this file) — import EVERY review into the dashboard and
//      reply to them in-app, via the Business Profile API with an OAuth
//      connection (business.manage scope).
//
// Required env:
//   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET   (shared Google OAuth app)
//   GOOGLE_BUSINESS_ACCOUNT_ID                (the account numeric id)
//   GOOGLE_BUSINESS_LOCATION_ID               (the location numeric id)
// Plus a one-time owner OAuth connection (stored encrypted as provider
// 'google-business'). The Business Profile API also requires per-project access
// to be granted by Google (a short request form) before calls succeed.
//
// Note: Google does NOT allow creating third-party reviews on a business's
// behalf — only reading them and posting an owner *reply*.

const PROVIDER = 'google-business';
const SCOPE = 'https://www.googleapis.com/auth/business.manage';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
// Reviews still live on the legacy v4 host (the newer Business Profile APIs
// haven't replaced the reviews surface).
const MB_V4 = 'https://mybusiness.googleapis.com/v4';

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://kclinics.co.uk').replace(/\/$/, '');
}
export function businessRedirectUri(): string {
  return `${siteUrl()}/api/admin/integrations/google-business/callback`;
}

export function googleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
function locationName(): string | null {
  const a = process.env.GOOGLE_BUSINESS_ACCOUNT_ID;
  const l = process.env.GOOGLE_BUSINESS_LOCATION_ID;
  return a && l ? `accounts/${a}/locations/${l}` : null;
}
export function googleBusinessConfigured(): boolean {
  return googleOAuthConfigured() && Boolean(locationName());
}

/** Public write-a-review deep link (Places-based, no OAuth needed). */
export async function googleWriteReviewUrl(): Promise<string | null> {
  const placeId = process.env.GOOGLE_PLACE_ID;
  return placeId ? `https://search.google.com/local/writereview?placeid=${placeId}` : null;
}

// ── OAuth (one-time owner connection) ────────────────────────────────────────
export function businessAuthUrl(state: string): string | null {
  if (!googleOAuthConfigured()) return null;
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: businessRedirectUri(),
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPE,
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

async function tokenRequest(body: Record<string, string>): Promise<Tokens | null> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, ...body }),
  });
  if (!res.ok) return null;
  const d = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!d.access_token) return null;
  return { access: d.access_token, refresh: d.refresh_token, expiresAt: d.expires_in ? Date.now() + d.expires_in * 1000 : null };
}

/** Auto-discover the first account + location after connecting, so the owner
 *  doesn't have to find the numeric IDs by hand. Returns `accounts/{id}/locations/{id}`
 *  or null (e.g. Business Profile API access not yet granted) — in which case we
 *  fall back to the GOOGLE_BUSINESS_* env vars. Best-effort; never throws. */
async function discoverLocation(access: string): Promise<string | null> {
  const list = await listLocationsWith(access);
  return list.locations?.[0]?.ref || null;
}

export type BusinessLocation = { ref: string; title: string; address: string | null };
export type LocationListing = {
  status: 'ok' | 'pending' | 'none' | 'error';
  locations?: BusinessLocation[];
  message?: string;
};

/** List every Business Profile location the connected owner can manage, with a
 *  human-meaningful status so the UI never has to surface raw API errors:
 *    ok      — one or more locations found (pick one)
 *    pending — Google hasn't granted Business Profile API access yet (403/429)
 *    none    — access granted but the account has no locations
 *    error   — anything else (network, auth) */
async function listLocationsWith(access: string): Promise<LocationListing> {
  try {
    const h = { Authorization: `Bearer ${access}` };
    const accRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', { headers: h });
    if (accRes.status === 403 || accRes.status === 429) return { status: 'pending' };
    if (!accRes.ok) return { status: 'error', message: `Couldn't reach Google (${accRes.status}).` };
    const accounts = ((await accRes.json()) as { accounts?: { name?: string }[] }).accounts || [];
    const out: BusinessLocation[] = [];
    for (const acc of accounts) {
      const account = acc.name;
      if (!account) continue;
      const mask = 'name,title,storefrontAddress';
      const locRes = await fetch(`https://mybusinessbusinessinformation.googleapis.com/v1/${account}/locations?readMask=${mask}&pageSize=100`, { headers: h });
      if (locRes.status === 403 || locRes.status === 429) return { status: 'pending' };
      if (!locRes.ok) continue;
      const locs = ((await locRes.json()) as {
        locations?: { name?: string; title?: string; storefrontAddress?: { addressLines?: string[]; locality?: string; postalCode?: string } }[];
      }).locations || [];
      for (const l of locs) {
        if (!l.name) continue;
        const a = l.storefrontAddress;
        const address = a ? [...(a.addressLines || []), a.locality, a.postalCode].filter(Boolean).join(', ') : null;
        out.push({ ref: `${account}/${l.name}`, title: l.title || 'Your business', address: address || null });
      }
    }
    return out.length ? { status: 'ok', locations: out } : { status: 'none' };
  } catch {
    return { status: 'error', message: "Couldn't reach Google. Please try again." };
  }
}

/** Public: list the locations for the connected owner (refreshes the token). */
export async function listBusinessLocations(): Promise<LocationListing> {
  const access = await token();
  if (!access) return { status: 'error', message: 'Not connected.' };
  return listLocationsWith(access);
}

/** Pin the location whose reviews we import (validates the shape, persists it on
 *  the connection so resolveLocation() picks it up). */
export async function setBusinessLocation(ref: string): Promise<{ ok: boolean; error?: string }> {
  if (!/^accounts\/.+\/locations\/.+$/.test(ref)) return { ok: false, error: 'Invalid location.' };
  const conn = await getConnection(PROVIDER);
  if (!conn) return { ok: false, error: 'Not connected.' };
  await saveConnection(PROVIDER, conn.tokens, ref, conn.label || 'Google Business Profile');
  return { ok: true };
}

/** The location currently pinned for imports (env var wins, else the stored
 *  connection ref), or null if none has been chosen yet. */
export async function currentBusinessLocation(): Promise<string | null> {
  return resolveLocation();
}

/** The location to read reviews for: the GOOGLE_BUSINESS_* env vars if set
 *  (pins a specific location), otherwise whatever was auto-discovered + stored
 *  on the connection at connect time. */
async function resolveLocation(): Promise<string | null> {
  const fromEnv = locationName();
  if (fromEnv) return fromEnv;
  try {
    const conn = await getConnection(PROVIDER);
    const ref = conn?.accountRef || null;
    return ref && /accounts\/.+\/locations\/.+/.test(ref) ? ref : null;
  } catch { return null; }
}

/** Exchange the OAuth code and store the connection (auto-discovering the
 *  account/location so reviews work without any manual ID setup). */
export async function exchangeBusinessCode(code: string): Promise<boolean> {
  const tokens = await tokenRequest({ code, redirect_uri: businessRedirectUri(), grant_type: 'authorization_code' });
  if (!tokens?.refresh) return false; // need offline refresh token (first consent)
  const discovered = locationName() || (await discoverLocation(tokens.access));
  await saveConnection(PROVIDER, tokens, discovered, 'Google Business Profile');
  return true;
}

async function token(): Promise<string | null> {
  return validAccessToken(PROVIDER, async (refresh) => {
    const next = await tokenRequest({ refresh_token: refresh, grant_type: 'refresh_token' });
    // Google omits refresh_token on refresh; preserve the stored one.
    return next ? { ...next, refresh } : null;
  });
}

export async function googleBusinessConnected(): Promise<boolean> {
  return Boolean(await getConnection(PROVIDER));
}
export async function disconnectGoogleBusiness(): Promise<void> {
  await disconnect(PROVIDER);
}

// ── Reviews ──────────────────────────────────────────────────────────────────
const STAR: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
type GBReview = {
  name?: string; reviewId?: string; comment?: string; starRating?: string;
  createTime?: string; updateTime?: string;
  reviewer?: { displayName?: string; profilePhotoUrl?: string };
  reviewReply?: { comment?: string; updateTime?: string };
};

/** Import every Google review into the GoogleReview table (idempotent). */
export async function syncGoogleReviews(): Promise<{ ok: boolean; imported: number; detail?: string }> {
  const loc = await resolveLocation();
  if (!loc) return { ok: false, imported: 0, detail: 'Choose which business location to import reviews from first.' };
  const access = await token();
  if (!access) return { ok: false, imported: 0, detail: 'Not connected — connect Google Business first.' };

  let pageToken: string | undefined;
  let imported = 0;
  try {
    do {
      const url = new URL(`${MB_V4}/${loc}/reviews`);
      url.searchParams.set('pageSize', '50');
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const res = await fetch(url, { headers: { Authorization: `Bearer ${access}` } });
      if (!res.ok) return { ok: false, imported, detail: `Google API ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}` };
      const data = (await res.json()) as { reviews?: GBReview[]; nextPageToken?: string };
      for (const r of data.reviews || []) {
        const googleName = r.name || (r.reviewId ? `${loc}/reviews/${r.reviewId}` : null);
        if (!googleName) continue;
        const row = {
          reviewerName: r.reviewer?.displayName || null,
          reviewerPhoto: r.reviewer?.profilePhotoUrl || null,
          starRating: STAR[r.starRating || ''] || 0,
          comment: r.comment || null,
          createTime: r.createTime ? new Date(r.createTime) : null,
          updateTime: r.updateTime ? new Date(r.updateTime) : null,
          replyComment: r.reviewReply?.comment || null,
          replyUpdateTime: r.reviewReply?.updateTime ? new Date(r.reviewReply.updateTime) : null,
        };
        await db.googleReview.upsert({ where: { googleName }, update: row, create: { googleName, ...row } });
        imported++;
      }
      pageToken = data.nextPageToken;
    } while (pageToken);
    return { ok: true, imported };
  } catch (e) {
    return { ok: false, imported, detail: (e as Error)?.message || 'Sync failed.' };
  }
}

/** Post (or update) the owner's public reply to a Google review. */
export async function replyToGoogleReview(googleName: string, comment: string): Promise<{ ok: boolean; error?: string }> {
  const access = await token();
  if (!access) return { ok: false, error: 'Not connected.' };
  const body = comment.trim();
  if (!body) return { ok: false, error: 'Reply cannot be empty.' };
  try {
    const res = await fetch(`${MB_V4}/${googleName}/reply`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: body.slice(0, 4096) }),
    });
    if (!res.ok) return { ok: false, error: `Google API ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}` };
    const d = (await res.json()) as { comment?: string; updateTime?: string };
    await db.googleReview.update({
      where: { googleName },
      data: { replyComment: d.comment || body, replyUpdateTime: d.updateTime ? new Date(d.updateTime) : new Date() },
    }).catch(() => {});
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message || 'Reply failed.' };
  }
}

/** Delete the owner's reply to a Google review. */
export async function deleteGoogleReply(googleName: string): Promise<{ ok: boolean; error?: string }> {
  const access = await token();
  if (!access) return { ok: false, error: 'Not connected.' };
  try {
    const res = await fetch(`${MB_V4}/${googleName}/reply`, { method: 'DELETE', headers: { Authorization: `Bearer ${access}` } });
    if (!res.ok && res.status !== 404) return { ok: false, error: `Google API ${res.status}` };
    await db.googleReview.update({ where: { googleName }, data: { replyComment: null, replyUpdateTime: null } }).catch(() => {});
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message || 'Delete failed.' };
  }
}
