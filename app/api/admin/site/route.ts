import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { crmEnabled } from '@/lib/crm';
import { SITE_CONFIG_TAG } from '@/lib/site-config';

export const runtime = 'nodejs';

// Global site configuration (business variables, social, hours, booking,
// announcement, navigation). Requires settings.manage. Every save snapshots the
// previous version into SiteConfigRevision for one-click rollback.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('settings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');
  const editor = (session as { email?: string }).email ?? null;

  // Restore a previous revision.
  if (body.op === 'rollback') {
    if (!body.revisionId) return NextResponse.json({ ok: false, error: 'No revision.' }, { status: 400 });
    const rev = await db.siteConfigRevision.findUnique({ where: { id: String(body.revisionId) } });
    if (!rev) return NextResponse.json({ ok: false, error: 'Revision not found.' }, { status: 404 });
    const current = await db.siteConfig.findUnique({ where: { id: 'singleton' }, select: { data: true } });
    if (current) await db.siteConfigRevision.create({ data: { configId: 'singleton', data: current.data as object, label: 'Before rollback', createdBy: editor } });
    await db.siteConfig.update({ where: { id: 'singleton' }, data: { data: rev.data as object, updatedBy: editor } });
    revalidateTag(SITE_CONFIG_TAG);
    return NextResponse.json({ ok: true });
  }

  // Save the full config object (the editor always sends the complete shape).
  const data = body.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return NextResponse.json({ ok: false, error: 'Invalid config.' }, { status: 400 });
  }
  if (JSON.stringify(data).length > 200_000) {
    return NextResponse.json({ ok: false, error: 'Config too large.' }, { status: 413 });
  }

  const existing = await db.siteConfig.findUnique({ where: { id: 'singleton' }, select: { data: true } });
  if (existing) {
    // Snapshot the outgoing version, then keep history trimmed to the last 30.
    await db.siteConfigRevision.create({ data: { configId: 'singleton', data: existing.data as object, label: body.label ? String(body.label).slice(0, 80) : null, createdBy: editor } });
    const old = await db.siteConfigRevision.findMany({ where: { configId: 'singleton' }, orderBy: { createdAt: 'desc' }, skip: 30, select: { id: true } });
    if (old.length) await db.siteConfigRevision.deleteMany({ where: { id: { in: old.map((r) => r.id) } } });
  }

  await db.siteConfig.upsert({
    where: { id: 'singleton' },
    update: { data, updatedBy: editor },
    create: { id: 'singleton', data, updatedBy: editor },
  });
  revalidateTag(SITE_CONFIG_TAG);
  return NextResponse.json({ ok: true });
}
