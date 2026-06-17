import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

const STATUSES = ['SUBMITTED', 'REVIEWED', 'APPROVED', 'NEEDS_REVISION'] as const;

// BLD-446: a tutor reviews a homework submission — set its status + feedback.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('settings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = String(body.id || '').trim();
  const status = String(body.status || '');
  const feedback = typeof body.feedback === 'string' ? body.feedback.slice(0, 4000) || null : null;
  if (!id || !(STATUSES as readonly string[]).includes(status)) return NextResponse.json({ ok: false, error: 'Bad request.' }, { status: 400 });

  const { db } = await import('@/lib/db');
  const sub = await db.homeworkSubmission.findUnique({ where: { id }, select: { id: true } });
  if (!sub) return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 });
  await db.homeworkSubmission.update({
    where: { id },
    data: { status: status as (typeof STATUSES)[number], feedback, reviewedBy: session.email, reviewedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
