import 'server-only';
import { db, withDbRetry } from '@/lib/db';

// Planned-maintenance windows — scheduled by Claude (ahead of risky work) or by
// an admin, and shown on the Owner/Admin status page. Kept deliberately simple:
// a window has a time range, the services it affects, and an impact note.

export type MaintenanceInput = {
  title: string;
  detail?: string;
  startAt: Date | string;
  endAt: Date | string;
  services?: string[];
  impact?: string;
  createdBy?: string;
};

export async function scheduleMaintenance(input: MaintenanceInput) {
  return db.maintenanceWindow.create({
    data: {
      title: input.title.slice(0, 200),
      detail: input.detail?.slice(0, 4000) || null,
      startAt: new Date(input.startAt),
      endAt: new Date(input.endAt),
      services: (input.services || []).slice(0, 30),
      impact: input.impact?.slice(0, 200) || null,
      createdBy: input.createdBy || 'claude',
    },
  });
}

/** Claude-facing helper: announce a maintenance window ahead of risky work. */
export async function announceMaintenance(input: MaintenanceInput) {
  return scheduleMaintenance({ ...input, createdBy: input.createdBy || 'claude' });
}

export async function cancelMaintenance(id: string) {
  return db.maintenanceWindow.update({ where: { id }, data: { status: 'CANCELLED' } });
}

/** Roll statuses forward by time so the page reflects what's live now, then
 *  return the windows that still matter (active or upcoming, plus recently ended). */
export async function listMaintenance() {
  const now = new Date();
  try {
    // Advance SCHEDULED→ACTIVE and ACTIVE→DONE by clock, best-effort.
    await db.maintenanceWindow.updateMany({ where: { status: 'SCHEDULED', startAt: { lte: now }, endAt: { gt: now } }, data: { status: 'ACTIVE' } });
    await db.maintenanceWindow.updateMany({ where: { status: { in: ['SCHEDULED', 'ACTIVE'] }, endAt: { lte: now } }, data: { status: 'DONE' } });
  } catch { /* non-fatal — display below still works */ }
  const cutoff = new Date(now.getTime() - 7 * 86400000);
  return withDbRetry(() => db.maintenanceWindow.findMany({
    where: { OR: [{ status: { in: ['SCHEDULED', 'ACTIVE'] } }, { endAt: { gte: cutoff } }] },
    orderBy: { startAt: 'asc' },
    take: 50,
  })).catch(() => []);
}

/** Active or imminent (next 24h) window, for surfacing a banner if wanted. */
export async function activeMaintenance() {
  const soon = new Date(Date.now() + 24 * 3600000);
  return withDbRetry(() => db.maintenanceWindow.findFirst({
    where: { status: { in: ['SCHEDULED', 'ACTIVE'] }, startAt: { lte: soon } },
    orderBy: { startAt: 'asc' },
  })).catch(() => null);
}
