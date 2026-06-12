'use client';

import { useEffect, useState } from 'react';

// Live wall-clock for the dashboard header — clinic-local time, minute-resolution
// (updates every 30s so it never lags by more than that). Renders nothing until
// mounted to avoid a server/client hydration mismatch on the time string.
export function LiveClock({ className }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!now) return <span className="inline-block h-5 w-12" aria-hidden />;
  return (
    <time className={className ?? 'font-[family-name:var(--font-display)] text-2xl tabular-nums leading-none text-[var(--color-ink)]'}>
      {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })}
    </time>
  );
}

// Live "time until / since" label for the next arrival. Updates every 30s.
export function Countdown({ iso }: { iso: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  const diffMin = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  let text: string;
  if (diffMin <= -1) text = `${Math.abs(diffMin)} min ago`;
  else if (diffMin <= 1) text = 'now';
  else if (diffMin < 60) text = `in ${diffMin} min`;
  else {
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    text = `in ${h}h${m ? ` ${m}m` : ''}`;
  }
  const soon = diffMin >= -5 && diffMin <= 15;
  return (
    <span className={`tabular-nums ${soon ? 'text-[var(--color-gold-deep)]' : 'text-[var(--color-stone)]'}`}>{text}</span>
  );
}
