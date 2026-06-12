import 'server-only';
import { db, withDbRetry } from '@/lib/db';

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
  | 'post_course_checkin'        // email when a client completes a full treatment course
  | 'gift_card_physical_enabled' // offer a paid physical gift-card posted to the recipient
  | 'staff_weekly_digest'        // Monday email: each staff member's work + admin report links
  | 'staff_work_reengagement'    // email staff with pending assigned work if idle ≥8h
  | 'vat_registered'             // the clinic is VAT-registered (turns VAT on across pricing)
  | 'prices_vat_inclusive'       // prices are entered/shown VAT-inclusive (vs exclusive)
  | 'kiosk_discount_enabled'     // the storefront kiosk issues a share-to-claim discount code
  | 'reminder_72h'               // send a 3-day-ahead appointment reminder (BLD-126)
  | 'reminder_48h'               // send a 2-day-ahead appointment reminder (BLD-126)
  | 'contractor_checkin_enabled'; // PRJ-63: contractors self-sign-in at reception via QR

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
  abandoned_booking_recovery: true, // BLD-131: enabled (owner-approved revenue automation)
  no_show_notice: false,
  membership_renewal_nudge: true, // BLD-131: enabled (owner-approved revenue automation)
  nps_survey: false,
  post_course_checkin: false,
  gift_card_physical_enabled: false,
  staff_weekly_digest: true,
  staff_work_reengagement: true,
  vat_registered: false,
  prices_vat_inclusive: true,
  kiosk_discount_enabled: true,
  reminder_72h: false,
  reminder_48h: false,
  contractor_checkin_enabled: false, // PRJ-63: ships dark; owner enables after review
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
  gift_card_physical_enabled: {
    label: 'Offer a physical gift card (paid upgrade)',
    description: 'Let buyers pay a small extra fee to have a beautifully printed gift card posted to the recipient, in addition to the emailed card. Off by default — turn on only when you’re set up to print and post cards.',
  },
  staff_weekly_digest: {
    label: 'Weekly staff work digest',
    description: 'A Monday-morning email to each active staff member summarising their open tasks and assigned board items, and pointing admins to the secured reports & financial dashboards. On by default; staff inactive with nothing assigned get nothing.',
  },
  staff_work_reengagement: {
    label: 'Staff re-engagement email',
    description: 'If a staff member has work assigned to them but hasn’t signed in for 8+ hours, email them a gentle “you have work waiting” nudge (at most once every few days). On by default.',
  },
  vat_registered: {
    label: 'VAT registered',
    description: 'Turn on once the clinic is VAT-registered. Off by default — until then everything is “No VAT”. When on, VAT is derived per service (dentistry exempt, others standard) and shown on prices, receipts and reports.',
  },
  prices_vat_inclusive: {
    label: 'Prices include VAT',
    description: 'When VAT is on, treat the prices you enter as VAT-inclusive (the displayed price is what the client pays). Turn off to add VAT on top. On by default.',
  },
  kiosk_discount_enabled: {
    label: 'Storefront kiosk share reward',
    description: 'When on, a storefront “Skin & Smile” kiosk visitor who shares their result can create an account and claim a single-use discount code (set the % under Finance → Financial controls). Turn off to pause the reward.',
  },
  reminder_72h: {
    label: '72-hour appointment reminder',
    description: 'Send a reminder email (and SMS if configured) 3 days before a confirmed appointment, in addition to the standard 24-hour reminder. Off by default.',
  },
  reminder_48h: {
    label: '48-hour appointment reminder',
    description: 'Send a reminder email (and SMS if configured) 2 days before a confirmed appointment, in addition to the standard 24-hour reminder. Off by default.',
  },
  contractor_checkin_enabled: {
    label: 'Contractor reception check-in',
    description: 'When on, contractors can scan a QR at reception to sign in for their visit — finding their existing profile by name/email or registering a new one (which staff then approve). They see only their assigned jobs, facility plans and a visit timer — never client, clinical or financial data. Off by default.',
  },
};

// Numeric/string config values (not booleans) live in the same Setting table
// under their own keys — e.g. the physical gift-card fee. Defaults applied when
// absent; never throws.
export type ConfigKey = 'gift_card_physical_fee_pence' | 'refund_window_days' | 'vat_default_rate_pct' | 'min_margin_pct' | 'kiosk_discount_pct' | 'kiosk_discount_days';
export const CONFIG_DEFAULTS: Record<ConfigKey, number> = { gift_card_physical_fee_pence: 495, refund_window_days: 180, vat_default_rate_pct: 20, min_margin_pct: 0, kiosk_discount_pct: 15, kiosk_discount_days: 60 };

export async function getConfigNumber(key: ConfigKey): Promise<number> {
  try {
    const row = await withDbRetry(() => db.setting.findUnique({ where: { key } }), 2);
    const n = row ? Number(row.value) : NaN;
    return Number.isFinite(n) ? n : CONFIG_DEFAULTS[key];
  } catch {
    return CONFIG_DEFAULTS[key];
  }
}

export async function setConfigNumber(key: ConfigKey, value: number, updatedBy?: string) {
  await db.setting.upsert({ where: { key }, update: { value: String(Math.max(0, Math.round(value))), updatedBy }, create: { key, value: String(Math.max(0, Math.round(value))), updatedBy } });
}

// getSetting is on the hot path of the booking/availability engine, so it must
// never throw on a transient DB blip (cold start / connection spike during a
// deploy). It retries briefly and, failing that, falls back to the coded
// default — so a hiccup can never 500 the booking flow.
export async function getSetting(key: SettingKey): Promise<boolean> {
  try {
    const row = await withDbRetry(() => db.setting.findUnique({ where: { key } }), 2);
    if (!row) return SETTING_DEFAULTS[key];
    return row.value === 'true';
  } catch {
    return SETTING_DEFAULTS[key];
  }
}

export async function getSettings(): Promise<Record<SettingKey, boolean>> {
  let rows: { key: string; value: string }[] = [];
  try {
    rows = await withDbRetry(() => db.setting.findMany({ select: { key: true, value: true } }), 2);
  } catch {
    rows = []; // fall back to defaults rather than throw
  }
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
