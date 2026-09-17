// Edge-safe attribution helpers (no DB/server-only imports — used in middleware
// and in node routes). First-touch attribution captured from UTM / ad-click /
// ?c= campaign params and stored in a first-party cookie (campaign tags only —
// no cross-site tracking, no personal data).

export const ATTRIB_COOKIE = 'kc_attrib';
export const ATTRIB_MAX_AGE = 60 * 60 * 24 * 60; // 60 days

export type Attribution = { source?: string; medium?: string; campaign?: string; landing?: string; gclid?: string; fbclid?: string; ts: number };

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
  // fbclid is captured the same way (PRJ-1200.4) so it survives to a later Meta
  // CAPI send even when the visitor's browser never set the _fbc cookie itself
  // (ad blocker, or the Pixel script not yet loaded on that first hit).
  return { source: cut(source, 80), medium: cut(medium, 80), campaign: cut(campaign, 120), landing: cut(url.pathname, 200), gclid: cut(gclid, 200), fbclid: cut(p.get('fbclid'), 200), ts: Date.now() };
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

/** Read Meta Pixel's own `_fbc`/`_fbp` cookies (set by fbevents.js once loaded
 *  and consented) from a raw `Cookie` request header, for forwarding into a
 *  server-side Meta CAPI event's `user_data` (PRJ-1200.4) — this is what lets
 *  Meta match a CAPI event to the same browser its Pixel already saw, raising
 *  Event Match Quality well beyond a hashed email alone. Missing = undefined,
 *  never a guess. */
export function metaCookiesFromHeader(cookieHeader?: string | null): { fbc?: string; fbp?: string } {
  const header = cookieHeader || '';
  const read = (name: string) => header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))?.[1];
  // decodeURIComponent THROWS (URIError) on a malformed escape such as "%zz",
  // and a cookie value is attacker/junk-controllable. Most call sites wrap this
  // in a best-effort try/catch, but app/api/gift-vouchers/confirm does not — an
  // uncaught throw there would 500 a voucher confirmation the customer has
  // ALREADY paid for. Meta's own _fbc/_fbp values are never percent-encoded, so
  // falling back to the raw value loses nothing.
  const decode = (v: string) => { try { return decodeURIComponent(v); } catch { return v; } };
  const fbc = read('_fbc');
  const fbp = read('_fbp');
  return { ...(fbc ? { fbc: decode(fbc) } : {}), ...(fbp ? { fbp: decode(fbp) } : {}) };
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
//
// BLD-1804 (review fix): the pre-consent buffer is held IN MEMORY only, and the
// cookie itself is still written by middleware, never by this module. Two
// reasons, both of which a sessionStorage + document.cookie implementation got
// wrong:
//  1. PECR reg. 6 — the rule the middleware block above cites — covers "storing
//     information, or gaining access to information stored, in the terminal
//     equipment of a user". That is not cookie-specific: sessionStorage counts.
//     An ad-click id (gclid/fbclid) is not strictly necessary for the service
//     the visitor asked for, so it must not be written to browser storage
//     before an affirmative marketing opt-in. An in-memory buffer stores
//     nothing on the device and still covers the real window (the banner is
//     answered on the landing page, or after client-side navigation, with this
//     module still loaded).
//  2. document.cookie cannot set httpOnly and cannot READ an httpOnly cookie.
//     Writing ATTRIB_COOKIE from JS both downgraded it to script-readable and
//     made the "first touch wins" check blind to the httpOnly cookie middleware
//     had already set — so a returning visitor who re-saved their cookie
//     preferences could silently overwrite their original attribution.
let pendingAttribution: Attribution | null = null;

/** Call on every page load, before any consent decision is known. Buffers any
 *  gclid/fbclid/UTM params present on the current URL in memory (no browser
 *  storage — see the note above), so they survive client-side navigation for
 *  as long as the consent decision is pending. No-ops server-side; never
 *  load-bearing for page render. */
export function bufferAttributionFromLocation(): void {
  if (typeof window === 'undefined') return;
  // First touch wins, same rule the cookie itself uses (middleware only writes
  // ATTRIB_COOKIE when one isn't already present) — never let a later page view
  // clobber the ad click that actually brought the visitor in.
  if (pendingAttribution) return;
  try {
    pendingAttribution = attributionFromUrl(new URL(window.location.href));
  } catch { /* malformed URL — nothing to buffer */ }
}

/** Call at the exact moment marketing consent is granted (the cookie-consent
 *  banner's accept action). If a pre-consent attribution was buffered by
 *  `bufferAttributionFromLocation`, replays those ad-click params on one
 *  same-origin request so MIDDLEWARE writes ATTRIB_COOKIE — httpOnly, gated on
 *  the marketing-consent cookie the banner has just set, and first-touch
 *  checked against the real cookie jar. The buffer is single-use and is
 *  cleared either way. If the request fails, the attribution is simply lost —
 *  the behaviour before this fix — never a weaker or ungated cookie. */
export function promoteBufferedAttribution(): void {
  if (typeof window === 'undefined') return;
  const attrib = pendingAttribution;
  pendingAttribution = null;
  if (!attrib) return;
  try {
    // Replay on the original landing path so middleware records the same
    // `landing` value it would have. Only a plain absolute path is accepted:
    // a protocol-relative pathname ("//evil.example") would otherwise resolve
    // to a third-party origin and hand it the gclid.
    const landing = attrib.landing && /^\/[^/\\]/.test(attrib.landing) ? attrib.landing : '/';
    const u = new URL(landing, window.location.origin);
    if (attrib.source) u.searchParams.set('utm_source', attrib.source);
    if (attrib.medium) u.searchParams.set('utm_medium', attrib.medium);
    if (attrib.campaign) u.searchParams.set('utm_campaign', attrib.campaign);
    if (attrib.gclid) u.searchParams.set('gclid', attrib.gclid);
    // PRJ-1200.4: fbclid too, or the newly-captured Meta click id is dropped on
    // exactly the journey it was added for — a first-time visitor arriving from
    // a Meta ad, who by definition has no marketing-consent cookie yet and so
    // reaches ATTRIB_COOKIE only through this replay.
    if (attrib.fbclid) u.searchParams.set('fbclid', attrib.fbclid);
    void fetch(u.toString(), { method: 'HEAD', credentials: 'same-origin', cache: 'no-store' }).catch(() => {});
  } catch { /* best-effort */ }
}
