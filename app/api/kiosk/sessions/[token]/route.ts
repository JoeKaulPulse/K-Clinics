import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildKioskStreamPayload, KIOSK_STREAM_SELECT } from '@/lib/kiosk-live';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public status endpoint the mobile client polls (and the display's fallback
// when SSE is unavailable). Returns the original { ok, status, resultId } keys
// for back-compat, plus the kiosk v2 live payload (stage/poseIdx/frame/photos/
// result — same shape as the SSE stream). Expires sessions past their TTL.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await db.kioskSession.findUnique({
    where: { token },
    select: KIOSK_STREAM_SELECT,
  });
  if (!session) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

  // Lazily expire stale sessions (unless they already finished).
  let status = session.status;
  const finished = status === 'ANALYZED' || status === 'SHARED' || status === 'AGE_DECLINED';
  if (!finished && session.expiresAt < new Date()) {
    if (status !== 'EXPIRED') {
      await db.kioskSession.update({ where: { id: session.id }, data: { status: 'EXPIRED' } }).catch(() => {});
    }
    status = 'EXPIRED';
  }

  const payload = buildKioskStreamPayload({ ...session, status });
  return NextResponse.json({ ok: true, ...payload, status, resultId: session.result?.id ?? null });
}
