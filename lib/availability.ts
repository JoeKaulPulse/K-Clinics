import 'server-only';
import { db } from './db';
import { site } from './site';

const SLOT_INTERVAL = Number(process.env.SLOT_INTERVAL_MIN || 15);
const LEAD_MINUTES = 120; // earliest bookable time from now

// site.hours uses day names; map JS getDay() (0=Sun) to them.
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseHM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/**
 * Free start-times (ISO strings) for a given date + treatment duration.
 * Single-resource model: a candidate slot is free if no active booking overlaps
 * [start, start+duration).
 */
export async function freeSlots(dateISO: string, durationMin: number): Promise<string[]> {
  const date = new Date(dateISO + 'T00:00:00');
  if (isNaN(date.getTime())) return [];

  const dayName = DOW[date.getDay()];
  const hours = site.hours.find((h) => h.day === dayName);
  if (!hours || hours.open === 'Closed') return [];

  const open = parseHM(hours.open);
  const close = parseHM(hours.close);
  if (open == null || close == null) return [];

  // Existing active bookings on this day.
  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);
  const bookings = await db.booking.findMany({
    where: {
      status: { in: ['PENDING', 'CONFIRMED'] },
      startAt: { gte: dayStart, lte: dayEnd },
    },
    select: { startAt: true, endAt: true },
  });

  const now = Date.now();
  const minStart = now + LEAD_MINUTES * 60_000;
  const slots: string[] = [];

  for (let m = open; m + durationMin <= close; m += SLOT_INTERVAL) {
    const start = new Date(date); start.setHours(0, m, 0, 0);
    const end = new Date(start.getTime() + durationMin * 60_000);
    if (start.getTime() < minStart) continue;

    const overlaps = bookings.some((b) => start < b.endAt && end > b.startAt);
    if (!overlaps) slots.push(start.toISOString());
  }
  return slots;
}

/** Validate that a proposed start is still free (used at create time). */
export async function isSlotFree(startISO: string, durationMin: number): Promise<boolean> {
  const start = new Date(startISO);
  if (isNaN(start.getTime())) return false;
  const end = new Date(start.getTime() + durationMin * 60_000);

  // Must be within opening hours.
  const dayName = DOW[start.getDay()];
  const hours = site.hours.find((h) => h.day === dayName);
  if (!hours || hours.open === 'Closed') return false;
  const open = parseHM(hours.open), close = parseHM(hours.close);
  const startM = start.getHours() * 60 + start.getMinutes();
  if (open == null || close == null || startM < open || startM + durationMin > close) return false;

  if (start.getTime() < Date.now() + LEAD_MINUTES * 60_000) return false;

  const clash = await db.booking.findFirst({
    where: {
      status: { in: ['PENDING', 'CONFIRMED'] },
      startAt: { lt: end },
      endAt: { gt: start },
    },
    select: { id: true },
  });
  return !clash;
}
