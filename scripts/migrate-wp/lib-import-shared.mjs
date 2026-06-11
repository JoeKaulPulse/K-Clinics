// Helpers shared by the importers: clinic-local time handling and the
// quarantine client that holds records which can't be linked to a person.

/** Minutes that `tz` is ahead of UTC at the instant `at`. */
function tzOffsetMinutes(tz, at) {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = Object.fromEntries(dtf.formatToParts(at).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return (asUtc - at.getTime()) / 60000;
}

/** A clinic wall-clock time (Europe/London, DST-aware) as a UTC Date.
 *  The old WordPress site stored appointment dates/slots as local times. */
export function londonToUtc(ymd, hh = 0, mm = 0) {
  const s = String(ymd).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || s.startsWith('0000')) return null;
  const probe = new Date(`${s}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00Z`);
  if (isNaN(probe.getTime())) return null;
  return new Date(probe.getTime() - tzOffsetMinutes('Europe/London', probe) * 60000);
}

// One well-known client that owns every migrated record whose person can't be
// identified (guest kiosk signings, users deleted from WordPress before the
// export). Nothing is silently dropped; staff find these under this client and
// reattach manually once identified.
export const QUARANTINE_EMAIL = 'unmatched.wordpress@imported.kclinics.local';

export async function ensureQuarantineClient(db) {
  const c = await db.client.upsert({
    where: { email: QUARANTINE_EMAIL },
    update: {},
    create: {
      email: QUARANTINE_EMAIL,
      firstName: 'Legacy WordPress',
      lastName: 'Unmatched records',
      source: 'wordpress',
      tags: ['migrated:wordpress', 'legacy-quarantine', 'needs-review'],
      notes: 'Holding record for data migrated from the old WordPress site that could not be linked to a person: consent forms signed without an account (guest/kiosk signings) and records belonging to users deleted from WordPress before the export. Each record names its WordPress source row. When a record is identified, recapture or reattach it under the right client, then note it here.',
      marketingOptIn: false,
    },
  });
  return c.id;
}
