import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { crmEnabled } from '@/lib/crm';
import { PAGES_TAG } from '@/lib/pages';
import { asSections, type Section } from '@/lib/sections';
import type { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

const normPath = (p: string) => '/' + String(p || '').trim().toLowerCase().replace(/[^a-z0-9/_-]/g, '').replace(/^\/+|\/+$/g, '');
const J = (v: Section[] | unknown) => v as unknown as Prisma.InputJsonValue;

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('settings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
  const editor = (session as { email?: string }).email ?? null;

  const body = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');
  const op = body.op as string;

  try {
    if (op === 'create') {
      const path = normPath(body.path);
      if (!path || path === '/') return NextResponse.json({ ok: false, error: 'Enter a valid path, e.g. /about.' }, { status: 400 });
      const exists = await db.page.findUnique({ where: { path }, select: { id: true } });
      if (exists) return NextResponse.json({ ok: false, error: 'A page for that path already exists.', id: exists.id }, { status: 409 });
      const page = await db.page.create({ data: { path, title: body.title ? String(body.title).slice(0, 120) : null, draft: J(asSections(body.sections)), status: 'DRAFT', updatedBy: editor } });
      return NextResponse.json({ ok: true, id: page.id });
    }

    if (!body.id) return NextResponse.json({ ok: false, error: 'No page id.' }, { status: 400 });

    if (op === 'saveDraft') {
      await db.page.update({ where: { id: body.id }, data: { draft: J(asSections(body.sections)), title: body.title !== undefined ? (body.title ? String(body.title).slice(0, 120) : null) : undefined, updatedBy: editor } });
      return NextResponse.json({ ok: true });
    }

    if (op === 'publish') {
      const page = await db.page.findUnique({ where: { id: body.id }, select: { published: true } });
      const sections = asSections(body.sections);
      // Snapshot the previously-published version for rollback.
      if (page?.published) await db.pageRevision.create({ data: { pageId: body.id, data: J(page.published), label: 'Published', createdBy: editor } });
      await db.page.update({ where: { id: body.id }, data: { draft: J(sections), published: J(sections), status: 'PUBLISHED', updatedBy: editor } });
      const old = await db.pageRevision.findMany({ where: { pageId: body.id }, orderBy: { createdAt: 'desc' }, skip: 30, select: { id: true } });
      if (old.length) await db.pageRevision.deleteMany({ where: { id: { in: old.map((r) => r.id) } } });
      revalidateTag(PAGES_TAG);
      return NextResponse.json({ ok: true });
    }

    if (op === 'unpublish') {
      const { Prisma } = await import('@prisma/client');
      await db.page.update({ where: { id: body.id }, data: { published: Prisma.DbNull, status: 'DRAFT', updatedBy: editor } });
      revalidateTag(PAGES_TAG);
      return NextResponse.json({ ok: true });
    }

    if (op === 'rollback') {
      const rev = await db.pageRevision.findUnique({ where: { id: String(body.revisionId) } });
      if (!rev) return NextResponse.json({ ok: false, error: 'Revision not found.' }, { status: 404 });
      await db.page.update({ where: { id: body.id }, data: { draft: J(rev.data), published: J(rev.data), status: 'PUBLISHED', updatedBy: editor } });
      revalidateTag(PAGES_TAG);
      return NextResponse.json({ ok: true });
    }

    if (op === 'delete') {
      await db.page.delete({ where: { id: body.id } }).catch(() => {});
      revalidateTag(PAGES_TAG);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: 'Unknown operation.' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error)?.message || 'Failed.' }, { status: 500 });
  }
}
