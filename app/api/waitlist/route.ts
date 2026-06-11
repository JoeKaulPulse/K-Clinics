import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// BLD-133 — public "notify me if a slot frees" join. Used from the booking flow
// when a date is fully booked. Find-or-creates the client by email, then adds an
// ACTIVE waitlist entry for the treatment + date window.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'Unavailable' }, { status: 503 });
  const b = await req.json().catch(() => ({}));
  const treatmentSlug = String(b.treatmentSlug || '').trim();
  const email = String(b.email || '').trim().toLowerCase();
  const firstName = String(b.name || b.firstName || '').trim().slice(0, 80);
  const phone = b.phone ? String(b.phone).trim().slice(0, 32) : null;
  if (!treatmentSlug) return NextResponse.json({ ok: false, error: 'Pick a treatment.' }, { status: 400 });
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ ok: false, error: 'Enter a valid email.' }, { status: 400 });
  if (!firstName) return NextResponse.json({ ok: false, error: 'Enter your name.' }, { status: 400 });

  const { getTreatment } = await import('@/lib/treatments');
  const treatment = getTreatment(treatmentSlug);
  if (!treatment) return NextResponse.json({ ok: false, error: 'Unknown treatment.' }, { status: 400 });

  // Date window: a specific day, or a range; default to the next 28 days.
  const from = b.fromDate ? new Date(b.fromDate) : new Date();
  const to = b.toDate ? new Date(b.toDate) : new Date(Date.now() + 28 * 864e5);
  if (isNaN(+from) || isNaN(+to) || to < from) return NextResponse.json({ ok: false, error: 'Invalid dates.' }, { status: 400 });

  const { db } = await import('@/lib/db');
  let client = await db.client.findFirst({ where: { email }, select: { id: true } }).catch(() => null);
  if (!client) {
    client = await db.client.create({ data: { firstName, email, phone, source: 'waitlist' }, select: { id: true } }).catch(() => null);
  }
  if (!client) return NextResponse.json({ ok: false, error: 'Could not save your details.' }, { status: 500 });

  const { joinWaitlist } = await import('@/lib/waitlist');
  const r = await joinWaitlist({ clientId: client.id, treatmentSlug, treatmentTitle: treatment.title, fromDate: from, toDate: to });
  return NextResponse.json({ ok: true, created: r.created });
}
