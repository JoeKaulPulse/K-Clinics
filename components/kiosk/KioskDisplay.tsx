'use client';

import { useEffect, useRef, useState } from 'react';
import { useKioskChannel } from './display/useKioskChannel';
import type { KioskLivePayload } from './display/types';
import { AttractScene } from './display/AttractScene';
import { PairedScene } from './display/PairedScene';
import { MirrorScene } from './display/MirrorScene';
import { AnalyzingScene } from './display/AnalyzingScene';
import { RevealScene } from './display/RevealScene';
import { ShareScene } from './display/ShareScene';
import { GoldParticles } from './display/GoldParticles';
import { BrandCorner, CornerBadge } from './display/CornerBadge';
import './display/kiosk-display.css';

// ── Storefront display orchestrator ──────────────────────────────────────────
// Scene = f(live channel payload) + local pacing for the reveal→share→reset
// tail. The page mints one session per render; we reload to mint a fresh one,
// but NEVER while a phone is mid-session (the token is their link to us).
//
// Hardware: Novastar Taurus Android WebView — everything below is CSS/SVG only
// (see kiosk-display.css header).

const REGEN_MS = 20 * 60 * 1000; // mint a fresh QR/session when idle this long
const REVEAL_MS = 25_000;        // how long the annotated reveal holds
const SHARE_MS = 12_000;         // "share your glow" outro before reset
const DECLINED_MS = 9_000;       // warm 18+ decline hold, then fresh session

type SceneKind =
  | 'attract' | 'paired' | 'consent' | 'mirror' | 'review'
  | 'analyzing' | 'reveal' | 'share' | 'declined' | 'failed';

/** Map the live payload onto a scene, before local reveal/share pacing. */
function sceneFor(p: KioskLivePayload | null): SceneKind {
  if (!p) return 'attract';
  switch (p.stage) {
    case 'paired': return 'paired';
    case 'consent': return 'consent';
    case 'posing':
    case 'countdown':
    case 'captured': return 'mirror';
    case 'review': return 'review';
    case 'analyzing': return 'analyzing';
    case 'reveal':
    case 'shared':
    case 'done': return p.result ? 'reveal' : 'analyzing';
    case 'declined': return 'declined';
    case 'failed': return 'failed';
    default: return 'attract'; // idle / expired / unknown
  }
}

export function KioskDisplay({ svg, token, secret }: { svg: string; url?: string; token: string; secret?: string }) {
  const { payload } = useKioskChannel(token, secret);
  const [remaining, setRemaining] = useState(REGEN_MS);
  // The reveal tail is locally paced: reveal → share outro → reload (fresh
  // session). Timestamps, not timers, so re-renders can't double-fire.
  const revealAtRef = useRef<number | null>(null);
  const declinedAtRef = useRef<number | null>(null);
  const [, forceTick] = useState(0);

  const base = sceneFor(payload);

  // Stamp pacing anchors on first entry to terminal scenes.
  if (base === 'reveal' && revealAtRef.current === null) revealAtRef.current = Date.now();
  if (base === 'declined' && declinedAtRef.current === null) declinedAtRef.current = Date.now();

  let scene: SceneKind = base;
  if (base === 'reveal' && revealAtRef.current !== null && Date.now() - revealAtRef.current > REVEAL_MS) {
    scene = 'share';
  }

  // One heartbeat drives the regen countdown, reveal pacing and resets.
  useEffect(() => {
    const started = Date.now();
    const tick = setInterval(() => {
      const left = REGEN_MS - (Date.now() - started);
      setRemaining(Math.max(0, left));
      forceTick((n) => n + 1); // re-evaluate the paced scenes

      const live = revealAtRef.current !== null || declinedAtRef.current !== null;
      const idle = sigStageRef.current === 'attract';
      // Reset to a fresh session when: the share outro finished, a decline
      // finished its hold, or the QR aged out while nobody was engaged.
      if (revealAtRef.current !== null && Date.now() - revealAtRef.current > REVEAL_MS + SHARE_MS) window.location.reload();
      if (declinedAtRef.current !== null && Date.now() - declinedAtRef.current > DECLINED_MS) window.location.reload();
      if (left <= 0 && idle && !live) window.location.reload();
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  // The interval reads the current scene through a ref (it closes over nothing).
  const sigStageRef = useRef<SceneKind>('attract');
  sigStageRef.current = scene;

  const lastPhoto = payload?.photoUrls?.length ? payload.photoUrls[payload.photoUrls.length - 1] : null;

  return (
    <main className="kd-stage" aria-label="K Clinics Skin and Smile kiosk display">
      {/* Ambient layer — present in every scene */}
      <div aria-hidden className="kd-shimmer" />
      <GoldParticles />
      <div aria-hidden className="kd-vignette" />

      {/* Active scene (keyed so enter animation replays per scene change) */}
      <div key={scene} className="kd-scene kd-scene-enter">
        {scene === 'attract' && <AttractScene svg={svg} remainingMs={remaining} />}
        {scene === 'paired' && (
          <PairedScene headline={<>Hello you <span className="text-gold-shimmer">✨</span></>} sub="Your session is live — eyes on your phone." />
        )}
        {scene === 'consent' && (
          <PairedScene eyebrow="Almost there" headline="A quick yes from you" sub="Confirm you're 18+ and happy for our AI to read your glow — it's all on your phone." />
        )}
        {scene === 'mirror' && (
          <MirrorScene
            stage={payload?.stage === 'countdown' ? 'countdown' : payload?.stage === 'captured' ? 'captured' : 'posing'}
            poseIdx={payload?.poseIdx ?? 0}
            frame={payload?.frame ?? null}
          />
        )}
        {scene === 'review' && (
          <PairedScene eyebrow="Looking good" headline="Picking the keepers…" sub="Choose your favourite shots on your phone." />
        )}
        {scene === 'analyzing' && <AnalyzingScene photo={lastPhoto} />}
        {scene === 'reveal' && payload?.result && (
          <RevealScene result={payload.result} photoUrls={payload.photoUrls ?? []} />
        )}
        {scene === 'share' && <ShareScene variant="share" />}
        {scene === 'declined' && (
          <PairedScene eyebrow="Thank you" headline="This one's for the grown-ups" sub="Our treatments are 18+ only, so we didn't run a reading — and your photos were deleted straight away. Come say hello inside!" />
        )}
        {scene === 'failed' && (
          <PairedScene eyebrow="One more try" headline="That photo was camera-shy" sub="We couldn't quite read it — have another go on your phone. Better light works wonders." />
        )}
      </div>

      {/* Corner chrome: brand always; "one at a time" badge during live sessions */}
      <BrandCorner />
      {scene !== 'attract' && <CornerBadge />}
    </main>
  );
}
