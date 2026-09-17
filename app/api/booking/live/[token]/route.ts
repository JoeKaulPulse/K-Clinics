import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// BLD-138 v2 — client live view (poll fallback for the phone companion page).
// Authenticated by the booking's unguessable manageToken; the payload is the
// sanitised client view only (no emails, no clinical or gate detail).
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  // BLD-1802: per-IP abuse cap. Sized for the REAL traffic this endpoint takes —
  // LiveCompanion.tsx polls it every 4s (POLL_MS) whenever SSE is unavailable,
  // i.e. 15 req/min per device, and the limit is keyed on IP, so several phones
  // on one clinic/household NAT share the bucket. The 60/60s shape mirrors the
  // existing 'chat-poll' limit (app/api/chat/route.ts) for the same reason: a
  // short window self-heals within a minute instead of locking a legitimate
  // client out of their own appointment view for ten.
  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'booking-live', 60, 60))) {
    return NextResponse.json({ ok: false, error: 'Too many attempts — wait a moment.' }, { status: 429, headers: { 'cache-control': 'no-store' } });
  }
  const { token } = await params;
  try {
    const { db } = await import('@/lib/db');
    const b = await db.booking.findUnique({ where: { manageToken: token }, select: { id: true } });
    if (!b) return NextResponse.json({ ok: false }, { status: 404 });
    const { sessionSnapshot, clientView } = await import('@/lib/appointment-session-server');
    const snap = await sessionSnapshot(b.id);
    if (!snap) return NextResponse.json({ ok: false }, { status: 404 });
    return NextResponse.json({ ok: true, live: clientView(snap) }, { headers: { 'cache-control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}
