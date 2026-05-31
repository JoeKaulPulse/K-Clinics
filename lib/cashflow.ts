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

// ── Predictive drivers (assumptions feeding the modelled forecast) ───────────
export type Drivers = {
  monthlyVisitors: number;     // website visitors / month
  conversionPct: number;       // visitor → booking %
  avgValuePence: number;       // average treatment value
  monthlyNewClients: number;   // alternative demand driver
  industryGrowthPct: number;   // annual growth %, compounded monthly
  seoRank: number;             // avg search position (1 = best)
  useSeasonality: boolean;
  useBookings: boolean;        // count confirmed/pending bookings as committed income
};

const CFG_KEYS = { opening: 'cash_opening_pence', floor: 'cash_safety_floor_pence', months: 'cash_forecast_months' };
const DRV_KEYS = {
  visitors: 'cf_monthly_visitors', conv: 'cf_conversion_pct', avg: 'cf_avg_value_pence', newClients: 'cf_monthly_new_clients',
  growth: 'cf_industry_growth_pct', seo: 'cf_seo_rank', seasonality: 'cf_use_seasonality', bookings: 'cf_use_bookings',
};

// Default seasonality for a London aesthetics & dentistry clinic (Jan…Dec),
// normalised to a mean of 1: pre-summer and pre-Christmas peaks, August/January dips.
const SEASONALITY = [0.85, 0.95, 1.05, 1.1, 1.15, 1.15, 1.05, 0.85, 1.05, 1.05, 1.15, 1.0];
const seasonNorm = (() => {
  const mean = SEASONALITY.reduce((a, b) => a + b, 0) / 12;
  return SEASONALITY.map((v) => v / mean);
})();

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

async function readNum(key: string, fallback: number): Promise<number> {
  const row = await db.setting.findUnique({ where: { key } });
  const n = row ? Number(row.value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export async function getDrivers(): Promise<Drivers> {
  const [monthlyVisitors, conversionPct, avgValuePence, monthlyNewClients, industryGrowthPct, seoRank, seasonality, bookings] = await Promise.all([
    readNum(DRV_KEYS.visitors, 0), readNum(DRV_KEYS.conv, 2), readNum(DRV_KEYS.avg, 25000), readNum(DRV_KEYS.newClients, 0),
    readNum(DRV_KEYS.growth, 0), readNum(DRV_KEYS.seo, 20), readNum(DRV_KEYS.seasonality, 1), readNum(DRV_KEYS.bookings, 1),
  ]);
  return { monthlyVisitors, conversionPct, avgValuePence, monthlyNewClients, industryGrowthPct, seoRank, useSeasonality: seasonality === 1, useBookings: bookings === 1 };
}

export async function setDrivers(d: Partial<Drivers>, by?: string) {
  const writes: Promise<unknown>[] = [];
  const put = (key: string, value: number) =>
    writes.push(db.setting.upsert({ where: { key }, update: { value: String(value), updatedBy: by }, create: { key, value: String(value), updatedBy: by } }));
  if (d.monthlyVisitors !== undefined) put(DRV_KEYS.visitors, Math.round(d.monthlyVisitors));
  if (d.conversionPct !== undefined) put(DRV_KEYS.conv, d.conversionPct);
  if (d.avgValuePence !== undefined) put(DRV_KEYS.avg, Math.round(d.avgValuePence));
  if (d.monthlyNewClients !== undefined) put(DRV_KEYS.newClients, Math.round(d.monthlyNewClients));
  if (d.industryGrowthPct !== undefined) put(DRV_KEYS.growth, d.industryGrowthPct);
  if (d.seoRank !== undefined) put(DRV_KEYS.seo, Math.round(d.seoRank));
  if (d.useSeasonality !== undefined) put(DRV_KEYS.seasonality, d.useSeasonality ? 1 : 0);
  if (d.useBookings !== undefined) put(DRV_KEYS.bookings, d.useBookings ? 1 : 0);
  await Promise.all(writes);
}

// SEO rank → a gentle income multiplier (better rank lifts demand). Bounded.
const rankMultiplier = (rank: number) => Math.min(1.12, Math.max(0.9, 1 + (30 - Math.min(Math.max(rank, 1), 100)) / 400));

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
  committedPence: number;   // from real confirmed/pending bookings
  modelledPence: number;    // from drivers + seasonality
  expensePence: number;
  netPence: number;
  reserveContribPence: number;
  operatingPence: number;   // running available cash after ring-fencing
  reservesPence: number;    // total ring-fenced balance at month end
  belowFloor: boolean;
};

export async function buildForecast() {
  const cfg = await getFinanceConfig();
  const drivers = await getDrivers();
  const now = new Date();
  const horizonEnd = new Date(now.getFullYear(), now.getMonth() + cfg.months, 1);

  const [entries, reservesRaw, bookings, consumables] = await Promise.all([
    db.cashflowEntry.findMany({ where: { active: true } }),
    db.cashReserve.findMany({ orderBy: { sortOrder: 'asc' } }),
    // Committed pipeline: confirmed/pending appointments within the horizon.
    drivers.useBookings
      ? db.booking.findMany({ where: { status: { in: ['PENDING', 'CONFIRMED'] }, startAt: { gte: now, lt: horizonEnd } }, select: { startAt: true, pricePence: true } })
      : Promise.resolve([] as { startAt: Date; pricePence: number }[]),
    // Consumables run-rate: last 90 days of stock consumed × unit cost → monthly.
    db.stockMovement.findMany({
      where: { reason: { in: ['USED', 'WASTED'] }, createdAt: { gte: new Date(Date.now() - 90 * 864e5) } },
      select: { delta: true, item: { select: { costPence: true } } },
    }),
  ]);

  // Map committed bookings to month index.
  const committedByMonth = new Array(cfg.months).fill(0);
  for (const b of bookings) {
    const idx = (b.startAt.getFullYear() - now.getFullYear()) * 12 + (b.startAt.getMonth() - now.getMonth());
    if (idx >= 0 && idx < cfg.months) committedByMonth[idx] += b.pricePence > 0 ? b.pricePence : drivers.avgValuePence;
  }

  // Monthly modelled consumables expense from trailing usage valuation.
  const consumed90 = consumables.reduce((s, m) => s + Math.abs(m.delta) * (m.item.costPence ?? 0), 0);
  const consumablesMonthly = Math.round(consumed90 / 3);

  // Modelled treatment demand per month (drivers × seasonality × growth × SEO).
  const visitorDemand = drivers.monthlyVisitors * (drivers.conversionPct / 100) * drivers.avgValuePence;
  const clientDemand = drivers.monthlyNewClients * drivers.avgValuePence;
  const baseDemand = Math.max(visitorDemand, clientDemand);
  const rankMult = rankMultiplier(drivers.seoRank);
  const modelledFor = (i: number, monthDate: Date) => {
    const growth = Math.pow(1 + drivers.industryGrowthPct / 100, i / 12);
    const season = drivers.useSeasonality ? seasonNorm[monthDate.getMonth()] : 1;
    return Math.round(baseDemand * growth * season * rankMult);
  };

  const reserveState = reservesRaw.map((r) => ({ ...r, running: r.balancePence }));
  const startReserves = reserveState.reduce((s, r) => s + r.balancePence, 0);

  const months: ForecastMonth[] = [];
  let cash = cfg.openingPence;

  for (let i = 0; i < cfg.months; i++) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
    let manualIncome = 0, expense = consumablesMonthly;
    for (const e of entries) {
      const amt = amountForMonth(e as Entry, monthDate);
      if (e.type === 'INCOME') manualIncome += amt; else expense += amt;
    }
    const committed = committedByMonth[i];
    const modelled = modelledFor(i, monthDate);
    // Treatment income: real bookings are the floor; modelled fills demand beyond them.
    const treatment = Math.max(committed, modelled);
    const income = treatment + manualIncome;

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
      incomePence: income, committedPence: committed, modelledPence: modelled,
      expensePence: expense, netPence: net,
      reserveContribPence: reserveContrib, operatingPence: cash,
      reservesPence: reserveState.reduce((s, r) => s + r.running, 0),
      belowFloor: cash < cfg.safetyFloorPence,
    });
  }

  return {
    cfg,
    drivers,
    consumablesMonthly,
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
