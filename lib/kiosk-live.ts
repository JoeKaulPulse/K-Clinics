import 'server-only';
import type { KioskObservation } from '@/lib/kiosk-ai';

// ── Kiosk v2 live-session shared helpers ─────────────────────────────────────
// Stage machine, live-frame limits and the SSE/poll payload shape shared by the
// stage/frame/photos/analyze/stream routes. Single source of truth per
// docs/KIOSK_V2_CONTRACT.md (the display + phone agents type the JSON locally).

/** The live stage machine. Server validates loosely: any move between known
 *  stages is allowed; unknown stages are rejected with 400. */
export const KIOSK_STAGES = [
  'idle',      // attract loop, nobody paired
  'paired',    // phone opened the session
  'consent',   // consent + explicit 18+ declaration
  'posing',    // live mirror streaming
  'countdown', // 3-2-1 before capture
  'captured',  // a photo was just taken (server bumps poseIdx)
  'review',    // thumbnails on the phone
  'analyzing', // AI running
  'reveal',    // scores + annotations on screen
  'shared',    // visitor shared their result
  'done',      // flow finished cleanly
  'declined',  // terminal: AI age backstop declined (photos purged)
  'failed',    // terminal: analysis failed
] as const;

export type KioskStage = (typeof KIOSK_STAGES)[number];

export const isKioskStage = (s: unknown): s is KioskStage =>
  typeof s === 'string' && (KIOSK_STAGES as readonly string[]).includes(s);

// ── Live mirror frame constraints (data-URL JPEG, DB-only — never Blob) ──────
export const FRAME_PREFIX = 'data:image/jpeg;base64,';
export const FRAME_MAX_CHARS = 120 * 1024; // ≤120KB as a string
export const FRAME_MIN_INTERVAL_MS = 250;  // writes closer together are ignored
/** Frames are only meaningful (stored/streamed) in these stages. */
export const FRAME_STAGES: readonly KioskStage[] = ['posing', 'countdown'];

export const MAX_KIOSK_PHOTOS = 4;

// ── SSE / poll payload ────────────────────────────────────────────────────────

export type KioskStreamResult = {
  id: string;
  headline: string;
  skinScore: number;
  smileScore: number;
  insights: string[];
  treatments: string[];
  annotations: KioskObservation[];
  bestPhotoUrl: string | null;
  shareSlug: string;
};

export type KioskStreamPayload = {
  stage: string;
  status: string;
  poseIdx: number;
  /** data-URL jpeg mirror frame — only present during posing/countdown. */
  frame: string | null;
  frameAt: string | null; // ISO timestamp of the frame
  photoUrls: string[];
  /** Present from reveal onwards (or once the session is ANALYZED/SHARED). */
  result?: KioskStreamResult;
};

/** Prisma `select` shape used by the stream + poll routes. */
export const KIOSK_STREAM_SELECT = {
  id: true,
  stage: true,
  status: true,
  poseIdx: true,
  liveFrame: true,
  liveFrameAt: true,
  photoUrls: true,
  token: true,
  expiresAt: true,
  result: {
    select: {
      id: true,
      headline: true,
      skinScore: true,
      smileScore: true,
      insights: true,
      treatments: true,
      annotations: true,
      bestPhotoUrl: true,
      shareSlug: true,
    },
  },
} as const;

export type KioskSessionLite = {
  stage: string;
  status: string;
  poseIdx: number;
  liveFrame: string | null;
  liveFrameAt: Date | null;
  photoUrls: string[];
  token: string;
  result?: {
    id: string;
    headline: string;
    skinScore: number;
    smileScore: number;
    insights: string[];
    treatments: string[];
    annotations: unknown;
    bestPhotoUrl: string | null;
    shareSlug: string;
  } | null;
};

/** Build the wire payload from a session row (with included result). The mirror
 *  frame is exposed only during posing/countdown; the result only at reveal+
 *  (or once status is ANALYZED/SHARED — covers the v1 fallback flow).
 *  BLD-1052: photo-view now requires the session secret (like frame/stream), so
 *  the relay URLs only carry a working `s=` param when the caller already proved
 *  it holds the secret (pass it through from a secret-gated caller, e.g. the SSE
 *  stream route). Callers without a validated secret — e.g. the token-only
 *  status poll — get relay URLs omitted rather than dead links. */
export function buildKioskStreamPayload(s: KioskSessionLite, secret?: string): KioskStreamPayload {
  // BLD-1496: the live mirror frame is as sensitive as the stored selfie
  // photos, so gate it on the session secret the same way photoUrls/
  // bestPhotoUrl are below — otherwise anyone holding just the (short,
  // guessable) token can read the visitor's live face frame via the
  // token-only poll route.
  const showFrame = (FRAME_STAGES as readonly string[]).includes(s.stage) && !!secret;
  const revealed =
    !!s.result &&
    (s.stage === 'reveal' || s.stage === 'shared' || s.stage === 'done' ||
      s.status === 'ANALYZED' || s.status === 'SHARED');

  const payload: KioskStreamPayload = {
    stage: s.stage,
    status: s.status,
    poseIdx: s.poseIdx,
    frame: showFrame ? (s.liveFrame ?? null) : null,
    frameAt: showFrame && s.liveFrameAt ? s.liveFrameAt.toISOString() : null,
    // BLD-798: selfies are stored PRIVATE — the wire carries relay URLs
    // (session-token-authenticated, no-store) instead of raw blob URLs.
    // BLD-1052: relay now also requires the session secret, so omit these
    // entirely unless the caller has already proven it holds one.
    photoUrls: secret
      ? (s.photoUrls ?? []).map((_, i) => `/api/kiosk/sessions/${s.token}/photo-view?i=${i}&s=${encodeURIComponent(secret)}`)
      : [],
  };
  if (revealed && s.result) {
    payload.result = {
      id: s.result.id,
      headline: s.result.headline,
      skinScore: s.result.skinScore,
      smileScore: s.result.smileScore,
      insights: s.result.insights,
      treatments: s.result.treatments,
      annotations: Array.isArray(s.result.annotations)
        ? (s.result.annotations as unknown as KioskObservation[])
        : [],
      // BLD-798: same relay treatment — resolve the best photo back to its
      // index in photoUrls (v1 single-photo results map to index 0).
      bestPhotoUrl: s.result.bestPhotoUrl && secret
        ? `/api/kiosk/sessions/${s.token}/photo-view?i=${Math.max(0, (s.photoUrls ?? []).indexOf(s.result.bestPhotoUrl))}&s=${encodeURIComponent(secret)}`
        : null,
      shareSlug: s.result.shareSlug,
    };
  }
  return payload;
}
