import { NextResponse, type NextRequest } from 'next/server';
import { verifyToken, verifyClientToken, verifyAcademyToken, SESSION_COOKIE, CLIENT_SESSION_COOKIE, ACADEMY_SESSION_COOKIE } from '@/lib/auth-edge';
import { isSameOrigin } from '@/lib/security/origin';
import { ATTRIB_COOKIE, ATTRIB_MAX_AGE, attributionFromUrl } from '@/lib/attribution';
import { SEG_COOKIE, SEG_MAX_AGE, segmentFromUrl } from '@/lib/personalize';
import { THEME_NO_FLASH_SCRIPT } from '@/lib/admin-theme';

// ── Strict, nonce-based CSP for the authenticated CRM (/admin) ───────────────
// The global CSP in next.config.mjs keeps 'unsafe-inline' in script-src — a
// Next.js limitation for *statically* rendered pages (a per-request nonce can't
// be baked into cached HTML). Every /admin page is force-dynamic, so here we can
// issue a per-request nonce and drop 'unsafe-inline'. Next applies the nonce to
// its own framework scripts; our two static inline scripts (the root no-flash
// theme script and the consent-cert print handler) are allow-listed by hash.
// 'strict-dynamic' lets nonced/hashed scripts load their own dependencies
// (Stripe.js, Turnstile, Maps) while ignoring host allow-lists in modern
// browsers. This response carries BOTH this strict policy and next.config's
// looser one, and the browser enforces the intersection — so injected inline
// scripts are blocked on /admin even though the global policy allows inline.
const CONSENT_PRINT_HASH = 'vpK0BYDTnvuWKT6efssYKbSHyfV41FUkOUCnTjMrDws='; // app/admin/consent/cert/[id] print handler — refresh if that script changes
let _noflashHash: string | null = null;
async function noflashHash(): Promise<string> {
  if (_noflashHash) return _noflashHash;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(THEME_NO_FLASH_SCRIPT));
  _noflashHash = btoa(String.fromCharCode(...new Uint8Array(digest)));
  return _noflashHash;
}
// Keep the non-script directives in sync with next.config.mjs.
async function adminCsp(nonce: string): Promise<string> {
  const noflash = await noflashHash();
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob: https:",
    "font-src 'self' https://fonts.gstatic.com data:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `script-src 'self' 'nonce-${nonce}' 'sha256-${noflash}' 'sha256-${CONSENT_PRINT_HASH}' 'strict-dynamic' https:`,
    "connect-src 'self' https://api.stripe.com https://m.stripe.network https://r.stripe.com https://challenges.cloudflare.com https://maps.googleapis.com https://vercel.com https://blob.vercel-storage.com https://*.blob.vercel-storage.com https://*.public.blob.vercel-storage.com https://*.sentry.io https://sentry.io https://connect.facebook.net https://graph.facebook.com",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com https://www.youtube.com https://www.youtube-nocookie.com https://www.google.com",
    "worker-src 'self' blob:",
    'upgrade-insecure-requests',
  ].join('; ');
}

// Public client-portal pages (no auth required).
const PUBLIC_ACCOUNT = new Set([
  '/account/login',
  '/account/signup',
  '/account/forgot-password',
  '/account/reset',
  '/account/activate', // passwordless migration magic link — signs the client in itself
]);

// Academy pages that are publicly accessible without a trainee session.
// Everything else under /academy requires a valid academy JWT (BLD-314 Phase 3).
const PUBLIC_ACADEMY = new Set([
  '/academy',
  '/academy/portal', // sign-in / sign-up landing (also the redirect target below)
  '/academy/forgot-password',
  '/academy/reset',
  '/academy/activate', // BLD-528: offer "accept & pay" magic link — signs the trainee in itself
]);
// Single-segment /academy/* paths that are trainee-only and must NOT be served
// as public course-catalogue slugs. They share the /academy/[slug] namespace but
// resolve to static trainee routes (each also enforces auth at the page level).
// Keep in sync with the static segments under app/(marketing)/academy/*.
const RESERVED_ACADEMY = new Set([
  '/academy/settings',
  '/academy/practice',
  '/academy/leaderboard',
  '/academy/revise', // BLD-531
  '/academy/exercises', // BLD-535
  '/academy/community', // BLD-533
  '/academy/portfolio', // BLD-534
]);
// Prefix match: course-catalogue slugs (/academy/<slug>) are public, except the
// reserved trainee routes above. Deeper paths (/academy/learn/...) are never
// public — except the two public Wave-2 marketing routes called out below.
const isPublicAcademyPath = (p: string) =>
  PUBLIC_ACADEMY.has(p) ||
  p.startsWith('/academy/verify/') || // BLD-528: public certificate verification
  /^\/academy\/bundles\/[^/]+$/.test(p) || // BLD-532: public learning-pathway pages
  /^\/academy\/[^/]+\/taster\/[^/]+$/.test(p) || // BLD-532: public free taster lessons
  (!RESERVED_ACADEMY.has(p) && /^\/academy\/[^/]+$/.test(p));

// ── Admin-managed URL redirects ─────────────────────────────────────────────
// Cached in module memory (per warm edge instance) and refreshed from the
// public /api/redirects map at most once a minute, so old WordPress URLs keep
// resolving without a DB hit on every request.
type RedirectMap = Record<string, { to: string; code: number }>;
let _redirects: { map: RedirectMap; at: number } | null = null;
async function loadRedirects(origin: string): Promise<RedirectMap> {
  if (_redirects && Date.now() - _redirects.at < 60_000) return _redirects.map;
  try {
    const res = await fetch(`${origin}/api/redirects`, { headers: { 'x-mw-redirects': '1' } });
    if (res.ok) _redirects = { map: (await res.json()) as RedirectMap, at: Date.now() };
  } catch { /* keep stale cache on failure */ }
  return _redirects?.map ?? {};
}
async function matchRedirect(req: NextRequest): Promise<NextResponse | null> {
  const { pathname, search, origin } = req.nextUrl;
  // Only the public marketing surface — never the app areas or our own handlers.
  if (/^\/(admin|account|api|qr)(\/|$)/.test(pathname)) return null;
  const map = await loadRedirects(origin);
  const key = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  const hit = map[key] ?? map[pathname];
  if (!hit) return null;
  let dest = /^https?:\/\//i.test(hit.to) ? hit.to : new URL(hit.to, origin).toString();
  if (search && !dest.includes('?')) dest += search; // preserve query params
  return NextResponse.redirect(dest, hit.code === 302 ? 302 : 301);
}

// ── IP deny-list ─────────────────────────────────────────────────────────────
// Manually-blocked IPs (admin Security → IP activity). Cached in module memory
// per warm edge instance and refreshed from the internal /api/blocked-ips feed
// at most once every 30s, so a blocked IP is denied page requests without a DB
// hit per request. Fails OPEN (no block) on any fetch error — a telemetry
// outage must never lock out legitimate visitors.
// Trusted, non-user-controlled base for the internal feed. Never the request
// Host (req.nextUrl.origin) — a client can spoof Host, which would turn this
// self-fetch into an SSRF sink. NEXT_PUBLIC_SITE_URL is the canonical site URL
// the rest of the app already uses for absolute links.
const SELF_BASE = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
let _blocked: { set: Set<string>; at: number } | null = null;
async function blockedIps(): Promise<Set<string>> {
  if (_blocked && Date.now() - _blocked.at < 30_000) return _blocked.set;
  if (!SELF_BASE) return _blocked?.set ?? new Set(); // no trusted base → fail open
  try {
    // BLD-807: the feed requires the shared internal secret (timing-safe
    // checked server-side); the old constant '1' was guessable from the source.
    const res = await fetch(`${SELF_BASE}/api/blocked-ips`, { headers: { 'x-mw-block': process.env.MW_BLOCK_SECRET || process.env.CRON_SECRET || '' } });
    if (res.ok) _blocked = { set: new Set((await res.json()) as string[]), at: Date.now() };
  } catch { /* keep stale cache on failure */ }
  return _blocked?.set ?? new Set();
}
// Edge-side real-client-IP extraction — mirrors lib/security/guard.ts clientIp:
// platform headers can't be spoofed past the proxy; raw XFF is client-controlled
// on its left, so use the last (proxy-appended) hop.
function edgeClientIp(req: NextRequest): string {
  const platform = req.headers.get('x-vercel-forwarded-for') || req.headers.get('x-real-ip');
  if (platform) return platform.split(',').pop()!.trim();
  const xff = req.headers.get('x-forwarded-for');
  if (xff) { const parts = xff.split(',').map((s) => s.trim()).filter(Boolean); if (parts.length) return parts[parts.length - 1]; }
  return 'unknown';
}

// Protect the staff CRM (/admin) and the client portal (/account); apply
// admin-managed redirects on the public site. Runs on the edge.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── BLD-698: CSRF / same-origin check for cookie-authed API mutations ─────
  // Run first for /api routes and return immediately, so no other (redirect /
  // admin CSP / attribution) logic executes on them. Gated on the presence of a
  // session cookie: token-authed and Stripe-signature routes carry none, so they
  // are exempt by construction. isSameOrigin() only inspects headers/URLs (edge-
  // safe) and only blocks state-changing methods.
  if (pathname.startsWith('/api/')) {
    const hasSession = Boolean(
      req.cookies.get(SESSION_COOKIE)?.value ||
      req.cookies.get(CLIENT_SESSION_COOKIE)?.value ||
      req.cookies.get(ACADEMY_SESSION_COOKIE)?.value,
    );
    if (hasSession && !isSameOrigin(req)) {
      return NextResponse.json({ ok: false, error: 'Cross-site request blocked.' }, { status: 403 });
    }
    return NextResponse.next();
  }

  // ── IP deny-list — blocked IPs get nothing (checked before any work) ─────
  const ip = edgeClientIp(req);
  if (ip !== 'unknown') {
    const set = await blockedIps();
    if (set.has(ip)) return new NextResponse('Access denied.', { status: 403 });
  }

  // ── URL redirects (old WordPress URLs / printed QR destinations) ─────────
  const redirected = await matchRedirect(req);
  if (redirected) return redirected;

  // ── Client portal ──────────────────────────────────────────────────────
  if (pathname.startsWith('/account')) {
    if (PUBLIC_ACCOUNT.has(pathname)) return NextResponse.next();
    const client = await verifyClientToken(req.cookies.get(CLIENT_SESSION_COOKIE)?.value);
    if (!client) {
      const url = req.nextUrl.clone();
      url.pathname = '/account/login';
      url.searchParams.set('from', pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // ── Academy trainee portal ─────────────────────────────────────────────
  // BLD-314 Phase 3: secure-by-default gate — any new /academy/* page is
  // protected unless explicitly listed in PUBLIC_ACADEMY or matches the
  // public single-slug catalogue pattern.
  if (pathname.startsWith('/academy') && !isPublicAcademyPath(pathname)) {
    const student = await verifyAcademyToken(req.cookies.get(ACADEMY_SESSION_COOKIE)?.value);
    if (!student) {
      const url = req.nextUrl.clone();
      url.pathname = '/academy/portal';
      url.searchParams.set('from', pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // ── Staff CRM ──────────────────────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (pathname === '/admin/login') return NextResponse.next();
    const session = await verifyToken(req.cookies.get(SESSION_COOKIE)?.value);
    if (!session) {
      const url = req.nextUrl.clone();
      url.pathname = '/admin/login';
      url.searchParams.set('from', pathname);
      return NextResponse.redirect(url);
    }
    // 2FA enforcement: a setup-only session may reach the profile page only,
    // until the user enrols (which re-issues a full session).
    if (session.needsSetup && !pathname.startsWith('/admin/profile')) {
      const url = req.nextUrl.clone();
      url.pathname = '/admin/profile';
      url.searchParams.set('setup2fa', '1');
      return NextResponse.redirect(url);
    }
    // Per-request nonce → strict CSP (no 'unsafe-inline') for the dynamic CRM.
    // Setting the policy on the REQUEST headers lets Next auto-nonce its own
    // script tags; setting it on the response sends it to the browser.
    const nonce = crypto.randomUUID().replace(/-/g, '');
    const csp = await adminCsp(nonce);
    const reqHeaders = new Headers(req.headers);
    reqHeaders.set('x-nonce', nonce);
    reqHeaders.set('content-security-policy', csp);
    // Slide the idle window: refresh the cookie lifetime on each request so an
    // active session stays alive (up to the JWT's 12h absolute cap) while an idle
    // one expires after the idle window.
    const res = NextResponse.next({ request: { headers: reqHeaders } });
    res.headers.set('content-security-policy', csp);
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    if (token) res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 2 });
    return res;
  }

  // Public marketing pages. Attribution and audience-segment cookies are
  // non-essential (PECR reg. 6): only set them once the visitor has consented.
  // The consent banner mirrors the choice into a server-readable first-party
  // cookie (kc_analytics_consent=1), so we can gate at the edge — pre-consent we
  // set nothing (BLD-464). Strictly-necessary cookies above are unaffected.
  const res = NextResponse.next();
  const consented = req.cookies.get('kc_analytics_consent')?.value === '1';
  if (consented) {
    // First-touch marketing attribution from ad/UTM params (campaign tags only —
    // no personal data).
    const attrib = attributionFromUrl(req.nextUrl);
    if (attrib && !req.cookies.get(ATTRIB_COOKIE)) {
      res.cookies.set(ATTRIB_COOKIE, JSON.stringify(attrib), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: ATTRIB_MAX_AGE });
    }
    // Audience personalisation: remember the ad-declared segment (content only,
    // no personal data) so the personalised rail adapts across the visit.
    const seg = segmentFromUrl(req.nextUrl);
    if (seg) {
      res.cookies.set(SEG_COOKIE, seg, { sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: SEG_MAX_AGE });
    }
  }
  return res;
}

export const config = {
  // Run on the app areas (auth), the public site (redirects) and API routes
  // (the BLD-698 CSRF check, which returns immediately), but skip Next internals
  // and any request for a file with an extension.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.[\\w]+$).*)'],
};
