import 'server-only';
import { db } from '@/lib/db';

// PRJ-63.8 — Room availability & prep-status service. Shared backbone for the
// clinician + receptionist views and the dashboard arrival-prep checklist.
//
//   • Prep state is one RoomPrep row per room per clinic day (upsert by the
//     compound (roomId, date) unique). Default DIRTY until someone sets it.
//   • Availability is derived live from Resource (kind ROOM) + the day's bookings
//     that hold the room — no extra state to keep in sync.
// Permission-safe: callers gate on `rooms.prep.manage`; the board carries only a
// short client display name + treatment (front-of-house data), never clinical fields.

export type RoomPrepState = 'DIRTY' | 'CLEANING' | 'READY';

export type RoomBookingLite = {
  id: string;
  startIso: string;
  endIso: string;
  timeLabel: string;
  client: string;
  treatment: string;
};

export type RoomDay = {
  id: string;
  name: string;
  slug: string;
  floor: string | null;
  tags: string[];
  prep: RoomPrepState;
  cleanedAt: string | null;
  cleanedBy: string | null;
  note: string | null;
  occupiedNow: boolean; // a live booking is in the room right now
  occupiedManual: boolean; // staff marked the room occupied (BLD-506)
  occupiedBy: string | null; // staff email who marked it occupied
  current: RoomBookingLite | null;
  next: RoomBookingLite | null;
};

/** The London calendar date as a UTC-midnight Date, for @db.Date storage/lookup. */
export function clinicDay(d: Date = new Date()): Date {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  return new Date(`${ymd}T00:00:00.000Z`);
}

const shortName = (first?: string | null, last?: string | null) =>
  [first ?? '', last ? `${last[0]}.` : ''].join(' ').trim() || 'Client';

const hhmm = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });

function lite(b: { id: string; startAt: Date; endAt: Date; treatmentTitle: string; client: { firstName: string | null; lastName: string | null } }): RoomBookingLite {
  return {
    id: b.id,
    startIso: b.startAt.toISOString(),
    endIso: b.endAt.toISOString(),
    timeLabel: hhmm(b.startAt),
    client: shortName(b.client.firstName, b.client.lastName),
    treatment: b.treatmentTitle,
  };
}

/** Set (upsert) a room's prep state for a day. Stamps cleanedAt/by on READY. */
export async function setRoomPrep(roomId: string, date: Date, status: RoomPrepState, by: string, note?: string | null) {
  const ready = status === 'READY';
  return db.roomPrep.upsert({
    where: { roomId_date: { roomId, date } },
    create: { roomId, date, status, note: note ?? null, cleanedAt: ready ? new Date() : null, cleanedBy: ready ? by : null },
    update: { status, ...(note !== undefined ? { note } : {}), cleanedAt: ready ? new Date() : null, cleanedBy: ready ? by : null },
  });
}

/** Mark a room manually occupied/vacant for a day (BLD-506). Orthogonal to the
 *  prep/cleanliness state — it only sets the occupancy flag + who/when. */
export async function setRoomOccupied(roomId: string, date: Date, occupied: boolean, by: string) {
  return db.roomPrep.upsert({
    where: { roomId_date: { roomId, date } },
    create: { roomId, date, status: 'DIRTY', occupied, occupiedAt: occupied ? new Date() : null, occupiedBy: occupied ? by : null },
    update: { occupied, occupiedAt: occupied ? new Date() : null, occupiedBy: occupied ? by : null },
  });
}

/** Clear the manual "occupied" flag on every room a booking holds, for the clinic
 *  day — called when a booking finishes so the room screen returns to Available
 *  without staff having to tap Vacant (BLD-506). Best-effort, idempotent. */
export async function clearOccupiedForBooking(bookingId: string, date: Date = clinicDay()): Promise<void> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { resources: { where: { kind: 'ROOM' }, select: { id: true } } },
  });
  const roomIds = booking?.resources.map((r) => r.id) ?? [];
  if (roomIds.length === 0) return;
  await db.roomPrep.updateMany({
    where: { roomId: { in: roomIds }, date, occupied: true },
    data: { occupied: false, occupiedAt: null, occupiedBy: null },
  });
}

/** Rooms for a clinic day with their prep state + live availability (occupied
 *  now, current + next booking). `now` is injectable for testing. */
export async function getRoomsForDay(opts: { locationId?: string | null; date?: Date; now?: Date } = {}): Promise<RoomDay[]> {
  const now = opts.now ?? new Date();
  const date = opts.date ?? clinicDay(now);
  const dayStart = new Date(date); // UTC midnight of the clinic day
  const dayEnd = new Date(date.getTime() + 24 * 60 * 60 * 1000 - 1);

  const rooms = await db.resource.findMany({
    where: { kind: 'ROOM', active: true, ...(opts.locationId ? { locationId: opts.locationId } : {}) },
    orderBy: [{ floor: 'asc' }, { name: 'asc' }],
    include: { roomPreps: { where: { date } } },
  });
  if (rooms.length === 0) return [];

  const roomIds = rooms.map((r) => r.id);
  const bookings = await db.booking.findMany({
    where: {
      startAt: { gte: dayStart, lte: dayEnd },
      status: { in: ['PENDING', 'CONFIRMED'] },
      resources: { some: { id: { in: roomIds } } },
    },
    orderBy: { startAt: 'asc' },
    select: {
      id: true, startAt: true, endAt: true, bufferMin: true, finishedAt: true, treatmentTitle: true,
      client: { select: { firstName: true, lastName: true } },
      resources: { select: { id: true } },
    },
  });

  return rooms.map((room) => {
    const mine = bookings.filter((b) => b.resources.some((r) => r.id === room.id));
    // Occupied now: an unfinished booking whose busy window [start, end+buffer] contains `now`.
    const currentBk = mine.find((b) => !b.finishedAt && b.startAt <= now && new Date(b.endAt.getTime() + b.bufferMin * 60000) > now) ?? null;
    const nextBk = mine.find((b) => b.startAt > now) ?? null;
    const prep = room.roomPreps[0];
    return {
      id: room.id,
      name: room.name,
      slug: room.slug,
      floor: room.floor,
      tags: room.tags ?? [],
      prep: (prep?.status ?? 'DIRTY') as RoomPrepState,
      cleanedAt: prep?.cleanedAt ? prep.cleanedAt.toISOString() : null,
      cleanedBy: prep?.cleanedBy ?? null,
      note: prep?.note ?? null,
      occupiedNow: !!currentBk,
      occupiedManual: !!prep?.occupied,
      occupiedBy: prep?.occupiedBy ?? null,
      current: currentBk ? lite(currentBk) : null,
      next: nextBk ? lite(nextBk) : null,
    };
  });
}

/** Prep state for a single room on a day (DIRTY if unset). For the arrival card. */
export async function getRoomPrepFor(roomId: string, date: Date = clinicDay()): Promise<{ status: RoomPrepState; cleanedBy: string | null }> {
  const row = await db.roomPrep.findUnique({ where: { roomId_date: { roomId, date } }, select: { status: true, cleanedBy: true } });
  return { status: (row?.status ?? 'DIRTY') as RoomPrepState, cleanedBy: row?.cleanedBy ?? null };
}
