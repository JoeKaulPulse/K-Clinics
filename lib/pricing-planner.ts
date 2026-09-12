// Pricing planner maths (BLD-1758) — cost of goods → retail price.
//
// Pure functions, no database and no 'server-only', so the same code runs in
// the planner UI as you type and on the server when a scenario is saved or a
// catalogue margin is worked out. Everything is in pence; percentages are
// whole-or-fractional numbers out of 100 (20 = 20%).
//
// Money model (matches lib/vat.ts): a retail price is what the client actually
// pays, VAT INCLUSIVE. VAT is extracted from within it, never added on top, so
// margin is always measured against net (ex-VAT) revenue — the money the clinic
// keeps. Card fees are charged by the processor on the gross amount taken.

import { ratePctForClass, type VatClass } from '@/lib/vat-rates';

export type CostLine = {
  id: string;
  label: string;
  /** Units consumed per sale — fractional is fine (0.5 of a vial). */
  qty: number;
  /** Cost of one unit, ex VAT, in pence. */
  unitCostPence: number;
};

export type PlannerInputs = {
  costLines: CostLine[];
  /** Chair/clinician time for one sale. */
  staffMinutes: number;
  /** Fully loaded staff cost per hour, in pence. */
  staffHourlyPence: number;
  /** Fixed overhead attributed to one sale (room, kit depreciation, admin). */
  overheadPence: number;
  /** Card processing: a percentage of the gross charge plus a fixed fee. */
  cardFeePct: number;
  cardFeeFixedPence: number;
  vatClass: VatClass;
  /** Target gross margin on net revenue, used for the suggested price. */
  targetMarginPct: number;
  /** A price to test — the "what if I charge this?" side. */
  pricePence: number;
  /** Monthly fixed costs, for the break-even volume figure. 0 = hide. */
  monthlyFixedPence: number;
};

export type VatContext = { registered: boolean; defaultRatePct: number };

export const EMPTY_INPUTS: PlannerInputs = {
  costLines: [],
  staffMinutes: 0,
  staffHourlyPence: 0,
  overheadPence: 0,
  cardFeePct: 1.5,
  cardFeeFixedPence: 20,
  vatClass: 'STANDARD',
  targetMarginPct: 70,
  pricePence: 0,
  monthlyFixedPence: 0,
};

export type PlannerResult = {
  /** Consumables and anything else entered as a cost line. */
  goodsPence: number;
  staffPence: number;
  overheadPence: number;
  /** goods + staff + overhead — everything except the card fee, which depends
   *  on the price and so is not knowable until one is chosen. */
  directCostPence: number;
  vatRatePct: number;

  // At the price being tested.
  pricePence: number;
  netPence: number;
  vatPence: number;
  cardFeePence: number;
  totalCostPence: number;
  profitPence: number;
  /** Profit as a share of net revenue. */
  marginPct: number;
  /** Profit as a share of total cost — what a supplier calls mark-up. */
  markupPct: number;
  /** Whether the price covers its costs at all. */
  belowCost: boolean;

  // At the target margin.
  suggestedPricePence: number;
  /** True when no price reaches the target (card fee % + margin ≥ 100%). */
  targetUnreachable: boolean;

  /** Sales a month needed to cover monthlyFixedPence at the tested price.
   *  null when there are no fixed costs or no profit per sale. */
  breakEvenUnits: number | null;
};

const round = (n: number) => Math.round(Number.isFinite(n) ? n : 0);
const clampPct = (n: number) => Math.min(100, Math.max(0, Number.isFinite(n) ? n : 0));

/** Money kept per sale, after VAT is taken out and the card fee is paid. */
function netOf(pricePence: number, ratePct: number): number {
  return ratePct > 0 ? round(pricePence / (1 + ratePct / 100)) : round(pricePence);
}

export function cardFeeOn(pricePence: number, pct: number, fixedPence: number): number {
  if (pricePence <= 0) return 0;
  return round((pricePence * Math.max(0, pct)) / 100) + round(Math.max(0, fixedPence));
}

/** Cost of goods for one sale: every cost line, rounded per line so the total
 *  matches what the table shows. */
export function goodsCost(lines: CostLine[]): number {
  return lines.reduce((sum, l) => sum + round(Math.max(0, l.qty) * Math.max(0, l.unitCostPence)), 0);
}

/**
 * The gross price that hits `targetMarginPct` on net revenue.
 *
 *   net = price / (1 + r)            VAT is inside the price
 *   fee = price × f + c              the processor takes its cut of the gross
 *   profit = net − D − fee           D = direct cost (goods + staff + overhead)
 *
 * Setting profit = m × net and solving for net:
 *
 *   net (1 − m − (1 + r) f) = D + c
 *
 * The bracket is what each £1 of net revenue is left with after the margin and
 * the percentage fee. At or below zero no price ever reaches the target — every
 * extra pound charged hands the same share (or more) straight back out — so the
 * caller is told it is unreachable rather than shown a nonsense number.
 */
export function priceForMargin(directCostPence: number, marginPct: number, vatRatePct: number, cardFeePct: number, cardFeeFixedPence: number): number | null {
  const m = clampPct(marginPct) / 100;
  const r = Math.max(0, vatRatePct) / 100;
  const f = Math.max(0, cardFeePct) / 100;
  const denom = 1 - m - (1 + r) * f;
  if (denom <= 0) return null;
  const net = (Math.max(0, directCostPence) + Math.max(0, round(cardFeeFixedPence))) / denom;
  return round(net * (1 + r));
}

export function planPricing(inputs: PlannerInputs, vat: VatContext): PlannerResult {
  const vatRatePct = vat.registered ? Math.max(0, ratePctForClass(inputs.vatClass, vat.defaultRatePct)) : 0;

  const goodsPence = goodsCost(inputs.costLines);
  const staffPence = round((Math.max(0, inputs.staffMinutes) / 60) * Math.max(0, inputs.staffHourlyPence));
  const overheadPence = round(Math.max(0, inputs.overheadPence));
  const directCostPence = goodsPence + staffPence + overheadPence;

  const pricePence = round(Math.max(0, inputs.pricePence));
  const netPence = netOf(pricePence, vatRatePct);
  const vatPence = pricePence - netPence;
  const cardFeePence = cardFeeOn(pricePence, inputs.cardFeePct, inputs.cardFeeFixedPence);
  const totalCostPence = directCostPence + cardFeePence;
  const profitPence = netPence - totalCostPence;

  const suggested = priceForMargin(directCostPence, inputs.targetMarginPct, vatRatePct, inputs.cardFeePct, inputs.cardFeeFixedPence);
  const monthlyFixed = round(Math.max(0, inputs.monthlyFixedPence));

  return {
    goodsPence, staffPence, overheadPence, directCostPence, vatRatePct,
    pricePence, netPence, vatPence, cardFeePence, totalCostPence, profitPence,
    marginPct: netPence > 0 ? (profitPence / netPence) * 100 : 0,
    markupPct: totalCostPence > 0 ? (profitPence / totalCostPence) * 100 : 0,
    belowCost: pricePence > 0 && profitPence < 0,
    suggestedPricePence: suggested ?? 0,
    targetUnreachable: suggested === null,
    breakEvenUnits: monthlyFixed > 0 && profitPence > 0 ? Math.ceil(monthlyFixed / profitPence) : null,
  };
}

/** Margin (% of net revenue) a catalogue row earns at its listed price, given
 *  only its recorded cost of goods. No staff time, overhead or card fee — those
 *  aren't recorded per item — so this is the optimistic figure the catalogue
 *  table shows, not the planner's. */
export function catalogueMarginPct(pricePence: number, costPence: number, vatRatePct: number): number | null {
  if (pricePence <= 0) return null;
  const net = netOf(pricePence, vatRatePct);
  if (net <= 0) return null;
  return ((net - Math.max(0, costPence)) / net) * 100;
}

/** The listed price a catalogue row needs for `marginPct` on the same basis. */
export function cataloguePriceForMargin(costPence: number, marginPct: number, vatRatePct: number): number | null {
  const m = clampPct(marginPct) / 100;
  if (m >= 1) return null;
  const net = Math.max(0, costPence) / (1 - m);
  return round(net * (1 + Math.max(0, vatRatePct) / 100));
}

export type Rounding = 'none' | 'pound' | 'five' | 'ninetynine';

/** Tidy a calculated price into something you would actually put on a menu.
 *  Always rounds UP, so the target margin survives the tidying. */
export function tidyPrice(pence: number, mode: Rounding): number {
  const p = round(Math.max(0, pence));
  if (p <= 0 || mode === 'none') return p;
  if (mode === 'pound') return Math.ceil(p / 100) * 100;
  if (mode === 'five') return Math.ceil(p / 500) * 500;
  // .99 — the next whole pound, minus a penny, never below the input.
  const next = Math.ceil(p / 100) * 100;
  return next - 1 >= p ? next - 1 : next + 99;
}

export const money = (pence: number) => `£${(Math.round(pence) / 100).toFixed(2)}`;
export const pct = (n: number) => `${n >= 0 ? '' : '−'}${Math.abs(n).toFixed(1)}%`;
