import 'server-only';
import { db } from '@/lib/db';

// Typed application settings, stored as key/value rows and editable in admin.
// Defaults apply when a row is absent.

export type SettingKey =
  | 'allow_clinician_choice' // clients may pick their clinician at booking
  | 'require_sop_ack'        // clinician must acknowledge SOP before starting
  | 'require_medical_review' // clinician must review medical flag before starting
  | 'enforce_staff_availability' // bookings respect per-staff schedules
  | 'auto_assign_practitioner'   // auto-assign a competent free clinician at booking
  | 'time_off_requires_approval' // staff time-off requests need manager sign-off
  | 'multi_location_enabled'     // surface location pickers across the CRM
  | 'room_equipment_binding'     // equipment is tied to the room it sits in
  | 'ai_consultation_enabled'    // K Vision AI photo consultation is live
  | 'review_requests_enabled'    // auto-send a review request after a treatment
  | 'require_consent'            // signed treatment consent required before starting
  | 'require_before_photo'       // laser: before-photo (or signed opt-out) required before starting
  | 'abandoned_booking_recovery' // email a nudge to finish an unpaid/incomplete booking
  | 'no_show_notice'             // email a warm rebooking note when an appointment is marked no-show
  | 'membership_renewal_nudge'   // email lapsing K Circle members to keep their tier
  | 'nps_survey'                 // send an NPS (0–10 recommend) survey after a completed visit
  | 'post_course_checkin';       // email when a client completes a full treatment course

export const SETTING_DEFAULTS: Record<SettingKey, boolean> = {
  allow_clinician_choice: false,
  require_sop_ack: true,
  require_medical_review: true,
  enforce_staff_availability: true,
  auto_assign_practitioner: true,
  time_off_requires_approval: true,
  multi_location_enabled: false,
  room_equipment_binding: false,
  ai_consultation_enabled: true,
  review_requests_enabled: true,
  require_consent: false,
  require_before_photo: true,
  abandoned_booking_recovery: false,
  no_show_notice: false,
  membership_renewal_nudge: false,
  nps_survey: false,
  post_course_checkin: false,
};

export const SETTING_META: Record<SettingKey, { label: string; description: string }> = {
  allow_clinician_choice: {
    label: 'Let clients choose their clinician',
    description: 'Show available clinicians at booking so clients can pick. Off by default — slots are assigned internally.',
  },
  auto_assign_practitioner: {
    label: 'Auto-assign a clinician at booking',
    description: 'Automatically assign a competent, available clinician when a booking is made.',
  },
  enforce_staff_availability: {
    label: 'Enforce staff availability',
    description: 'Only offer slots when at least one competent clinician is working and free (per schedules, time-off & Google Calendar).',
  },
  require_sop_ack: {
    label: 'Require SOP acknowledgement',
    description: 'Clinicians must confirm they’ve reviewed the treatment SOP before an appointment can be started.',
  },
  require_medical_review: {
    label: 'Require medical-flag review',
    description: 'Clinicians must review any client medical flag before an appointment can be started.',
  },
  time_off_requires_approval: {
    label: 'Time-off needs approval',
    description: 'Staff time-off requests must be approved by a manager before they’re confirmed. Requested time still blocks the calendar until declined.',
  },
  multi_location_enabled: {
    label: 'Multi-location mode',
    description: 'Turn on once you operate more than one site. Surfaces location pickers for schedules and bookings. Each clinician works at one location per day.',
  },
  room_equipment_binding: {
    label: 'Tie equipment to its room',
    description: 'When on, a treatment that needs a machine (e.g. laser/HIFU) is only offered in rooms that physically hold that equipment. Off by default — equipment is treated as movable and limited only by how many units you own.',
  },
  ai_consultation_enabled: {
    label: 'AI consultation (Get My Plan)',
    description: 'Let signed-in clients upload photos for an AI skin/teeth/hair analysis and a bookable, phased treatment plan. Requires an Anthropic API key. Turn off to hide the tool.',
  },
  review_requests_enabled: {
    label: 'Post-treatment review requests',
    description: 'Automatically invite clients to leave a review after a completed treatment (email; SMS when configured).',
  },
  require_consent: {
    label: 'Require signed consent before treatment',
    description: 'An appointment can’t be started until the client has e-signed the consent form for that treatment. Enable once your consent wording is approved.',
  },
  require_before_photo: {
    label: 'Require before-photo for laser',
    description: 'Laser appointments can’t be started until a before-photo is captured in-app, or the client has signed a photo opt-out. Strongly recommended for insurance.',
  },
  abandoned_booking_recovery: {
    label: 'Abandoned-booking recovery emails',
    description: 'Email a gentle, one-time nudge to clients who started a booking but didn’t save a card to finish it (sent 2–72h later). Off by default — turn on to recover incomplete bookings.',
  },
  no_show_notice: {
    label: 'No-show rebooking email',
    description: 'When an appointment is marked as a no-show, email the client a warm “sorry we missed you — shall we rebook?” note (any fee charged is noted). Off by default.',
  },
  membership_renewal_nudge: {
    label: 'K Circle renewal nudge',
    description: 'Email lapsing members in a paid tier (Silver+) a gentle “keep your benefits” nudge to rebook before their 12-month spend rolls off and they drop a tier. Off by default.',
  },
  nps_survey: {
    label: 'NPS satisfaction survey',
    description: 'After a completed visit, email a one-tap 0–10 “how likely to recommend us?” survey (at most once per client every ~90 days). Results show under Admin → NPS. Off by default.',
  },
  post_course_checkin: {
    label: 'Post-course check-in',
    description: 'When a client completes a full course of a course-based treatment (e.g. laser hair removal), email a “course complete — here’s how to maintain your results” note with a maintenance-booking link. Sent once per course. Off by default.',
  },
};

export async function getSetting(key: SettingKey): Promise<boolean> {
  const row = await db.setting.findUnique({ where: { key } });
  if (!row) return SETTING_DEFAULTS[key];
  return row.value === 'true';
}

export async function getSettings(): Promise<Record<SettingKey, boolean>> {
  const rows = await db.setting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value === 'true']));
  const out = {} as Record<SettingKey, boolean>;
  (Object.keys(SETTING_DEFAULTS) as SettingKey[]).forEach((k) => {
    out[k] = map.has(k) ? (map.get(k) as boolean) : SETTING_DEFAULTS[k];
  });
  return out;
}

export async function setSetting(key: SettingKey, value: boolean, updatedBy?: string) {
  await db.setting.upsert({
    where: { key },
    update: { value: String(value), updatedBy },
    create: { key, value: String(value), updatedBy },
  });
}
