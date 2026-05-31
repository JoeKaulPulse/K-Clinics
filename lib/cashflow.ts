import 'server-only';
import { db } from '@/lib/db';

// Cashflow forecasting with ring-fenced reserves.
//
// Config (opening cash, safety floor, horizon) lives in the Setting key/value
// table so it's editable without schema changes. Projected income/expense lines
// (CashflowEntry) are rolled up per month by cadence; planned reserve
// contributions are skimmed BEFORE 'operating cash' so the business always
// keeps its slush fund. Reserve contributions stop once a pot hits its target,
// freeing that cash back into operations.

export type FinanceConfig = { openingPence: number; safetyFloorPence: number; months: number };

const CFG_KEYS = { opening: 'cash_opening_pence', floor: 'cash_safety_floor_pence', months: 'cash_forecast_months' };

async function readInt(key: string, fallback: number): Promise<number> {
  const row = await db.setting.findUnique({ where: { key } });
  const n = row ? parseInt(row.value, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export async function getFinanceConfig(): Promise<FinanceConfig> {
  const [openingPence, safetyFloorPence, months] = await Promise.all([
    readInt(CFG_KEYS.opening, 0),
    readInt(CFG_KEYS.floor, 0),
    readInt(CFG_KEYS.months, 12),
  ]);
  return { openingPence, safetyFloorPence, months: Math.min(Math.max(months, 1), 36) };
}

export async function setFinanceConfig(cfg: Partial<FinanceConfig>, by?: string) {
  const writes: Promise<unknown>[] = [];
  const put = (key: string, value: number) =>
    writes.push(db.setting.upsert({ where: { key }, update: { value: String(Math.round(value)), updatedBy: by }, create: { key, value: String(Math.round(value)), updatedBy: by } }));
  if (cfg.openingPence !== undefined) put(CFG_KEYS.opening, cfg.openingPence);
  if (cfg.safetyFloorPence !== undefined) put(CFG_KEYS.floor, cfg.safetyFloorPence);
  if (cfg.months !== undefined) put(CFG_KEYS.months, cfg.months);
  await Promise.all(writes);
}

type Entry = { type: 'INCOME' | 'EXPENSE'; amountPence: number; cadence: string; startDate: Date | null; endDate: Date | null };

const monthKey = (d: Date) => d.getFullYear() * 12 + d.getMonth();

/** Amount a single entry contributes in a given projected month. */
function amountForMonth(e: Entry, monthDate: Date): number {
  const mk = monthKey(monthDate);
  if (e.startDate && mk < monthKey(e.startDate)) return 0;
  if (e.endDate && mk > monthKey(e.endDate)) return 0;
  const since = e.startDate ? mk - monthKey(e.startDate) : mk - monthKey(new Date());
  switch (e.cadence) {
    case 'MONTHLY': return e.amountPence;
    case 'WEEKLY': return Math.round((e.amountPence * 52) / 12);
    case 'QUARTERLY': return since % 3 === 0 ? e.amountPence : 0;
    case 'ANNUAL': return since % 12 === 0 ? e.amountPence : 0;
    case 'ONE_OFF': return since === 0 ? e.amountPence : 0;
    default: return 0;
  }
}

export type ForecastMonth = {
  label: string;
  incomePence: number;
  expensePence: number;
  netPence: number;
  reserveContribPence: number;
  operatingPence: number;   // running available cash after ring-fencing
  reservesPence: number;    // total ring-fenced balance at month end
  belowFloor: boolean;
};

export async function buildForecast() {
  const cfg = await getFinanceConfig();
  const [entries, reservesRaw] = await Promise.all([
    db.cashflowEntry.findMany({ where: { active: true } }),
    db.cashReserve.findMany({ orderBy: { sortOrder: 'asc' } }),
  ]);

  const reserveState = reservesRaw.map((r) => ({ ...r, running: r.balancePence }));
  const startReserves = reserveState.reduce((s, r) => s + r.balancePence, 0);

  const now = new Date();
  const months: ForecastMonth[] = [];
  let cash = cfg.openingPence;

  for (let i = 0; i < cfg.months; i++) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
    let income = 0, expense = 0;
    for (const e of entries) {
      const amt = amountForMonth(e as Entry, monthDate);
      if (e.type === 'INCOME') income += amt; else expense += amt;
    }
    // Ring-fence reserve contributions (capped at target).
    let reserveContrib = 0;
    for (const r of reserveState) {
      if (r.monthlyContributionPence <= 0) continue;
      const room = r.targetPence > 0 ? Math.max(0, r.targetPence - r.running) : r.monthlyContributionPence;
      const contrib = Math.min(r.monthlyContributionPence, room);
      r.running += contrib;
      reserveContrib += contrib;
    }
    const net = income - expense;
    cash += net - reserveContrib;
    months.push({
      label: monthDate.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
      incomePence: income, expensePence: expense, netPence: net,
      reserveContribPence: reserveContrib, operatingPence: cash,
      reservesPence: reserveState.reduce((s, r) => s + r.running, 0),
      belowFloor: cash < cfg.safetyFloorPence,
    });
  }

  return {
    cfg,
    months,
    reserves: reserveState.map((r) => ({
      id: r.id, name: r.name, color: r.color, targetPence: r.targetPence,
      startPence: r.balancePence, endPence: r.running, monthlyContributionPence: r.monthlyContributionPence,
    })),
    startReserves,
    summary: {
      endOperating: months.length ? months[months.length - 1].operatingPence : cfg.openingPence,
      endReserves: reserveState.reduce((s, r) => s + r.running, 0),
      lowestOperating: months.reduce((m, x) => Math.min(m, x.operatingPence), cfg.openingPence),
      everBelowFloor: months.some((m) => m.belowFloor),
    },
  };
}
