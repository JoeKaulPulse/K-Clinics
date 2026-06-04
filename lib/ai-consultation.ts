import 'server-only';
import { db } from '@/lib/db';
import { encryptJson } from '@/lib/crypto';

// ── "Get My Plan" — AI consultation engine ──────────────────────────────────
// Cost-minimal: Claude Haiku by default (escalates to Sonnet only on low
// confidence), browser-downscaled images, cached system prompt, capped output.
// Produces a PHASED, dated treatment schedule within the client's chosen budget,
// plus a separate "worth considering" set above budget. Everything is bound to
// the real priced catalogue, so a plan is always bookable and margin-positive.

const HAIKU = 'claude-haiku-4-5-20251001';
const SONNET = 'claude-sonnet-4-6';
const MONTHLY_CAP = Number(process.env.AI_MONTHLY_CAP || 3);
const MAX_IMAGES = 4;

export const AREAS = [
  { id: 'skin', label: 'Face & skin' },
  { id: 'teeth', label: 'Teeth & smile' },
  { id: 'hair', label: 'Hair & scalp' },
  { id: 'body', label: 'Body & contour' },
] as const;

export type Finding = { area: string; label: string; note: string; severity: 'mild' | 'moderate' | 'notable' };
export type PlanTreatment = { slug: string; title: string; sessions: number; intervalWeeks: number; reason: string; fromPence: number; totalPence: number; href: string };
export type Phase = { title: string; timing: string; startISO: string; expect: string; treatments: PlanTreatment[]; phaseTotalPence: number };
export type Extra = { slug: string; title: string; fromPence: number; reason: string; href: string };
export type AnalyzeResult =
  | { ok: true; analysisId: string; summary: string; findings: Finding[]; phases: Phase[]; planTotalPence: number; extras: Extra[]; confidence: number; needsExpert: boolean }
  | { ok: false; reason: 'unavailable' | 'limit' | 'refused' | 'error'; message: string };

function areaForSlug(slug: string, category: string): string {
  if (category === 'dentistry' || /teeth|veneer|whiten|bonding|dental|smile|braces|denture/.test(slug)) return 'teeth';
  if (/hair-removal|scalp/.test(slug)) return 'hair';
  if (/body-contour|endosphere|bodysphere|hifu|fat-dissolv|cellulite/.test(slug)) return 'body';
  return 'skin';
}

type MenuItem = { slug: string; title: string; area: string; fromPence: number; courses: { sessions: number; totalPence: number }[] };

async function buildMenu(): Promise<MenuItem[]> {
  const { listServices } = await import('@/lib/services');
  const services = await listServices(false);
  return services
    .map((s) => {
      const priced = s.variants.filter((v) => v.pricePence > 0).sort((a, b) => a.pricePence - b.pricePence);
      const cheapest = priced[0];
      return { slug: s.treatmentSlug, title: s.name, area: areaForSlug(s.treatmentSlug, s.category), fromPence: cheapest?.pricePence ?? 0, courses: cheapest?.courses ?? [] };
    })
    .filter((m, i, arr) => arr.findIndex((x) => x.slug === m.slug) === i);
}

function priceLine(m: MenuItem, sessions: number): number {
  if (sessions > 1) {
    const exact = m.courses.find((c) => c.sessions === sessions);
    if (exact) return exact.totalPence;
    return m.fromPence * sessions;
  }
  return m.fromPence;
}

export async function analysesThisMonth(clientId: string): Promise<number> {
  const since = new Date(); since.setDate(1); since.setHours(0, 0, 0, 0);
  return db.aiAnalysis.count({ where: { clientId, createdAt: { gte: since }, status: 'complete' } });
}

type Img = { area?: string; dataUrl: string };

export async function analyze(opts: { clientId: string; areas: string[]; images: Img[]; storeImages: boolean; budgetPence: number | null; budgetLabel: string }): Promise<AnalyzeResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, reason: 'unavailable', message: 'The consultation isn’t available right now.' };
  if ((await analysesThisMonth(opts.clientId)) >= MONTHLY_CAP) return { ok: false, reason: 'limit', message: `You’ve used your ${MONTHLY_CAP} plans this month. Book a visit and we’ll take it from here.` };

  const images = opts.images.slice(0, MAX_IMAGES).filter((i) => i.dataUrl.startsWith('data:image/'));
  if (images.length === 0) return { ok: false, reason: 'error', message: 'Please add at least one clear photo.' };

  const menu = await buildMenu();
  const allowed = menu.filter((m) => opts.areas.includes(m.area));
  const menuText = (allowed.length ? allowed : menu).map((m) => `- ${m.slug} | ${m.title} | area:${m.area} | from £${Math.round(m.fromPence / 100)}/session`).join('\n');
  const budgetText = opts.budgetPence ? `The client's TOTAL budget is about £${Math.round(opts.budgetPence / 100)}. Keep the core phased plan within this; put anything beyond it in "worthConsidering".` : 'The client is flexible on budget — build the ideal plan and add premium complements in "worthConsidering".';

  const system = `You are a cosmetic skin/teeth/hair imaging assistant for KClinics (aesthetics & dentistry, London). You give warm, encouraging COSMETIC GUIDANCE — never a medical diagnosis, never alarming. Recommend ONLY from the ALLOWED TREATMENTS (exact slug). If a photo shows genitals/intimate areas, a minor, or isn't a usable face/skin/teeth/hair/body photo, set "refused": true.

ALLOWED TREATMENTS (slug | name | area | from-price):
${menuText}

${budgetText}

CLINICAL JUDGEMENT — match the plan to what you can ACTUALLY SEE, and err on the side of LESS:
- Least-invasive-first. Recommend the gentlest treatment that addresses each visible concern — hydrating/brightening facials, light maintenance and targeted care before anything stronger.
- Reserve intensive or aggressive treatments (ablative/resurfacing lasers such as laser skin resurfacing/rejuvenation, deep chemical peels, long high-intensity courses) for concerns that genuinely warrant them — i.e. "notable" texture, scarring, or pronounced ageing/pigmentation. NEVER recommend resurfacing or aggressive courses for skin that already looks healthy or has only mild concerns; it won't make sense to the client and can feel pushy.
- Right-size everything. Session counts, intervals and the number of phases must reflect severity. Mild concerns → a light, short plan; sometimes a single treatment, occasional maintenance, or even "you're in great shape — here's light upkeep" is the honest answer. Only propose a multi-session course (3–6, spaced 2–6 weeks) when the concern clearly needs it.
- Do NOT pad the plan to fill phases or to reach the budget. A small, well-judged plan is better than an over-treated one. Spend less than the budget when that's genuinely appropriate.
- If concerns are minimal, it's fine to return a single short phase (or focus on maintenance) and put anything optional in "worthConsidering" rather than the core plan.

Explain what to expect at each phase in plain, reassuring language.

Return STRICT JSON only:
{"refused":false,"confidence":0.0-1.0,"needsExpert":false,"summary":"one warm sentence",
"findings":[{"area":"skin|teeth|hair|body","label":"short","note":"1 gentle sentence","severity":"mild|moderate|notable"}],
"phases":[{"title":"Phase 1","timing":"Weeks 1–6","startWeek":0,"expect":"what to expect / milestone, 1 sentence","treatments":[{"slug":"<from list>","sessions":3,"intervalWeeks":2,"reason":"why, 1 sentence"}]}],
"worthConsidering":[{"slug":"<from list>","reason":"why it would help, 1 sentence"}]}
Use 1–4 phases and 1–2 treatments each — fewer when little is needed (a single phase with one treatment is perfectly valid). 0–3 worthConsidering. Set needsExpert only if photos are unclear or the case is genuinely complex.`;

  const userContent: object[] = [
    { type: 'text', text: `Areas: ${opts.areas.join(', ') || 'general'}. Budget: ${opts.budgetLabel}. Please analyse the attached photo(s) and build my plan.` },
    ...images.map((i) => {
      const [meta, b64] = i.dataUrl.split(',');
      const media = /data:(image\/\w+);/.exec(meta)?.[1] || 'image/jpeg';
      return { type: 'image', source: { type: 'base64', media_type: media, data: b64 } };
    }),
  ];

  let parsed = await callClaude(key, HAIKU, system, userContent);
  if (parsed && !parsed.refused && (parsed.needsExpert || (parsed.confidence ?? 1) < 0.5) && process.env.AI_DISABLE_ESCALATION !== 'true') {
    const better = await callClaude(key, SONNET, system, userContent);
    if (better) parsed = better;
  }
  if (!parsed) return { ok: false, reason: 'error', message: 'We couldn’t complete the analysis. Please try again.' };
  if (parsed.refused) {
    await db.aiAnalysis.create({ data: { clientId: opts.clientId, areas: opts.areas, model: parsed._model, status: 'refused', budgetPence: opts.budgetPence } }).catch(() => {});
    return { ok: false, reason: 'refused', message: 'We couldn’t analyse those photos. Please upload clear, well-lit photos of your face, skin, teeth or hair (no intimate areas).' };
  }

  const bySlug = new Map(menu.map((m) => [m.slug, m]));
  const now = Date.now();

  // Resolve phases → priced, dated treatments.
  const phases: Phase[] = [];
  for (const ph of Array.isArray(parsed.phases) ? parsed.phases : []) {
    const p = ph as { title?: string; timing?: string; startWeek?: number; expect?: string; treatments?: unknown[] };
    const startISO = new Date(now + Math.max(0, Number(p.startWeek) || 0) * 7 * 86400000).toISOString();
    const treatments: PlanTreatment[] = [];
    for (const t of Array.isArray(p.treatments) ? p.treatments : []) {
      const tr = t as { slug?: string; sessions?: number; intervalWeeks?: number; reason?: string };
      const m = tr.slug ? bySlug.get(tr.slug) : undefined;
      if (!m) continue;
      const sessions = Math.max(1, Math.min(12, Math.round(Number(tr.sessions) || 1)));
      treatments.push({ slug: m.slug, title: m.title, sessions, intervalWeeks: Math.max(0, Math.round(Number(tr.intervalWeeks) || 0)), reason: String(tr.reason || '').slice(0, 200), fromPence: m.fromPence, totalPence: priceLine(m, sessions), href: `/book?treatment=${m.slug}` });
    }
    if (treatments.length === 0) continue;
    phases.push({ title: String(p.title || `Phase ${phases.length + 1}`).slice(0, 60), timing: String(p.timing || '').slice(0, 60), startISO, expect: String(p.expect || '').slice(0, 220), treatments, phaseTotalPence: treatments.reduce((s, x) => s + x.totalPence, 0) });
  }

  // Resolve extras ("worth considering").
  const extras: Extra[] = [];
  for (const e of Array.isArray(parsed.worthConsidering) ? parsed.worthConsidering : []) {
    const ex = e as { slug?: string; reason?: string };
    const m = ex.slug ? bySlug.get(ex.slug) : undefined;
    if (!m || extras.some((x) => x.slug === m.slug)) continue;
    extras.push({ slug: m.slug, title: m.title, fromPence: m.fromPence, reason: String(ex.reason || '').slice(0, 200), href: `/book?treatment=${m.slug}` });
    if (extras.length >= 3) break;
  }

  // Budget guardrail: trim the most expensive in-plan treatment into "extras"
  // until the core plan fits the budget (always keep at least one treatment).
  let planTotal = phases.reduce((s, p) => s + p.phaseTotalPence, 0);
  if (opts.budgetPence) {
    let guard = 0;
    while (planTotal > opts.budgetPence && guard++ < 12) {
      const count = phases.reduce((s, p) => s + p.treatments.length, 0);
      if (count <= 1) break;
      let bestPh = -1, bestI = -1, bestPrice = -1;
      phases.forEach((p, pi) => p.treatments.forEach((t, ti) => { if (t.totalPence > bestPrice) { bestPrice = t.totalPence; bestPh = pi; bestI = ti; } }));
      if (bestPh < 0) break;
      const [removed] = phases[bestPh].treatments.splice(bestI, 1);
      phases[bestPh].phaseTotalPence -= removed.totalPence;
      if (!extras.some((x) => x.slug === removed.slug)) extras.unshift({ slug: removed.slug, title: removed.title, fromPence: removed.fromPence, reason: removed.reason, href: removed.href });
      planTotal -= removed.totalPence;
    }
    for (let i = phases.length - 1; i >= 0; i--) if (phases[i].treatments.length === 0) phases.splice(i, 1);
  }

  const findings: Finding[] = (Array.isArray(parsed.findings) ? parsed.findings : []).slice(0, 8).map((f: Finding) => ({
    area: f.area, label: String(f.label || '').slice(0, 80), note: String(f.note || '').slice(0, 200), severity: ['mild', 'moderate', 'notable'].includes(f.severity) ? f.severity : 'mild',
  }));
  const summary = String(parsed.summary || 'Here’s your personalised plan.').slice(0, 200);

  const analysis = await db.aiAnalysis.create({
    data: {
      clientId: opts.clientId, areas: opts.areas, model: parsed._model, status: 'complete',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : null, needsExpert: !!parsed.needsExpert,
      budgetPence: opts.budgetPence,
      findingsEnc: encryptJson(findings),
      planJson: { phases, extras, planTotalPence: planTotal } as object,
      recommendedSlugs: phases.flatMap((p) => p.treatments.map((t) => t.slug)),
      summary, tokensIn: parsed._in, tokensOut: parsed._out, consentAt: new Date(), storeImages: opts.storeImages,
      images: opts.storeImages ? { create: images.map((i) => ({ area: i.area || null, dataEnc: encryptJson(i.dataUrl) })) } : undefined,
    },
  });

  return { ok: true, analysisId: analysis.id, summary, findings, phases, planTotalPence: planTotal, extras, confidence: parsed.confidence ?? 0.8, needsExpert: !!parsed.needsExpert };
}

type Parsed = { refused?: boolean; confidence?: number; needsExpert?: boolean; summary?: string; findings?: unknown; phases?: unknown; worthConsidering?: unknown; _model: string; _in?: number; _out?: number };

async function callClaude(key: string, model: string, system: string, content: object[]): Promise<Parsed | null> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 1100, system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }], messages: [{ role: 'user', content }] }),
    });
    if (!res.ok) { console.error('[get-my-plan] anthropic', res.status, await res.text().catch(() => '')); return null; }
    const j = await res.json();
    const text = j?.content?.find((c: { type: string }) => c.type === 'text')?.text ?? '';
    const obj = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    return { ...obj, _model: model, _in: j?.usage?.input_tokens, _out: j?.usage?.output_tokens };
  } catch (e) {
    console.error('[get-my-plan] call failed:', (e as Error)?.message);
    return null;
  }
}
