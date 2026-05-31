import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Quick client lookup for the CRM search box. Requires clients.view.
export async function GET(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, results: [] }, { status: 503 });
  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!sessionCan(session, 'clients.view')) return NextResponse.json({ ok: false, results: [] }, { status: 403 });

  const q = (new URL(req.url).searchParams.get('q') || '').trim();
  if (q.length < 2) return NextResponse.json({ ok: true, results: [] });

  const { db } = await import('@/lib/db');
  const rows = await db.client.findMany({
    where: {
      OR: [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
      ],
    },
    orderBy: { updatedAt: 'desc' },
    take: 8,
    select: { id: true, firstName: true, lastName: true, email: true, medicalFlag: true },
  });

  const results = rows.map((c) => ({
    id: c.id,
    name: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email,
    email: c.email,
    flag: Boolean(c.medicalFlag),
  }));
  return NextResponse.json({ ok: true, results });
}
