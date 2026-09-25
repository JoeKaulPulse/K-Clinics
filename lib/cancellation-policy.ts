// BLD-1920: the 48-hour self-service window for CLIENT-initiated cancel and
// reschedule, and the policy wording shown once a booking falls inside it.
//
// Deliberately a plain module (no 'server-only') so both server code
// (lib/booking-actions.ts, which enforces the rule) and client components
// (CancelButton, the public /booking/manage page, the account appointments
// page) read the exact same window and copy from one place — "the same rule
// and wording ... consistent across the website, client account and booking
// system" per the ticket.
//
// This is a NEW, stricter gate layered on top of the existing 24-hour
// late-cancellation FEE in lib/booking-actions.ts (isWithin24h /
// lateCancelFeePence / CANCEL_WINDOW_MS) — that fee logic is untouched and
// still applies to a staff/admin-initiated cancellation. This constant only
// governs whether a CLIENT may cancel/reschedule themselves at all; below it,
// self-service is blocked outright rather than charged.
export const SELF_SERVICE_WINDOW_MS = 48 * 60 * 60 * 1000;

export function isWithinSelfServiceWindow(startAt: Date | string): boolean {
  const t = typeof startAt === 'string' ? new Date(startAt).getTime() : startAt.getTime();
  return t - Date.now() < SELF_SERVICE_WINDOW_MS;
}

export const CANCELLATION_POLICY_HREF = '/info/cancellations-refunds';
export const CANCELLATION_POLICY_NAME = 'Cancellation & Rescheduling Policy';
export const CANCELLATION_POLICY_PHONE_DISPLAY = '020 8050 0750';
export const CANCELLATION_POLICY_PHONE_HREF = 'tel:02080500750';

// Server-side rejection text (app/api/booking/cancel, app/api/booking/reschedule
// via lib/booking-actions.ts). Client surfaces show the same message inline
// instead of waiting for this response wherever possible, but the server copy
// still matches it so a race (or a direct API call) reads identically.
export const SELF_SERVICE_CLOSED_MESSAGE =
  `Online cancellations and reschedules must be made at least 48 hours before your appointment. This booking is now subject to our ${CANCELLATION_POLICY_NAME} — please call us on ${CANCELLATION_POLICY_PHONE_DISPLAY} so our team can help.`;
