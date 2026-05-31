import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';
import { site } from '@/lib/site';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Download a single appointment as an .ics file. Keyed by the booking's
// manageToken (the same unguessable secret used for the manage link), so a
// signed-in client — or anyone with their confirmation link — can add it to
// any calendar app.
const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
const esc = (s: string) => s.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { token } = await params;
  const { db } = await import('@/lib/db');
  const b = await db.booking.findUnique({
    where: { manageToken: token },
    select: { id: true, treatmentTitle: true, startAt: true, endAt: true, status: true },
  });
  if (!b || b.status === 'CANCELLED') return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 });

  const location = `${site.name}, ${site.address.street}, ${[site.address.locality, site.address.postalCode].filter(Boolean).join(', ')}`;
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//K Clinics//Portal//EN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:booking-${b.id}@kclinics`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(b.startAt)}`,
    `DTEND:${fmt(b.endAt)}`,
    `SUMMARY:${esc(`${b.treatmentTitle} — ${site.name}`)}`,
    `LOCATION:${esc(location)}`,
    `DESCRIPTION:${esc(`Your appointment at ${site.name}. Manage it any time in your client portal.`)}`,
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(`Reminder: ${b.treatmentTitle} tomorrow at ${site.name}`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="kclinics-appointment.ics"`,
    },
  });
}
