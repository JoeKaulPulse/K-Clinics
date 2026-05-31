import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Create/update or reset a treatment SOP. Requires sop.manage.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('sop.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { op, treatmentSlug, title, content } = body as { op?: string; treatmentSlug?: string; title?: string; content?: string };
  if (!treatmentSlug) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });

  const { db } = await import('@/lib/db');

  if (op === 'reset') {
    await db.treatmentSop.deleteMany({ where: { treatmentSlug } });
    return NextResponse.json({ ok: true });
  }

  if (!title || !content) return NextResponse.json({ ok: false, error: 'Title and content are required.' }, { status: 422 });
  const existing = await db.treatmentSop.findUnique({ where: { treatmentSlug } });
  await db.treatmentSop.upsert({
    where: { treatmentSlug },
    update: { title, content, version: (existing?.version ?? 0) + 1, updatedBy: session.email },
    create: { treatmentSlug, title, content, updatedBy: session.email },
  });
  return NextResponse.json({ ok: true });
}
