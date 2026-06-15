'use server';

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { getSession, sessionCan } from '@/lib/auth';

// BLD-195 — manage the clinic's device registry (card terminals, displays,
// kiosks, printers). Settings-managers only.

const KINDS = ['TERMINAL', 'DISPLAY', 'KIOSK', 'SCANNER', 'PRINTER', 'OTHER'] as const;
type Kind = (typeof KINDS)[number];

async function guard() {
  const session = await getSession();
  if (!session || !sessionCan(session, 'settings.manage')) return null;
  return session;
}

export async function saveDevice(input: {
  id?: string;
  name: string;
  kind: string;
  provider?: string;
  externalId?: string;
  location?: string;
  station?: string;
  notes?: string;
  roomId?: string;
}) {
  if (!(await guard())) return { ok: false as const, error: 'You don’t have permission to manage devices.' };
  const name = (input.name || '').trim();
  if (!name) return { ok: false as const, error: 'Give the device a name.' };
  const kind: Kind = (KINDS as readonly string[]).includes(input.kind) ? (input.kind as Kind) : 'TERMINAL';
  const clean = (v?: string) => { const s = (v || '').trim(); return s === '' ? null : s; };
  // Provider only applies to terminals.
  const provider = kind === 'TERMINAL' ? clean(input.provider) : null;
  const station = input.station === 'reception' || input.station === 'room' ? input.station : null;

  // BLD-225 — a room display points at a room (Resource id) + carries a token
  // for its public /room-display/<token> URL (minted once, kept stable).
  const roomId = kind === 'DISPLAY' ? clean(input.roomId) : null;
  const { db } = await import('@/lib/db');
  const data = { name, kind, provider, externalId: clean(input.externalId), location: clean(input.location), station, notes: clean(input.notes), roomId };
  if (input.id) {
    if (kind === 'DISPLAY') { const cur = await db.device.findUnique({ where: { id: input.id }, select: { token: true } }); if (!cur?.token) (data as { token?: string }).token = randomUUID(); }
    await db.device.update({ where: { id: input.id }, data });
  } else {
    if (kind === 'DISPLAY') (data as { token?: string }).token = randomUUID();
    await db.device.create({ data });
  }

  revalidatePath('/admin/devices');
  return { ok: true as const };
}

export async function setDeviceActive(id: string, active: boolean) {
  if (!(await guard())) return { ok: false as const, error: 'Not permitted' };
  const { db } = await import('@/lib/db');
  await db.device.update({ where: { id }, data: { active } });
  revalidatePath('/admin/devices');
  return { ok: true as const };
}

export async function deleteDevice(id: string) {
  if (!(await guard())) return { ok: false as const, error: 'Not permitted' };
  const { db } = await import('@/lib/db');
  await db.device.delete({ where: { id } });
  revalidatePath('/admin/devices');
  return { ok: true as const };
}
