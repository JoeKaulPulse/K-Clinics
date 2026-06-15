# Skin & Smile Kiosk v2 — Build Contract (PRJ-1)

World-class OOH campaign loop: storefront screen ↔ phone, live. This document
is the single source of truth for the v2 build. Deviations require updating
this file in the same PR.

## Experience principles (non-negotiable)
- **Positive only.** Every observation is real, specific and kind. Body-positive
  tone; we celebrate features, we never shame. No medicalised language.
- **Truthful.** Annotations point at the *actual* visible feature with tight
  coordinates — never generic floating markers. If nothing is notable, show
  fewer annotations. Never invent.
- **Cautious on treatments.** Suggest at most 2, from the whitelist, only when
  the visual evidence is clear; phrase as "could love" not "needs". Never
  recommend invasive intervention unless visually unambiguous — then phrase
  softly ("a consult could explore…").
- **18+ only.** Explicit tap declaration on the phone AND an AI challenge-21
  backstop. If the model is not confident the person is clearly over 21:
  decline warmly, purge photos immediately, no result.
- **Privacy.** Photos/frames live only inside the session: never on the public
  share page, purged on decline/expiry/cleanup cron. The display shows them
  only during the live session.
- **Budget.** ≤ 10p AI cost per session. Target ~2–4p (one Sonnet multi-image
  call). `claude-sonnet-4-6`, max_tokens 1200, 30s timeout, no retries that
  could double-bill beyond one.

## Hardware target
Novastar Taurus media player running ViPlex (Android WebView pointed at
`/kiosk/display`). Therefore the display experience uses **CSS transforms /
opacity / SVG only** (no WebGL, no heavy filters, no video). Must look superb
at 1920×1080 landscape AND 1080×1920 portrait (CSS container/media queries).
Assume no audio, no input on the screen.

## Schema deltas (ADDITIVE ONLY — no @unique, per CLAUDE.md)
```prisma
enum KioskStatus { ... existing ... AGE_DECLINED }   // append value

model KioskSession {
  // existing fields stay (photoUrl kept for back-compat)
  stage        String    @default("idle") // live stage machine (below)
  poseIdx      Int       @default(0)
  photoUrls    String[]  @default([])     // multi-capture
  liveFrame    String?   // latest mirror frame as data-URL jpeg ≤120KB
  liveFrameAt  DateTime?
  ageDeclaredAt DateTime? // when the 18+ tap happened
}

model KioskResult {
  // existing fields stay
  annotations   Json?     // AI observations (schema below)
  shareCaption  String?
  bestPhotoUrl  String?   // chosen photo (session-scoped use only; NEVER on public share page)
}
```

## Stage machine (KioskSession.stage)
`idle → paired → consent → posing → countdown → captured(poseIdx++) →
(posing|review) → analyzing → reveal → shared → done`
plus terminal `declined` (age) and `failed`. Server validates transitions
loosely (any forward move allowed; unknown stages rejected). Stage writes also
bump `updatedAt`.

## API contract (all under /api/kiosk, public, token-scoped, rate-limited)
1. `POST /sessions/[token]/stage` body `{ stage: string, ageDeclared?: true }`
   → `{ ok }`. Stamps `ageDeclaredAt` once when `ageDeclared` first sent with
   consent stage. Rejects stages not in the machine.
2. `POST /sessions/[token]/frame` body `{ frame: "data:image/jpeg;base64,..." }`
   ≤120KB, only meaningful in stages posing/countdown; stores into
   liveFrame/liveFrameAt (DB write; no Blob). Soft rate: ignore if <250ms since
   last. → `{ ok }`.
3. `POST /sessions/[token]/photos` multipart `file` (+ `poseIdx`) — uploads to
   Blob `kiosk/{token}-p{poseIdx}-{ts}.jpg`, appends to `photoUrls` (max 4),
   sets status PHOTO_TAKEN. Reuses validations from the existing photo route.
   → `{ ok, count }`.
4. `POST /sessions/[token]/analyze` body `{ }` — requires consent + ≥1 photo +
   ageDeclaredAt; sets stage analyzing; fires `runKioskAnalysisV2` via
   `after()`. → `{ ok }`.
5. `GET /sessions/[token]/stream` — **SSE** (`text/event-stream`,
   `maxDuration=60`, heartbeat every 15s, ends ~55s; EventSource auto-
   reconnects). Emits on change (in-function 500ms DB poll):
   `data: { stage, status, poseIdx, frame, frameAt, photoUrls, result? }`
   where `result` (only at reveal+) = `{ headline, skinScore, smileScore,
   insights, treatments, annotations, bestPhotoUrl, shareSlug }`.
   The existing `GET /sessions/[token]` poll stays as display fallback.
6. `GET /results/[id]/card` — branded share-card PNG (ImageResponse, 1080×1350
   portrait): scores, headline, "K CLINICS — Islington, London", IG handle from
   site config, QR to share page. NO client photo on the card (v1).

## AI v2 (lib/kiosk-ai.ts — extend, keep old exports working)
`analyzeKioskPhotosV2(photoUrls: string[])` → single Claude call,
`claude-sonnet-4-6`, all photos attached (downscale not required server-side),
strict JSON:
```json
{
  "clearlyOver21": true,
  "headline": "≤60 chars, uplifting, specific",
  "skinScore": 1-10, "smileScore": 1-10,
  "bestPhotoIndex": 0,
  "observations": [
    { "area": "skin"|"smile", "photoIndex": 0,
      "label": "≤24 chars e.g. 'Cheekbone glow'",
      "detail": "≤90 chars, positive, specific to THIS face",
      "box": { "x":0-1, "y":0-1, "w":0-1, "h":0-1 },
      "confidence": 0-1 }
  ],
  "treatments": ["whitelist", "max 2"],
  "shareCaption": "≤180 chars first-person, fun, no hashtags"
}
```
Rules enforced in code: drop observations with confidence <0.6 or boxes
covering >40% of the image (anti-generic); ≤6 kept; clamp scores 7–10 floor 6
(generous by design); if `clearlyOver21` false → purge ALL photos + frames
from Blob/DB, status AGE_DECLINED, stage declined, return null. On success:
result row gets annotations/shareCaption/bestPhotoUrl; status ANALYZED; stage
reveal. Existing single-photo path (`runKioskAnalysis`) remains for
back-compat until the new flow fully replaces it.

## Display scenes (/kiosk/display — server page + client components)
Scene = f(SSE payload). All transitions 400–700ms, `--ease-lux`.
- **attract** (no session activity): dark `--color-ink` canvas, slow gold
  radial shimmer (CSS), Fraunces headline rotating through 3 value lines,
  breathing QR card, "New code in mm:ss". Subtle particle drift = CSS-animated
  absolutely-positioned dots (≤24 nodes).
- **paired**: QR shrinks to corner; "Hello you ✨ — eyes on your phone."
- **posing/countdown**: live mirror (img element swapped per frame, 200ms
  cross-fade), face/half-body guide frame (SVG rounded rect + corner ticks),
  pose title banner ("Big natural smile"), giant 3-2-1 numerals (scale+fade),
  white flash on capture.
- **analyzing**: chosen photo with a vertical gold scan-line sweep + shimmer,
  rotating micro-copy lines.
- **reveal**: score rings count up (SVG stroke-dashoffset animation), then the
  annotated photo: each observation draws a leader line from its box to a
  label card, staggered 600ms apart. Treatments + headline. After 25s →
  **share** scene: "Your code is on your phone — share your glow ✨" → back to
  attract (frames+photo cleared from screen state).
- QR session rotation: keep current 20-min regen, but pause regen while a
  session is live.

## Phone flow (components/kiosk/* — rebuild KioskSessionFlow)
1. **welcome**: campaign-branded, "takes ~60s".
2. **consent + 18 gate**: two explicit taps — checkbox consent (existing
   wording) AND a separate "I'm 18 or over" button press; stage→consent with
   `ageDeclared:true`.
3. **camera**: `getUserMedia` (user-facing), canvas snapshots. Pose sequence:
   (1) "Big natural smile" (2) "Show us your best side" (3) "Freestyle — strike
   a pose!". Each: stage→posing, stream frames (≈400ms cadence, 480px JPEG
   q0.6), stage→countdown, 3-2-1 overlay, capture full-res (≤1280px) → POST
   /photos, flash, next pose. Skip/retake allowed. Fallback: if getUserMedia
   denied → existing file-input path (single photo, no frames).
4. **review**: thumbnails, "Use these" → POST /analyze, stage analyzing.
5. **analyzing**: poll/SSE for result (reuse polling).
6. **result**: annotated best photo on the phone too (SVG overlay from the
   same annotations), scores, insights, treatments.
7. **share**: fetch `/results/[id]/card` → `navigator.share({ files, text })`
   with caption = shareCaption + " 📍 K Clinics, Islington" + IG handle + share
   URL; fallback buttons (existing ShareButtons). Share unlocks claim
   (existing SHARED gate) → ClaimReward (existing).
8. **declined** (age): warm copy, no result, photos already purged.

## Cleanup & privacy hooks
- `app/api/cron/kiosk-cleanup/route.ts`: also delete `photoUrls[]` blobs +
  null `liveFrame` for expired sessions.
- test-cleanup route: include photoUrls blobs.
- AGE_DECLINED purge happens inline in the AI path (not cron-dependent).

## Attribution
- Claim path already creates Client(source 'kiosk') + campaign-coded promo.
  Add: stamp `ageDeclaredAt→Client.ageDeclaredAt` on claim upsert, and pass
  `?c=skin-smile-ooh` on the share-page claim CTA so lib/attribution.ts tags
  any later booking from that device.

## File ownership (parallel build — do not cross)
- **Agent A (server)**: prisma/schema.prisma, lib/kiosk.ts, lib/kiosk-ai.ts,
  new lib/kiosk-live.ts, all app/api/kiosk/** routes, cron route, share-card
  route.
- **Agent B (display)**: app/kiosk/display/page.tsx,
  components/kiosk/display/** (new dir), KioskDisplay.tsx (may replace).
- **Agent C (phone)**: components/kiosk/KioskSessionFlow.tsx, new
  components/kiosk/capture/**, ResultCard annotations overlay,
  ShareButtons/ClaimReward tweaks, app/kiosk/[token]/page.tsx if needed.
- Shared types: each side types the API JSON locally per this contract (no
  cross-imports of new types until integration).

## Out of scope this PR (board follow-ups)
WebRTC true-video mirror; admin kiosk analytics dashboard; multi-location
sessions; ViPlex on-device validation; printed window vinyl QR fallback;
seasonal scene theming; localisation.
