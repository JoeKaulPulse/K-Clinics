// Single source of truth for rendering clinic-local times/dates. The server may
// run in UTC (Vercel), so any appointment time formatted without an explicit
// timeZone drifts — and different views drift differently, showing the SAME
// appointment at different times. Everything that renders an appointment time
// MUST go through these helpers so the clinic (Europe/London) time is consistent
// across My day, the dashboard views, the calendar and client-facing pages.

export const CLINIC_TZ = 'Europe/London';

/** "09:30" in clinic-local time. */
export function fmtClinicTime(d: Date | string | number): string {
  return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: CLINIC_TZ });
}

/** Clinic-local date, e.g. "11 Jun" (default) or per the supplied Intl options. */
export function fmtClinicDate(
  d: Date | string | number,
  opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' },
): string {
  return new Date(d).toLocaleDateString('en-GB', { timeZone: CLINIC_TZ, ...opts });
}

// ── Clinic-local wall-clock <-> UTC instant ──────────────────────────────────
// The availability engine reasons in wall-clock minutes (opening hours, staff
// schedules are "09:00"-style local times) but stores/compares absolute instants.
// On a UTC server, `new Date(dateISO+'T00:00:00')` + `setHours()`/`getHours()`
// silently use UTC, so during BST every generated slot is offered an hour off the
// clinic's real opening hours. These helpers do the conversion explicitly in
// Europe/London so slot math is correct year-round (proven for BST + GMT).

/** Offset in minutes to ADD to UTC to get clinic-local time at `at` (BST → +60, GMT → 0). */
function clinicOffsetMin(at: Date): number {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: CLINIC_TZ, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at).map((x) => [x.type, x.value])) as Record<string, string>;
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, p.hour === '24' ? 0 : +p.hour, +p.minute, +p.second);
  return Math.round((asUTC - at.getTime()) / 60000);
}

/** The UTC instant for a clinic-local wall-clock minute-of-day on a calendar date.
 *  e.g. ('2026-07-01', 540) → 08:00Z (09:00 London in BST); ('2026-01-15', 540) → 09:00Z. */
export function clinicWallTimeToUTC(dateISO: string, minutesOfDay: number): Date {
  const [y, mo, d] = dateISO.split('-').map(Number);
  const guess = Date.UTC(y, mo - 1, d, 0, minutesOfDay, 0, 0); // wall-clock treated as UTC…
  const off = clinicOffsetMin(new Date(guess));
  return new Date(guess - off * 60000); // …then shifted by the real London offset.
}

/** Minutes since clinic-local midnight for an instant (e.g. 08:00Z in BST → 540). */
export function clinicMinutesOfDay(at: Date): number {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: CLINIC_TZ, hour12: false, hour: '2-digit', minute: '2-digit',
  }).formatToParts(at).map((x) => [x.type, x.value])) as Record<string, string>;
  return (p.hour === '24' ? 0 : +p.hour) * 60 + +p.minute;
}

/** Calendar date (YYYY-MM-DD) of an instant in clinic-local time. */
export function clinicDateISO(at: Date): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: CLINIC_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(at).map((x) => [x.type, x.value])) as Record<string, string>;
  return `${p.year}-${p.month}-${p.day}`;
}

/** Day-of-week (0=Sun…6=Sat) for a calendar date string, tz-stable (noon-UTC anchor). */
export function clinicDayOfWeek(dateISO: string): number {
  const [y, mo, d] = dateISO.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, 12)).getUTCDay();
}

/** Inclusive UTC bounds [start, end] spanning the clinic-local day of `dateISO`. */
export function clinicDayBounds(dateISO: string): { dayStart: Date; dayEnd: Date } {
  const dayStart = clinicWallTimeToUTC(dateISO, 0);
  return { dayStart, dayEnd: new Date(dayStart.getTime() + 24 * 60 * 60_000 - 1) };
}
