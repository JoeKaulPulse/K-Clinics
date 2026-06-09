import 'server-only';

// Kiosk Skin & Smile AI analysis — lightweight, friendly, non-clinical.
// Uses the same Claude API as K Vision (lib/ai-consultation.ts) but with a
// campaign-specific prompt. Returns a fun, shareable rating — NOT a diagnosis.

const HAIKU = 'claude-haiku-4-5-20251001';

const SYSTEM = `You are a friendly AI beauty consultant for K Clinics, a premium aesthetic clinic. You're helping the user discover their skin & smile score in a fun, encouraging way. This is NOT a medical assessment.

When given a photo, provide:
1. A short, uplifting headline (max 10 words) about their look
2. A skinScore from 1-10 (be generous — this is fun, not critical)
3. A smileScore from 1-10 (same)
4. 2-3 short, positive insights about their skin or smile (max 15 words each)
5. 1-2 treatment suggestions from K Clinics that could enhance their look

Treatment options to suggest from (use exact names):
- HydraFacial, Chemical Peel, Microneedling, LED Light Therapy, Botox, Dermal Fillers, Lip Fillers, Teeth Whitening, Composite Bonding, Laser Hair Removal, IPL Photorejuvenation

Tone: warm, fun, celebratory — like a beauty-savvy friend. Never medical or diagnostic. If the photo isn't a usable face/selfie (e.g. no person, intimate areas, a minor), still return the JSON but with a gentle generic headline and modest scores.

ALWAYS respond in this exact JSON format:
{
  "headline": "Your glow is seriously impressive!",
  "skinScore": 8,
  "smileScore": 7,
  "insights": ["Your skin has a beautiful natural glow", "Great cheekbone structure", "Your smile lights up the room"],
  "treatments": ["HydraFacial", "LED Light Therapy"]
}`;

const ALLOWED_TREATMENTS = [
  'HydraFacial', 'Chemical Peel', 'Microneedling', 'LED Light Therapy', 'Botox',
  'Dermal Fillers', 'Lip Fillers', 'Teeth Whitening', 'Composite Bonding',
  'Laser Hair Removal', 'IPL Photorejuvenation',
];

export type KioskAiResult = {
  headline: string;
  skinScore: number;
  smileScore: number;
  insights: string[];
  treatments: string[];
};

function mediaTypeFromUrl(url: string): string {
  const u = url.toLowerCase().split('?')[0];
  if (u.endsWith('.png')) return 'image/png';
  if (u.endsWith('.webp')) return 'image/webp';
  if (u.endsWith('.gif')) return 'image/gif';
  if (u.endsWith('.heic') || u.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

function clampScore(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 7;
  return Math.max(1, Math.min(10, v));
}

/**
 * Analyse a kiosk selfie and return a friendly skin & smile rating.
 * Fetches the photo from its (public Vercel Blob) URL, base64-encodes it, and
 * calls Claude with the campaign prompt. Returns null on any failure.
 */
export async function analyzeKioskPhoto(photoUrl: string): Promise<KioskAiResult | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error('[kiosk-ai] ANTHROPIC_API_KEY not set');
    return null;
  }

  try {
    // 1) Fetch the photo and base64-encode it.
    const imgRes = await fetch(photoUrl);
    if (!imgRes.ok) {
      console.error('[kiosk-ai] photo fetch failed', imgRes.status);
      return null;
    }
    const ab = await imgRes.arrayBuffer();
    const b64 = Buffer.from(ab).toString('base64');
    const media = mediaTypeFromUrl(photoUrl);

    // 2) Call Claude with a 30s timeout (same pattern as callClaude in lib/ai-consultation.ts).
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 30_000);
    let res: Response;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: ac.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: HAIKU,
          max_tokens: 600,
          system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: 'Here is my selfie — give me my fun skin & smile score!' },
              { type: 'image', source: { type: 'base64', media_type: media, data: b64 } },
            ],
          }],
        }),
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      console.error('[kiosk-ai] anthropic', res.status, await res.text().catch(() => ''));
      return null;
    }

    // 3) Parse + validate the JSON response.
    const j = await res.json();
    const text = j?.content?.find((c: { type: string }) => c.type === 'text')?.text ?? '';
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end < 0) return null;
    const obj = JSON.parse(text.slice(start, end + 1));

    const headline = String(obj.headline || '').trim().slice(0, 80) || 'You’re looking radiant!';
    const skinScore = clampScore(obj.skinScore);
    const smileScore = clampScore(obj.smileScore);
    const insights = (Array.isArray(obj.insights) ? obj.insights : [])
      .map((i: unknown) => String(i || '').trim().slice(0, 120))
      .filter(Boolean)
      .slice(0, 3);
    let treatments = (Array.isArray(obj.treatments) ? obj.treatments : [])
      .map((t: unknown) => String(t || '').trim())
      .filter((t: string) => ALLOWED_TREATMENTS.includes(t));
    treatments = treatments.slice(0, 2);
    if (treatments.length === 0) treatments = ['HydraFacial'];
    if (insights.length === 0) return null; // not a usable result

    return { headline, skinScore, smileScore, insights, treatments };
  } catch (e) {
    console.error('[kiosk-ai] analysis failed:', (e as Error)?.message);
    return null;
  }
}
