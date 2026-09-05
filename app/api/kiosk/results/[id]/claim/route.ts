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
  const eventId = typeof body?.eventId === 'string' && body.eventId ? body.eventId : globalThis.crypto.randomUUID();
  try {
    const { sendLead } = await import('@/lib/conversions');
    const { consentFromCookieHeader } = await import('@/lib/attribution');
    const { analyticsConsent, marketingConsent } = consentFromCookieHeader(req.headers.get('cookie'));
    await sendLead({ eventId, email: marketingOptIn ? email : null, sourceUrl: req.headers.get('referer'), analyticsConsent, marketingConsent });
  } catch { /* best-effort */ }

  return NextResponse.json({ ...r, eventId });
}
