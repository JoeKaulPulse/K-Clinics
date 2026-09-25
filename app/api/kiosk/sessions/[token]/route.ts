import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildKioskStreamPayload, KIOSK_STREAM_SELECT } from '@/lib/kiosk-live';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public status endpoint the mobile client polls (and the display's fallback
// when SSE is unavailable). Returns the original { ok, status, resultId } keys
// for back-compat, plus the kiosk v2 live payload (stage/poseIdx/frame/photos/
// result — the same shape as the SSE stream). Expires sessions past their TTL.
//
// This route authenticates with the TOKEN ONLY, and lib/kiosk.ts documents the
// token as brute-forceable, so the visitor's face never leaves here: the
// payload's `frame` is always null and `photoUrls` always empty, because
// buildKioskStreamPayload is called without a secret (BLD-1052 for the stored
// photos, BLD-1496 for the live mirror frame). Both are served only over the
// secret-gated SSE /stream route, which is what the display actually uses —
// useKioskChannel's poll fallback ignores those two fields entirely. Do not
// "fix" the null frame by passing a secret in from here: that would reopen the
// leak. Anything needing the frame must prove it holds the session secret.
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
