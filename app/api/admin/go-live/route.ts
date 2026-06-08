import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Tick / untick a manual go-live task (owner-driven tasks that can't be
// auto-detected). Stored in the Setting store so progress persists.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'Not enabled.' }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('settings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const { id, done } = (await req.json().catch(() => ({}))) as { id?: string; done?: boolean };
  if (!id || typeof id !== 'string') return NextResponse.json({ ok: false, error: 'Missing id.' }, { status: 400 });

  const { setGoLiveManual } = await import('@/lib/go-live');
  const ids = await setGoLiveManual(id, !!done, session.email);
  return NextResponse.json({ ok: true, ids });
}
