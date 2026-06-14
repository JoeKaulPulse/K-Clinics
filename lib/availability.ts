import 'server-only';
import { db } from './db';
import { site } from './site';
import { getSetting } from './settings';
import { bookingFor, getTreatment } from './treatments';
import { clinicWallTimeToUTC, clinicMinutesOfDay, clinicDateISO, clinicDayOfWeek, clinicDayBounds } from './clinic-time';

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
  const startM = clinicMinutesOfDay(start); // clinic-local minutes; schedules are wall-clock
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

/** Free treatment rooms matching the required capability tag. When `equipSlug`
 *  is given (equipment-tied-to-room mode), only rooms physically holding that
 *  equipment qualify. Returns null when no rooms are configured for the tag at
 *  all (requirement not enforced); an empty pool (→ no slots) when rooms exist
 *  for the tag but none hold the required equipment. */
async function roomPool(roomTag: string | null, equipSlug: string | undefined, dayStart: Date, dayEnd: Date, locationId?: string | null): Promise<Pool | null> {
  if (!roomTag) return null;
  const locWhere = locationId ? { OR: [{ locationId: null }, { locationId }] } : {};
  const anyRoom = await db.resource.count({ where: { kind: 'ROOM', active: true, tags: { has: roomTag }, ...locWhere } });
  if (!anyRoom) return null; // rooms not configured for this category → don't enforce
  const resources = await db.resource.findMany({
    where: {
      kind: 'ROOM', active: true, tags: { has: roomTag },
      ...(equipSlug ? { equipment: { some: { kind: 'EQUIPMENT', active: true, slug: equipSlug } } } : {}),
      ...locWhere,
    },
    select: { id: true, capacity: true },
  });
  const pool = await loadPool(resources, dayStart, dayEnd); // may be empty → blocks the slot
  // BLD-198: a scheduled room closure occupies the room like a booking, so a
  // blocked room drops out of availability for any overlapping slot.
  const closures = await db.roomClosure.findMany({
    where: { roomId: { in: resources.map((r) => r.id) }, startAt: { lt: dayEnd }, endAt: { gt: dayStart } },
    select: { roomId: true, startAt: true, endAt: true, endedEarlyAt: true },
  });
  for (const c of closures) {
    const effEnd = c.endedEarlyAt && c.endedEarlyAt < c.endAt ? c.endedEarlyAt : c.endAt;
    if (effEnd.getTime() > dayStart.getTime()) pool.bookings.push({ startAt: c.startAt, endAt: effEnd, bufferMin: 0, resIds: [c.roomId] });
  }
  return pool;
}

/** Equipment slug to require inside the room, only when binding is on. */
function boundEquipSlug(binding: boolean, treatmentSlug?: string): string | undefined {
  return binding && treatmentSlug ? bookingFor(treatmentSlug).requiresResource : undefined;
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return [];
  const dow = clinicDayOfWeek(dateISO);
  const hours = site.hours.find((h) => h.day === DOW[dow]);
  if (!hours || hours.open === 'Closed') return [];
  const open = parseHM(hours.open);
  const close = parseHM(hours.close);
  if (open == null || close == null) return [];

  const { dayStart, dayEnd } = clinicDayBounds(dateISO);

  const bufferMin = treatmentSlug ? (bookingFor(treatmentSlug).bufferMin ?? 0) : 0;
  const [enforce, binding] = await Promise.all([
    treatmentSlug ? getSetting('enforce_staff_availability') : Promise.resolve(false),
    treatmentSlug ? getSetting('room_equipment_binding') : Promise.resolve(false),
  ]);
  const [clinicians, closures, rooms, equip] = await Promise.all([
    enforce && treatmentSlug ? cliniciansForDay(treatmentSlug, dayStart, dayEnd) : Promise.resolve([] as Clinician[]),
    dayClosures(dayStart, dayEnd, locationId),
    roomPool(roomTagFor(treatmentSlug), boundEquipSlug(binding, treatmentSlug), dayStart, dayEnd, locationId),
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
    const start = clinicWallTimeToUTC(dateISO, m); // wall-clock minute → correct UTC instant
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

// How close (minutes) a free slot must sit to an existing booking — beyond the
// cleanup buffer — to count as "preferred". Encourages clustering a clinician's
// day into a contiguous block instead of leaving idle gaps (e.g. one at 9am and
// one at 5pm).
const CLUSTER_GAP_MIN = 30;

/**
 * Free slots for a date, with a "preferred" subset highlighted. A slot is
 * preferred when it can be served by a clinician who already has a booking that
 * day and sits adjacent to it (within the cleanup buffer + a small tolerance) —
 * so bookings cluster together and staff aren't left idle between appointments.
 * When staff enforcement is off, adjacency is measured against the day's
 * bookings clinic-wide.
 */
export async function recommendedSlots(dateISO: string, durationMin: number, treatmentSlug?: string, locationId?: string | null): Promise<{ slots: string[]; preferred: string[] }> {
  const slots = await freeSlots(dateISO, durationMin, treatmentSlug, locationId);
  if (slots.length === 0) return { slots, preferred: [] };

  const dow = clinicDayOfWeek(dateISO);
  const { dayStart, dayEnd } = clinicDayBounds(dateISO);
  const bufferMin = treatmentSlug ? (bookingFor(treatmentSlug).bufferMin ?? 0) : 0;
  const tolMs = (bufferMin + CLUSTER_GAP_MIN) * 60_000;

  // Non-overlapping gap (ms) between a slot [s,e] and a booking [bs,be]; -1 if overlapping.
  const gap = (s: number, e: number, bs: number, be: number) => (s >= be ? s - be : bs >= e ? bs - e : -1);
  const adjacent = (s: number, e: number, bs: number, be: number) => { const g = gap(s, e, bs, be); return g >= 0 && g <= tolMs; };

  const enforce = treatmentSlug ? await getSetting('enforce_staff_availability') : false;
  const preferred: string[] = [];

  if (enforce && treatmentSlug) {
    const clinicians = await cliniciansForDay(treatmentSlug, dayStart, dayEnd);
    for (const iso of slots) {
      const s = new Date(iso); const e = new Date(s.getTime() + durationMin * 60_000);
      const ok = clinicians.some((c) =>
        c.bookings.length > 0 &&
        clinicianFree(c, s, e, dow, bufferMin, locationId) &&
        c.bookings.some((b) => adjacent(s.getTime(), e.getTime(), b.startAt.getTime(), b.endAt.getTime())));
      if (ok) preferred.push(iso);
    }
  } else {
    const bookings = await db.booking.findMany({
      where: { status: { in: ['PENDING', 'CONFIRMED'] }, startAt: { gte: dayStart, lte: dayEnd }, ...(locationId ? { locationId } : {}) },
      select: { startAt: true, endAt: true },
    });
    for (const iso of slots) {
      const s = new Date(iso); const e = new Date(s.getTime() + durationMin * 60_000);
      if (bookings.some((b) => adjacent(s.getTime(), e.getTime(), b.startAt.getTime(), b.endAt.getTime()))) preferred.push(iso);
    }
  }
  return { slots, preferred };
}

/** Upcoming dates that already have bookings AND still have availability — used
 *  to nudge new bookings onto days the clinic is already open/staffed for, so
 *  appointments cluster onto fewer days. Returns up to `limit` soonest dates. */
export async function popularDays(durationMin: number, treatmentSlug?: string, locationId?: string | null, withinDays = 21, limit = 6): Promise<string[]> {
  const from = new Date(); from.setHours(0, 0, 0, 0);
  const to = new Date(from); to.setDate(to.getDate() + withinDays);
  const bookings = await db.booking.findMany({
    where: { status: { in: ['PENDING', 'CONFIRMED'] }, startAt: { gte: from, lt: to }, ...(locationId ? { locationId } : {}) },
    select: { startAt: true },
  });
  const days = [...new Set(bookings.map((b) => clinicDateISO(b.startAt)))].sort();
  const out: string[] = [];
  // Bound the availability checks for cost; days are already sorted soonest-first.
  // Run them concurrently (per-request getSetting cache dedupes the shared reads)
  // then take the soonest `limit` with availability, preserving order.
  const candidates = days.slice(0, 12);
  const have = await Promise.all(candidates.map((d) => freeSlots(d, durationMin, treatmentSlug, locationId)));
  for (let i = 0; i < candidates.length && out.length < limit; i++) {
    if (have[i].length) out.push(candidates[i]);
  }
  return out;
}

/** Pick a competent, free clinician for a slot (auto-assign), optionally at a location. */
export async function pickPractitioner(startISO: string, durationMin: number, treatmentSlug: string, locationId?: string | null): Promise<string | null> {
  const start = new Date(startISO);
  if (isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + durationMin * 60_000);
  const dateISO = clinicDateISO(start);
  const { dayStart, dayEnd } = clinicDayBounds(dateISO);
  const bufferMin = bookingFor(treatmentSlug).bufferMin ?? 0;
  const clinicians = await cliniciansForDay(treatmentSlug, dayStart, dayEnd);
  const free = clinicians.find((c) => clinicianFree(c, start, end, clinicDayOfWeek(dateISO), bufferMin, locationId));
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
  const { dayStart, dayEnd } = clinicDayBounds(clinicDateISO(start));

  const binding = await getSetting('room_equipment_binding');
  const [rooms, equip] = await Promise.all([
    roomPool(roomTagFor(treatmentSlug), boundEquipSlug(binding, treatmentSlug), dayStart, dayEnd, locationId),
    equipmentPool(treatmentSlug, dayStart, dayEnd, locationId),
  ]);
  const ids: string[] = [];
  const room = rooms && pickFromPool(rooms, start, endBufferedMs);
  if (room) ids.push(room);
  const machine = equip && pickFromPool(equip, start, endBufferedMs);
  if (machine) ids.push(machine);
  return ids;
}

/**
 * Validate a proposed start is still free (used at create time).
 *
 * `opts.leadMinutes` overrides the public 2-hour online-booking lead window
 * (BLD-192): staff phone/walk-in bookings pass a small *negative* grace so
 * reception can log a client who has just arrived, and admin reschedules pass 0
 * so they can move an appointment to any free time. Public flows omit it and
 * keep the full 2-hour notice.
 */
export async function isSlotFree(startISO: string, durationMin: number, treatmentSlug?: string, locationId?: string | null, opts?: { leadMinutes?: number }): Promise<boolean> {
  const start = new Date(startISO);
  if (isNaN(start.getTime())) return false;
  const end = new Date(start.getTime() + durationMin * 60_000);
  const dateISO = clinicDateISO(start);

  const hours = site.hours.find((h) => h.day === DOW[clinicDayOfWeek(dateISO)]);
  if (!hours || hours.open === 'Closed') return false;
  const open = parseHM(hours.open), close = parseHM(hours.close);
  const startM = clinicMinutesOfDay(start); // clinic-local minutes-of-day
  if (open == null || close == null || startM < open || startM + durationMin > close) return false;
  const leadMinutes = opts?.leadMinutes ?? LEAD_MINUTES;
  if (start.getTime() < Date.now() + leadMinutes * 60_000) return false;

  const { dayStart, dayEnd } = clinicDayBounds(dateISO);
  const bufferMin = treatmentSlug ? (bookingFor(treatmentSlug).bufferMin ?? 0) : 0;
  const endBufferedMs = end.getTime() + bufferMin * 60_000;

  const binding = treatmentSlug ? await getSetting('room_equipment_binding') : false;
  const [closures, rooms, equip] = await Promise.all([
    dayClosures(dayStart, dayEnd, locationId),
    roomPool(roomTagFor(treatmentSlug), boundEquipSlug(binding, treatmentSlug), dayStart, dayEnd, locationId),
    equipmentPool(treatmentSlug, dayStart, dayEnd, locationId),
  ]);
  if (closures.some((cl) => start.getTime() < cl.endAt.getTime() && end.getTime() > cl.startAt.getTime())) return false;
  if (!poolFree(rooms, start, endBufferedMs)) return false;
  if (!poolFree(equip, start, endBufferedMs)) return false;

  const enforce = treatmentSlug ? await getSetting('enforce_staff_availability') : false;
  if (enforce && treatmentSlug) {
    const clinicians = await cliniciansForDay(treatmentSlug, dayStart, dayEnd);
    if (clinicians.length) return clinicians.some((c) => clinicianFree(c, start, end, clinicDayOfWeek(dateISO), bufferMin, locationId));
  }

  // Single-resource fallback — buffer-aware overlap check.
  const sameDay = await db.booking.findMany({
    where: { status: { in: ['PENDING', 'CONFIRMED'] }, startAt: { gte: dayStart, lte: dayEnd }, ...(locationId ? { locationId } : {}) },
    select: { startAt: true, endAt: true, bufferMin: true },
  });
  return !sameDay.some((b) => start.getTime() < busyEnd(b) && endBufferedMs > b.startAt.getTime());
}
