'use client';

import React, { useEffect } from 'react';
import { PairedScene } from './display/PairedScene';
import { GoldParticles } from './display/GoldParticles';
import { BrandCorner } from './display/CornerBadge';
import { getKioskThemeMeta, type KioskThemeKey } from '@/lib/kiosk-themes';
import './display/kiosk-display.css';

// BLD-1535: rendered by app/kiosk/display/page.tsx in place of KioskDisplay
// when both session-create attempts fail (Neon resume, pool exhaustion, etc).
// Reuses the same stage chrome (kd-stage/kd-shimmer/kd-vignette, GoldParticles,
// BrandCorner) and the existing PairedScene copy block — no new styling
// primitives — but skips useKioskChannel entirely: there is no token to poll,
// and CornerBadge's "one at a time" copy is specific to a live session, so it
// is deliberately omitted here.
//
// This page is `force-dynamic`, so a plain reload is a fresh request that
// re-runs the session-create attempt server-side from scratch — the retry
// below can't get stuck showing a stale unavailable state once the DB
// recovers. RETRY_MS is far shorter than KioskDisplay's healthy 20-minute
// regen cycle so an outage doesn't leave the storefront dark for that long.
const RETRY_MS = 60_000;

export function KioskUnavailable({ theme = 'default' }: { theme?: KioskThemeKey }) {
  const themeMeta = getKioskThemeMeta(theme);

  useEffect(() => {
    const t = setTimeout(() => window.location.reload(), RETRY_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <main
      className="kd-stage"
      aria-label="K Clinics Skin and Smile kiosk display"
      style={Object.keys(themeMeta.stageVars).length > 0 ? (themeMeta.stageVars as React.CSSProperties) : undefined}
    >
      <div aria-hidden className="kd-shimmer" />
      <GoldParticles />
      <div aria-hidden className="kd-vignette" />

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        Kiosk temporarily unavailable — please check back shortly
      </div>

      <div className="kd-scene kd-scene-enter">
        <PairedScene
          eyebrow="One moment"
          headline="We're just recalibrating"
          sub="This screen will be back shortly — thanks for your patience."
        />
      </div>

      <BrandCorner />
    </main>
  );
}
