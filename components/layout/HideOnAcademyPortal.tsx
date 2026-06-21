'use client';

import { usePathname } from 'next/navigation';

// BLD-528: the academy trainee portal lives under /academy/* (inside the marketing
// route group) but should wear its own portal chrome — like the client portal —
// not the public site header/footer. This gate drops the marketing chrome it wraps
// on the authenticated portal routes. usePathname resolves during SSR too, so there
// is no header flash before hydration. Public academy pages (catalogue, course
// detail, funding, verify) keep the marketing chrome.
const PORTAL_PREFIXES = ['/academy/portal', '/academy/learn', '/academy/practice', '/academy/revise', '/academy/exercises', '/academy/demos', '/academy/community', '/academy/portfolio', '/academy/leaderboard', '/academy/settings', '/academy/pay', '/academy/forgot-password', '/academy/reset'];

export function HideOnAcademyPortal({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const hidden = PORTAL_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
  if (hidden) return null;
  return <>{children}</>;
}
