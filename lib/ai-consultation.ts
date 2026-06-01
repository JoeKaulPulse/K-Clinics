import 'server-only';
import { db } from '@/lib/db';
import { encryptJson } from '@/lib/crypto';

// ── K Vision — AI consultation engine ───────────────────────────────────────
// Cost-minimal by design: Claude Haiku by default (escalates to Sonnet only when
// the model flags low confidence), browser-downscaled images, capped output,
// and a cached system prompt. Recommendations are bound to the real priced
// catalogue, so a generated plan is always bookable and margin-positive.

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
export type PlanItem = { slug: string; title: string; fromPence: number; reason: string; href: string };
export type AnalyzeResult =
  | { ok: true; analysisId: string; summary: string; findings: Finding[]; plan: PlanItem[]; confidence: number; needsExpert: boolean }
  | { ok: false; reason: 'unavailable' | 'limit' | 'refused' | 'error'; message: string };

function areaForSlug(slug: string, category: string): string {
  if (category === 'dentistry' || /teeth|veneer|whiten|bonding|dental|smile|braces|denture/.test(slug)) return 'teeth';
  if (/hair-removal|scalp/.test(slug)) return 'hair';
  if (/body-contour|endosphere|hifu|fat-dissolv|cellulite/.test(slug)) return 'body';
  return 'skin';
}

/** Compact, priced menu the model is allowed to recommend from. */
async function buildMenu() {
  const { listServices } = await import('@/lib/services');
  const services = await listServices(false);
  return services
    .map((s) => {
      const prices = s.variants.map((v) => v.pricePence).filter((p) => p > 0);
      return { slug: s.treatmentSlug, title: s.name, area: areaForSlug(s.treatmentSlug, s.category), fromPence: prices.length ? Math.min(...prices) : 0 };
    })
    // de-dupe by slug (services may share a treatment slug)
    .filter((m, i, arr) => arr.findIndex((x) => x.slug === m.slug) === i);
}

export async function analysesThisMonth(clientId: string): Promise<number> {
  const since = new Date(); since.setDate(1); since.setHours(0, 0, 0, 0);
  return db.aiAnalysis.count({ where: { clientId, createdAt: { gte: since }, status: 'complete' } });
}

type Img = { area?: string; dataUrl: string };

export async function analyze(opts: { clientId: string; areas: string[]; images: Img[]; storeImages: boolean }): Promise<AnalyzeResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, reason: 'unavailable', message: 'The AI consultation isn’t available right now.' };

  if ((await analysesThisMonth(opts.clientId)) >= MONTHLY_CAP) {
    return { ok: false, reason: 'limit', message: `You’ve used your ${MONTHLY_CAP} analyses this month. Book a visit and we’ll take it from here.` };
  }

  const images = opts.images.slice(0, MAX_IMAGES).filter((i) => i.dataUrl.startsWith('data:image/'));
  if (images.length === 0) return { ok: false, reason: 'error', message: 'Please add at least one clear photo.' };

  const menu = await buildMenu();
  const allowed = menu.filter((m) => opts.areas.includes(m.area));
  const menuText = (allowed.length ? allowed : menu).map((m) => `- ${m.slug} | ${m.title} | area:${m.area}`).join('\n');

  const system = `You are a cosmetic skin/teeth/hair imaging assistant for K Clinics (aesthetics & dentistry, London). You give gentle, encouraging COSMETIC GUIDANCE — never a medical diagnosis, never alarming language. You only recommend from the ALLOWED TREATMENTS list (use the exact slug). If an image shows genitals/intimate areas, a minor, or isn't a usable face/skin/teeth/hair/body photo, set "refused": true.

ALLOWED TREATMENTS (slug | name | area):
${menuText}

Return STRICT JSON only, no prose:
{"refused": false, "confidence": 0.0-1.0, "needsExpert": false, "summary": "one warm sentence", "findings": [{"area":"skin|teeth|hair|body","label":"short","note":"1 gentle sentence","severity":"mild|moderate|notable"}], "recommendations": [{"slug":"<from list>","reason":"why, 1 sentence","priority":1}]}
Pick 2–4 recommendations max, prioritised. Set needsExpert true only if photos are unclear or the case is genuinely complex.`;

  const userContent: object[] = [
    { type: 'text', text: `Areas of interest: ${opts.areas.join(', ') || 'general'}. Please analyse the attached photo(s).` },
    ...images.map((i) => {
      const [meta, b64] = i.dataUrl.split(',');
      const media = /data:(image\/\w+);/.exec(meta)?.[1] || 'image/jpeg';
      return { type: 'image', source: { type: 'base64', media_type: media, data: b64 } };
    }),
  ];

  let parsed = await callClaude(key, HAIKU, system, userContent);
  if (parsed && (parsed.needsExpert || (parsed.confidence ?? 1) < 0.5) && process.env.AI_DISABLE_ESCALATION !== 'true' && !parsed.refused) {
    const better = await callClaude(key, SONNET, system, userContent);
    if (better) parsed = better;
  }
  if (!parsed) return { ok: false, reason: 'error', message: 'We couldn’t complete the analysis. Please try again.' };
  if (parsed.refused) {
    await db.aiAnalysis.create({ data: { clientId: opts.clientId, areas: opts.areas, model: parsed._model, status: 'refused' } }).catch(() => {});
    return { ok: false, reason: 'refused', message: 'We couldn’t analyse those photos. Please upload clear, well-lit photos of your face, skin, teeth or hair (no intimate areas).' };
  }

  // Resolve recommendations to real priced catalogue items.
  const bySlug = new Map(menu.map((m) => [m.slug, m]));
  const plan: PlanItem[] = [];
  for (const raw of Array.isArray(parsed.recommendations) ? parsed.recommendations : []) {
    const r = raw as { slug?: string; reason?: string };
    const m = r.slug ? bySlug.get(r.slug) : undefined;
    if (!m) continue;
    plan.push({ slug: m.slug, title: m.title, fromPence: m.fromPence, reason: String(r.reason || '').slice(0, 200), href: `/book?treatment=${m.slug}` });
    if (plan.length >= 4) break;
  }
  const findings: Finding[] = (Array.isArray(parsed.findings) ? parsed.findings : []).slice(0, 8).map((f: Finding) => ({
    area: f.area, label: String(f.label || '').slice(0, 80), note: String(f.note || '').slice(0, 200), severity: ['mild', 'moderate', 'notable'].includes(f.severity) ? f.severity : 'mild',
  }));
  const summary = String(parsed.summary || 'Here’s your personalised guidance.').slice(0, 200);

  const analysis = await db.aiAnalysis.create({
    data: {
      clientId: opts.clientId, areas: opts.areas, model: parsed._model, status: 'complete',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : null,
      needsExpert: !!parsed.needsExpert,
      findingsEnc: encryptJson(findings),
      planJson: plan, recommendedSlugs: plan.map((p) => p.slug), summary,
      tokensIn: parsed._in, tokensOut: parsed._out, consentAt: new Date(), storeImages: opts.storeImages,
      images: opts.storeImages ? { create: images.map((i) => ({ area: i.area || null, dataEnc: encryptJson(i.dataUrl) })) } : undefined,
    },
  });

  return { ok: true, analysisId: analysis.id, summary, findings, plan, confidence: parsed.confidence ?? 0.8, needsExpert: !!parsed.needsExpert };
}

type Parsed = { refused?: boolean; confidence?: number; needsExpert?: boolean; summary?: string; findings?: unknown; recommendations?: unknown; _model: string; _in?: number; _out?: number };

async function callClaude(key: string, model: string, system: string, content: object[]): Promise<Parsed | null> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model, max_tokens: 800,
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content }],
      }),
    });
    if (!res.ok) { console.error('[ai-consultation] anthropic', res.status, await res.text().catch(() => '')); return null; }
    const j = await res.json();
    const text = j?.content?.find((c: { type: string }) => c.type === 'text')?.text ?? '';
    const obj = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    return { ...obj, _model: model, _in: j?.usage?.input_tokens, _out: j?.usage?.output_tokens };
  } catch (e) {
    console.error('[ai-consultation] call failed:', (e as Error)?.message);
    return null;
  }
}
