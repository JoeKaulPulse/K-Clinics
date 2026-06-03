import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession } = await import('@/lib/auth');
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const s = (v: unknown, n: number) => (v ? String(v).slice(0, n) : null);
  const { db } = await import('@/lib/db');
  await db.adminUser.update({
    where: { email: session.email },
    data: {
      ...(b.name ? { name: String(b.name).slice(0, 80) } : {}),
      ...(b.title !== undefined ? { title: s(b.title, 80) } : {}),
      ...(b.credentials !== undefined ? { credentials: s(b.credentials, 160) } : {}),
      ...(b.photoUrl !== undefined ? { photoUrl: s(b.photoUrl, 500) } : {}),
      ...(b.publicPhone !== undefined ? { publicPhone: s(b.publicPhone, 40) } : {}),
      onboardedAt: new Date(),
    },
  });
  return NextResponse.json({ ok: true });
}
