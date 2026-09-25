// Pure compute for the Finance planner — no server imports, so it can be unit
// tested and reused. The maths mirrors docs/finance/KClinics-Financial-Model.xlsx
// (recalculation-verified); keep the two in step when changing formulas.
import type {
  PlannerInputs, PlannerMachine, Plan, PlanMonth, PlanYear, PricingRow, ClassAggregate,
} from '@/lib/finance-planner-types';
import {
  CLASS_BY_SERVICE_SLUG, CONSUMABLES_BY_VARIANT, CONSUMABLES_CLASS_FALLBACK,
} from '@/lib/finance-planner-defaults';

export const CLASS_LABELS: Record<string, string> = {
  'diode-laser': 'Laser hair removal (diode)',
  'laser-ipl-platform': 'IPL / laser skin',
  hifu: 'HIFU lifting',
  'rf-tightening': 'RF tightening',
  'hydrafacial-platform': 'HydraFacial & facials',
  'endosphere-vacuum': 'Body contouring (Endosphere)',
  'microneedling-pen': 'Microneedling & BB Glow',
  microdermabrasion: 'Microdermabrasion',
  'microcurrent-led': 'Microcurrent & LED',
  'none-injectables': 'Injectables',
  'none-manual': 'Peels, massage & manual',
  'co2-laser': 'CO2 laser (coming soon)',
  'pico-laser-PLANNED': 'Tattoo/pigment removal (pico — not purchased)',
  consultation: 'Consultations (no revenue)',
};

const NO_MACHINE_TIME = new Set(['none-injectables', 'none-manual', 'consultation']);

export type CatalogueVariant = {
  serviceSlug: string;
  service: string;
  category: string;
  serviceStatus: string;
  variant: string;
  durationMin: number;
  pricePence: number;
  variantStatus: string | null;
  active: boolean;
  courses: { sessions: number; totalPence: number }[] | null;
};

// ── Compute ──────────────────────────────────────────────────────────────────

const roundTo = (x: number, step: number) => (step > 0 ? Math.round(x / step) * step : x);

/** 2026/27 corporation tax with marginal relief, on annual profit. */
function corporationTax(profit: number, t: PlannerInputs['tax']): number {
  if (profit <= 0) return 0;
  if (profit <= t.ctSmallLimit) return profit * t.ctSmallRate;
  if (profit <= t.ctMarginalLimit) return t.ctSmallLimit * t.ctSmallRate + (profit - t.ctSmallLimit) * t.ctMarginalRate;
  return profit * t.ctMainRate;
}

export function buildPlan(inputs: PlannerInputs, catalogue: CatalogueVariant[]): Plan {
  const machinesByKey = new Map<string, PlannerMachine>(inputs.machines.map((m) => [m.key, m]));
  const loadedLabourPerHour =
    (inputs.staff.practitionerSalary * inputs.staff.onCost) /
    (inputs.staff.workingWeeks * inputs.staff.productiveHoursPerWeek);
  const cardDrag = inputs.overheads.cardFeePct * inputs.overheads.cardShare;

  const monthlyDep = (m: PlannerMachine) => (m.inServiceMonth === null ? 0 : m.purchase / (m.lifeYears * 12));
  const servicePerHour = (m: PlannerMachine) => (m.plannedHoursMonth > 0 ? m.annualService / 12 / m.plannedHoursMonth : 0);
  const depPerHour = (m: PlannerMachine) => (m.plannedHoursMonth > 0 ? monthlyDep(m) / m.plannedHoursMonth : 0);

  // Pricing rows from the live catalogue.
  const pricing: PricingRow[] = catalogue.map((row) => {
    const cls = CLASS_BY_SERVICE_SLUG[row.serviceSlug] || 'none-manual';
    const machine = machinesByKey.get(cls);
    const status = row.variantStatus || row.serviceStatus;
    const sellable = row.active && (status === 'NORMAL' || status === 'CONSULTATION');
    const usesMachine = !NO_MACHINE_TIME.has(cls) && !!machine;
    const machineMin = usesMachine ? row.durationMin : 0;
    const vatRate = row.category === 'dentistry' ? 0 : inputs.tax.vatRate;
    const v = inputs.pricing.priceForVat ? vatRate : 0;
    const price = row.pricePence / 100;
    const net = price / (1 + v);
    const consumables =
      CONSUMABLES_BY_VARIANT[`${row.serviceSlug}|${row.variant}`] ?? CONSUMABLES_CLASS_FALLBACK[cls] ?? 0;
    const machineEnergy = machine ? (machineMin / 60) * machine.kwhPerTreatmentHour * (inputs.energy.unitRatePence / 100) : 0;
    const machineService = machine ? (machineMin / 60) * servicePerHour(machine) : 0;
    const machineDep = machine ? (machineMin / 60) * depPerHour(machine) : 0;
    const labour = (row.durationMin / 60) * loadedLabourPerHour;
    const cardFee = price * cardDrag;
    const loadedCost = consumables + machineEnergy + machineService + machineDep + labour + cardFee;
    const contribution = net - loadedCost;
    const targetPct = inputs.pricing.targetMarginByClass[cls] ?? 0.7;
    const baseCost = consumables + machineEnergy + machineService + machineDep + labour;
    const denom = 1 - targetPct - cardDrag * (1 + v);
    const recommendedNet = denom > 0.01 ? baseCost / denom : 0;
    const recommended = roundTo(recommendedNet * (1 + v), inputs.pricing.roundTo);
    const cur6 = row.courses?.find((c) => c.sessions === 6)?.totalPence ?? null;
    const d = inputs.pricing.courseDiscounts;
    return {
      serviceSlug: row.serviceSlug, service: row.service, variant: row.variant, category: row.category,
      status, sellable, cls, durationMin: row.durationMin, machineMin, vatRate, price, net,
      consumables, machineEnergy, machineService, machineDep, labour, cardFee, loadedCost,
      contribution, contributionPct: net > 0 ? contribution / net : 0, targetPct,
      recommendedNet, recommended, deltaPct: price > 0 ? recommended / price - 1 : 0,
      course3: roundTo(recommended * 3 * (1 - d.s3), inputs.pricing.roundTo),
      course6: roundTo(recommended * 6 * (1 - d.s6), inputs.pricing.roundTo),
      course10: roundTo(recommended * 10 * (1 - d.s10), inputs.pricing.roundTo),
      currentCourse6: cur6 !== null ? cur6 / 100 : null,
      currentCourse6DiscountPct: cur6 !== null && price > 0 ? 1 - cur6 / 100 / (6 * price) : null,
    };
  });

  // Per-class aggregates over sellable variants (means; overridable).
  const classKeys = [...inputs.machines.map((m) => m.key), 'consultation'];
  const classes: ClassAggregate[] = classKeys.map((cls) => {
    const rows = pricing.filter((r) => r.cls === cls && r.sellable);
    const mean = (f: (r: PricingRow) => number) => (rows.length ? rows.reduce((s, r) => s + f(r), 0) / rows.length : 0);
    const machine = machinesByKey.get(cls);
    const isConsult = cls === 'consultation';
    const avgDurationMin = inputs.volumes.avgDurationOverride[cls] ?? (isConsult ? 20 : mean((r) => r.durationMin));
    const avgPrice = inputs.volumes.avgPriceOverride[cls] ?? (isConsult ? 0 : mean((r) => r.price));
    const avgDirectCost = isConsult ? 1 : mean((r) => r.consumables + r.machineEnergy + r.machineService);
    return {
      cls, label: CLASS_LABELS[cls] || cls,
      avgDurationMin, avgPrice, avgDirectCost,
      machineMin: isConsult ? 0 : mean((r) => r.machineMin),
      kwhPerTreatmentHour: machine?.kwhPerTreatmentHour ?? 0,
      mixPct: inputs.volumes.mixByClass[cls] ?? 0,
      sellableVariants: rows.length,
    };
  });
  const mixTotalPct = classes.reduce((s, c) => s + c.mixPct, 0);

  // Monthly forecast.
  const [startY, startM] = inputs.startMonth.split('-').map((x) => parseInt(x, 10));
  const months: PlanMonth[] = [];
  let cumRevenue = 0;
  const cumByMonth: number[] = [];
  let vatOnPrev = false;
  let rolling12Prev = 0;

  for (let i = 0; i < inputs.months; i++) {
    const date = new Date(startY, startM - 1 + i, 1);
    const calMonth = date.getMonth();
    const daysInMonth = new Date(date.getFullYear(), calMonth + 1, 0).getDate();
    const daysOpen = Math.round((daysInMonth * inputs.openDaysPerWeek) / 7);
    const roomHours = inputs.rooms * inputs.openHoursPerDay * daysOpen;
    const utilisation = inputs.volumes.utilisation[i] ?? inputs.volumes.utilisation[inputs.volumes.utilisation.length - 1] ?? 0.1;
    const treatedHours = roomHours * utilisation;
    const yearIdx = Math.min(Math.floor(i / 12), 2);

    let grossRevenue = 0, directCosts = 0, machineKWh = 0, sessions = 0, revenueHours = 0;
    for (const c of classes) {
      const hours = treatedHours * (c.mixPct / 100);
      if (c.avgDurationMin <= 0) continue;
      const n = (hours * 60) / c.avgDurationMin;
      sessions += n;
      grossRevenue += n * c.avgPrice;
      directCosts += n * c.avgDirectCost;
      machineKWh += n * (c.machineMin / 60) * c.kwhPerTreatmentHour;
      if (c.cls !== 'consultation') revenueHours += hours;
    }

    // VAT threshold tracker: registered from the month after rolling 12-month
    // turnover crosses the threshold (or from the manual override month).
    const override = inputs.tax.vatOverrideMonth;
    const vatOn: boolean = override > 0 ? i + 1 >= override : vatOnPrev || rolling12Prev >= inputs.tax.vatThreshold;
    cumRevenue += grossRevenue;
    cumByMonth.push(cumRevenue);
    const m1 = i + 1;
    const rolling12 =
      m1 < 12
        ? cumRevenue + inputs.tax.priorTurnover * ((12 - m1) / 12)
        : cumRevenue - (m1 === 12 ? 0 : cumByMonth[i - 12]);
    const outputVat = vatOn ? (grossRevenue * inputs.tax.vatRate) / (1 + inputs.tax.vatRate) : 0;
    const netRevenue = grossRevenue - outputVat;

    const cardFees = grossRevenue * cardDrag;
    const grossProfit = netRevenue - directCosts - cardFees;

    const staff =
      ((inputs.staff.practitionersByYear[yearIdx] ?? 0) * inputs.staff.practitionerSalary +
        (inputs.staff.receptionistsByYear[yearIdx] ?? 0) * inputs.staff.receptionistSalary +
        inputs.staff.ownerSalary) *
      inputs.staff.onCost / 12;
    const hvacKWh = (inputs.energy.hvacKWhPerRoomMonth[calMonth] ?? 0) * inputs.hvacRooms;
    const baseKWh = inputs.energy.baseLoadKWhPerDay * daysInMonth;
    const facilityEnergy = ((hvacKWh + baseKWh) * inputs.energy.unitRatePence) / 100 + (daysInMonth * inputs.energy.standingPencePerDay) / 100;
    const machineEnergyCost = (machineKWh * inputs.energy.unitRatePence) / 100;
    const marketing = Math.max(inputs.marketing.floorMonthly, (inputs.marketing.pctByYear[yearIdx] ?? 0.1) * netRevenue);

    const overheads =
      staff + inputs.property.rent / 12 + inputs.property.rates / 12 + inputs.property.serviceCharge / 12 +
      facilityEnergy + marketing + inputs.overheads.insurance / 12 + inputs.overheads.softwareMonthly +
      inputs.overheads.cleaningMonthly + inputs.overheads.otherMonthly;
    const ebitda = grossProfit - overheads;

    const active = (start: number | null, life: number) =>
      start !== null && m1 >= Math.max(start, 1) && m1 < start + life * 12;
    const depreciation = inputs.machines.reduce((s, m) => s + (active(m.inServiceMonth, m.lifeYears) ? monthlyDep(m) : 0), 0);
    const amortisation = inputs.enhancements.reduce(
      (s, e) => s + (e.lifeYears > 0 && active(e.inServiceMonth, e.lifeYears) ? e.cost / (e.lifeYears * 12) : 0), 0);

    const ebit = ebitda - depreciation - amortisation;
    const profitBeforeTax = ebit;
    const taxAccrual = Math.max(0, profitBeforeTax) * inputs.tax.ctSmallRate;
    const netProfit = profitBeforeTax - taxAccrual;

    const practitionerHoursAvailable =
      ((inputs.staff.practitionersByYear[yearIdx] ?? 0) + 1) *
      ((inputs.staff.productiveHoursPerWeek * inputs.staff.workingWeeks) / 12);

    months.push({
      label: date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
      calMonth, daysOpen, roomHours, utilisation, treatedHours, revenueHours, sessions,
      grossRevenue, rolling12, vatOn, outputVat, netRevenue, directCosts, cardFees, grossProfit,
      staff, rent: inputs.property.rent / 12, rates: inputs.property.rates / 12,
      serviceCharge: inputs.property.serviceCharge / 12, facilityEnergy, machineEnergyCost,
      totalKWh: hvacKWh + baseKWh + machineKWh, marketing,
      insurance: inputs.overheads.insurance / 12, software: inputs.overheads.softwareMonthly,
      cleaning: inputs.overheads.cleaningMonthly, other: inputs.overheads.otherMonthly,
      ebitda, depreciation, amortisation, ebit, profitBeforeTax, taxAccrual, netProfit,
      practitionerHoursNeeded: revenueHours,
      practitionerHoursAvailable,
      overCapacity: revenueHours > practitionerHoursAvailable,
    });
    vatOnPrev = vatOn;
    rolling12Prev = rolling12;
  }

  // Annual summary with proper CT bands.
  const years: PlanYear[] = [];
  for (let y = 0; y * 12 < months.length; y++) {
    const slice = months.slice(y * 12, (y + 1) * 12);
    const sum = (f: (m: PlanMonth) => number) => slice.reduce((s, m) => s + f(m), 0);
    const netRevenue = sum((m) => m.netRevenue);
    const grossProfit = sum((m) => m.grossProfit);
    const ebitda = sum((m) => m.ebitda);
    const pbt = sum((m) => m.profitBeforeTax);
    const tax = corporationTax(pbt, inputs.tax);
    years.push({
      label: `Year ${y + 1}`,
      grossRevenue: sum((m) => m.grossRevenue), netRevenue,
      grossProfit, grossMarginPct: netRevenue > 0 ? grossProfit / netRevenue : 0,
      ebitda, ebitdaMarginPct: netRevenue > 0 ? ebitda / netRevenue : 0,
      depreciation: sum((m) => m.depreciation), amortisation: sum((m) => m.amortisation),
      profitBeforeTax: pbt, tax, netProfit: pbt - tax,
      netMarginPct: netRevenue > 0 ? (pbt - tax) / netRevenue : 0,
    });
  }

  const vatIdx = months.findIndex((m) => m.vatOn);
  const breakevenIdx = months.findIndex((m) => m.ebitda >= 0);
  const sellableRows = pricing.filter((r) => r.sellable);
  return {
    months, years, pricing, classes, mixTotalPct,
    vatCrossingMonth: vatIdx >= 0 ? vatIdx + 1 : null,
    loadedLabourPerHour,
    monthlyDepreciationNow: months[0]?.depreciation ?? 0,
    summary: {
      y1Ebitda: years[0]?.ebitda ?? 0,
      y3NetProfit: years[2]?.netProfit ?? years[years.length - 1]?.netProfit ?? 0,
      breakevenMonth: breakevenIdx >= 0 ? breakevenIdx + 1 : null,
      underTargetVariants: sellableRows.filter((r) => r.contributionPct < r.targetPct).length,
      belowCostVariants: sellableRows.filter((r) => r.contribution < 0).length,
    },
  };
}
