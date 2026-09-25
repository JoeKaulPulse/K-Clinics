import { NextResponse } from 'next/server';
import { z } from 'zod';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Client-initiated cancellation via their manage token.
// BLD-1920: cancelBooking() blocks this outright when less than 48 hours
// remain (self-service is closed; the client is pointed at our
// Cancellation & Rescheduling Policy). Outside that window, the pre-existing
// 24h late-cancellation-fee policy still applies automatically (free if
// >24h, otherwise the late fee is charged) — but a client can no longer
// reach that window through self-service, since it now sits inside the 48h
// block; it still applies to a staff-assisted cancellation.
const schema = z.object({ token: z.string().min(1), reason: z.string().max(500).optional() });

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'booking-cancel', 10, 300))) {
    return NextResponse.json({ ok: false, error: 'Too many attempts — wait a few minutes.' }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 422 });

  const { db } = await import('@/lib/db');
  const booking = await db.booking.findUnique({ where: { manageToken: parsed.data.token } });
  if (!booking) return NextResponse.json({ ok: false, error: 'Booking not found' }, { status: 404 });

  const { cancelBooking } = await import('@/lib/booking-actions');
  const res = await cancelBooking(booking.id, { by: 'client', reason: parsed.data.reason });
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error, code: res.code }, { status: 400 });

  return NextResponse.json({ ok: true, charged: res.charged ?? 0, requiresAction: res.requiresAction ?? false });
}
