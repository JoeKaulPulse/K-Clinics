import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'Service unavailable.' }, { status: 503 });
  try {
    const { token, newStartISO } = await req.json();
    if (!token || !newStartISO) return NextResponse.json({ ok: false, error: 'Missing token or new time.' }, { status: 400 });

    const { db } = await import('@/lib/db');
    const booking = await db.booking.findUnique({ where: { manageToken: String(token) } });
    if (!booking) return NextResponse.json({ ok: false, error: 'Booking not found.' }, { status: 404 });

    const { rescheduleBooking } = await import('@/lib/booking-actions');
    const result = await rescheduleBooking(booking.id, String(newStartISO), { by: 'client' });
    return NextResponse.json(result);
  } catch (e) {
    console.error('[reschedule]', (e as Error)?.message);
    Sentry.captureException(e, { tags: { area: 'booking/reschedule' } });
    return NextResponse.json({ ok: false, error: 'An error occurred. Please try again.' }, { status: 500 });
  }
}
