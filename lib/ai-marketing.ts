import 'server-only';
import { getBrandKit, brandContextForAI } from '@/lib/brand';
import { site } from '@/lib/site';
import { getSecret } from '@/lib/secrets';

// AI marketing assistant (Claude Haiku). Generates on-brand campaign content —
// email, ad copy, landing page sections and SEO — from a campaign brief. Output
// is always presented to the owner for review; nothing publishes or spends.

const HAIKU = 'claude-haiku-4-5-20251001';

export const aiAvailable = async () => Boolean(await getSecret('ANTHROPIC_API_KEY'));

export type CampaignInput = { name: string; goal: string; audience: string; brief: string };

export type CampaignPack = {
  email: { subject: string; preview: string; headline: string; body: string };
  ads: { google: { headlines: string[]; descriptions: string[] }; meta: { primaryTexts: string[]; headlines: string[] } };
  landing: { hero: { eyebrow: string; headline: string; subhead: string; ctaLabel: string }; sections: { heading: string; body: string }[] };
  seo: { title: string; metaDescription: string; keywords: string[] };
  sms: string;
};

async function callHaiku<T>(system: string, user: string, maxTokens = 1600): Promise<T | null> {
  const key = await getSecret('ANTHROPIC_API_KEY');
  if (!key) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: HAIKU, max_tokens: maxTokens,
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) { console.error('[ai-marketing] anthropic', res.status, await res.text().catch(() => '')); return null; }
    const j = await res.json();
    const text = j?.content?.find((c: { type: string }) => c.type === 'text')?.text ?? '';
    return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as T;
  } catch (e) {
    console.error('[ai-marketing] call failed:', (e as Error)?.message);
    return null;
  }
}

/** Compact, real service menu so the AI references genuine treatments + prices. */
async function serviceMenu(): Promise<string> {
  try {
    const { listServices, formatPence } = await import('@/lib/services');
    const services = await listServices(false);
    return services.slice(0, 40).map((s) => {
      const from = s.variants.map((v) => v.pricePence).filter((p) => p > 0).sort((a, b) => a - b)[0];
      return `- ${s.name}${from ? ` (from ${formatPence(from)})` : ''}`;
    }).join('\n');
  } catch { return ''; }
}

export async function generateCampaignPack(input: CampaignInput): Promise<CampaignPack | null> {
  const brand = await getBrandKit();
  const menu = await serviceMenu();
  const system = [
    `You are the senior marketing copywriter for ${site.name}, a premium aesthetics & dental clinic in London.`,
    brandContextForAI(brand),
    'Write in British English. Be specific, tasteful and conversion-focused without hype or medical guarantees.',
    menu ? `Real services you may reference (use exact names & realistic framing):\n${menu}` : '',
    'Respond ONLY with a single minified JSON object matching exactly this TypeScript type, no prose, no markdown:',
    '{"email":{"subject":string,"preview":string,"headline":string,"body":string},"ads":{"google":{"headlines":string[],"descriptions":string[]},"meta":{"primaryTexts":string[],"headlines":string[]}},"landing":{"hero":{"eyebrow":string,"headline":string,"subhead":string,"ctaLabel":string},"sections":[{"heading":string,"body":string}]},"seo":{"title":string,"metaDescription":string,"keywords":string[]},"sms":string}',
    'Constraints: email.body 90-160 words; 5 google headlines (<=30 chars) + 3 google descriptions (<=90 chars); 3 meta primaryTexts + 3 meta headlines; 3-4 landing sections; seo.title <=60 chars; seo.metaDescription <=155 chars; 6-10 keywords; sms <=150 chars.',
  ].filter(Boolean).join('\n\n');

  const user = `Create a complete content pack for this campaign.
Campaign: ${input.name}
Primary goal: ${input.goal}
Target audience: ${input.audience || 'all clients & prospects'}
Brief: ${input.brief || 'Promote the clinic and drive bookings.'}`;

  return callHaiku<CampaignPack>(system, user);
}

export type OptimiseInput = {
  name: string; goal: string; audience: string; daysRunning: number;
  bookings: number; revenuePence: number; spendPence: number; budgetPence: number | null;
  roi: number | null; targetRevenuePence: number | null; targetBookings: number | null;
  topSources: { label: string; bookings: number; revenuePence: number }[];
};
export type CampaignAdvice = {
  summary: string;
  actions: { title: string; detail: string; impact: 'high' | 'medium' | 'low' }[];
  budgetAdvice: string;
  audienceIdeas: string[];
  testIdeas: string[];
};

/** Analyse a campaign's live performance and recommend concrete optimisations. */
export async function optimiseCampaign(i: OptimiseInput): Promise<CampaignAdvice | null> {
  const brand = await getBrandKit();
  const gbp = (p: number) => `£${(p / 100).toLocaleString('en-GB')}`;
  const system = [
    `You are a senior growth/performance marketer for ${site.name}, a premium London aesthetics & dental clinic.`,
    brandContextForAI(brand),
    'Give sharp, specific, realistic optimisation advice for a UK clinic. No fluff, no guarantees. British English.',
    'Respond ONLY with minified JSON of this type: {"summary":string,"actions":[{"title":string,"detail":string,"impact":"high"|"medium"|"low"}],"budgetAdvice":string,"audienceIdeas":string[],"testIdeas":string[]}.',
    '3-6 actions ordered by impact; 3-4 audienceIdeas; 3-4 testIdeas. Be concrete (channels, offers, timing, creative angles).',
  ].join('\n\n');
  const user = `Campaign: ${i.name}
Goal: ${i.goal} · Audience: ${i.audience || 'broad'} · Running ${i.daysRunning} days
Results so far: ${i.bookings} bookings, ${gbp(i.revenuePence)} revenue, spend ${gbp(i.spendPence)}, ROI ${i.roi == null ? 'n/a' : i.roi + '%'}
Targets: ${i.targetRevenuePence ? gbp(i.targetRevenuePence) : 'none'} revenue, ${i.targetBookings ?? 'none'} bookings, budget ${i.budgetPence ? gbp(i.budgetPence) : 'none'}
Top sources: ${i.topSources.length ? i.topSources.map((s) => `${s.label} (${s.bookings} bk, ${gbp(s.revenuePence)})`).join('; ') : 'no attributed sources yet'}`;
  return callHaiku<CampaignAdvice>(system, user, 1200);
}

/** Generate N on-brand variants of a single line (subject line, ad headline…) — for A/B or quick rewrites. */
export async function rewriteVariants(kind: string, text: string, n = 4): Promise<string[] | null> {
  const brand = await getBrandKit();
  const system = [
    `You are a marketing copywriter for ${site.name}.`,
    brandContextForAI(brand),
    `Produce ${n} distinct, on-brand variants of a ${kind}. British English, no hype.`,
    'Respond ONLY with JSON: {"variants":string[]}.',
  ].join('\n\n');
  const out = await callHaiku<{ variants: string[] }>(system, `Original ${kind}: "${text}"`, 600);
  return out?.variants ?? null;
}
