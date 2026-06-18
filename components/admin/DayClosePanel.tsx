'use client';

import { useCallback, useEffect, useState } from 'react';
import { DayCloseRunner } from './DayCloseRunner';
import type { DayCloseConfig, ExpectedTakings, StockTakeItem } from '@/lib/day-close';

type Loc = { id: string; name: string; isPrimary: boolean };
type Existing = { id: string; status: string; completedBy: string | null; completedAt: string | null; variancePence: number | null; checklistDone: number; checklistTotal: number } | null;
type Data = {
  config: DayCloseConfig;
  locations: Loc[];
  locationId: string | null;
  businessDate: string;
  expected: ExpectedTakings;
  stock: StockTakeItem[];
  existing: Existing;
};

const money = (pence: number) => `£${(pence / 100).toFixed(2)}`;

export function DayClosePanel() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [locId, setLocId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async (location?: string | null) => {
    setLoading(true);
    try {
      const qs = location ? `?locationId=${encodeURIComponent(location)}` : '';
      const res = await fetch(`/api/admin/day-close${qs}`);
      const json = (await res.json()) as Data & { ok: boolean };
      if (json.ok) {
        setData(json);
        setLocId(json.locationId);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) return <p className="text-sm text-[var(--color-stone)]">Loading…</p>;
  if (!data) return <p className="text-sm text-[var(--color-stone)]">Couldn&apos;t load the close-down.</p>;

  const locName = data.locations.find((l) => l.id === data.locationId)?.name || 'the clinic';
  const closed = data.existing?.status === 'COMPLETED';

  return (
    <div className="max-w-xl">
      {data.locations.length > 1 && (
        <label className="mb-5 block text-sm">
          <span className="text-[var(--color-stone)]">Location</span>
          <select
            value={locId ?? ''}
            onChange={(e) => { setLocId(e.target.value); load(e.target.value); }}
            className="mt-1.5 block rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]"
          >
            {data.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
      )}

      <div className={`rounded-[var(--radius-lg)] border p-6 ${closed ? 'border-[var(--color-jade)]/40 bg-[var(--color-bone)]' : 'border-[var(--color-line)] bg-[var(--color-porcelain)]'}`}>
        {closed ? (
          <>
            <p className="text-sm font-medium text-[var(--color-jade)]">✓ Closed down for today</p>
            <p className="mt-1 text-sm text-[var(--color-stone)]">
              {locName} · {data.existing?.checklistDone}/{data.existing?.checklistTotal} checks ·{' '}
              {(data.existing?.variancePence ?? 0) === 0 ? 'takings balanced' : `variance ${money(data.existing?.variancePence ?? 0)}`}
              {data.existing?.completedBy && <> · by {data.existing.completedBy}</>}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-[var(--color-stone)]">Card takings expected today</p>
            <p className="font-[family-name:var(--font-display)] text-3xl tabular-nums">{money(data.expected.cardPence)}</p>
            <p className="mt-1 text-xs text-[var(--color-stone)]">
              {data.expected.chargeCount} charge{data.expected.chargeCount === 1 ? '' : 's'}
              {data.expected.orderCount > 0 && <> · {data.expected.orderCount} order{data.expected.orderCount === 1 ? '' : 's'}</>}
              {data.config.stockTake && <> · {data.stock.length} stock lines to count</>}
            </p>
          </>
        )}

        <button
          onClick={() => setOpen(true)}
          className="mt-5 rounded-full bg-[var(--color-gold)] px-6 py-3 text-sm font-medium text-white shadow-[var(--shadow-gold)] hover:bg-[var(--color-ink)]"
        >
          {closed ? 'Re-open close-down' : 'Begin close-down'}
        </button>
      </div>

      {open && (
        <DayCloseRunner
          config={data.config}
          expected={data.expected}
          stock={data.stock}
          locationId={data.locationId}
          locationName={locName}
          businessDate={data.businessDate}
          onClose={() => { setOpen(false); load(locId); }}
          onDone={() => { /* refetch happens on close */ }}
        />
      )}
    </div>
  );
}
