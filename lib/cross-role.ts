import 'server-only';
import { db } from '@/lib/db';

// PRJ-63.11 — cross-role interactions. Turning a finished treatment into a clean
// handoff between roles: when a clinician completes a session, the room they used
// is flagged for turnover and front-of-house / cleaners (rooms.prep.manage) are
// pinged. All best-effort: a notification or prep update must never break the
// session-complete write that triggered it.

/**
 * Hand a room over for cleaning after a clinician completes a session: set the
 * room to DIRTY for today and notify everyone who manages room prep. No-op if the
 * booking has no assigned room. Returns the room name handed over, if any.
 */
export async function handleSessionTurnover(bookingId: string, actorEmail: string): Promise<{ room: string | null; pinged: number }> {
  try {
    const room = await db.resource.findFirst({
      where: { kind: 'ROOM', bookings: { some: { id: bookingId } } },
      select: { id: true, name: true },
    });
    if (!room) return { room: null, pinged: 0 };

    const booking = await db.booking.findUnique({ where: { id: bookingId }, select: { treatmentTitle: true } });
    const { setRoomPrep, clinicDay } = await import('@/lib/room-prep');
    // Mark the room as needing cleaning (not READY) so the live board shows it.
    await setRoomPrep(room.id, clinicDay(), 'DIRTY', actorEmail, 'Turnover after session').catch(() => {});

    const { notifyStaffByPermission } = await import('@/lib/notifications');
    const pinged = await notifyStaffByPermission(
      'rooms.prep.manage',
      { kind: 'system', title: `${room.name} needs turnover`, body: booking?.treatmentTitle ? `After ${booking.treatmentTitle}. Tap to set it ready when cleaned.` : 'Tap to set it ready when cleaned.', href: '/admin/my-day' },
      actorEmail,
    );

    try {
      const { logAudit } = await import('@/lib/audit');
      await logAudit({ action: 'ROOM_TURNOVER', actor: actorEmail, bookingId, summary: `Room ${room.name} flagged for turnover after session`, meta: { roomId: room.id } });
    } catch { /* non-fatal */ }

    return { room: room.name, pinged };
  } catch (e) {
    console.error('[cross-role] turnover failed (non-fatal):', (e as Error)?.message);
    return { room: null, pinged: 0 };
  }
}
