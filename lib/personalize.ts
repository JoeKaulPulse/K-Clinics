// Edge-safe + client-safe personalisation helpers. A campaign/ad can append
// ?seg=male|female to its landing URL to declare its audience; we use that to
// reorder public content (e.g. show male-relevant treatments first). This is
// content personalisation from a param the visitor arrived with — not profiling,
// and stores no personal data (just an audience preference).

export const SEG_COOKIE = 'kc_seg';
export const SEG_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
export type Segment = 'male' | 'female';

export function segmentFromUrl(url: URL): Segment | null {
  const s = (url.searchParams.get('seg') || url.searchParams.get('audience') || '').toLowerCase();
  if (['male', 'men', 'm', 'him'].includes(s)) return 'male';
  if (['female', 'women', 'w', 'f', 'her'].includes(s)) return 'female';
  return null;
}

export function normalizeSegment(raw?: string | null): Segment | null {
  return raw === 'male' || raw === 'female' ? raw : null;
}

/** Read the segment from document.cookie (client) — empty string safe. */
export function segmentFromCookieString(cookie: string): Segment | null {
  const m = cookie.match(new RegExp(`(?:^|; )${SEG_COOKIE}=([^;]+)`));
  return normalizeSegment(m ? decodeURIComponent(m[1]) : null);
}
