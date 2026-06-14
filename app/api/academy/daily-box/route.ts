import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Open today's beauty box (Duolingo-style chest) for the signed-in trainee.
export async function POST() {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });
  const { openDailyBox } = await import('@/lib/academy-daily');
  const res = await openDailyBox(student.id);
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
