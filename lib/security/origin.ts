import { NextResponse } from 'next/server';
import { site } from '@/lib/site';

// ── BLD-698: CSRF defence-in-depth for cookie-authed, state-changing routes ──
// SameSite=Lax on the session cookies (lib/auth.ts) already stops a cross-site
// top-level POST from carrying the session cookie, but it doesn't cover every
// case (same-site sibling subdomains, older embedded webviews, browsers that
// don't yet honour SameSite). Sec-Fetch-Site — sent by all modern browsers and
// unforgeable by page script — and, as a fallback, Origin give a second,
// independent signal that a state-changing request actually came from our own
// front end.
//
// This is edge-safe (only reads request headers + URLs) so middleware can apply
// it as a single choke point over every cookie-authed /api mutation; individual
// route handlers can also call assertSameOrigin(req) directly. Token-authed and
// signature-authed routes (Stripe webhook, the board queue, cron) carry no
// session cookie, so callers gate on cookie presence and those routes are
// untouched.

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

let _canonicalHost: string | null | undefined;
function canonicalHost(): string | null {
  if (_canonicalHost !== undefined) return _canonicalHost;
  try { _canonicalHost = new URL(site.url).host; } catch { _canonicalHost = null; }
  return _canonicalHost;
}

/** True when `req` is a safe request; false when it is a cross-site browser
 *  request that should be rejected. Read-only methods (GET/HEAD/OPTIONS) and
 *  requests carrying no independent origin signal are always treated as safe
 *  (SameSite=Lax still applies to the latter). */
export function isSameOrigin(req: Request): boolean {
  if (!STATE_CHANGING.has(req.method.toUpperCase())) return true;

  // Sec-Fetch-Site is the primary signal. 'same-origin' (our own fetch/form) and
  // 'none' (typed URL, bookmark, browser extension) are fine; 'cross-site' and
  // 'same-site' (a sibling subdomain) are not our front end.
  const fetchSite = req.headers.get('sec-fetch-site');
  if (fetchSite) return fetchSite === 'same-origin' || fetchSite === 'none';

  // Fallback for browsers without Sec-Fetch-Site: compare the Origin host to the
  // request's own host and the canonical site host.
  const origin = req.headers.get('origin');
  if (!origin) return true; // no independent signal — nothing to assert beyond SameSite=Lax
  let host: string;
  try { host = new URL(origin).host; } catch { return false; }
  let reqHost: string | null = null;
  try { reqHost = new URL(req.url).host; } catch { /* ignore */ }
  return host === reqHost || host === canonicalHost();
}

/** Returns a 403 response when `req` is a cross-site cookie-authed mutation, or
 *  null when it is safe to proceed. Use at the top of a cookie-authed
 *  POST/PATCH/DELETE handler:
 *    const blocked = assertSameOrigin(req);
 *    if (blocked) return blocked; */
export function assertSameOrigin(req: Request): NextResponse | null {
  if (isSameOrigin(req)) return null;
  return NextResponse.json({ ok: false, error: 'Cross-site request blocked.' }, { status: 403 });
}

/** PRJ-1032.2: same-origin check for the rare handler that performs a state
 *  change on a GET (e.g. a deep-link that seeds a row and redirects). Unlike
 *  isSameOrigin(), this does NOT exempt GET — it applies the same Sec-Fetch-Site
 *  / Origin signals so a cross-site `<img src>` or link can't trigger the write.
 *  A genuine in-app navigation is `same-origin`; a typed URL/bookmark is `none`;
 *  both pass. Absent any signal we fall back to SameSite=Lax (return true). */
export function isSameOriginRequest(req: Request): boolean {
  const fetchSite = req.headers.get('sec-fetch-site');
  if (fetchSite) return fetchSite === 'same-origin' || fetchSite === 'none';

  const origin = req.headers.get('origin') || req.headers.get('referer');
  if (!origin) return true; // no independent signal — SameSite=Lax still applies
  let host: string;
  try { host = new URL(origin).host; } catch { return false; }
  let reqHost: string | null = null;
  try { reqHost = new URL(req.url).host; } catch { /* ignore */ }
  return host === reqHost || host === canonicalHost();
}
