import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { getLocale } from '@/lib/locale';
import { t } from '@/lib/i18n';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { CalendarBlockButton } from '@/components/admin/CalendarBlockButton';

export const dynamic = 'force-dynamic';

const DAY_START = 8 * 60; // 08:00
const DAY_END = 21 * 60;  // 21:00
const PX_PER_MIN = 1.1;

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'calendar.view')) redirect('/admin');

  const { date } = await searchParams;
  const day = date ? new Date(date + 'T00:00:00') : new Date();
  if (isNaN(+day)) day.setTime(Date.now());
  const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999);
  const prev = new Date(dayStart); prev.setDate(prev.getDate() - 1);
  const next = new Date(dayStart); next.setDate(next.getDate() + 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const { db } = await import('@/lib/db');
  const [clinicians, bookings, timeOff] = await Promise.all([
    db.adminUser.findMany({ where: { isClinician: true, active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, color: true } }),
    db.booking.findMany({
      where: { startAt: { gte: dayStart, lte: dayEnd }, status: { in: ['PENDING', 'CONFIRMED', 'COMPLETED'] } },
      orderBy: { startAt: 'asc' },
      include: { client: { select: { firstName: true, lastName: true, medicalFlag: true } } },
    }),
    // Match the booking engine (lib/availability.ts): only time-off that
    // actually blocks bookings — exclude declined/cancelled requests, and
    // Google "busy" mirrors are shown with their own label below.
    db.staffTimeOff.findMany({ where: { startAt: { lt: dayEnd }, endAt: { gt: dayStart }, status: { notIn: ['DECLINED', 'CANCELLED'] } } }),
  ]);
  const closures = await db.clinicClosure.findMany({ where: { startAt: { lt: dayEnd }, endAt: { gt: dayStart } }, select: { reason: true } });
  const canManageSchedule = sessionCan(session, 'schedule.manage');

  // Columns: each clinician + an "Unassigned" column.
  const columns = [...clinicians.map((c) => ({ id: c.id, name: c.name || 'Clinician', color: c.color })), { id: null as string | null, name: 'Unassigned', color: null }];
  const hours = Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, i) => DAY_START + i * 60);

  const can = await sessionPermissions();

  const locale = await getLocale();
  const topOf = (d: Date) => (Math.max(DAY_START, d.getHours() * 60 + d.getMinutes()) - DAY_START) * PX_PER_MIN;
  const heightOf = (s: Date, e: Date) => Math.max(22, ((e.getTime() - s.getTime()) / 60000) * PX_PER_MIN);

  // Current-time indicator — only shown when viewing today.
  const now = new Date();
  const isToday = iso(day) === iso(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowPx = isToday && nowMin >= DAY_START && nowMin <= DAY_END ? (nowMin - DAY_START) * PX_PER_MIN : null;

  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">{t(locale, 'nav.calendar')}</h1>
        <div className="flex items-center gap-2 text-sm">
          <Link href={`/admin/calendar?date=${iso(prev)}`} className="rounded-full border border-[var(--color-line)] px-3 py-1.5 transition-colors duration-150 hover:bg-[var(--color-bone)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]" aria-label="Previous day">←</Link>
          <span className="min-w-44 text-center font-medium">{day.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <Link href={`/admin/calendar?date=${iso(next)}`} className="rounded-full border border-[var(--color-line)] px-3 py-1.5 transition-colors duration-150 hover:bg-[var(--color-bone)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]" aria-label="Next day">→</Link>
          <Link href="/admin/calendar" className="ml-2 rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-[var(--color-porcelain)] transition-colors duration-150 hover:bg-[var(--color-ink-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]">Today</Link>
          {canManageSchedule && clinicians.length > 0 && <CalendarBlockButton clinicians={columns.filter((c) => c.id).map((c) => ({ id: c.id as string, name: c.name }))} dateISO={iso(dayStart)} />}
        </div>
      </div>

      {closures.length > 0 && (
        <p className="mt-4 rounded-[var(--radius-sm)] border border-[var(--color-blush)]/40 bg-[var(--color-blush)]/10 px-4 py-2.5 text-sm font-medium text-[var(--color-ink)]">
          Clinic closed this day{closures[0].reason ? ` — ${closures[0].reason}` : ''}. No online bookings will be offered.
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
        <div className="flex min-w-[640px]">
          {/* Hour gutter */}
          <div className="w-14 shrink-0 border-r border-[var(--color-line)] pt-10">
            {hours.map((h) => (
              <div key={h} style={{ height: 60 * PX_PER_MIN }} className="relative">
                <span className="absolute -top-2 right-2 text-[0.65rem] text-[var(--color-stone)]">{String(h / 60).padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>
          {/* Columns */}
          {columns.map((col) => {
            const items = bookings.filter((b) => (b.practitionerId ?? null) === col.id);
            const offs = col.id ? timeOff.filter((t) => t.staffId === col.id) : [];
            return (
              <div key={col.id ?? 'unassigned'} className="relative flex-1 border-r border-[var(--color-line)] last:border-r-0">
                <div className="sticky top-0 z-10 flex h-10 items-center gap-2 border-b border-[var(--color-line)] bg-[var(--color-bone)] px-3 text-sm font-medium">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: col.color || (col.id ? 'var(--color-gold)' : 'var(--color-stone-soft)') }} />
                  {col.name}
                </div>
                <div className="relative" style={{ height: (DAY_END - DAY_START) * PX_PER_MIN }}>
                  {/* hour grid lines */}
                  {hours.map((h) => <div key={h} style={{ top: (h - DAY_START) * PX_PER_MIN }} className="absolute inset-x-0 border-t border-[var(--color-line)]/60" />)}
                  {/* current-time indicator (today only) */}
                  {nowPx !== null && (
                    <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: nowPx }}>
                      <div className="relative flex items-center">
                        <span className="absolute -left-0.5 h-2 w-2 rounded-full bg-[var(--color-blush)]" style={{ top: '-3px' }} />
                        <div className="h-px w-full bg-[var(--color-blush)]" />
                      </div>
                    </div>
                  )}
                  {/* time off */}
                  {offs.map((t) => (
                    <div key={t.id} style={{ top: topOf(t.startAt), height: heightOf(t.startAt < dayStart ? dayStart : t.startAt, t.endAt > dayEnd ? dayEnd : t.endAt) }}
                      className="absolute inset-x-1 rounded-[var(--radius-sm)] bg-[repeating-linear-gradient(45deg,var(--color-sand),var(--color-sand)_6px,transparent_6px,transparent_12px)] opacity-70" title={`${t.kind} ${t.reason ?? ''}`} />
                  ))}
                  {/* bookings */}
                  {items.map((b) => (
                    <Link key={b.id} href={`/admin/bookings/${b.id}`}
                      style={{ top: topOf(b.startAt), height: heightOf(b.startAt, b.endAt), borderColor: col.color || 'var(--color-gold)' }}
                      className="absolute inset-x-1 overflow-hidden rounded-[var(--radius-sm)] border-l-2 bg-[var(--color-bone)] p-1.5 text-xs shadow-sm transition-shadow duration-150 hover:shadow-[var(--shadow-soft)]">
                      <span className="block truncate font-medium">
                        {b.startAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} {b.treatmentTitle}
                      </span>
                      <span className="block truncate text-[var(--color-stone)]">
                        {b.client.firstName} {b.client.lastName ?? ''} {b.client.medicalFlag ? '⚠' : ''}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-3 text-xs text-[var(--color-stone)]">Times in clinic local time. ⚠ indicates a client medical flag. Hatched blocks are staff time-off.</p>
    </AdminShell>
  );
}
