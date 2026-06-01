import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Client applies (or clears) loyalty points against one of their upcoming
// bookings. Capped at 50% of the price inside redeemPointsOnBooking.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getCurrentClient } = await import('@/lib/client-auth');
  const client = await getCurrentClient();
  if (!client) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });

  const { bookingId, points } = await req.json().catch(() => ({}));
  if (!bookingId || typeof points !== 'number' || points < 0) {
    return NextResponse.json({ ok: false, error: 'Bad request.' }, { status: 400 });
  }

  const { redeemPointsOnBooking } = await import('@/lib/client-loyalty');
  const res = await redeemPointsOnBooking(client.id, bookingId, points);
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
