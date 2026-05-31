import 'server-only';
import { db } from './db';
import { site } from './site';
import { getSetting } from './settings';

const SLOT_INTERVAL = Number(process.env.SLOT_INTERVAL_MIN || 15);
const LEAD_MINUTES = 120; // earliest bookable time from now

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseHM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

type Clinician = {
  id: string;
  name: string | null;
  schedules: { dayOfWeek: number; startMin: number; endMin: number; locationId: string | null }[];
  timeOff: { startAt: Date; endAt: Date }[];
  bookings: { startAt: Date; endAt: Date }[];
};

/** Clinicians competent for a treatment, with schedule/time-off/bookings for the day. */
async function cliniciansForDay(treatmentSlug: string, dayStart: Date, dayEnd: Date): Promise<Clinician[]> {
  const staff = await db.adminUser.findMany({
    where: { isClinician: true, active: true },
    select: {
      id: true,
      name: true,
      competencies: true,
      schedules: { select: { dayOfWeek: true, startMin: true, endMin: true, locationId: true } },
      // Pending + approved time-off blocks availability; declined/cancelled does not.
      timeOff: { where: { startAt: { lt: dayEnd }, endAt: { gt: dayStart }, status: { notIn: ['DECLINED', 'CANCELLED'] } }, select: { startAt: true, endAt: true } },
      bookings: {
        where: { status: { in: ['PENDING', 'CONFIRMED'] }, startAt: { gte: dayStart, lte: dayEnd } },
        select: { startAt: true, endAt: true },
      },
    },
  });
  return staff
    .filter((s) => s.competencies.length === 0 || s.competencies.includes(treatmentSlug))
    .map((s) => ({ id: s.id, name: s.name, schedules: s.schedules, timeOff: s.timeOff, bookings: s.bookings }));
}

/** A clinician is free if they're scheduled (at the requested location, if any),
 *  not on time-off, and have no overlapping booking. A clinician works at one
 *  location per day, so a location filter narrows to staff rostered there. */
function clinicianFree(c: Clinician, start: Date, end: Date, dow: number, locationId?: string | null): boolean {
  const startM = start.getHours() * 60 + start.getMinutes();
  const endM = startM + (end.getTime() - start.getTime()) / 60000;
  const working = c.schedules.some((sc) =>
    sc.dayOfWeek === dow && sc.startMin <= startM && sc.endMin >= endM &&
    (!locationId || !sc.locationId || sc.locationId === locationId),
  );
  if (!working) return false;
  if (c.timeOff.some((t) => start < t.endAt && end > t.startAt)) return false;
  if (c.bookings.some((b) => start < b.endAt && end > b.startAt)) return false;
  return true;
}

/**
 * Free start-times (ISO) for a date + treatment duration.
 * When staff availability is enforced AND clinicians are configured, a slot is
 * free if at least one competent clinician is working and free; otherwise a
 * single-resource model (no overlapping booking) within opening hours.
 */
export async function freeSlots(dateISO: string, durationMin: number, treatmentSlug?: string, locationId?: string | null): Promise<string[]> {
  const date = new Date(dateISO + 'T00:00:00');
  if (isNaN(date.getTime())) return [];
  const dow = date.getDay();
  const dayName = DOW[dow];
  const hours = site.hours.find((h) => h.day === dayName);
  if (!hours || hours.open === 'Closed') return [];
  const open = parseHM(hours.open);
  const close = parseHM(hours.close);
  if (open == null || close == null) return [];

  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);

  const enforce = treatmentSlug ? await getSetting('enforce_staff_availability') : false;
  const clinicians = enforce && treatmentSlug ? await cliniciansForDay(treatmentSlug, dayStart, dayEnd) : [];
  const useStaff = enforce && clinicians.length > 0;

  const bookings = useStaff
    ? []
    : await db.booking.findMany({
        where: { status: { in: ['PENDING', 'CONFIRMED'] }, startAt: { gte: dayStart, lte: dayEnd }, ...(locationId ? { locationId } : {}) },
        select: { startAt: true, endAt: true },
      });

  const minStart = Date.now() + LEAD_MINUTES * 60_000;
  const slots: string[] = [];

  for (let m = open; m + durationMin <= close; m += SLOT_INTERVAL) {
    const start = new Date(date); start.setHours(0, m, 0, 0);
    const end = new Date(start.getTime() + durationMin * 60_000);
    if (start.getTime() < minStart) continue;

    if (useStaff) {
      if (clinicians.some((c) => clinicianFree(c, start, end, dow, locationId))) slots.push(start.toISOString());
    } else {
      if (!bookings.some((b) => start < b.endAt && end > b.startAt)) slots.push(start.toISOString());
    }
  }
  return slots;
}

/** Pick a competent, free clinician for a slot (auto-assign), optionally at a location. */
export async function pickPractitioner(startISO: string, durationMin: number, treatmentSlug: string, locationId?: string | null): Promise<string | null> {
  const start = new Date(startISO);
  if (isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + durationMin * 60_000);
  const dayStart = new Date(start); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(start); dayEnd.setHours(23, 59, 59, 999);
  const clinicians = await cliniciansForDay(treatmentSlug, dayStart, dayEnd);
  const free = clinicians.find((c) => clinicianFree(c, start, end, start.getDay(), locationId));
  return free?.id ?? null;
}

/** Validate a proposed start is still free (used at create time). */
export async function isSlotFree(startISO: string, durationMin: number, treatmentSlug?: string, locationId?: string | null): Promise<boolean> {
  const start = new Date(startISO);
  if (isNaN(start.getTime())) return false;
  const end = new Date(start.getTime() + durationMin * 60_000);

  const dayName = DOW[start.getDay()];
  const hours = site.hours.find((h) => h.day === dayName);
  if (!hours || hours.open === 'Closed') return false;
  const open = parseHM(hours.open), close = parseHM(hours.close);
  const startM = start.getHours() * 60 + start.getMinutes();
  if (open == null || close == null || startM < open || startM + durationMin > close) return false;
  if (start.getTime() < Date.now() + LEAD_MINUTES * 60_000) return false;

  const enforce = treatmentSlug ? await getSetting('enforce_staff_availability') : false;
  if (enforce && treatmentSlug) {
    const dayStart = new Date(start); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(start); dayEnd.setHours(23, 59, 59, 999);
    const clinicians = await cliniciansForDay(treatmentSlug, dayStart, dayEnd);
    if (clinicians.length) return clinicians.some((c) => clinicianFree(c, start, end, start.getDay(), locationId));
  }

  const clash = await db.booking.findFirst({
    where: { status: { in: ['PENDING', 'CONFIRMED'] }, startAt: { lt: end }, endAt: { gt: start }, ...(locationId ? { locationId } : {}) },
    select: { id: true },
  });
  return !clash;
}
