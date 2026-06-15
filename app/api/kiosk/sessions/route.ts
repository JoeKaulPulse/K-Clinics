import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clientIp, hashIp, randomToken, randomSecret, sessionExpiry } from '@/lib/kiosk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public, no auth. Creates a short-lived kiosk session for a scanned QR.
// Anti-abuse: max 3 sessions per IP per day AND max 5 per IP per hour.
const MAX_PER_DAY = 3;
const MAX_PER_HOUR = 5;

export async function POST(req: Request) {
  const ipHash = hashIp(clientIp(req));

  if (ipHash) {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [perDay, perHour] = await Promise.all([
      db.kioskSession.count({ where: { ipHash, createdAt: { gte: dayAgo } } }),
      db.kioskSession.count({ where: { ipHash, createdAt: { gte: hourAgo } } }),
    ]);
    if (perDay >= MAX_PER_DAY || perHour >= MAX_PER_HOUR) {
      return NextResponse.json(
        { ok: false, error: 'Too many sessions from this device. Please try again later.' },
        { status: 429 },
      );
    }
  }

  // Generate a unique token (retry on the rare collision).
  let token = randomToken();
  for (let i = 0; i < 5; i++) {
    const clash = await db.kioskSession.findUnique({ where: { token }, select: { id: true } });
    if (!clash) break;
    token = randomToken();
  }
  const secret = randomSecret(); // BLD-159: gates the live camera feed

  await db.kioskSession.create({
    data: { token, secret, ipHash, status: 'ACTIVE', expiresAt: sessionExpiry() },
  });

  return NextResponse.json({ ok: true, token, secret });
}
