import { db } from '@/lib/db';
import { getRoomPrepFor } from '@/lib/room-prep';
import { decClinical } from '@/lib/clinical-crypto';
import { fmtClinicTime, fmtClinicDate } from '@/lib/clinic-time';
import { ArrivalPrep, type NextArrival } from '@/components/admin/ArrivalPrep';

// "Up next — prepare for arrival" (BLD-1002). The next-booking → room →
// room-prep lookup is a genuine 3-step dependency chain (each step needs the
// previous step's id), so it can't be flattened into the dashboard's parallel
// batch — instead it streams in through its own <Suspense> boundary so the
// rest of the page shell (attention banner, quick actions, KPIs) paints
// without waiting on it. Query filters/selects are unchanged from the
// original inline version in app/admin/page.tsx.
export async function NextArrivalWidget({
  canBookings,
  canRoomsPrep,
  canClinical,
  nowIso,
}: {
  canBookings: boolean;
  canRoomsPrep: boolean;
  canClinical: boolean;
  nowIso: string;
}) {
  const now = new Date(nowIso);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const nextBk = canBookings
    ? await db.booking.findFirst({
        where: { startAt: { gte: now }, status: { in: ['CONFIRMED', 'PENDING'] } },
        orderBy: { startAt: 'asc' },
        select: {
          id: true, startAt: true, treatmentTitle: true, refreshments: true, clientId: true,
          client: { select: { firstName: true, lastName: true, allergies: true, medicalFlag: true } },
          practitioner: { select: { name: true } },
        },
      }).catch(() => null)
    : null;
  const nextRoom = nextBk
    ? await db.resource.findFirst({ where: { kind: 'ROOM', bookings: { some: { id: nextBk.id } } }, select: { id: true, name: true } }).catch(() => null)
    : null;
  // The next arrival's room prep state (for the live arrival-prep checklist).
  const nextRoomPrep = nextRoom ? await getRoomPrepFor(nextRoom.id).catch(() => null) : null;
  const nextArrival: NextArrival | null = nextBk ? {
    id: nextBk.id,
    clientId: nextBk.clientId,
    clientName: [nextBk.client.firstName, nextBk.client.lastName].filter(Boolean).join(' ') || 'Client',
    treatment: nextBk.treatmentTitle,
    startIso: nextBk.startAt.toISOString(),
    timeLabel: fmtClinicTime(nextBk.startAt) + (nextBk.startAt <= endOfToday ? '' : ` · ${fmtClinicDate(nextBk.startAt)}`),
    practitioner: nextBk.practitioner?.name ?? null,
    room: nextRoom?.name ?? null,
    roomId: nextRoom?.id ?? null,
    roomPrep: nextRoomPrep?.status,
    canManageRoom: canRoomsPrep,
    drinks: nextBk.refreshments ?? [],
    // clients.clinical.view gated — same redaction as ReceptionistView (front-of-house never sees clinical data).
    allergies: canClinical ? decClinical(nextBk.client.allergies) ?? null : null,
    medicalFlag: canClinical ? decClinical(nextBk.client.medicalFlag) ?? null : null,
  } : null;

  if (nextArrival) return <ArrivalPrep a={nextArrival} />;
  return (
    <section className="flex flex-col items-start justify-center rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
      <p className="eyebrow text-[var(--color-stone)]">Up next</p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-xl">No upcoming appointments</p>
      <p className="mt-1 text-sm text-[var(--color-stone)]">Nothing booked ahead right now — enjoy the calm, or take a new booking.</p>
    </section>
  );
}
