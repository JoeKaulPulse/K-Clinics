import { NextResponse, type NextRequest } from 'next/server';
import { verifyToken, verifyClientToken, verifyAcademyToken, SESSION_COOKIE, CLIENT_SESSION_COOKIE, ACADEMY_SESSION_COOKIE } from '@/lib/auth-edge';
import { ATTRIB_COOKIE, ATTRIB_MAX_AGE, attributionFromUrl } from '@/lib/attribution';
import { SEG_COOKIE, SEG_MAX_AGE, segmentFromUrl } from '@/lib/personalize';

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
]);
// Prefix match: course-catalogue slugs (/academy/<slug>) are public, except the
// reserved trainee routes above. Deeper paths (/academy/learn/...) are never public.
const isPublicAcademyPath = (p: string) =>
  PUBLIC_ACADEMY.has(p) ||
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

// Protect the staff CRM (/admin) and the client portal (/account); apply
// admin-managed redirects on the public site. Runs on the edge.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

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
    // Slide the idle window: refresh the cookie lifetime on each request so an
    // active session stays alive (up to the JWT's 12h absolute cap) while an idle
    // one expires after the idle window.
    const res = NextResponse.next();
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
  // Run on the app areas (auth) and the public site (redirects), but skip
  // Next internals, API routes, and any request for a file with an extension.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.[\\w]+$).*)'],
};
