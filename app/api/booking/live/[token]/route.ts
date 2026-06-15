import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// BLD-138 v2 — client live view (poll fallback for the phone companion page).
// Authenticated by the booking's unguessable manageToken; the payload is the
// sanitised client view only (no emails, no clinical or gate detail).
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { token } = await params;
  const { db } = await import('@/lib/db');
  const b = await db.booking.findUnique({ where: { manageToken: token }, select: { id: true } });
  if (!b) return NextResponse.json({ ok: false }, { status: 404 });
  const { sessionSnapshot, clientView } = await import('@/lib/appointment-session-server');
  const snap = await sessionSnapshot(b.id);
  if (!snap) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true, live: clientView(snap) }, { headers: { 'cache-control': 'no-store' } });
}
