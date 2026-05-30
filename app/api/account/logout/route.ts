import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  const { destroyClientSession } = await import('@/lib/auth');
  await destroyClientSession();
  return NextResponse.json({ ok: true });
}
