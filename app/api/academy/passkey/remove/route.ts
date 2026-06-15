import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Remove one of the signed-in trainee's own passkeys.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ ok: false, error: 'Missing id.' }, { status: 400 });
  const { db } = await import('@/lib/db');
  await db.studentPasskey.deleteMany({ where: { id: String(id), studentId: student.id } });
  return NextResponse.json({ ok: true });
}
