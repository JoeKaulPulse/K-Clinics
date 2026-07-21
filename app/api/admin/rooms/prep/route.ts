import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUSES = ['DIRTY', 'CLEANING', 'READY'] as const;

// PRJ-63.8 — read room availability + prep state (polled live by RoomPrepStatus),
// and set a room's prep state. Reading needs bookings/calendar visibility; setting
// needs rooms.prep.manage.
export async function GET(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'Not signed in.' }, { status: 401 });
  if (!sessionCan(session, 'rooms.prep.manage') && !sessionCan(session, 'bookings.view') && !sessionCan(session, 'calendar.view')) {
    return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
  }
  const url = new URL(req.url);
  const locationId = url.searchParams.get('locationId');
  try {
    const { getRoomsForDay } = await import('@/lib/room-prep');
    const rooms = await getRoomsForDay({ locationId });
    return NextResponse.json({ ok: true, rooms, canManage: sessionCan(session, 'rooms.prep.manage') }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not load rooms.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'Not signed in.' }, { status: 401 });
  if (!sessionCan(session, 'rooms.prep.manage')) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const roomId = typeof body.roomId === 'string' ? body.roomId : '';
  if (!roomId) return NextResponse.json({ ok: false, error: 'Bad request.' }, { status: 400 });

  // Manual occupancy toggle (BLD-506) — orthogonal to the prep/cleanliness state,
  // so it carries its own field rather than a prep status.
  if (typeof body.occupied === 'boolean') {
    try {
      const { setRoomOccupied, clinicDay } = await import('@/lib/room-prep');
      await setRoomOccupied(roomId, clinicDay(), body.occupied, session.email);
      return NextResponse.json({ ok: true, occupied: body.occupied });
    } catch {
      return NextResponse.json({ ok: false, error: 'Could not update the room.' }, { status: 500 });
    }
  }

  const status = body.status;
  if (!STATUSES.includes(status)) return NextResponse.json({ ok: false, error: 'Bad request.' }, { status: 400 });
  const note = typeof body.note === 'string' ? body.note.slice(0, 300) : undefined;

  try {
    const { setRoomPrep, clinicDay } = await import('@/lib/room-prep');
    await setRoomPrep(roomId, clinicDay(), status, session.email, note);
    return NextResponse.json({ ok: true, status });
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not update the room.' }, { status: 500 });
  }
}
