import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// BLD-534: portfolio review (tutor). Requires settings.manage.
//   POST { op:'review', id, status:'APPROVED'|'NEEDS_WORK', feedback }
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('settings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  if (b.op === 'review') {
    if (!b.id) return NextResponse.json({ ok: false, error: 'Missing id.' }, { status: 400 });
    const { reviewEntry } = await import('@/lib/portfolio');
    const r = await reviewEntry(session.email, String(b.id), str(b.status), str(b.feedback));
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }
  return NextResponse.json({ ok: false, error: 'Unknown action.' }, { status: 400 });
}
