import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';

export const runtime = 'nodejs';

// yay.com call webhook → immutable CallRecord. Configure yay to POST call/CDR
// events here with ?token=<YAY_WEBHOOK_SECRET> (or an Authorization: Bearer
// header). Idempotent on the yay call id, so duplicate deliveries are safe.

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function POST(req: Request) {
  const secret = process.env.YAY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: 'Telephony webhook not configured.' }, { status: 503 });

  const url = new URL(req.url);
  const token = url.searchParams.get('token') || (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token || !safeEqual(token, secret)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ ok: false, error: 'Bad payload.' }, { status: 400 });

  const { parseYayEvent, ingestCall } = await import('@/lib/yay');
  const parsed = parseYayEvent(body as Record<string, unknown>);
  if (!parsed) return NextResponse.json({ ok: true, ignored: true }); // event without a call id (e.g. heartbeat)

  try {
    const res = await ingestCall(parsed, body);
    return NextResponse.json({ ok: true, id: res.id, created: res.created });
  } catch (e) {
    console.error('[yay] ingest failed:', (e as Error)?.message);
    return NextResponse.json({ ok: false, error: 'Ingest failed.' }, { status: 500 });
  }
}
