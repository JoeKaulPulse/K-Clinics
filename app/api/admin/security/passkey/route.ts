import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// List or remove the owner's export passkeys (OWNER only).
export async function GET() {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession } = await import('@/lib/auth');
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'Sign in first.' }, { status: 403 });
  const { db } = await import('@/lib/db');
  const passkeys = await db.webAuthnCredential.findMany({ where: { adminUserId: session.sub }, select: { id: true, deviceName: true, createdAt: true, lastUsedAt: true }, orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ ok: true, passkeys });
}

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession } = await import('@/lib/auth');
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'Sign in first.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (body.op !== 'remove' || !body.id) return NextResponse.json({ ok: false, error: 'Bad request.' }, { status: 400 });
  const { db } = await import('@/lib/db');
  await db.webAuthnCredential.deleteMany({ where: { id: String(body.id), adminUserId: session.sub } });
  return NextResponse.json({ ok: true });
}
