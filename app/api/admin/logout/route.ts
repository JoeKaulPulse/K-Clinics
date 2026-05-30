import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  const { destroySession } = await import('@/lib/auth');
  await destroySession();
  return NextResponse.json({ ok: true });
}
