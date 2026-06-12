'use client';

import { useEffect, useState } from 'react';

// PRJ-63 — live visit timer. Pure presentational tick from checkedInAt; no data.
export function VisitTimer({ since }: { since: string }) {
  const start = new Date(since).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const sec = Math.max(0, Math.floor((now - start) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <span className="font-[family-name:var(--font-display)] tabular-nums" suppressHydrationWarning>
      {h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`}
    </span>
  );
}
