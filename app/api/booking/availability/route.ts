import { NextResponse } from 'next/server';
import { availabilitySchema } from '@/lib/validation';
import { crmEnabled } from '@/lib/crm';
import { bookingFor } from '@/lib/treatments';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, slots: [] }, { status: 503 });
  const parsed = availabilitySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 422 });

  const { recommendedSlots } = await import('@/lib/availability');
  const { withDbRetry } = await import('@/lib/db');
  // Duration comes from the chosen catalogue variant when supplied; otherwise the
  // treatment default. This keeps the slot picker tied to the real admin engine.
  const durationMin = parsed.data.durationMin ?? bookingFor(parsed.data.slug).durationMin;
  try {
    // Retry transient DB blips (cold start / connection spike during a deploy) so
    // the slot picker rides over them instead of 500-ing mid-booking.
    const { slots, preferred } = await withDbRetry(() => recommendedSlots(parsed.data.date, durationMin, parsed.data.slug));
    return NextResponse.json({ ok: true, slots, preferred, durationMin });
  } catch (e) {
    console.error('[availability] failed after retries:', (e as Error)?.message);
    return NextResponse.json({ ok: false, error: 'Availability is briefly unavailable — please try again in a moment, or call us.', slots: [] }, { status: 503 });
  }
}
