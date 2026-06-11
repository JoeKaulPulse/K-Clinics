import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PRJ-63.5 — front-of-house check-in. Marks (or clears) a booking's arrivedAt so
// reception can one-tap check a client in; the clinician view reflects it.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'Not signed in.' }, { status: 401 });
  if (!sessionCan(session, 'bookings.manage')) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const bookingId = typeof body.bookingId === 'string' ? body.bookingId : '';
  const arrived = body.arrived !== false; // default true
  if (!bookingId) return NextResponse.json({ ok: false, error: 'Bad request.' }, { status: 400 });

  try {
    const { db } = await import('@/lib/db');
    await db.booking.update({ where: { id: bookingId }, data: { arrivedAt: arrived ? new Date() : null } });
    return NextResponse.json({ ok: true, arrived });
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not update the booking.' }, { status: 500 });
  }
}
