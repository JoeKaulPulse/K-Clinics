import 'server-only';
import { db } from './db';
import { site } from './site';
import { getSetting } from './settings';
import { bookingFor } from './treatments';

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

type ResourceCtx = { capacity: number; bookings: { startAt: Date; endAt: Date; bufferMin: number }[] };

/** Resource (room/equipment) context for a treatment that requires one. Returns
 *  null when nothing needs enforcing (no required slug, or none configured). */
async function resourceContext(slug: string | undefined, dayStart: Date, dayEnd: Date, locationId?: string | null): Promise<ResourceCtx | null> {
  const required = slug ? bookingFor(slug).requiresResource : undefined;
  if (!required) return null;
  const resources = await db.resource.findMany({
    where: { slug: required, active: true, ...(locationId ? { OR: [{ locationId: null }, { locationId }] } : {}) },
    select: { id: true, capacity: true },
  });
  if (!resources.length) return null; // not configured → don't block
  const capacity = resources.reduce((s, r) => s + r.capacity, 0);
  const bookings = await db.booking.findMany({
    where: { resourceId: { in: resources.map((r) => r.id) }, status: { in: ['PENDING', 'CONFIRMED'] }, startAt: { lt: dayEnd }, endAt: { gt: dayStart } },
    select: { startAt: true, endAt: true, bufferMin: true },
  });
  return { capacity, bookings };
}

function resourceFree(ctx: ResourceCtx | null, start: Date, endBufferedMs: number): boolean {
  if (!ctx) return true;
  const overlapping = ctx.bookings.filter((b) => start.getTime() < busyEnd(b) && endBufferedMs > b.startAt.getTime()).length;
  return overlapping < ctx.capacity;
}

/**
 * Free start-times (ISO) for a date + treatment. A slot is offered only when it
 * fits opening hours and lead time, is outside any clinic closure, has resource
 * capacity, and — when staff availability is enforced — at least one competent
 * clinician is working and free (schedule, break, time-off & clashes, all
 * buffer-aware). Otherwise a single-resource model (no overlapping booking).
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
  const [clinicians, closures, resCtx] = await Promise.all([
    enforce && treatmentSlug ? cliniciansForDay(treatmentSlug, dayStart, dayEnd) : Promise.resolve([] as Clinician[]),
    dayClosures(dayStart, dayEnd, locationId),
    resourceContext(treatmentSlug, dayStart, dayEnd, locationId),
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
    // Clinic closure?
    if (closures.some((cl) => start.getTime() < cl.endAt.getTime() && end.getTime() > cl.startAt.getTime())) continue;
    // Resource capacity?
    if (!resourceFree(resCtx, start, endBufferedMs)) continue;

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

/** Pick a resource (room/equipment) with free capacity for a slot, if the
 *  treatment requires one. Returns the resource id to hold, or null. */
export async function pickResource(startISO: string, durationMin: number, treatmentSlug: string, locationId?: string | null): Promise<string | null> {
  const required = bookingFor(treatmentSlug).requiresResource;
  if (!required) return null;
  const start = new Date(startISO);
  if (isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + durationMin * 60_000);
  const bufferMin = bookingFor(treatmentSlug).bufferMin ?? 0;
  const endBufferedMs = end.getTime() + bufferMin * 60_000;

  const resources = await db.resource.findMany({
    where: { slug: required, active: true, ...(locationId ? { OR: [{ locationId: null }, { locationId }] } : {}) },
    select: { id: true, capacity: true },
    orderBy: { capacity: 'desc' },
  });
  for (const r of resources) {
    const used = await db.booking.count({
      where: { resourceId: r.id, status: { in: ['PENDING', 'CONFIRMED'] }, startAt: { lt: new Date(endBufferedMs) }, endAt: { gt: start } },
    });
    if (used < r.capacity) return r.id;
  }
  return null;
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

  // Clinic closure?
  const closures = await dayClosures(dayStart, dayEnd, locationId);
  if (closures.some((cl) => start.getTime() < cl.endAt.getTime() && end.getTime() > cl.startAt.getTime())) return false;

  // Resource capacity?
  if (!resourceFree(await resourceContext(treatmentSlug, dayStart, dayEnd, locationId), start, endBufferedMs)) return false;

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
