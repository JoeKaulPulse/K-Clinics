import { site } from './site';

// Client-side slot generation for demo mode (mirrors lib/availability.ts but
// without a database — excludes only locally-made demo bookings).
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SLOT_INTERVAL = 15;
const LEAD_MIN = 120;

function parseHM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function demoSlots(dateISO: string, durationMin: number, takenISO: string[] = []): string[] {
  const date = new Date(dateISO + 'T00:00:00');
  if (isNaN(date.getTime())) return [];
  const hours = site.hours.find((h) => h.day === DOW[date.getDay()]);
  if (!hours || hours.open === 'Closed') return [];
  const open = parseHM(hours.open);
  const close = parseHM(hours.close);
  if (open == null || close == null) return [];

  const minStart = Date.now() + LEAD_MIN * 60_000;
  const taken = takenISO.map((t) => new Date(t).getTime());
  const out: string[] = [];
  for (let m = open; m + durationMin <= close; m += SLOT_INTERVAL) {
    const start = new Date(date);
    start.setHours(0, m, 0, 0);
    if (start.getTime() < minStart) continue;
    if (taken.includes(start.getTime())) continue;
    out.push(start.toISOString());
  }
  return out;
}
