import { NextResponse } from 'next/server';
import { claimKioskDiscount } from '@/lib/kiosk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public. After sharing, a kiosk visitor creates an account and claims their
// single-use discount code. Share-gated + idempotent in claimKioskDiscount.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // BLD-711: this mints an account + single-use discount code — throttle per IP.
  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'kiosk-claim', 10, 600))) {
    return NextResponse.json({ ok: false, error: 'Too many requests.' }, { status: 429 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || '');
  const marketingOptIn = Boolean(body?.marketingOptIn);
  const r = await claimKioskDiscount(id, email, String(body?.firstName || ''), marketingOptIn);
  if (!r.ok) return NextResponse.json(r, { status: 400 });

  // BLD-1637: the kiosk's actual conversion (discount claim) never produced a
  // server-side Lead event — same pattern as /api/consult and /api/finder-lead.
  // No email forwarded to Meta's advanced matching unless the visitor's own
  // marketing tick was on (ConsultForm convention).
  //
  // claimKioskDiscount is idempotent: re-POSTing an already-claimed result
  // returns ok:true with the code minted by the FIRST request. That is a replay,
  // not a conversion, so it must not fire a second Lead — a refresh, a
  // double-tap or a retry would otherwise book one lead each (with a fresh
  // event id every time, so neither CAPI nor GA4 would dedupe them away).
  // `eventId` is only echoed back when a Lead actually went out, which is also
  // what tells the browser pixel in ClaimReward.tsx whether to fire.
  let eventId: string | null = null;
  if (!r.alreadyClaimed) {
    // Bounded like /api/finder-lead's schema (z.string().max(100)) — this is
    // unvalidated request-body input that ends up in an outbound CAPI payload.
    const supplied = typeof body?.eventId === 'string' ? body.eventId.trim() : '';
    const leadEventId = supplied && supplied.length <= 100 ? supplied : globalThis.crypto.randomUUID();
    eventId = leadEventId;
    try {
      const { sendLead } = await import('@/lib/conversions');
      const { consentFromCookieHeader } = await import('@/lib/attribution');
      const { analyticsConsent, marketingConsent } = consentFromCookieHeader(req.headers.get('cookie'));
      await sendLead({ eventId: leadEventId, clientId: r.clientId ?? null, email: marketingOptIn ? email : null, sourceUrl: req.headers.get('referer'), analyticsConsent, marketingConsent });
    } catch { /* best-effort */ }
  }

  // Explicit response shape: `clientId` and `alreadyClaimed` are internal
  // bookkeeping and must not be spread out to the browser.
  return NextResponse.json({ ok: true, code: r.code, pct: r.pct, days: r.days, ...(eventId ? { eventId } : {}) });
}
