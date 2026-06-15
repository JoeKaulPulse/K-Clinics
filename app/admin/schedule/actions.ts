'use server';

import { revalidatePath } from 'next/cache';
import { getSession, sessionCan } from '@/lib/auth';

// BLD-198 — schedule per-room block-outs (e.g. a contractor on site). A closure
// removes the room from availability for its window; ending it marks the room
// DIRTY so a cleaning is required before the next client session.

async function guard() {
  const session = await getSession();
  if (!session || !sessionCan(session, 'schedule.manage')) return null;
  return session;
}

const dayOnly = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

async function markDirty(roomId: string, day: Date, note: string) {
  const { db } = await import('@/lib/db');
  const date = dayOnly(day);
  await db.roomPrep.upsert({
    where: { roomId_date: { roomId, date } },
    create: { roomId, date, status: 'DIRTY', note },
    update: { status: 'DIRTY', cleanedAt: null, cleanedBy: null, note },
  }).catch(() => {});
}

export async function createRoomClosure(input: { roomId: string; startISO: string; endISO: string; reason?: string }) {
  const session = await guard();
  if (!session) return { ok: false as const, error: 'You don’t have permission to manage rooms.' };
  const start = new Date(input.startISO);
  const end = new Date(input.endISO);
  if (isNaN(+start) || isNaN(+end)) return { ok: false as const, error: 'Enter valid start and end times.' };
  if (end <= start) return { ok: false as const, error: 'The end must be after the start.' };

  const { db } = await import('@/lib/db');
  const room = await db.resource.findFirst({ where: { id: input.roomId, kind: 'ROOM' }, select: { id: true } });
  if (!room) return { ok: false as const, error: 'Unknown room.' };

  await db.roomClosure.create({ data: { roomId: room.id, startAt: start, endAt: end, reason: (input.reason || '').trim() || null, createdBy: session.email } });
  // Cleaning gate: the day the room reopens needs a turnover before reuse.
  await markDirty(room.id, end, 'Needs cleaning after a room block-out');
  try { const { logAudit } = await import('@/lib/audit'); await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: `Room blocked out (${input.reason || 'no reason'})`, meta: { roomId: room.id, startISO: input.startISO, endISO: input.endISO } }); } catch { /* non-fatal */ }
  revalidatePath('/admin/schedule');
  return { ok: true as const };
}

export async function endRoomClosureEarly(id: string) {
  const session = await guard();
  if (!session) return { ok: false as const, error: 'Not permitted' };
  const { db } = await import('@/lib/db');
  const c = await db.roomClosure.findUnique({ where: { id }, select: { roomId: true, endedEarlyAt: true } });
  if (!c) return { ok: false as const, error: 'Closure not found.' };
  if (c.endedEarlyAt) return { ok: true as const };
  await db.roomClosure.update({ where: { id }, data: { endedEarlyAt: new Date(), endedEarlyBy: session.email } });
  await markDirty(c.roomId, new Date(), 'Needs cleaning after a room block-out');
  revalidatePath('/admin/schedule');
  return { ok: true as const };
}

export async function deleteRoomClosure(id: string) {
  const session = await guard();
  if (!session) return { ok: false as const, error: 'Not permitted' };
  const { db } = await import('@/lib/db');
  await db.roomClosure.delete({ where: { id } }).catch(() => {});
  revalidatePath('/admin/schedule');
  return { ok: true as const };
}
