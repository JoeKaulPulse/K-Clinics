import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { qrSvg } from '@/lib/qr';
import { randomToken, sessionExpiry } from '@/lib/kiosk';
import { KioskDisplay } from '@/components/kiosk/KioskDisplay';

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
export default async function KioskDisplayPage() {
  const origin = await originFromHeaders();

  // Create a fresh session for this display render.
  let token = randomToken();
  for (let i = 0; i < 5; i++) {
    const clash = await db.kioskSession.findUnique({ where: { token }, select: { id: true } });
    if (!clash) break;
    token = randomToken();
  }
  await db.kioskSession.create({ data: { token, status: 'ACTIVE', expiresAt: sessionExpiry() } }).catch(() => {});

  const url = `${origin}/kiosk/${token}`;
  const svg = await qrSvg(url, { dark: '#2a2420', light: '#ffffff' });

  return <KioskDisplay svg={svg} url={url} />;
}
