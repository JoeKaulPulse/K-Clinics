// ── Kiosk display: local types for the live channel ─────────────────────────
// Typed locally per docs/KIOSK_V2_CONTRACT.md §5 (no cross-imports of new
// server types until integration). The SSE endpoint emits:
//   data: { stage, status, poseIdx, frame, frameAt, photoUrls, result? }

/** Stage machine values (contract "Stage machine"). Unknown strings tolerated. */
export type KioskStage =
  | 'idle'
  | 'paired'
  | 'consent'
  | 'posing'
  | 'countdown'
  | 'captured'
  | 'review'
  | 'analyzing'
  | 'reveal'
  | 'shared'
  | 'done'
  | 'declined'
  | 'failed'
  | (string & {});

/** One AI observation (contract "AI v2" observations[]). Box coords are 0–1. */
export type KioskAnnotation = {
  area?: 'skin' | 'smile' | string;
  photoIndex?: number;
  label: string;
  detail?: string;
  box?: { x: number; y: number; w: number; h: number } | null;
  confidence?: number;
};

/** Result payload present from reveal onwards. */
export type KioskLiveResult = {
  headline?: string | null;
  skinScore?: number | null;
  smileScore?: number | null;
  insights?: string[] | null;
  treatments?: string[] | null;
  /** Server may send the observations array directly or wrapped. */
  annotations?: KioskAnnotation[] | { observations?: KioskAnnotation[] } | null;
  bestPhotoUrl?: string | null;
  shareSlug?: string | null;
};

/** One SSE frame / synthesized poll snapshot. */
export type KioskLivePayload = {
  stage: KioskStage;
  status: string;
  poseIdx: number;
  frame?: string | null;
  frameAt?: string | null;
  photoUrls?: string[] | null;
  result?: KioskLiveResult | null;
};

/** Pose titles by poseIdx (contract "Phone flow" §3). */
export const POSE_TITLES = [
  'Big natural smile',
  'Show us your best side',
  'Freestyle — strike a pose!',
] as const;

export function poseTitle(poseIdx: number): string {
  return POSE_TITLES[Math.max(0, Math.min(POSE_TITLES.length - 1, poseIdx))];
}

/** Flatten the annotations field to a clean, render-ready list. */
export function normalizeAnnotations(result: KioskLiveResult | null | undefined): KioskAnnotation[] {
  if (!result) return [];
  const raw = result.annotations;
  const list: KioskAnnotation[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { observations?: KioskAnnotation[] }).observations)
      ? (raw as { observations: KioskAnnotation[] }).observations
      : [];
  return list
    .filter((o): o is KioskAnnotation => !!o && typeof o.label === 'string' && !!o.box
      && typeof o.box.x === 'number' && typeof o.box.y === 'number'
      && typeof o.box.w === 'number' && typeof o.box.h === 'number')
    .slice(0, 6);
}
