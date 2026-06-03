import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent();
  if (!student) return NextResponse.json({ ok: false }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');
  await db.academyStudent.update({
    where: { id: student.id },
    data: { ...(b.goals !== undefined ? { goals: b.goals ? String(b.goals).slice(0, 1000) : null } : {}), onboardedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
