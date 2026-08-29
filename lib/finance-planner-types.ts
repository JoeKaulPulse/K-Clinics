// Types for the Finance planner (/admin/finance/planner) — the in-admin version
// of the standing financial model in docs/finance/. Shared by the server compute
// (lib/finance-planner.ts), the seed defaults, and the client UI, so keep this
// file free of server-only imports.

export type PlannerMachine = {
  key: string; // machine class key, e.g. 'diode-laser'
  name: string;
  ownership: string;
  purchase: number; // £
  inServiceMonth: number | null; // 0 = owned before the model starts; 1–36 = bought that month; null = not owned (excluded)
  lifeYears: number;
  kwhPerTreatmentHour: number;
  annualService: number; // £/yr
  plannedHoursMonth: number; // allocation base for service/depreciation per treatment hour
  consumablesNote: string;
  basis: string;
};

export type PlannerEnhancement = {
  name: string;
  cost: number; // £
  inServiceMonth: number | null;
  lifeYears: number;
};

export type PlannerInputs = {
  startMonth: string; // 'YYYY-MM'
  months: number; // horizon, capped at 36
  rooms: number;
  hvacRooms: number;
  openDaysPerWeek: number;
  openHoursPerDay: number;
  staff: {
    practitionerSalary: number;
    receptionistSalary: number;
    ownerSalary: number;
    onCost: number; // employer NI + pension multiplier
    practitionersByYear: number[]; // [Y1, Y2, Y3]
    receptionistsByYear: number[];
    productiveHoursPerWeek: number;
    workingWeeks: number;
  };
  energy: {
    unitRatePence: number; // p/kWh
    standingPencePerDay: number;
    baseLoadKWhPerDay: number;
    hvacKWhPerRoomMonth: number[]; // Jan..Dec, kWh per conditioned room
  };
  property: { rent: number; rates: number; serviceCharge: number }; // £/yr each
  overheads: {
    insurance: number; // £/yr
    softwareMonthly: number;
    cardFeePct: number; // fraction, e.g. 0.017
    cardShare: number; // fraction of turnover taken by card
    cleaningMonthly: number;
    otherMonthly: number;
  };
  marketing: { pctByYear: number[]; floorMonthly: number };
  tax: {
    vatRate: number; // 0.20
    vatThreshold: number; // rolling 12-month registration threshold £
    priorTurnover: number; // taxable turnover in the 12 months before the model starts £
    vatOverrideMonth: number; // 0 = auto from threshold; 1–36 forces registration from that month
    ctSmallRate: number;
    ctSmallLimit: number;
    ctMarginalRate: number;
    ctMarginalLimit: number;
    ctMainRate: number;
  };
  machines: PlannerMachine[];
  enhancements: PlannerEnhancement[];
  pricing: {
    targetMarginByClass: Record<string, number>; // fraction per machine class
    roundTo: number; // £ rounding for recommended prices
    priceForVat: boolean; // price for the VAT-registered state
    courseDiscounts: { s3: number; s6: number; s10: number }; // per-session discount fractions
  };
  volumes: {
    utilisation: number[]; // fraction per month, length = months
    mixByClass: Record<string, number>; // % of treated hours per class ('consultation' included); should sum to 100
    avgPriceOverride: Record<string, number | null>; // per class £ override of the catalogue average (null = use catalogue)
    avgDurationOverride: Record<string, number | null>; // per class minutes override (null = use catalogue)
  };
};

// ── Computed outputs ─────────────────────────────────────────────────────────

export type PricingRow = {
  serviceSlug: string;
  service: string;
  variant: string;
  category: string;
  status: string; // effective public status
  sellable: boolean;
  cls: string;
  durationMin: number;
  machineMin: number;
  vatRate: number;
  price: number; // current gross £
  net: number;
  consumables: number;
  machineEnergy: number;
  machineService: number;
  machineDep: number;
  labour: number;
  cardFee: number;
  loadedCost: number;
  contribution: number;
  contributionPct: number;
  targetPct: number;
  recommendedNet: number;
  recommended: number; // gross, rounded
  deltaPct: number; // recommended vs current
  course3: number;
  course6: number;
  course10: number;
  currentCourse6: number | null;
  currentCourse6DiscountPct: number | null;
};

export type ClassAggregate = {
  cls: string;
  label: string;
  avgDurationMin: number;
  avgPrice: number;
  avgDirectCost: number; // consumables + machine energy + machine service per session
  machineMin: number;
  kwhPerTreatmentHour: number;
  mixPct: number;
  sellableVariants: number;
};

export type PlanMonth = {
  label: string; // 'Sep 26'
  calMonth: number; // 0-11
  daysOpen: number;
  roomHours: number;
  utilisation: number;
  treatedHours: number;
  revenueHours: number; // excludes consultations
  sessions: number;
  grossRevenue: number;
  rolling12: number;
  vatOn: boolean;
  outputVat: number;
  netRevenue: number;
  directCosts: number;
  cardFees: number;
  grossProfit: number;
  staff: number;
  rent: number;
  rates: number;
  serviceCharge: number;
  facilityEnergy: number;
  machineEnergyCost: number;
  totalKWh: number;
  marketing: number;
  insurance: number;
  software: number;
  cleaning: number;
  other: number;
  ebitda: number;
  depreciation: number;
  amortisation: number;
  ebit: number;
  profitBeforeTax: number;
  taxAccrual: number;
  netProfit: number;
  practitionerHoursNeeded: number;
  practitionerHoursAvailable: number;
  overCapacity: boolean;
};

export type PlanYear = {
  label: string;
  grossRevenue: number;
  netRevenue: number;
  grossProfit: number;
  grossMarginPct: number;
  ebitda: number;
  ebitdaMarginPct: number;
  depreciation: number;
  amortisation: number;
  profitBeforeTax: number;
  tax: number; // banded (19% / 26.5% marginal / 25%)
  netProfit: number;
  netMarginPct: number;
};

export type Plan = {
  months: PlanMonth[];
  years: PlanYear[];
  pricing: PricingRow[];
  classes: ClassAggregate[];
  mixTotalPct: number;
  vatCrossingMonth: number | null; // 1-based model month VAT switches on, if within horizon
  loadedLabourPerHour: number;
  monthlyDepreciationNow: number;
  summary: {
    y1Ebitda: number;
    y3NetProfit: number;
    breakevenMonth: number | null; // first month with EBITDA >= 0
    underTargetVariants: number; // sellable variants priced below target margin
    belowCostVariants: number; // sellable variants with negative contribution
  };
};
