import Link from 'next/link';

// BLD-995: a compact monthly calendar beside the day diary, so staff can see at
// a glance which days have appointments without clicking through every date.
// Pure presentational — the page fetches booking counts per day and passes them
// in; a day with >=1 booking is highlighted in red, and clicking it opens that
// day's schedule (the existing diary view, via the date query param).

const MONTH_WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

function shiftMonthISO(monthISO: string, delta: number): string {
  const [y, m] = monthISO.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function daysInMonth(monthISO: string): number {
  const [y, m] = monthISO.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0, 12)).getUTCDate();
}

/** Day-of-week (0=Sun…6=Sat) of the 1st of the given month, tz-stable. Mirrors
 *  lib/clinic-time.ts's clinicDayOfWeek (noon-UTC anchor). */
function firstWeekday(monthISO: string): number {
  const [y, m] = monthISO.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1, 12)).getUTCDay();
}

export function MonthCalendar({
  monthISO,
  selectedISO,
  todayISO,
  counts,
  basePath = '/admin/calendar',
}: {
  monthISO: string; // 'YYYY-MM' — the month being displayed
  selectedISO: string; // the day currently open in the diary
  todayISO: string;
  counts: Record<string, number>; // 'YYYY-MM-DD' -> booking count
  basePath?: string;
}) {
  const [y, m] = monthISO.split('-').map(Number);
  const total = daysInMonth(monthISO);
  // Monday-first grid (en-GB convention, matches the rest of the admin's date formatting).
  const leading = (firstWeekday(monthISO) + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: leading }, () => null);
  for (let d = 1; d <= total; d++) cells.push(`${monthISO}-${String(d).padStart(2, '0')}`);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = new Date(Date.UTC(y, m - 1, 1, 12)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const prevMonth = shiftMonthISO(monthISO, -1);
  const nextMonth = shiftMonthISO(monthISO, 1);
  const dayHref = (dISO: string) => `${basePath}?date=${dISO}`;

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
      <div className="flex items-center justify-between gap-2">
        <Link href={`${basePath}?date=${selectedISO}&month=${prevMonth}`} aria-label="Previous month" className="grid h-7 w-7 place-items-center rounded-full border border-[var(--color-line)] text-sm transition-colors hover:bg-[var(--color-bone)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]">←</Link>
        <span className="text-sm font-medium">{monthLabel}</span>
        <Link href={`${basePath}?date=${selectedISO}&month=${nextMonth}`} aria-label="Next month" className="grid h-7 w-7 place-items-center rounded-full border border-[var(--color-line)] text-sm transition-colors hover:bg-[var(--color-bone)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]">→</Link>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[0.65rem] text-[var(--color-stone)]">
        {MONTH_WEEKDAYS.map((w, i) => <span key={i}>{w}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((dISO, i) => {
          if (!dISO) return <span key={`b${i}`} aria-hidden />;
          const count = counts[dISO] ?? 0;
          const hasBookings = count > 0;
          const isSelected = dISO === selectedISO;
          const isToday = dISO === todayISO;
          const dayNum = parseInt(dISO.slice(-2), 10);
          return (
            <Link
              key={dISO}
              href={dayHref(dISO)}
              title={hasBookings ? `${count} booking${count > 1 ? 's' : ''} — open ${dISO}` : `Open ${dISO}`}
              aria-current={isSelected ? 'date' : undefined}
              className={[
                'relative grid aspect-square place-items-center rounded-full text-xs tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]',
                hasBookings
                  ? 'bg-[#c0392b] font-medium text-white hover:bg-[#a8321f]'
                  : 'hover:bg-[var(--color-bone)]',
                isSelected && !hasBookings ? 'ring-2 ring-[var(--color-gold)]' : '',
                isSelected && hasBookings ? 'ring-2 ring-[var(--color-ink)] ring-offset-1 ring-offset-[var(--color-porcelain)]' : '',
                isToday && !isSelected ? 'font-semibold text-[var(--color-gold-deep)]' : '',
              ].filter(Boolean).join(' ')}
            >
              {dayNum}
            </Link>
          );
        })}
      </div>
      <p className="mt-3 text-[0.65rem] text-[var(--color-stone)]"><span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#c0392b] align-middle" /> day has one or more bookings — click to open its schedule.</p>
    </div>
  );
}
