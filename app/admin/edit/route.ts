import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';
import type { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

const normPath = (p: string) => '/' + String(p || '').trim().toLowerCase().replace(/[^a-z0-9/_-]/g, '').replace(/^\/+|\/+$/g, '');

// Deep-link from the public-site edit bar straight to the right editor for a
// path: an existing CMS page, a catalogue's dedicated tool, or a freshly
// created (seeded) page.
export async function GET(req: Request) {
  const to = (path: string) => NextResponse.redirect(new URL(path, req.url));
  if (!crmEnabled) return to('/admin');
  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) return to('/admin/login');

  const path = normPath(new URL(req.url).searchParams.get('path') || '');
  if (!path || path === '/') return to('/admin/pages');

  const { db } = await import('@/lib/db');
  const existing = await db.page.findUnique({ where: { path }, select: { id: true } }).catch(() => null);
  if (existing) return to(`/admin/pages/${existing.id}`);

  // Catalogue or system page → its dedicated editor (or the pages list).
  const { SITE_PAGE_GROUPS } = await import('@/lib/site-pages');
  const item = SITE_PAGE_GROUPS.flatMap((g) => g.items).find((i) => i.path === path);
  if (item?.manage === 'catalogue' && item.adminHref) return to(item.adminHref);
  if (item?.manage === 'system') return to('/admin/pages');

  // Editorial / legal / new path → create a (seeded) page and open it.
  // PRJ-1032.2: creating the page is a state change on a GET, so gate it on a
  // same-origin signal. A real click from the in-app edit bar is a same-origin
  // navigation (or a typed URL / bookmark = 'none'); a cross-site <img src> or
  // link that tries to forge the write against a logged-in admin is not, and
  // lands on the pages list without creating anything.
  const { isSameOriginRequest } = await import('@/lib/security/origin');
  if (!isSameOriginRequest(req)) return to('/admin/pages');

  const { pageSeed } = await import('@/lib/page-seeds');
  const { asSections } = await import('@/lib/sections');
  const sections = pageSeed(path) ?? [];
  const editor = (session as { email?: string }).email ?? null;
  const page = await db.page.create({ data: { path, draft: asSections(sections) as unknown as Prisma.InputJsonValue, status: 'DRAFT', updatedBy: editor } });
  return to(`/admin/pages/${page.id}`);
}
