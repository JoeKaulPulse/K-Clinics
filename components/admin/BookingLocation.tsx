'use client';

import { useTransition } from 'react';
import { setBookingLocation } from '@/app/admin/bookings/actions';

type Loc = { id: string; name: string; color: string | null };

export function BookingLocation({ bookingId, current, locations }: { bookingId: string; current: string | null; locations: Loc[] }) {
  const [pending, start] = useTransition();
  const active = locations.find((l) => l.id === current);

  return (
    <section className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <div className="mb-2 flex items-center gap-2">
        {active && <span className="h-2.5 w-2.5 rounded-full" style={{ background: active.color || 'var(--color-gold)' }} />}
        <h2 className="font-[family-name:var(--font-display)] text-lg">Location</h2>
      </div>
      <select
        value={current || ''}
        disabled={pending}
        onChange={(e) => start(() => { setBookingLocation(bookingId, e.target.value || null); })}
        className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)] disabled:opacity-60"
      >
        <option value="">Not set</option>
        {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
    </section>
  );
}
