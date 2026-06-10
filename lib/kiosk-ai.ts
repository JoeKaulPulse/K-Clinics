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

export const ALLOWED_TREATMENTS = [
  'HydraFacial', 'Chemical Peel', 'Microneedling', 'LED Light Therapy', 'Botox',
  'Dermal Fillers', 'Lip Fillers', 'Teeth Whitening', 'Composite Bonding',
  'Laser Hair Removal', 'IPL Photorejuvenation',
];

// Treatments that are invasive: the model is told to only ever suggest these
// when the visual signal is unambiguous (and the surrounding copy stays soft).
const INVASIVE_TREATMENTS = ['Botox', 'Dermal Fillers', 'Lip Fillers'];

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

// ─────────────────────────────────────────────────────────────────────────────
// Kiosk v2 — multi-photo analysis with truthful, positive annotations and an
// AI challenge-21 age backstop. One Sonnet call per session (budget ≤10p);
// strict JSON; all guard-rails re-enforced in code below, never trusted from
// the model alone. See docs/KIOSK_V2_CONTRACT.md.
// ─────────────────────────────────────────────────────────────────────────────

const SONNET = 'claude-sonnet-4-6';

export type KioskObservationArea = 'skin' | 'smile';

export type KioskObservation = {
  area: KioskObservationArea;
  /** Which of the submitted photos the box refers to (original photoUrls index). */
  photoIndex: number;
  label: string;  // ≤24 chars, e.g. "Cheekbone glow"
  detail: string; // ≤90 chars, positive, specific to THIS face
  /** Normalised 0–1 coordinates, tight around the actual feature. */
  box: { x: number; y: number; w: number; h: number };
  confidence: number; // 0–1
};

export type KioskAiV2Result = {
  clearlyOver21: boolean;
  headline: string;
  skinScore: number;
  smileScore: number;
  bestPhotoIndex: number;
  observations: KioskObservation[];
  treatments: string[];
  shareCaption: string;
};

const SYSTEM_V2 = `You are the AI behind the K Clinics "Skin & Smile" storefront kiosk — a fun, kind, 60-second moment of celebration on a London high street. This is entertainment and warmth, NOT a medical assessment, diagnosis or consultation.

You receive 1–4 selfie photos of the same visitor, each labelled "Photo N". Study them carefully, then respond with ONE JSON object only — no markdown fences, no commentary before or after — in exactly this shape:

{
  "clearlyOver21": true,
  "headline": "string, max 60 chars, uplifting and specific to this person",
  "skinScore": 6,
  "smileScore": 6,
  "bestPhotoIndex": 0,
  "observations": [
    {
      "area": "skin",
      "photoIndex": 0,
      "label": "max 24 chars, e.g. 'Cheekbone glow'",
      "detail": "max 90 chars, positive, specific to THIS face",
      "box": { "x": 0.0, "y": 0.0, "w": 0.0, "h": 0.0 },
      "confidence": 0.0
    }
  ],
  "treatments": [],
  "shareCaption": "max 180 chars, first person, fun, no hashtags"
}

AGE CHECK — DO THIS FIRST:
- Set "clearlyOver21": true ONLY if you are confident the person is clearly an adult well over 21.
- If they could plausibly be under 21, if no real adult face is clearly visible, if the photo is of a photo/screen/printout, or if it is not a genuine live selfie of one person, set "clearlyOver21": false.
- When false, still return valid JSON but keep every other field generic — nothing else will be used and the photos will be deleted. Never describe or score a person you have declined.

TONE — POSITIVE ONLY:
- Every word is warm, celebratory and body-positive, like a beauty-savvy friend hyping someone up.
- Celebrate what is genuinely there. NEVER mention or imply flaws: no blemishes, wrinkles, lines, texture issues, asymmetry, discolouration, dental misalignment, weight, age, tiredness, or any skin/dental condition. No medical or clinical language. No backhanded compliments ("despite", "even though", "could be improved").

TRUTHFULNESS — NEVER INVENT:
- Each observation must describe a REAL, clearly visible feature of THIS specific person in the photo it points at — e.g. their actual smile line, brow shape, cheekbone light, lip shape, eye sparkle, jawline, freckles they visibly have.
- "box" must be TIGHT around the actual feature in that photo: normalised 0–1 coordinates (x,y = top-left, w,h = size relative to the image). Keep boxes small and precise — typically well under 15% of the image area. Never a large generic box over the whole face, and never a floating marker on empty background.
- "confidence" is your honest 0–1 confidence that the feature is genuinely notable AND the box is accurate. Use values below 0.6 freely when unsure — those are dropped.
- Return AT MOST 6 observations, mixing skin and smile where possible. If only 2 or 3 things are genuinely notable, return only those. Fewer truthful observations always beats padded or invented ones. An empty list is acceptable.

SCORES:
- skinScore and smileScore are whole numbers from 6 to 10 — generous by design, this is fun, not critique. Reserve 9–10 for genuinely striking features; never go below 6.

TREATMENTS:
- Suggest 0, 1 or 2 treatment names, using EXACT names from this list only: ${ALLOWED_TREATMENTS.join(', ')}.
- Only suggest a treatment when the photos clearly suggest the person would enjoy it — something they "could love", never something they "need". When in doubt, suggest fewer or none.
- ${INVASIVE_TREATMENTS.join(', ')} are injectable/invasive: include one ONLY if the visual evidence is completely unambiguous; otherwise prefer the non-invasive options or none.

SHARE CAPTION:
- "shareCaption": max 180 characters, written in the first person as the visitor (e.g. "Just got my skin & smile scored…"), fun and shareable, no hashtags.

BEST PHOTO:
- "bestPhotoIndex" is the label number of the single most flattering photo.`;

const clampV2Score = (n: unknown): number => {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 8;
  return Math.max(6, Math.min(10, v));
};

const num01 = (n: unknown): number | null => {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.max(0, Math.min(1, v));
};

/** Parse + enforce one raw observation; null when invalid. */
function sanitiseObservation(raw: unknown, photoCount: number): KioskObservation | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const area = o.area === 'skin' || o.area === 'smile' ? o.area : null;
  if (!area) return null;
  const photoIndex = Math.round(Number(o.photoIndex));
  if (!Number.isFinite(photoIndex) || photoIndex < 0 || photoIndex >= photoCount) return null;
  const label = String(o.label || '').trim().slice(0, 24);
  const detail = String(o.detail || '').trim().slice(0, 90);
  if (!label || !detail) return null;
  const b = (o.box || {}) as Record<string, unknown>;
  const x = num01(b.x), y = num01(b.y), w = num01(b.w), h = num01(b.h);
  if (x === null || y === null || w === null || h === null || w <= 0 || h <= 0) return null;
  const confidence = num01(o.confidence);
  if (confidence === null || confidence < 0.6) return null;      // drop low confidence
  if (w * h > 0.4) return null;                                  // drop generic giant boxes
  return { area, photoIndex, label, detail, box: { x, y, w, h }, confidence };
}

/**
 * Analyse 1–4 kiosk selfies in ONE Claude call and return the v2 result.
 * Guard-rails (confidence ≥0.6, box area ≤40%, ≤6 observations, scores 6–10,
 * treatments whitelisted ≤2) are enforced here in code. The caller is
 * responsible for the AGE_DECLINED purge when `clearlyOver21` is false.
 * Returns null on any failure (caller marks ANALYSIS_FAILED).
 */
export async function analyzeKioskPhotosV2(photoUrls: string[]): Promise<KioskAiV2Result | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error('[kiosk-ai] ANTHROPIC_API_KEY not set');
    return null;
  }
  const urls = (photoUrls || []).filter(Boolean).slice(0, 4);
  if (!urls.length) return null;

  try {
    // 1) Fetch + base64 every photo (keep ORIGINAL indexes so photoIndex /
    //    bestPhotoIndex map back onto photoUrls even if one fetch fails).
    const fetched = await Promise.all(urls.map(async (url, idx) => {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const ab = await res.arrayBuffer();
        return { idx, media: mediaTypeFromUrl(url), b64: Buffer.from(ab).toString('base64') };
      } catch { return null; }
    }));
    const photos = fetched.filter((p): p is NonNullable<typeof p> => !!p);
    if (!photos.length) {
      console.error('[kiosk-ai] no photos could be fetched');
      return null;
    }

    // 2) One Sonnet call, all photos attached, 30s timeout, NO retries
    //    (budget rule: a retry could double-bill the session).
    const content: unknown[] = [
      { type: 'text', text: `Here are my ${photos.length} kiosk selfies — score my skin & smile!` },
    ];
    for (const p of photos) {
      content.push({ type: 'text', text: `Photo ${p.idx}:` });
      content.push({ type: 'image', source: { type: 'base64', media_type: p.media, data: p.b64 } });
    }

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 30_000);
    let res: Response;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: ac.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: SONNET,
          max_tokens: 1200,
          system: [{ type: 'text', text: SYSTEM_V2, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content }],
        }),
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      console.error('[kiosk-ai] anthropic v2', res.status, await res.text().catch(() => ''));
      return null;
    }

    // 3) Parse + enforce.
    const j = await res.json();
    const text = j?.content?.find((c: { type: string }) => c.type === 'text')?.text ?? '';
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end < 0) return null;
    const obj = JSON.parse(text.slice(start, end + 1));

    // Age backstop: anything other than an explicit `true` is a decline.
    const clearlyOver21 = obj.clearlyOver21 === true;

    const headline = String(obj.headline || '').trim().slice(0, 60) || 'You’re glowing today!';
    const skinScore = clampV2Score(obj.skinScore);
    const smileScore = clampV2Score(obj.smileScore);

    let bestPhotoIndex = Math.round(Number(obj.bestPhotoIndex));
    if (!Number.isFinite(bestPhotoIndex) || !photos.some((p) => p.idx === bestPhotoIndex)) {
      bestPhotoIndex = photos[0].idx;
    }

    const observations = (Array.isArray(obj.observations) ? obj.observations : [])
      .map((o: unknown) => sanitiseObservation(o, urls.length))
      .filter((o: KioskObservation | null): o is KioskObservation => !!o)
      .slice(0, 6);

    const treatments = (Array.isArray(obj.treatments) ? obj.treatments : [])
      .map((t: unknown) => String(t || '').trim())
      .filter((t: string) => ALLOWED_TREATMENTS.includes(t))
      .slice(0, 2);

    const shareCaption = String(obj.shareCaption || '').trim().replace(/#\S+/g, '').slice(0, 180)
      || 'Just got my skin & smile scored at the K Clinics kiosk — come find your glow ✨';

    return { clearlyOver21, headline, skinScore, smileScore, bestPhotoIndex, observations, treatments, shareCaption };
  } catch (e) {
    console.error('[kiosk-ai] v2 analysis failed:', (e as Error)?.message);
    return null;
  }
}
