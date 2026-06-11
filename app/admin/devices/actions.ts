'use server';

import { revalidatePath } from 'next/cache';
import { getSession, sessionCan } from '@/lib/auth';

// BLD-195 — manage the clinic's device registry (card terminals, displays,
// kiosks, printers). Settings-managers only.

const KINDS = ['TERMINAL', 'DISPLAY', 'KIOSK', 'SCANNER', 'PRINTER', 'OTHER'];

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
}) {
  if (!(await guard())) return { ok: false as const, error: 'You don’t have permission to manage devices.' };
  const name = (input.name || '').trim();
  if (!name) return { ok: false as const, error: 'Give the device a name.' };
  const kind = KINDS.includes(input.kind) ? (input.kind as 'TERMINAL') : 'TERMINAL';
  const clean = (v?: string) => { const s = (v || '').trim(); return s === '' ? null : s; };
  // Provider only applies to terminals.
  const provider = kind === 'TERMINAL' ? clean(input.provider) : null;
  const station = input.station === 'reception' || input.station === 'room' ? input.station : null;

  const { db } = await import('@/lib/db');
  const data = { name, kind, provider, externalId: clean(input.externalId), location: clean(input.location), station, notes: clean(input.notes) };
  if (input.id) await db.device.update({ where: { id: input.id }, data });
  else await db.device.create({ data });

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
