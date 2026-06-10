import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { FRAME_MAX_CHARS, FRAME_MIN_INTERVAL_MS, FRAME_PREFIX, FRAME_STAGES } from '@/lib/kiosk-live';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public, token-scoped. Live mirror frame from the phone camera: a small JPEG
// data-URL stored on the session row (DB only — never Blob) and relayed to the
// storefront display via SSE. Privacy: frames live only inside the session and
// are cleared at reveal/decline/expiry/cleanup.
//
// Soft rate limiting by design: writes <250ms since the previous stored frame
// are silently ignored (ok:true) so the phone can stream at its own cadence
// without error handling; frames outside posing/countdown are ignored too.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const body = await req.json().catch(() => null);
  const frame = body?.frame;
  if (typeof frame !== 'string' || !frame.startsWith(FRAME_PREFIX)) {
    return NextResponse.json({ ok: false, error: 'bad_frame' }, { status: 400 });
  }
  if (frame.length > FRAME_MAX_CHARS) {
    return NextResponse.json({ ok: false, error: 'frame_too_large' }, { status: 413 });
  }

  const session = await db.kioskSession.findUnique({
    where: { token },
    select: { id: true, status: true, stage: true, expiresAt: true, liveFrameAt: true },
  });
  if (!session) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  if (session.status === 'EXPIRED' || session.status === 'AGE_DECLINED' || session.expiresAt < new Date()) {
    return NextResponse.json({ ok: false, error: 'expired' }, { status: 410 });
  }

  // Frames only matter while posing/countdown — otherwise quietly ignore.
  if (!(FRAME_STAGES as readonly string[]).includes(session.stage)) {
    return NextResponse.json({ ok: true, stored: false });
  }
  // Ignore writes arriving faster than the display can use them.
  if (session.liveFrameAt && Date.now() - session.liveFrameAt.getTime() < FRAME_MIN_INTERVAL_MS) {
    return NextResponse.json({ ok: true, stored: false });
  }

  await db.kioskSession.update({
    where: { id: session.id },
    data: { liveFrame: frame, liveFrameAt: new Date() },
  });

  return NextResponse.json({ ok: true, stored: true });
}
