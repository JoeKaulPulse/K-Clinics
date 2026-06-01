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
  | 'review_requests_enabled';   // auto-send a review request after a treatment

export const SETTING_DEFAULTS: Record<SettingKey, boolean> = {
  allow_clinician_choice: false,
  require_sop_ack: true,
  require_medical_review: true,
  enforce_staff_availability: true,
  auto_assign_practitioner: true,
  time_off_requires_approval: true,
  multi_location_enabled: false,
  room_equipment_binding: false,
  review_requests_enabled: true,
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
  review_requests_enabled: {
    label: 'Post-treatment review requests',
    description: 'Automatically invite clients to leave a review after a completed treatment (email; SMS when configured).',
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
