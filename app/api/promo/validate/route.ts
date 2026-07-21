import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Live promo-code preview for the booking flow. Price is taken from the
// catalogue server-side (never trusted from the client).
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'Unavailable.' }, { status: 503 });
  const { code, slug } = await req.json().catch(() => ({}));
  if (!code || !slug) return NextResponse.json({ ok: false, error: 'Enter a code.' }, { status: 400 });

  // Throttle so the endpoint can't be used to brute-force valid discount codes.
  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'promo-validate', 20, 600, 'client', { failClosed: true }))) return NextResponse.json({ ok: false, error: 'Too many attempts — please try again shortly.' }, { status: 429 });

  const { getTreatment } = await import('@/lib/treatments');
  if (!getTreatment(String(slug))) return NextResponse.json({ ok: false, error: 'Unknown treatment.' }, { status: 404 });
  const { lowestPenceForTreatment } = await import('@/lib/services');
  const pricePence = await lowestPenceForTreatment(String(slug));
  if (!pricePence || pricePence <= 0) return NextResponse.json({ ok: false, error: 'This treatment is priced on consultation.' }, { status: 400 });

  const { getCurrentClient } = await import('@/lib/client-auth');
  const client = await getCurrentClient().catch(() => null);

  const { priceWithPromo } = await import('@/lib/promo');
  const r = await priceWithPromo(String(code), { clientId: client?.id, email: client?.email, treatmentSlug: String(slug), pricePence });
  if (!r.ok) return NextResponse.json(r, { status: 200 });
  return NextResponse.json({ ok: true, code: r.code, label: r.label, discountPence: r.discountPence, finalPence: r.finalPence, pricePence });
}
