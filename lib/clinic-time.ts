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
