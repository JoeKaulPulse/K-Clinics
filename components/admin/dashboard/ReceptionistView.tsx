import 'server-only';
import Link from 'next/link';
import { sessionCan, type Session } from '@/lib/auth';
import { db } from '@/lib/db';
import { loadBookingTreatments } from '@/lib/services';
import { getRoomsForDay, getRoomPrepFor, clinicDay } from '@/lib/room-prep';
import { fmtClinicTime } from '@/lib/clinic-time';
import { postAppointmentUpsells } from '@/lib/upsell';
import { DashWidget, StatTile } from './Widgets';
import { ArrivalPrep, type NextArrival } from '@/components/admin/ArrivalPrep';
import { ArrivalsBoard, type ArrivalRow } from '@/components/admin/rooms/ArrivalsBoard';
import { RoomPrepStatus } from '@/components/admin/rooms/RoomPrepStatus';
import { NewBookingButton } from '@/components/admin/NewBookingButton';

// PRJ-63.5 — Receptionist (front-of-house) view. NO clinical health data: it never
// reads or renders allergies / medical flags — the arrival card is given the
// clinical-free overload. Arrivals timeline + one-tap check-in, prepare-for-arrival
// handoff, the live rooms board (set READY → clinician sees it), payments to take,
// and new-booking / walk-in quick actions. Self-contained async server bundle.

const fmtTime = fmtClinicTime;
const fullName = (c: { firstName: string | null; lastName: string | null }) => [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Client';

export async function ReceptionistView({ session }: { session: Session }) {
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  const canRooms = sessionCan(session, 'rooms.prep.manage');
  const canManageBookings = sessionCan(session, 'bookings.manage');
  const canCharge = sessionCan(session, 'bookings.charge');

  const [todays, rooms, paymentsToTake] = await Promise.all([
    db.booking.findMany({
      where: { startAt: { gte: start, lte: end }, status: { notIn: ['CANCELLED'] } },
      orderBy: { startAt: 'asc' },
      select: {
        id: true, clientId: true, startAt: true, status: true, treatmentTitle: true, treatmentSlug: true, refreshments: true,
        arrivedAt: true, startedAt: true, finishedAt: true,
        client: { select: { firstName: true, lastName: true } },
        practitioner: { select: { name: true } },
        resources: { select: { name: true, kind: true } },
      },
    }).catch(() => []),
    canRooms ? getRoomsForDay({ now }).catch(() => []) : Promise.resolve([]),
    canCharge ? db.booking.count({ where: { status: 'COMPLETED', chargedAt: null, pricePence: { gt: 0 }, startAt: { gte: start, lte: end } } }).catch(() => 0) : Promise.resolve(0),
  ]);

  type Bk = (typeof todays)[number];
  const roomOf = (b: Bk) => b.resources.find((r) => r.kind === 'ROOM')?.name ?? null;

  // Post-appointment upsell prompts for clients who finished today (most recent first).
  const finishedToday = todays
    .filter((b) => b.status === 'COMPLETED' || !!b.finishedAt)
    .sort((a, b) => +(b.finishedAt ?? b.startAt) - +(a.finishedAt ?? a.startAt))
    .map((b) => ({ id: b.id, clientId: b.clientId, clientName: fullName(b.client), treatmentSlug: b.treatmentSlug, treatmentTitle: b.treatmentTitle, startAt: b.startAt }));
  const upsells = finishedToday.length ? await postAppointmentUpsells(finishedToday).catch(() => []) : [];

  const arrivals: ArrivalRow[] = todays.map((b) => ({
    id: b.id,
    clientId: b.clientId,
    timeLabel: fmtTime(b.startAt),
    client: fullName(b.client),
    treatment: b.treatmentTitle,
    room: roomOf(b),
    status: b.status,
    arrived: !!b.arrivedAt,
    done: b.status === 'COMPLETED' || !!b.finishedAt,
  }));

  // Next arrival for the prepare-for-arrival card — CLINICAL-FREE (no allergies / flag).
  const focus = todays.find((b) => !b.finishedAt && b.startAt >= now && b.status !== 'COMPLETED') ?? null;
  const focusRoom = focus ? focus.resources.find((r) => r.kind === 'ROOM') ?? null : null;
  const focusRoomId = focusRoom ? (await db.resource.findFirst({ where: { name: focusRoom.name, kind: 'ROOM' }, select: { id: true } }).catch(() => null))?.id ?? null : null;
  const focusPrep = focusRoomId ? await getRoomPrepFor(focusRoomId, clinicDay(now)).catch(() => null) : null;
  const nextArrival: NextArrival | null = focus ? {
    id: focus.id,
    clientId: focus.clientId,
    clientName: fullName(focus.client),
    treatment: focus.treatmentTitle,
    startIso: focus.startAt.toISOString(),
    timeLabel: fmtTime(focus.startAt),
    practitioner: focus.practitioner?.name ?? null,
    room: focusRoom?.name ?? null,
    roomId: focusRoomId,
    roomPrep: focusPrep?.status,
    canManageRoom: canRooms,
    drinks: focus.refreshments ?? [],
    // allergies / medicalFlag intentionally omitted — front-of-house sees no clinical data.
  } : null;

  const treatments = await loadBookingTreatments();
  const arrivedCount = arrivals.filter((a) => a.arrived && !a.done).length;
  const toCome = arrivals.filter((a) => !a.done).length;

  return (
    <div className="mt-6 space-y-6">
      {/* Prepare-for-arrival (clinical-free) + quick actions */}
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr] [&>*]:min-w-0">
        {nextArrival ? (
          <ArrivalPrep a={nextArrival} />
        ) : (
          <DashWidget>
            <p className="eyebrow text-[var(--color-stone)]">Up next</p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-xl">No upcoming arrivals</p>
            <p className="mt-1 text-sm text-[var(--color-stone)]">Nothing booked ahead right now.</p>
          </DashWidget>
        )}
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
          <p className="eyebrow mb-3 text-[var(--color-stone)]">Quick actions</p>
          <div className="mb-3"><NewBookingButton treatments={treatments} /></div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: '/admin/calendar', label: 'Calendar', perm: 'calendar.view' },
              { href: '/admin/bookings', label: 'All bookings', perm: 'bookings.view' },
              { href: '/admin/calls', label: 'Calls', perm: 'calls.view' },
              { href: '/admin/clients', label: 'Clients', perm: 'clients.view' },
            ]
              .filter((t) => sessionCan(session, t.perm))
              .map((t) => (
                <Link key={t.href} href={t.href} className="flex items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-line)] px-3 py-3 text-center text-sm text-[var(--color-ink-soft)] transition-colors duration-150 ease-out hover:bg-[var(--color-bone)] hover:text-[var(--color-ink)] active:bg-[var(--color-sand)]">
                  {t.label}
                </Link>
              ))}
          </div>
        </section>
      </div>

      {/* Front-of-house stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatTile label="Appointments today" value={arrivals.length} />
        <StatTile label="Arrived · waiting" value={arrivedCount} />
        {canCharge && <StatTile label="Payments to take" value={paymentsToTake} href="/admin/bookings" />}
      </div>

      {/* Arrivals + rooms — the core front-of-house working area, kept high:
          check people in as they walk in, and set rooms ready to hand off. */}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
        {/* Arrivals timeline + one-tap check-in */}
        <DashWidget title="Arrivals" eyebrow={`${toCome} still to come`}>
          <ArrivalsBoard initialArrivals={arrivals} canManage={canManageBookings} />
        </DashWidget>

        {/* Rooms — set READY to hand off to the clinician */}
        <DashWidget title="Rooms" eyebrow="Set ready to hand off">
          {canRooms ? (
            <RoomPrepStatus initialRooms={rooms} initialCanManage={canRooms} />
          ) : (
            <p className="text-sm text-[var(--color-stone)]">You don’t have permission to set room readiness.</p>
          )}
        </DashWidget>
      </div>

      {/* Upsell opportunities — opportunistic, so it sits below the live work:
          after an appointment finishes, with the reason why */}
      {upsells.length > 0 && (
        <DashWidget title="Upsell opportunities" eyebrow="After today’s appointments">
          <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
            {upsells.map((u) => (
              <div key={u.bookingId} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bone)]/40 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <Link href={`/admin/clients/${u.clientId}`} className="text-sm font-medium hover:text-[var(--color-gold)]">{u.clientName}</Link>
                  <span className="text-xs text-[var(--color-stone-soft)]">just finished {u.treatment}</span>
                </div>
                <ul className="mt-3 space-y-2.5">
                  {u.suggestions.map((s, i) => (
                    <li key={i} className="border-t border-[var(--color-line)] pt-2.5 first:border-0 first:pt-0">
                      <div className="flex items-baseline justify-between gap-2">
                        {s.href ? (
                          <Link href={s.href} className="text-sm font-medium text-[var(--color-ink)] hover:text-[var(--color-gold)]">{s.title}</Link>
                        ) : (
                          <span className="text-sm font-medium">{s.title}</span>
                        )}
                        {s.pricePence != null && <span className="shrink-0 text-sm tabular-nums text-[var(--color-gold-deep)]">£{(s.pricePence / 100).toLocaleString('en-GB', { minimumFractionDigits: s.pricePence % 100 ? 2 : 0 })}</span>}
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--color-stone)]">{s.reason}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </DashWidget>
      )}
    </div>
  );
}
