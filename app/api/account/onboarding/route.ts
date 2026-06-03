import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

const GENDERS = ['FEMALE', 'MALE', 'NON_BINARY', 'OTHER', 'PREFER_NOT_TO_SAY'];

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getCurrentClient } = await import('@/lib/client-auth');
  const client = await getCurrentClient();
  if (!client) return NextResponse.json({ ok: false }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');
  await db.client.update({
    where: { id: client.id },
    data: {
      ...(b.phone ? { phone: String(b.phone).slice(0, 40) } : {}),
      ...(b.gender && GENDERS.includes(b.gender) ? { gender: b.gender } : {}),
      ...(Array.isArray(b.concerns) ? { concerns: b.concerns.map((c: string) => String(c).slice(0, 60)).slice(0, 12) } : {}),
      ...(typeof b.smsReminders === 'boolean' ? { smsReminders: b.smsReminders } : {}),
      ...(typeof b.marketingOptIn === 'boolean' ? { marketingOptIn: b.marketingOptIn } : {}),
      onboardedAt: new Date(),
    },
  });
  return NextResponse.json({ ok: true });
}
