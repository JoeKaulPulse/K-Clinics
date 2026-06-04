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
  // Duration comes from the chosen catalogue variant when supplied; otherwise the
  // treatment default. This keeps the slot picker tied to the real admin engine.
  const durationMin = parsed.data.durationMin ?? bookingFor(parsed.data.slug).durationMin;
  const { slots, preferred } = await recommendedSlots(parsed.data.date, durationMin, parsed.data.slug);
  return NextResponse.json({ ok: true, slots, preferred, durationMin });
}
