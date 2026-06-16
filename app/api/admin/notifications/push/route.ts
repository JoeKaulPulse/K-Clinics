import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Web-push subscriptions for the signed-in user. GET returns the VAPID public key
// (+ whether push is configured) so the client can subscribe; POST saves a
// subscription; DELETE removes one.
export async function GET() {
  const { vapidPublicKey, pushConfigured } = await import('@/lib/push');
  return NextResponse.json({ ok: true, enabled: pushConfigured(), publicKey: vapidPublicKey() });
}

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession } = await import('@/lib/auth');
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const endpoint = typeof b?.endpoint === 'string' ? b.endpoint : '';
  const p256dh = b?.keys?.p256dh, auth = b?.keys?.auth;
  if (!endpoint || !p256dh || !auth) return NextResponse.json({ ok: false, error: 'Bad subscription' }, { status: 400 });
  const { db } = await import('@/lib/db');
  // Structural dedup (no @unique per the deploy gate): one row per endpoint.
  await db.pushSubscription.deleteMany({ where: { endpoint } }).catch(() => {});
  await db.pushSubscription.create({ data: { userId: session.sub, endpoint, p256dh: String(p256dh), auth: String(auth), ua: req.headers.get('user-agent')?.slice(0, 200) || null } }).catch(() => {});
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { getSession } = await import('@/lib/auth');
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const endpoint = typeof b?.endpoint === 'string' ? b.endpoint : '';
  if (endpoint) {
    const { db } = await import('@/lib/db');
    await db.pushSubscription.deleteMany({ where: { endpoint, userId: session.sub } }).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
