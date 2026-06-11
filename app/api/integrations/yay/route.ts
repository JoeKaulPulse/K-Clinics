import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';

export const runtime = 'nodejs';

// Reachability check — open this URL in a browser to confirm the endpoint is
// deployed and public (does NOT reveal the secret or accept events; events are POST).
export async function GET() {
  return NextResponse.json({ ok: true, service: 'yay-webhook', expects: 'POST', configured: !!process.env.YAY_WEBHOOK_SECRET });
}

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

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ ok: false, error: 'Bad payload.' }, { status: 400 });

  // BLD-160: accept the Auth Token from the Authorization / X-Auth-Token headers
  // or the JSON body — NEVER a ?token= query param, which would leak the secret
  // into Vercel/CDN access logs. (yay can send it as a header.) Constant-time.
  const b = body as Record<string, unknown>;
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    || req.headers.get('x-auth-token')
    || (typeof b.auth_token === 'string' ? b.auth_token : '')
    || (typeof b.token === 'string' ? b.token : '');
  if (!token || !safeEqual(token, secret)) {
    // Throttle unauthorised callers so the secret can't be hammered / the
    // endpoint spammed. Legitimate (authorised) yay traffic never reaches this.
    const { enforceRateLimit } = await import('@/lib/security/guard');
    await enforceRateLimit(req, 'yay-auth-fail', 20, 300, 'client');
    return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }

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
