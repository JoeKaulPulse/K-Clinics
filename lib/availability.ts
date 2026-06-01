import 'server-only';
import { db } from './db';
import { site } from './site';
import { getSetting } from './settings';
import { bookingFor, getTreatment } from './treatments';

const SLOT_INTERVAL = Number(process.env.SLOT_INTERVAL_MIN || 15);
const LEAD_MINUTES = 120; // earliest bookable time from now

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseHM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Effective end of a booking including its cleanup buffer. */
function busyEnd(b: { endAt: Date; bufferMin: number }): number {
  return b.endAt.getTime() + b.bufferMin * 60_000;
}

/** Room capability a treatment needs, derived from its category. */
function roomTagFor(treatmentSlug?: string): string | null {
  if (!treatmentSlug) return null;
  const t = getTreatment(treatmentSlug);
  if (!t) return null;
  return t.category === 'dentistry' ? 'dental' : 'aesthetics';
}

type Clinician = {
  id: string;
  name: string | null;
  schedules: { dayOfWeek: number; startMin: number; endMin: number; breakStartMin: number | null; breakEndMin: number | null; locationId: string | null }[];
  timeOff: { startAt: Date; endAt: Date }[];
  bookings: { startAt: Date; endAt: Date; bufferMin: number }[];
};

/** Clinicians competent for a treatment, with schedule/time-off/bookings for the day. */
async function cliniciansForDay(treatmentSlug: string, dayStart: Date, dayEnd: Date): Promise<Clinician[]> {
  const staff = await db.adminUser.findMany({
    where: { isClinician: true, active: true },
    select: {
      id: true,
      name: true,
      competencies: true,
      schedules: { select: { dayOfWeek: true, startMin: true, endMin: true, breakStartMin: true, breakEndMin: true, locationId: true } },
      timeOff: { where: { startAt: { lt: dayEnd }, endAt: { gt: dayStart }, status: { notIn: ['DECLINED', 'CANCELLED'] } }, select: { startAt: true, endAt: true } },
      bookings: {
        where: { status: { in: ['PENDING', 'CONFIRMED'] }, startAt: { gte: dayStart, lte: dayEnd } },
        select: { startAt: true, endAt: true, bufferMin: true },
      },
    },
  });
  return staff
    .filter((s) => s.competencies.length === 0 || s.competencies.includes(treatmentSlug))
    .map((s) => ({ id: s.id, name: s.name, schedules: s.schedules, timeOff: s.timeOff, bookings: s.bookings }));
}

/** A clinician is free if scheduled (at the location, if any), not on a break,
 *  not on time-off, and with no overlapping booking — all buffer-aware. */
function clinicianFree(c: Clinician, start: Date, end: Date, dow: number, bufferMin: number, locationId?: string | null): boolean {
  const startM = start.getHours() * 60 + start.getMinutes();
  const endM = startM + (end.getTime() - start.getTime()) / 60000;
  const sched = c.schedules.find((sc) =>
    sc.dayOfWeek === dow && sc.startMin <= startM && sc.endMin >= endM &&
    (!locationId || !sc.locationId || sc.locationId === locationId),
  );
  if (!sched) return false;
  // Daily break (e.g. lunch).
  if (sched.breakStartMin != null && sched.breakEndMin != null && startM < sched.breakEndMin && endM > sched.breakStartMin) return false;
  const endBuffered = end.getTime() + bufferMin * 60_000;
  if (c.timeOff.some((t) => start.getTime() < t.endAt.getTime() && endBuffered > t.startAt.getTime())) return false;
  if (c.bookings.some((b) => start.getTime() < busyEnd(b) && endBuffered > b.startAt.getTime())) return false;
  return true;
}

/** Clinic-wide closures overlapping the day (for this location or all sites). */
async function dayClosures(dayStart: Date, dayEnd: Date, locationId?: string | null) {
  return db.clinicClosure.findMany({
    where: {
      startAt: { lt: dayEnd }, endAt: { gt: dayStart },
      OR: [{ locationId: null }, ...(locationId ? [{ locationId }] : [])],
    },
    select: { startAt: true, endAt: true },
  });
}

// ── Resource pools (rooms & equipment) ───────────────────────────────────────
// A pool is a set of interchangeable resources. A slot is feasible while at
// least one member has spare capacity; assignment picks that member.
type Pool = {
  resources: { id: string; capacity: number }[];
  bookings: { startAt: Date; endAt: Date; bufferMin: number; resIds: string[] }[];
};

async function loadPool(resources: { id: string; capacity: number }[], dayStart: Date, dayEnd: Date): Promise<Pool> {
  const ids = resources.map((r) => r.id);
  const rows = await db.booking.findMany({
    where: { status: { in: ['PENDING', 'CONFIRMED'] }, startAt: { lt: dayEnd }, endAt: { gt: dayStart }, resources: { some: { id: { in: ids } } } },
    select: { startAt: true, endAt: true, bufferMin: true, resources: { where: { id: { in: ids } }, select: { id: true } } },
  });
  return { resources, bookings: rows.map((r) => ({ startAt: r.startAt, endAt: r.endAt, bufferMin: r.bufferMin, resIds: r.resources.map((x) => x.id) })) };
}

/** Free treatment rooms matching the required capability tag. */
async function roomPool(roomTag: string | null, dayStart: Date, dayEnd: Date, locationId?: string | null): Promise<Pool | null> {
  if (!roomTag) return null;
  const resources = await db.resource.findMany({
    where: { kind: 'ROOM', active: true, tags: { has: roomTag }, ...(locationId ? { OR: [{ locationId: null }, { locationId }] } : {}) },
    select: { id: true, capacity: true },
  });
  return resources.length ? loadPool(resources, dayStart, dayEnd) : null;
}

/** Shared equipment (laser/HIFU) the treatment requires. */
async function equipmentPool(treatmentSlug: string | undefined, dayStart: Date, dayEnd: Date, locationId?: string | null): Promise<Pool | null> {
  const required = treatmentSlug ? bookingFor(treatmentSlug).requiresResource : undefined;
  if (!required) return null;
  const resources = await db.resource.findMany({
    where: { kind: 'EQUIPMENT', active: true, slug: required, ...(locationId ? { OR: [{ locationId: null }, { locationId }] } : {}) },
    select: { id: true, capacity: true },
  });
  return resources.length ? loadPool(resources, dayStart, dayEnd) : null;
}

/** First pool member with spare capacity for [start, endBuffered], else null. */
function pickFromPool(pool: Pool, start: Date, endBufferedMs: number): string | null {
  for (const r of pool.resources) {
    const used = pool.bookings.filter((b) => b.resIds.includes(r.id) && start.getTime() < busyEnd(b) && endBufferedMs > b.startAt.getTime()).length;
    if (used < r.capacity) return r.id;
  }
  return null;
}

const poolFree = (pool: Pool | null, start: Date, endBufferedMs: number) => !pool || pickFromPool(pool, start, endBufferedMs) !== null;

/**
 * Free start-times (ISO) for a date + treatment. A slot is offered only when it
 * fits opening hours and lead time, is outside any clinic closure, has a free
 * capable room and (if needed) free equipment, and — when staff availability is
 * enforced — at least one competent clinician is working and free (schedule,
 * break, time-off & clashes, all buffer-aware).
 */
export async function freeSlots(dateISO: string, durationMin: number, treatmentSlug?: string, locationId?: string | null): Promise<string[]> {
  const date = new Date(dateISO + 'T00:00:00');
  if (isNaN(date.getTime())) return [];
  const dow = date.getDay();
  const hours = site.hours.find((h) => h.day === DOW[dow]);
  if (!hours || hours.open === 'Closed') return [];
  const open = parseHM(hours.open);
  const close = parseHM(hours.close);
  if (open == null || close == null) return [];

  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);

  const bufferMin = treatmentSlug ? (bookingFor(treatmentSlug).bufferMin ?? 0) : 0;
  const enforce = treatmentSlug ? await getSetting('enforce_staff_availability') : false;
  const [clinicians, closures, rooms, equip] = await Promise.all([
    enforce && treatmentSlug ? cliniciansForDay(treatmentSlug, dayStart, dayEnd) : Promise.resolve([] as Clinician[]),
    dayClosures(dayStart, dayEnd, locationId),
    roomPool(roomTagFor(treatmentSlug), dayStart, dayEnd, locationId),
    equipmentPool(treatmentSlug, dayStart, dayEnd, locationId),
  ]);
  const useStaff = enforce && treatmentSlug != null && clinicians.length > 0;

  const bookings = useStaff
    ? []
    : await db.booking.findMany({
        where: { status: { in: ['PENDING', 'CONFIRMED'] }, startAt: { gte: dayStart, lte: dayEnd }, ...(locationId ? { locationId } : {}) },
        select: { startAt: true, endAt: true, bufferMin: true },
      });

  const minStart = Date.now() + LEAD_MINUTES * 60_000;
  const slots: string[] = [];

  for (let m = open; m + durationMin <= close; m += SLOT_INTERVAL) {
    const start = new Date(date); start.setHours(0, m, 0, 0);
    const end = new Date(start.getTime() + durationMin * 60_000);
    if (start.getTime() < minStart) continue;

    const endBufferedMs = end.getTime() + bufferMin * 60_000;
    if (closures.some((cl) => start.getTime() < cl.endAt.getTime() && end.getTime() > cl.startAt.getTime())) continue;
    if (!poolFree(rooms, start, endBufferedMs)) continue;
    if (!poolFree(equip, start, endBufferedMs)) continue;

    if (useStaff) {
      if (clinicians.some((c) => clinicianFree(c, start, end, dow, bufferMin, locationId))) slots.push(start.toISOString());
    } else {
      if (!bookings.some((b) => start.getTime() < busyEnd(b) && endBufferedMs > b.startAt.getTime())) slots.push(start.toISOString());
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
  const bufferMin = bookingFor(treatmentSlug).bufferMin ?? 0;
  const clinicians = await cliniciansForDay(treatmentSlug, dayStart, dayEnd);
  const free = clinicians.find((c) => clinicianFree(c, start, end, start.getDay(), bufferMin, locationId));
  return free?.id ?? null;
}

/** Auto-assign the resources a booking should hold: a free capable room plus any
 *  shared equipment the treatment requires. Returns resource ids to connect
 *  (empty when nothing is configured). */
export async function assignResources(startISO: string, durationMin: number, treatmentSlug: string, locationId?: string | null): Promise<string[]> {
  const start = new Date(startISO);
  if (isNaN(start.getTime())) return [];
  const end = new Date(start.getTime() + durationMin * 60_000);
  const bufferMin = bookingFor(treatmentSlug).bufferMin ?? 0;
  const endBufferedMs = end.getTime() + bufferMin * 60_000;
  const dayStart = new Date(start); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(start); dayEnd.setHours(23, 59, 59, 999);

  const [rooms, equip] = await Promise.all([
    roomPool(roomTagFor(treatmentSlug), dayStart, dayEnd, locationId),
    equipmentPool(treatmentSlug, dayStart, dayEnd, locationId),
  ]);
  const ids: string[] = [];
  const room = rooms && pickFromPool(rooms, start, endBufferedMs);
  if (room) ids.push(room);
  const machine = equip && pickFromPool(equip, start, endBufferedMs);
  if (machine) ids.push(machine);
  return ids;
}

/** Validate a proposed start is still free (used at create time). */
export async function isSlotFree(startISO: string, durationMin: number, treatmentSlug?: string, locationId?: string | null): Promise<boolean> {
  const start = new Date(startISO);
  if (isNaN(start.getTime())) return false;
  const end = new Date(start.getTime() + durationMin * 60_000);

  const hours = site.hours.find((h) => h.day === DOW[start.getDay()]);
  if (!hours || hours.open === 'Closed') return false;
  const open = parseHM(hours.open), close = parseHM(hours.close);
  const startM = start.getHours() * 60 + start.getMinutes();
  if (open == null || close == null || startM < open || startM + durationMin > close) return false;
  if (start.getTime() < Date.now() + LEAD_MINUTES * 60_000) return false;

  const dayStart = new Date(start); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(start); dayEnd.setHours(23, 59, 59, 999);
  const bufferMin = treatmentSlug ? (bookingFor(treatmentSlug).bufferMin ?? 0) : 0;
  const endBufferedMs = end.getTime() + bufferMin * 60_000;

  const [closures, rooms, equip] = await Promise.all([
    dayClosures(dayStart, dayEnd, locationId),
    roomPool(roomTagFor(treatmentSlug), dayStart, dayEnd, locationId),
    equipmentPool(treatmentSlug, dayStart, dayEnd, locationId),
  ]);
  if (closures.some((cl) => start.getTime() < cl.endAt.getTime() && end.getTime() > cl.startAt.getTime())) return false;
  if (!poolFree(rooms, start, endBufferedMs)) return false;
  if (!poolFree(equip, start, endBufferedMs)) return false;

  const enforce = treatmentSlug ? await getSetting('enforce_staff_availability') : false;
  if (enforce && treatmentSlug) {
    const clinicians = await cliniciansForDay(treatmentSlug, dayStart, dayEnd);
    if (clinicians.length) return clinicians.some((c) => clinicianFree(c, start, end, start.getDay(), bufferMin, locationId));
  }

  // Single-resource fallback — buffer-aware overlap check.
  const sameDay = await db.booking.findMany({
    where: { status: { in: ['PENDING', 'CONFIRMED'] }, startAt: { gte: dayStart, lte: dayEnd }, ...(locationId ? { locationId } : {}) },
    select: { startAt: true, endAt: true, bufferMin: true },
  });
  return !sameDay.some((b) => start.getTime() < busyEnd(b) && endBufferedMs > b.startAt.getTime());
}
