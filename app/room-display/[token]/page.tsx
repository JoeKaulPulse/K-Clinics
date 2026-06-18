import { notFound } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';

export const dynamic = 'force-dynamic';

// BLD-225 — the screen mounted outside a treatment room (e.g. iiyama TW1023ASC).
// Token-secured + public (no login); shows that room's current + next
// appointment with minimal client identity (first name only). Auto-refreshes.
const fmt = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });

export default async function RoomDisplay({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!crmEnabled || !token) notFound();
  const { db } = await import('@/lib/db');
  const device = await db.device.findFirst({ where: { token, kind: 'DISPLAY', active: true }, select: { roomId: true } });
  if (!device?.roomId) notFound();
  const room = await db.resource.findUnique({ where: { id: device.roomId }, select: { name: true, floor: true } });
  if (!room) notFound();

  const now = new Date();
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now); dayEnd.setHours(23, 59, 59, 999);
  const bookings = await db.booking.findMany({
    where: { resources: { some: { id: device.roomId } }, status: { in: ['CONFIRMED', 'PENDING', 'COMPLETED'] }, startAt: { gte: dayStart, lte: dayEnd } },
    orderBy: { startAt: 'asc' },
    select: { startAt: true, endAt: true, startedAt: true, finishedAt: true, treatmentTitle: true, client: { select: { firstName: true } } },
  }).catch(() => []);

  const current = bookings.find((b) => !b.finishedAt && ((b.startedAt && !b.finishedAt) || (now >= b.startAt && now <= b.endAt)));
  const next = bookings.find((b) => b.startAt > now && !b.finishedAt && b !== current);
  const who = (n?: string | null) => (n || 'Guest');

  // Manual occupancy (BLD-506): staff mark who is in the room, so the screen reads
  // "Occupied" even when there is no booking (walk-in, consultation, prep).
  const { clinicDay } = await import('@/lib/room-prep');
  const prep = await db.roomPrep.findUnique({
    where: { roomId_date: { roomId: device.roomId, date: clinicDay(now) } },
    select: { occupied: true },
  }).catch(() => null);
  const manuallyOccupied = !current && !!prep?.occupied;

  return (
    <main className="grid min-h-dvh place-items-center bg-[#1a1714] p-[5vmin] text-[#f3ece2]">
      {/* Kiosk auto-refresh — keep the panel live without any client bundle. */}
      <meta httpEquiv="refresh" content="20" />
      <div className="w-full max-w-3xl text-center">
        <p className="text-[3.2vmin] uppercase tracking-[0.3em] text-[#b79c74]">{room.name}{room.floor ? ` · ${room.floor}` : ''}</p>

        {current ? (
          <div className="mt-[6vmin]">
            <p className="inline-flex items-center gap-3 rounded-full bg-[#b79c74]/20 px-5 py-2 text-[2.6vmin] uppercase tracking-[0.2em] text-[#e7c9a0]">
              <span className="h-3 w-3 animate-pulse rounded-full bg-[#e7c9a0]" /> In session
            </p>
            <h1 className="mt-[4vmin] font-[family-name:var(--font-display)] text-[10vmin] leading-none">{who(current.client?.firstName)}</h1>
            <p className="mt-[3vmin] text-[3.4vmin] text-[#cdbfa9]">{current.treatmentTitle}</p>
            <p className="mt-[1.5vmin] text-[3vmin] tabular-nums text-[#9c8f7c]">{fmt(current.startAt)} – {fmt(current.endAt)}</p>
          </div>
        ) : manuallyOccupied ? (
          <div className="mt-[6vmin]">
            <p className="inline-flex items-center gap-3 rounded-full bg-[#c0392b]/20 px-5 py-2 text-[2.6vmin] uppercase tracking-[0.2em] text-[#e8a99f]">
              <span className="h-3 w-3 rounded-full bg-[#e8a99f]" /> Occupied
            </p>
            <h1 className="mt-[4vmin] font-[family-name:var(--font-display)] text-[8vmin] leading-tight text-[#cdbfa9]">In use</h1>
          </div>
        ) : (
          <div className="mt-[6vmin]">
            <h1 className="font-[family-name:var(--font-display)] text-[8vmin] leading-tight text-[#cdbfa9]">Available</h1>
          </div>
        )}

        {next && (
          <div className="mt-[8vmin] border-t border-white/10 pt-[4vmin]">
            <p className="text-[2.4vmin] uppercase tracking-[0.25em] text-[#9c8f7c]">Next</p>
            <p className="mt-[1.5vmin] text-[4vmin]">{fmt(next.startAt)} · {who(next.client?.firstName)} <span className="text-[#9c8f7c]">— {next.treatmentTitle}</span></p>
          </div>
        )}
      </div>
    </main>
  );
}
