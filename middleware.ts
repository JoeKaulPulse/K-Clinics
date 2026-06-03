import { NextResponse, type NextRequest } from 'next/server';
import { verifyToken, verifyClientToken, SESSION_COOKIE, CLIENT_SESSION_COOKIE } from '@/lib/auth-edge';

// Public client-portal pages (no auth required).
const PUBLIC_ACCOUNT = new Set([
  '/account/login',
  '/account/signup',
  '/account/forgot-password',
  '/account/reset',
]);

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

  // Public marketing pages — nothing to gate.
  return NextResponse.next();
}

export const config = {
  // Run on the app areas (auth) and the public site (redirects), but skip
  // Next internals, API routes, and any request for a file with an extension.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.[\\w]+$).*)'],
};
