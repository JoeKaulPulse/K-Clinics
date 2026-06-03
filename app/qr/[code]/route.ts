import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { site } from '@/lib/site';
import { crmEnabled } from '@/lib/crm';

// Public QR endpoint: /qr/{code} → 302 to the code's current destination.
// The scan is logged after the response so the redirect stays instant. Unknown
// or disabled codes fall back to the homepage so a printed code never dead-ends.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const home = new URL('/', site.url);
  if (!crmEnabled || !code) return NextResponse.redirect(home, 302);

  try {
    const { db } = await import('@/lib/db');
    const qr = await db.qrCode.findUnique({ where: { code }, select: { id: true, destination: true, active: true } });
    if (!qr || !qr.active || !qr.destination) return NextResponse.redirect(home, 302);

    // Log the scan without blocking the redirect.
    const ua = req.headers.get('user-agent');
    const referer = req.headers.get('referer');
    const country = req.headers.get('x-vercel-ip-country') || req.headers.get('cf-ipcountry');
    after(async () => {
      try {
        const { deviceFromUa } = await import('@/lib/qr');
        await db.$transaction([
          db.qrScan.create({ data: { qrCodeId: qr.id, device: deviceFromUa(ua), referer: referer?.slice(0, 300) ?? null, country: country?.slice(0, 2) ?? null, userAgent: ua?.slice(0, 300) ?? null } }),
          db.qrCode.update({ where: { id: qr.id }, data: { scanCount: { increment: 1 } } }),
        ]);
      } catch { /* analytics best-effort — never affects the redirect */ }
    });

    // Resolve whatever the admin entered: absolute URL, site-relative path
    // (/offers), or a bare domain (example.com).
    const raw = qr.destination.trim();
    let dest: string;
    if (/^https?:\/\//i.test(raw)) dest = raw;
    else if (raw.startsWith('/')) dest = new URL(raw, site.url).toString();
    else dest = `https://${raw}`;
    return NextResponse.redirect(dest, 302);
  } catch {
    return NextResponse.redirect(home, 302);
  }
}
