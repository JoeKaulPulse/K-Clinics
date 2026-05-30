import { NextResponse } from 'next/server';
import { z } from 'zod';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Client-initiated cancellation via their manage token. The 24h policy applies
// automatically (free if >24h, otherwise the late fee is charged).
const schema = z.object({ token: z.string().min(1), reason: z.string().max(500).optional() });

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 422 });

  const { db } = await import('@/lib/db');
  const booking = await db.booking.findUnique({ where: { manageToken: parsed.data.token } });
  if (!booking) return NextResponse.json({ ok: false, error: 'Booking not found' }, { status: 404 });

  const { cancelBooking } = await import('@/lib/booking-actions');
  const res = await cancelBooking(booking.id, { by: 'client', reason: parsed.data.reason });
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 400 });

  return NextResponse.json({ ok: true, charged: res.charged ?? 0, requiresAction: res.requiresAction ?? false });
}
