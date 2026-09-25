// Verify lib/finance-planner-compute against the recalculation-verified workbook.
// Feeds buildPlan the same frozen input set the workbook was built from and
// compares checkpoint values read from the recalced xlsx.
import { buildPlan, type CatalogueVariant } from '@/lib/finance-planner-compute';
import { PLANNER_DEFAULTS } from '@/lib/finance-planner-defaults';
import * as fs from 'fs';

// Run from the repo root (see docs/finance/README.md for the esbuild command).
const data = JSON.parse(fs.readFileSync('docs/finance/model-inputs.json', 'utf8'));
const rows = data.synthesis.treatments.filter((t: { meta?: boolean }) => !t.meta);

// name -> slug (first match; duplicates share prices so class/consumable lookups agree)
const nameToSlug = new Map<string, string>();
for (const s of data.catalogue.services) if (!nameToSlug.has(s.name)) nameToSlug.set(s.name, s.slug);
const catNameToCategory = new Map<string, string>();
for (const s of data.catalogue.services) catNameToCategory.set(s.name, s.category);

const catalogue: CatalogueVariant[] = rows.map((t: Record<string, unknown>) => {
  const status = String(t.status);
  return {
    serviceSlug: nameToSlug.get(String(t.service)) || '?',
    service: String(t.service),
    category: catNameToCategory.get(String(t.service)) || 'aesthetics',
    serviceStatus: status === 'ACTIVE' ? 'NORMAL' : status === 'INACTIVE' ? 'NORMAL' : status,
    variant: String(t.variant),
    durationMin: Number(t.durMin),
    pricePence: Math.round(Number(t.priceGBP) * 100),
    variantStatus: null,
    active: status !== 'INACTIVE',
    courses: null,
  };
});

const plan = buildPlan(PLANNER_DEFAULTS, catalogue);

const checks: [string, number, number, number][] = [
  // label, got, expected (workbook, recalc-verified), tolerance
  ['month 1 gross revenue', plan.months[0].grossRevenue, 13316.94, 30],
  ['month 12 EBITDA', plan.months[11].ebitda, 745.77, 60],
  ['Y1 profit before tax', plan.years[0].profitBeforeTax, -104657.55, 300],
  ['Y2 tax', plan.years[1].tax, 6246.37, 120],
  ['Y3 net profit', plan.years[2].netProfit, 86480.9, 400],
  ['VAT crossing month', plan.vatCrossingMonth ?? -1, 6, 0],
  ['loaded labour £/hr', plan.loadedLabourPerHour, 34.4638, 0.01],
  ['monthly depreciation', plan.monthlyDepreciationNow, 3048.94, 0.5],
];
const bikini = plan.pricing.find((r) => r.service.includes('Laser Hair Removal — Women') && r.variant === 'Bikini Line');
if (bikini) {
  checks.push(['Bikini loaded cost', bikini.loadedCost, 14.1289, 0.01]);
  checks.push(['Bikini recommended £', bikini.recommended, 58, 0]);
  checks.push(['Bikini contribution %', bikini.contributionPct, 0.5156, 0.001]);
} else {
  console.log('FAIL: Bikini Line row not found');
  process.exit(1);
}

let ok = true;
for (const [label, got, exp, tol] of checks) {
  const pass = Math.abs(got - exp) <= tol;
  ok &&= pass;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}: got ${got.toFixed(2)} expected ${exp} (±${tol})`);
}
console.log(ok ? 'ALL CHECKS PASS' : 'CHECKS FAILED');
process.exit(ok ? 0 : 1);
