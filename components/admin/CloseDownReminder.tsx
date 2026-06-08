'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// A gentle, dismissible nudge shown across the admin once it's near closing time
// and the clinic hasn't been closed down yet — so security, equipment-off and
// lock-up checks aren't forgotten. Polls a tiny status endpoint.

type Status = { ok: boolean; closedToday?: boolean; closingTime?: string; reminderOffsetsMin?: number[] };

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export function CloseDownReminder() {
  const pathname = usePathname();
  const [status, setStatus] = useState<Status | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let on = true;
    const load = () => fetch('/api/admin/day-close?status=1').then((r) => r.json()).then((j) => { if (on) setStatus(j); }).catch(() => {});
    load();
    const poll = setInterval(load, 5 * 60 * 1000); // refresh status every 5 min
    const tick = setInterval(() => setNow(new Date()), 60 * 1000); // re-evaluate the clock each minute
    return () => { on = false; clearInterval(poll); clearInterval(tick); };
  }, []);

  // Don't show on the day-close page itself.
  if (dismissed || pathname.startsWith('/admin/day-close')) return null;
  if (!status?.ok || status.closedToday || !status.closingTime) return null;

  const closeMin = toMin(status.closingTime);
  const offsets = status.reminderOffsetsMin?.length ? status.reminderOffsetsMin : [30, 0];
  const earliest = closeMin - Math.max(...offsets);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (nowMin < earliest) return null;

  const overdue = nowMin >= closeMin;

  return (
    <div className="mb-5 flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-gold)]/40 bg-[var(--color-bone)] px-4 py-3">
      <div className="flex items-start gap-2.5">
        <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-gold-deep)]" fill="none"><path d="M12 8v5M12 16h.01M12 3l9 16H3L12 3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <p className="text-sm text-[var(--color-ink)]">
          {overdue
            ? 'Time to close down — secure the building, power down equipment and lock up.'
            : `Closing at ${status.closingTime} — start the end-of-day close-down soon.`}{' '}
          <Link href="/admin/day-close" className="font-medium text-[var(--color-gold-deep)] underline">Start close-down</Link>
        </p>
      </div>
      <button onClick={() => setDismissed(true)} aria-label="Dismiss" className="shrink-0 text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">✕</button>
    </div>
  );
}
