#!/usr/bin/env python3
"""Generate lib/finance-planner-defaults.ts from model-inputs.json.

The admin Finance planner (/admin/finance/planner) seeds its editable model
from this module; regenerate after refreshing model-inputs.json.
"""
import json, os
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
data = json.load(open(os.path.join(HERE, "model-inputs.json")))
syn = data["synthesis"]
cat = data["catalogue"]
rows = [t for t in syn["treatments"] if not t.get("meta")]
mach = [m for m in syn["machinery"] if not m.get("meta") and m["machineClass"] != "dental-surgery-DEFERRED"]
energy = syn["energy"]
opex = syn["opex"]

# Join synthesis rows (service NAME + variant) back to catalogue slugs.
name_to_slugs = defaultdict(list)
for s in cat["services"]:
    name_to_slugs[s["name"]].append(s["slug"])

class_map = {}          # serviceSlug -> machineClass
consumables = {}        # "serviceSlug|variantName" -> £/session
for t in rows:
    for slug in name_to_slugs.get(t["service"], []):
        class_map[slug] = t["machineClass"]
        consumables[f"{slug}|{t['variant']}"] = t.get("consumablesGBP") or 0

# Per-class consumable fallback (median) for variants added later in admin.
by_class = defaultdict(list)
for t in rows:
    by_class[t["machineClass"]].append(t.get("consumablesGBP") or 0)
class_fallback = {}
for k, v in by_class.items():
    v = sorted(v)
    class_fallback[k] = v[len(v) // 2]

planned_hours = {
    "diode-laser": 250, "laser-ipl-platform": 30, "pico-laser-PLANNED": 25, "co2-laser": 8,
    "hifu": 25, "rf-tightening": 12, "hydrafacial-platform": 60, "endosphere-vacuum": 45,
    "microneedling-pen": 18, "microdermabrasion": 8, "microcurrent-led": 25,
    "none-injectables": 25, "none-manual": 25,
}
machines = []
for m in mach:
    key = m["machineClass"]
    planned = key == "pico-laser-PLANNED" or m["ownership"].upper().startswith("NOT")
    machines.append({
        "key": key, "name": m["name"], "ownership": m["ownership"],
        "purchase": m["purchaseGBP"], "inServiceMonth": None if planned else 0,
        "lifeYears": m["lifeYears"], "kwhPerTreatmentHour": m["kWhPerTreatmentHour"],
        "annualService": m["annualServiceGBP"], "plannedHoursMonth": planned_hours.get(key, 20),
        "consumablesNote": m["consumablesModel"], "basis": m["basis"],
    })

target_default = {"none-injectables": 0.55, "hifu": 0.60, "hydrafacial-platform": 0.65, "microneedling-pen": 0.65, "none-manual": 0.65}
targets = {m["machineClass"]: target_default.get(m["machineClass"], 0.70) for m in mach}

# Hours-share mix seeded from live booking stats (see model workbook Volumes tab).
mix = {
    "diode-laser": 49.5, "laser-ipl-platform": 3.0, "hifu": 2.0, "rf-tightening": 2.0,
    "hydrafacial-platform": 11.0, "endosphere-vacuum": 8.0, "microneedling-pen": 3.0,
    "microdermabrasion": 0.5, "microcurrent-led": 4.0, "none-injectables": 3.0,
    "none-manual": 2.0, "co2-laser": 0.0, "pico-laser-PLANNED": 0.0, "consultation": 12.0,
}
assert abs(sum(mix.values()) - 100) < 1e-9, sum(mix.values())

util = [round(4 + (m - 1) * (25 - 4) / 35, 1) / 100 for m in range(1, 37)]
months_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
curve = [energy["hvacKWhPerRoomPerMonth"][m] for m in months_names]

defaults = {
    "startMonth": "2026-09", "months": 36,
    "rooms": 9, "hvacRooms": 9, "openDaysPerWeek": 6, "openHoursPerDay": 9.5,
    "staff": {
        "practitionerSalary": opex["staff"]["practitionerSalaryGBP"], "receptionistSalary": opex["staff"]["receptionistSalaryGBP"],
        "ownerSalary": 48000, "onCost": 1.16,
        "practitionersByYear": [2, 3, 5], "receptionistsByYear": [1, 1, 2],
        "productiveHoursPerWeek": 30, "workingWeeks": 46,
    },
    "energy": {
        "unitRatePence": energy["unitRatePencePerKWh"], "standingPencePerDay": energy["standingChargePencePerDay"],
        "baseLoadKWhPerDay": energy["baseLoadKWhPerDay"], "hvacKWhPerRoomMonth": curve,
    },
    "property": {"rent": opex["rent"]["placeholderGBPPerYear"], "rates": opex["businessRates"]["placeholderGBPPerYear"], "serviceCharge": 0},
    "overheads": {
        "insurance": opex["insuranceGBPPerYear"], "softwareMonthly": opex["softwareGBPPerMonth"],
        "cardFeePct": opex["cardFeesPctOfCardTurnover"] / 100, "cardShare": 0.95,
        "cleaningMonthly": 400, "otherMonthly": 200,
    },
    "marketing": {"pctByYear": [0.12, 0.10, 0.08], "floorMonthly": opex["marketing"]["fixedFloorGBPPerMonth"]},
    "tax": {
        "vatRate": 0.20, "vatThreshold": 90000, "priorTurnover": 25000, "vatOverrideMonth": 0,
        "ctSmallRate": 0.19, "ctSmallLimit": 50000, "ctMarginalRate": 0.265, "ctMarginalLimit": 250000, "ctMainRate": 0.25,
    },
    "machines": machines,
    "enhancements": [
        {"name": "Initial fit-out / leasehold improvements", "cost": 0, "inServiceMonth": 0, "lifeYears": 10},
        {"name": "Example — reception refresh (edit or zero out)", "cost": 8000, "inServiceMonth": 6, "lifeYears": 5},
    ],
    "pricing": {
        "targetMarginByClass": targets, "roundTo": 1, "priceForVat": True,
        "courseDiscounts": {"s3": 0.10, "s6": 0.15, "s10": 0.20},
    },
    "volumes": {"utilisation": util, "mixByClass": mix, "avgPriceOverride": {}, "avgDurationOverride": {}},
}

ts = f"""// GENERATED from docs/finance/model-inputs.json by docs/finance/gen_admin_defaults.py — do not edit by hand.
// Seed values for the admin Finance planner. Sources and confidence notes live in
// docs/finance/model-inputs.json (every figure carries a basis) and docs/finance/README.md.

import type {{ PlannerInputs }} from '@/lib/finance-planner-types';

export const PLANNER_DEFAULTS: PlannerInputs = {json.dumps(defaults, indent=2, ensure_ascii=False)};

/** treatment service slug -> machine class (drives energy/service/depreciation per session). */
export const CLASS_BY_SERVICE_SLUG: Record<string, string> = {json.dumps(class_map, indent=2, ensure_ascii=False)};

/** Estimated consumables £/session keyed "serviceSlug|variantName" (no recorded COGS exist in the DB). */
export const CONSUMABLES_BY_VARIANT: Record<string, number> = {json.dumps(consumables, indent=2, ensure_ascii=False)};

/** Fallback consumables £/session per machine class for variants with no per-variant estimate. */
export const CONSUMABLES_CLASS_FALLBACK: Record<string, number> = {json.dumps(class_fallback, indent=2, ensure_ascii=False)};
"""
# JSON null/true/false -> TS
ts = ts.replace(": null", ": null").replace(": True", ": true")
out = os.path.join(REPO, "lib", "finance-planner-defaults.ts")
open(out, "w").write(ts)
print("wrote", out, len(ts), "bytes;", len(machines), "machines,", len(consumables), "variant consumables,", len(class_map), "slugs mapped")
