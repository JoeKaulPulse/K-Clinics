import 'server-only';
import { db } from '@/lib/db';
import { site } from '@/lib/site';

// ── Hostinger calendar (CalDAV) ─────────────────────────────────────────────
// Pushes confirmed appointments to a shared clinic calendar via CalDAV, so they
// appear in Hostinger webmail (or any CalDAV client). Standard CalDAV: a PUT of
// an .ics resource per booking, DELETE to remove. No-op until configured.
//
// Provide the full calendar *collection* URL (ending with '/') in
// HOSTINGER_CALDAV_URL, plus the mailbox user + an app password. Works with any
// CalDAV server, so it also covers a non-Hostinger calendar if needed.

function config() {
  const url = process.env.HOSTINGER_CALDAV_URL;
  const user = process.env.HOSTINGER_CALDAV_USER;
  const pass = process.env.HOSTINGER_CALDAV_PASS;
  if (!url || !user || !pass) return null;
  return { base: url.replace(/\/?$/, '/'), auth: 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64') };
}

export function calendarConfigured(): boolean {
  return !!config();
}

const uidFor = (bookingId: string) => `kc-booking-${bookingId}`;
const pad = (n: number) => String(n).padStart(2, '0');
const toICSDate = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

function buildICS(ev: { uid: string; start: Date; end: Date; summary: string; description: string; location: string; cancelled?: boolean }): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//K Clinics//Booking//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${ev.cancelled ? 'CANCEL' : 'PUBLISH'}`,
    'BEGIN:VEVENT',
    `UID:${ev.uid}@kclinics.co.uk`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(ev.start)}`,
    `DTEND:${toICSDate(ev.end)}`,
    `SUMMARY:${esc(ev.summary)}`,
    `DESCRIPTION:${esc(ev.description)}`,
    `LOCATION:${esc(ev.location)}`,
    `STATUS:${ev.cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/** Create/update the calendar event for a confirmed booking. Best-effort. */
export async function pushBooking(bookingId: string): Promise<{ ok: boolean; error?: string }> {
  const cfg = config();
  if (!cfg) return { ok: false, error: 'CalDAV not configured' };
  try {
    const b = await db.booking.findUnique({ where: { id: bookingId }, include: { client: { select: { firstName: true, lastName: true, email: true, phone: true } } } });
    if (!b) return { ok: false, error: 'Booking not found' };
    const name = [b.client?.firstName, b.client?.lastName].filter(Boolean).join(' ') || 'Client';
    const loc = `${site.address.street}, ${site.address.locality}, ${site.address.postalCode}`;
    const ics = buildICS({
      uid: uidFor(bookingId),
      start: b.startAt,
      end: b.endAt,
      summary: `${b.treatmentTitle} — ${name}`,
      description: [`Client: ${name}`, b.client?.phone ? `Phone: ${b.client.phone}` : '', b.client?.email ? `Email: ${b.client.email}` : '', b.notes ? `Notes: ${b.notes}` : ''].filter(Boolean).join('\n'),
      location: loc,
    });
    const res = await fetch(`${cfg.base}${uidFor(bookingId)}.ics`, {
      method: 'PUT',
      headers: { 'content-type': 'text/calendar; charset=utf-8', authorization: cfg.auth },
      body: ics,
    });
    if (!res.ok && res.status !== 204 && res.status !== 201) return { ok: false, error: `CalDAV PUT ${res.status}` };
    return { ok: true };
  } catch (e) {
    console.error('[hostinger-calendar] push failed:', (e as Error)?.message);
    return { ok: false, error: (e as Error).message };
  }
}

/** Remove the calendar event for a cancelled booking. Best-effort. */
export async function removeBooking(bookingId: string): Promise<{ ok: boolean }> {
  const cfg = config();
  if (!cfg) return { ok: false };
  try {
    await fetch(`${cfg.base}${uidFor(bookingId)}.ics`, { method: 'DELETE', headers: { authorization: cfg.auth } });
    return { ok: true };
  } catch (e) {
    console.error('[hostinger-calendar] remove failed:', (e as Error)?.message);
    return { ok: false };
  }
}
