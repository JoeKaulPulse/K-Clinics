import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  const { destroyAcademySession } = await import('@/lib/auth');
  await destroyAcademySession();
  return NextResponse.json({ ok: true });
}
