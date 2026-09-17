import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// BLD-1794: staff review of a trainee's VTCT registration. Requires settings.manage.
//   POST { op:'confirm', id }
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('settings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (b.op === 'confirm') {
    if (!b.id) return NextResponse.json({ ok: false, error: 'Missing id.' }, { status: 400 });
    const { confirmRegistration } = await import('@/lib/vtct-registration');
    const r = await confirmRegistration(session.email, String(b.id));
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }
  return NextResponse.json({ ok: false, error: 'Unknown action.' }, { status: 400 });
}
