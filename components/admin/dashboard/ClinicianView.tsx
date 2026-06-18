import 'server-only';
import Link from 'next/link';
import { sessionCan, type Session } from '@/lib/auth';
import { db } from '@/lib/db';
import { decClinical } from '@/lib/clinical-crypto';
import { fmtClinicTime } from '@/lib/clinic-time';
import { getRoomsForDay } from '@/lib/room-prep';
import { DashWidget, TimelineList, EmptyWidget, type TimelineItem } from './Widgets';
import { RoomPrepStatus } from '@/components/admin/rooms/RoomPrepStatus';

// PRJ-63.4 — Clinician dashboard view. The role-shaped landing for a practitioner:
// today's appointments (own first), the live room availability + prep board, a
// clinical client quick-card for the current/next client, and a one-tap jump into
// the guided session. Clinical fields (allergies, medical flag) are gated behind
// clients.clinical.view, so a non-clinical role reusing these pieces never sees them.
// Self-contained async server component — does its own scoped queries (no revenue/
// management data), so it's safe for the clinician role and for admin preview.

const fmtTime = fmtClinicTime;
const fullName = (c: { firstName: string | null; lastName: string | null }) => [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Client';

export async function ClinicianView({ session }: { session: Session }) {
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  const canClinical = sessionCan(session, 'clients.clinical.view');
  const canAllBookings = sessionCan(session, 'bookings.view');
  const canRooms = sessionCan(session, 'rooms.prep.manage');

  const select = {
    id: true, startAt: true, endAt: true, status: true, treatmentTitle: true, treatmentSlug: true,
    arrivedAt: true, startedAt: true, finishedAt: true, practitionerId: true,
    client: { select: { id: true, firstName: true, lastName: true, allergies: true, medicalFlag: true } },
    practitioner: { select: { name: true } },
  } as const;

  const [mine, clinic, rooms] = await Promise.all([
    db.booking.findMany({ where: { practitionerId: session.sub, startAt: { gte: start, lte: end }, status: { notIn: ['CANCELLED'] } }, orderBy: { startAt: 'asc' }, select }).catch(() => []),
    canAllBookings ? db.booking.findMany({ where: { startAt: { gte: start, lte: end }, status: { notIn: ['CANCELLED'] } }, orderBy: { startAt: 'asc' }, select }).catch(() => []) : Promise.resolve([]),
    canRooms ? getRoomsForDay({ now }).catch(() => []) : Promise.resolve([]),
  ]);

  type Bk = (typeof mine)[number];
  const lateFlag = (b: Bk) => (b.status === 'PENDING' || b.status === 'CONFIRMED') && !b.startedAt && b.startAt < now;
  const inProgress = (b: Bk) => !!b.startedAt && !b.finishedAt;

  const toItem = (b: Bk, showClinician = false): TimelineItem => ({
    id: b.id,
    lead: fmtTime(b.startAt),
    title: fullName(b.client),
    meta: [b.treatmentTitle, showClinician && b.practitioner?.name ? b.practitioner.name : null].filter(Boolean).join(' · '),
    href: `/admin/bookings/${b.id}`,
    trailing: inProgress(b)
      ? <span className="rounded-full bg-[color-mix(in_oklab,var(--color-jade)_14%,transparent)] px-2.5 py-1 text-xs font-medium text-[var(--color-jade)]">In progress</span>
      : lateFlag(b)
        ? <span className="rounded-full bg-[color-mix(in_oklab,#c0392b_12%,transparent)] px-2.5 py-1 text-xs font-medium text-[#b23b3b]">Running late</span>
        : b.status === 'COMPLETED'
          ? <span className="rounded-full bg-[var(--color-ink)] px-2.5 py-1 text-xs font-medium text-[var(--color-porcelain)]">Done</span>
          : b.arrivedAt
            ? <span className="rounded-full bg-[color-mix(in_oklab,var(--color-jade)_14%,transparent)] px-2.5 py-1 text-xs font-medium text-[var(--color-jade)]">✓ Arrived</span>
            : <span className="rounded-full bg-[var(--color-bone)] px-2.5 py-1 text-xs text-[var(--color-stone)]">{fmtTime(b.startAt)}</span>,
  });

  // The client to prep for: an in-progress one first, else the next upcoming (mine, then clinic).
  const pool = mine.length ? mine : clinic;
  const focus = pool.find(inProgress) ?? pool.find((b) => b.startAt >= now && b.status !== 'COMPLETED') ?? null;
  let focusConsent: boolean | null = null;
  if (focus) {
    const c = await db.signedConsent.count({ where: { bookingId: focus.id, kind: 'treatment', declined: false } }).catch(() => 0);
    focusConsent = c > 0;
  }
  const focusAllergies = focus && canClinical ? decClinical(focus.client.allergies) : null;
  const focusMedical = focus && canClinical ? decClinical(focus.client.medicalFlag) : null;

  const doneCount = mine.filter((b) => b.status === 'COMPLETED').length;

  return (
    <div className="mt-6 space-y-6">
      {/* Focus: current / next client + jump into the guided session */}
      {focus ? (
        <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-gold)]/40 bg-[var(--color-porcelain)]">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[var(--color-line)] bg-[var(--color-bone)]/60 px-5 py-3">
            <p className="eyebrow text-[var(--color-stone)]">{inProgress(focus) ? 'In session now' : 'Next client'}</p>
            <p className="text-sm font-medium tabular-nums">{fmtTime(focus.startAt)}</p>
          </div>
          <div className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/admin/clients/${focus.client.id}`} className="font-[family-name:var(--font-display)] text-xl hover:text-[var(--color-gold)]">{fullName(focus.client)}</Link>
                <p className="mt-0.5 text-sm text-[var(--color-stone)]">{focus.treatmentTitle}</p>
              </div>
              <Link href={`/admin/bookings/${focus.id}`} className="shrink-0 rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-[var(--color-porcelain)] transition-opacity hover:opacity-90">
                {inProgress(focus) ? 'Resume session →' : 'Start session →'}
              </Link>
            </div>
            {/* Clinical-gated quick facts */}
            {canClinical && (focusMedical || focusAllergies) && (
              <p className="mt-3 flex items-start gap-2 rounded-[var(--radius-sm)] bg-[color-mix(in_oklab,#c0392b_12%,transparent)] px-3 py-2 text-sm text-[var(--color-ink)]">
                <span aria-hidden>⚠</span>
                <span className="min-w-0 break-words">{[focusMedical, focusAllergies && `Allergies: ${focusAllergies}`].filter(Boolean).join(' · ')}</span>
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {focus.arrivedAt && <span className="rounded-full bg-[color-mix(in_oklab,var(--color-jade)_14%,transparent)] px-2.5 py-1 font-medium text-[var(--color-jade)]">✓ Arrived</span>}
              <span className={`rounded-full px-2.5 py-1 font-medium ${focusConsent ? 'bg-[color-mix(in_oklab,var(--color-jade)_14%,transparent)] text-[var(--color-jade)]' : 'bg-amber-100 text-amber-800'}`}>
                {focusConsent ? 'Consent signed' : 'Consent outstanding'}
              </span>
              {canClinical && !focusMedical && <span className="rounded-full bg-[var(--color-bone)] px-2.5 py-1 text-[var(--color-stone)]">No medical flag</span>}
            </div>
          </div>
        </section>
      ) : (
        <DashWidget>
          <EmptyWidget title="No appointments to prepare for" hint="Nothing upcoming right now — your day’s schedule appears below as it fills." />
        </DashWidget>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
        {/* Today's appointments */}
        <DashWidget
          title="Today’s appointments"
          action={<Link href="/admin/my-day" className="text-sm text-[var(--color-gold)] hover:underline">Open My day →</Link>}
        >
          <p className="mb-2 text-xs text-[var(--color-stone)]">{mine.length} yours{mine.length ? ` · ${doneCount} done` : ''}</p>
          <TimelineList items={mine.map((b) => toItem(b))} empty="No appointments assigned to you today." />
          {canAllBookings && clinic.length > mine.length && (
            <>
              <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-stone)]">Whole clinic today</p>
              <TimelineList items={clinic.filter((b) => b.practitionerId !== session.sub).map((b) => toItem(b, true))} empty="No other appointments." />
            </>
          )}
        </DashWidget>

        {/* Rooms — availability + prep (live) */}
        <DashWidget title="Rooms">
          {canRooms ? (
            <RoomPrepStatus initialRooms={rooms} initialCanManage={canRooms} />
          ) : (
            <EmptyWidget title="Room status unavailable" hint="You don’t have permission to view room readiness." />
          )}
        </DashWidget>
      </div>
    </div>
  );
}
