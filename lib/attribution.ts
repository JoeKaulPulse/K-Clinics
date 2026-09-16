// Edge-safe attribution helpers (no DB/server-only imports — used in middleware
// and in node routes). First-touch attribution captured from UTM / ad-click /
// ?c= campaign params and stored in a first-party cookie (campaign tags only —
// no cross-site tracking, no personal data).

export const ATTRIB_COOKIE = 'kc_attrib';
export const ATTRIB_MAX_AGE = 60 * 60 * 24 * 60; // 60 days

export type Attribution = { source?: string; medium?: string; campaign?: string; landing?: string; gclid?: string; ts: number };

const cut = (s: string | null | undefined, n: number) => (s ? s.slice(0, n) : undefined);

/** Derive attribution from a landing URL's query params, or null if none present. */
export function attributionFromUrl(url: URL): Attribution | null {
  const p = url.searchParams;
  const gclid = p.get('gclid');
  const source =
    p.get('utm_source') ||
    (gclid ? 'google' : p.get('fbclid') ? 'meta' : p.get('ttclid') ? 'tiktok' : null);
  const medium = p.get('utm_medium') || ((gclid || p.get('fbclid') || p.get('ttclid')) ? 'cpc' : null);
  const campaign = p.get('utm_campaign') || p.get('c');
  if (!source && !medium && !campaign) return null;
  // Capture the raw gclid so a booking can be uploaded to Google Ads as an offline
  // conversion (value-based Smart Bidding). Campaign tags only — no personal data.
  return { source: cut(source, 80), medium: cut(medium, 80), campaign: cut(campaign, 120), landing: cut(url.pathname, 200), gclid: cut(gclid, 200), ts: Date.now() };
}

export function parseAttribution(raw?: string | null): Attribution | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as Attribution;
    return j && typeof j === 'object' ? j : null;
  } catch {
    return null;
  }
}

// First-party cookie-consent banner (components/legal/CookieConsent.tsx) mirrors
// the visitor's choice into these two cookies so the SERVER can honour rejection
// too, not just the browser pixels (lib/analytics-events.ts). Analytics gates the
// GA4 side of server-side conversions (lib/conversions.ts); marketing gates Meta.
export const ANALYTICS_CONSENT_COOKIE = 'kc_analytics_consent';
export const MARKETING_CONSENT_COOKIE = 'kc_marketing_consent';

/** Read both consent cookies from a raw `Cookie` request header (fetch API
 *  `Request`, which has no `.cookies` jar). Missing/rejected = false — fail
 *  closed, matching the "no pre-ticked boxes" default the banner itself uses. */
export function consentFromCookieHeader(cookieHeader?: string | null): { analyticsConsent: boolean; marketingConsent: boolean } {
  const header = cookieHeader || '';
  return {
    analyticsConsent: new RegExp(`(?:^|;\\s*)${ANALYTICS_CONSENT_COOKIE}=1(?:;|$)`).test(header),
    marketingConsent: new RegExp(`(?:^|;\\s*)${MARKETING_CONSENT_COOKIE}=1(?:;|$)`).test(header),
  };
}

// ── Client-side pre-consent buffering (BLD-1804) ────────────────────────────
// middleware (above) only ever writes ATTRIB_COOKIE once MARKETING_CONSENT_COOKIE
// is already '1'. A brand-new visitor arriving from a paid Google/Meta ad has no
// consent cookie yet, so the very click that should be attributed lands with
// nothing captured, and there is no client-side fallback — the ad-click params
// are simply gone by the time (if ever) the visitor accepts marketing cookies.
// These two functions close that gap without touching consent gating itself:
// they only decide what happens to attribution data that already arrived on the
// URL, never whether tracking cookies get written without consent.
const ATTRIB_PENDING_KEY = 'kc_attrib_pending';

/** Call on every page load, before any consent decision is known. Buffers any
 *  gclid/fbclid/UTM params present on the current URL into sessionStorage, so
 *  they survive further page loads within the same tab for as long as the
 *  consent decision is pending. No-ops server-side and swallows storage
 *  errors (private browsing, quota, disabled storage) — this is a
 *  best-effort improvement, never load-bearing for page render. */
export function bufferAttributionFromLocation(): void {
  if (typeof window === 'undefined') return;
  try {
    // First touch wins, same rule the cookie itself uses (middleware only
    // writes ATTRIB_COOKIE when one isn't already present) — never let a
    // later page view in the same session clobber the ad click that actually
    // brought the visitor in.
    if (window.sessionStorage.getItem(ATTRIB_PENDING_KEY)) return;
    const attrib = attributionFromUrl(new URL(window.location.href));
    if (attrib) window.sessionStorage.setItem(ATTRIB_PENDING_KEY, JSON.stringify(attrib));
  } catch { /* sessionStorage unavailable — nothing to buffer */ }
}

/** Call at the exact moment marketing consent is granted (the cookie-consent
 *  banner's accept action). If a pre-consent attribution was buffered by
 *  `bufferAttributionFromLocation`, writes ATTRIB_COOKIE retroactively —
 *  same JSON shape and max-age as middleware's own write — so code reading
 *  the cookie picks it up immediately, not just on a lucky next server
 *  request that still happens to carry the original ad-click params. Clears
 *  the buffer either way (it is single-use), and never overwrites a cookie
 *  that is already present. */
export function writeBufferedAttributionCookie(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.sessionStorage.getItem(ATTRIB_PENDING_KEY);
    window.sessionStorage.removeItem(ATTRIB_PENDING_KEY);
    const attrib = parseAttribution(raw);
    if (!attrib) return;
    if (new RegExp(`(?:^|;\\s*)${ATTRIB_COOKIE}=`).test(document.cookie)) return; // already set — first touch wins
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${ATTRIB_COOKIE}=${encodeURIComponent(JSON.stringify(attrib))}; path=/; max-age=${ATTRIB_MAX_AGE}; SameSite=Lax${secure}`;
  } catch { /* document.cookie unavailable */ }
}
