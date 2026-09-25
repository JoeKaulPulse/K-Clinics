import 'server-only';
import { db } from '@/lib/db';
import type { PlannerInputs } from '@/lib/finance-planner-types';
import { PLANNER_DEFAULTS } from '@/lib/finance-planner-defaults';
import type { CatalogueVariant } from '@/lib/finance-planner-compute';

export { buildPlan, CLASS_LABELS } from '@/lib/finance-planner-compute';
export type { CatalogueVariant } from '@/lib/finance-planner-compute';

// Finance planner (/admin/finance/planner): the standing financial model from
// docs/finance/ running live inside the admin. Pricing rows come from the live
// Service/ServiceVariant catalogue; every assumption is editable and stored as
// one JSON blob in the Setting table (no schema changes — deploy-gate safe).
// The maths mirrors docs/finance/KClinics-Financial-Model.xlsx, which was
// recalculation-verified; keep the two in step when changing formulas.

const SETTING_KEY = 'finance_planner_model_v1';



// ── Storage ──────────────────────────────────────────────────────────────────

type JsonObject = Record<string, unknown>;

function isPlainObject(v: unknown): v is JsonObject {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** Deep-merge stored overrides onto defaults. Arrays and scalars replace wholesale. */
function merge<T>(base: T, over: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(over)) return (over === undefined ? base : (over as T));
  const out: JsonObject = { ...(base as JsonObject) };
  for (const [k, v] of Object.entries(over)) {
    const b = (base as JsonObject)[k];
    out[k] = isPlainObject(b) && isPlainObject(v) ? merge(b, v) : v;
  }
  return out as T;
}

function sanitise(inputs: PlannerInputs): PlannerInputs {
  const months = Math.min(Math.max(Math.round(inputs.months) || 36, 12), 36);
  const util = Array.from({ length: months }, (_, i) => {
    const v = Number(inputs.volumes.utilisation[i]);
    return Number.isFinite(v) ? Math.min(Math.max(v, 0), 1) : 0.1;
  });
  const curve = Array.from({ length: 12 }, (_, i) => Math.max(0, Number(inputs.energy.hvacKWhPerRoomMonth[i]) || 0));
  return {
    ...inputs,
    months,
    volumes: { ...inputs.volumes, utilisation: util },
    energy: { ...inputs.energy, hvacKWhPerRoomMonth: curve },
    machines: inputs.machines.filter((m) => m && m.key),
    enhancements: (inputs.enhancements || []).filter((e) => e && e.name),
  };
}

export async function loadPlannerInputs(): Promise<PlannerInputs> {
  const row = await db.setting.findUnique({ where: { key: SETTING_KEY } });
  if (!row) return sanitise(PLANNER_DEFAULTS);
  try {
    return sanitise(merge(PLANNER_DEFAULTS, JSON.parse(row.value)));
  } catch {
    return sanitise(PLANNER_DEFAULTS);
  }
}

export async function savePlannerInputs(partial: unknown, by?: string): Promise<PlannerInputs> {
  const current = await loadPlannerInputs();
  const next = sanitise(merge(current, partial));
  const value = JSON.stringify(next);
  await db.setting.upsert({
    where: { key: SETTING_KEY },
    update: { value, updatedBy: by },
    create: { key: SETTING_KEY, value, updatedBy: by },
  });
  return next;
}

export async function resetPlannerInputs(): Promise<void> {
  await db.setting.deleteMany({ where: { key: SETTING_KEY } });
}

// ── Live catalogue ───────────────────────────────────────────────────────────


export async function loadCatalogue(): Promise<CatalogueVariant[]> {
  const services = await db.service.findMany({
    where: { active: true },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    include: { variants: { orderBy: { order: 'asc' } } },
  });
  const rows: CatalogueVariant[] = [];
  for (const s of services) {
    for (const v of s.variants) {
      let courses: { sessions: number; totalPence: number }[] | null = null;
      if (Array.isArray(v.courses)) {
        courses = (v.courses as unknown[])
          .filter((c): c is { sessions: number; totalPence: number } =>
            isPlainObject(c) && typeof c.sessions === 'number' && typeof c.totalPence === 'number')
          .map((c) => ({ sessions: c.sessions, totalPence: c.totalPence }));
      }
      rows.push({
        serviceSlug: s.slug, service: s.name, category: s.category, serviceStatus: s.status,
        variant: v.name, durationMin: v.durationMin, pricePence: v.pricePence,
        variantStatus: v.status, active: v.active, courses,
      });
    }
  }
  return rows;
}

