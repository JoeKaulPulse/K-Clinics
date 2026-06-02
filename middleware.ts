import { NextResponse, type NextRequest } from 'next/server';
import { verifyToken, verifyClientToken, SESSION_COOKIE, CLIENT_SESSION_COOKIE } from '@/lib/auth-edge';

// Public client-portal pages (no auth required).
const PUBLIC_ACCOUNT = new Set([
  '/account/login',
  '/account/signup',
  '/account/forgot-password',
  '/account/reset',
]);

// Protect the staff CRM (/admin) and the client portal (/account); auth/public
// pages stay open. Runs on the edge.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

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

export const config = {
  matcher: ['/admin/:path*', '/account/:path*'],
};
