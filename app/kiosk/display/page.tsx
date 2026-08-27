import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { qrSvg } from '@/lib/qr';
import { randomToken, randomSecret, sessionExpiry } from '@/lib/kiosk';
import { KioskDisplay } from '@/components/kiosk/KioskDisplay';
import { KioskUnavailable } from '@/components/kiosk/KioskUnavailable';
import { getStringSetting } from '@/lib/settings';
import { KIOSK_THEME_DEFAULT, isKioskThemeKey, type KioskThemeKey } from '@/lib/kiosk-themes';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'KClinics — Skin & Smile Kiosk',
  robots: { index: false, follow: false },
};

async function originFromHeaders(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host') || 'kclinics.co.uk';
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
  return `${proto}://${host}`;
}

// Storefront full-screen display: shows a large QR that opens a fresh mobile
// session. Auto-regenerates every 20 minutes (client-side reload triggers a new
// session). No auth — this is the screen on the storefront device.
//
// BLD-137 slice 2: pass ?location=<slug> to attribute sessions to a specific
// site (e.g. /kiosk/display?location=islington).
export default async function KioskDisplayPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const origin = await originFromHeaders();
  const { location: locationSlug } = await searchParams;

  // BLD-137: read the active seasonal theme from settings (falls back to default).
  const rawTheme = await getStringSetting('kiosk_theme', KIOSK_THEME_DEFAULT);
  const theme: KioskThemeKey = isKioskThemeKey(rawTheme) ? rawTheme : KIOSK_THEME_DEFAULT;

  // BLD-137 slice 2: resolve the locationId from slug for attribution.
  let locationId: string | undefined;
  if (locationSlug) {
    const loc = await db.location.findUnique({ where: { slug: locationSlug }, select: { id: true } });
    locationId = loc?.id;
  }

  // Create a fresh session for this display render.
  let token = randomToken();
  for (let i = 0; i < 5; i++) {
    const clash = await db.kioskSession.findUnique({ where: { token }, select: { id: true } });
    if (!clash) break;
    token = randomToken();
  }
  // BLD-159: a capability secret travels in the QR (?s=) — not in the brute-
  // forceable token — and gates the live camera feed (/stream, /frame).
  const secret = randomSecret();

  // BLD-1535: the write used to be a bare `.catch(() => {})` — a transient DB
  // blip (Neon resume, pool exhaustion) left the unattended storefront screen
  // showing a QR that would 404 for every visitor who scanned it, with
  // nothing logged and no staff-visible signal. Retry once (a short blip is
  // often gone a beat later), and if both attempts fail, capture to Sentry and
  // render the calm unavailable state below instead of a dead QR. The page is
  // force-dynamic and self-reloads (see KioskDisplay's REGEN_MS / kd countdown
  // and KioskUnavailable's own shorter retry), so the next request tries this
  // same create fresh — this isn't a state that can get stuck.
  const sessionData = { token, secret, status: 'ACTIVE' as const, expiresAt: sessionExpiry(), ...(locationId ? { locationId } : {}) };
  let sessionCreated = false;
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await db.kioskSession.create({ data: sessionData });
      sessionCreated = true;
      break;
    } catch (e) {
      lastError = e;
      console.error(`[kiosk] display session create failed (attempt ${attempt}/2):`, (e as Error)?.message);
      if (attempt === 1) await new Promise((r) => setTimeout(r, 300));
    }
  }
  if (!sessionCreated) {
    Sentry.captureException(lastError, { tags: { area: 'kiosk-display-session-create' } });
    return <KioskUnavailable theme={theme} />;
  }

  const url = `${origin}/kiosk/${token}?s=${secret}`;
  const svg = await qrSvg(url, { dark: '#2a2420', light: '#ffffff' });

  return <KioskDisplay svg={svg} url={url} token={token} secret={secret} theme={theme} />;
}
