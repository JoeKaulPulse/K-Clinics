// Edge-safe attribution helpers (no DB/server-only imports — used in middleware
// and in node routes). First-touch attribution captured from UTM / ad-click /
// ?c= campaign params and stored in a first-party cookie (campaign tags only —
// no cross-site tracking, no personal data).

export const ATTRIB_COOKIE = 'kc_attrib';
export const ATTRIB_MAX_AGE = 60 * 60 * 24 * 60; // 60 days

export type Attribution = { source?: string; medium?: string; campaign?: string; landing?: string; ts: number };

const cut = (s: string | null | undefined, n: number) => (s ? s.slice(0, n) : undefined);

/** Derive attribution from a landing URL's query params, or null if none present. */
export function attributionFromUrl(url: URL): Attribution | null {
  const p = url.searchParams;
  const source =
    p.get('utm_source') ||
    (p.get('gclid') ? 'google' : p.get('fbclid') ? 'meta' : p.get('ttclid') ? 'tiktok' : null);
  const medium = p.get('utm_medium') || ((p.get('gclid') || p.get('fbclid') || p.get('ttclid')) ? 'cpc' : null);
  const campaign = p.get('utm_campaign') || p.get('c');
  if (!source && !medium && !campaign) return null;
  return { source: cut(source, 80), medium: cut(medium, 80), campaign: cut(campaign, 120), landing: cut(url.pathname, 200), ts: Date.now() };
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
