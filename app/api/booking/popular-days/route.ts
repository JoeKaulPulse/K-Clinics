import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';
import { bookingFor } from '@/lib/treatments';

export const runtime = 'nodejs';

// Soon-upcoming dates that already have bookings and still have availability —
// surfaced as quick-pick chips so clients cluster onto already-staffed days.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, days: [] }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const slug = typeof body.slug === 'string' ? body.slug : '';
  if (!slug) return NextResponse.json({ ok: false, days: [] }, { status: 422 });
  const durationMin = Number(body.durationMin) > 0 ? Number(body.durationMin) : bookingFor(slug).durationMin;
  const { popularDays } = await import('@/lib/availability');
  const days = await popularDays(durationMin, slug);
  return NextResponse.json({ ok: true, days });
}
