import { NextResponse } from 'next/server';
import { z } from 'zod';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Client-initiated reschedule via their manage token.
// Rules enforced in rescheduleBooking(): ≤3 moves, ≥48h notice before the current slot.
const schema = z.object({
  token: z.string().min(1),
  newStartISO: z.string().datetime(),
});

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 422 });

  const { db } = await import('@/lib/db');
  const booking = await db.booking.findUnique({ where: { manageToken: parsed.data.token } });
  if (!booking) return NextResponse.json({ ok: false, error: 'Booking not found' }, { status: 404 });

  const { rescheduleBooking } = await import('@/lib/booking-actions');
  const res = await rescheduleBooking(booking.id, parsed.data.newStartISO, { by: 'client' });
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 400 });

  return NextResponse.json({ ok: true });
}
