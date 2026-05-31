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
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/account/:path*'],
};
