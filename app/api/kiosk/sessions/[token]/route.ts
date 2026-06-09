import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public status endpoint the mobile client polls. Returns the current status
// and the result id once analysis is done. Expires sessions past their TTL.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await db.kioskSession.findUnique({
    where: { token },
    include: { result: { select: { id: true } } },
  });
  if (!session) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

  // Lazily expire stale sessions (unless they already finished).
  let status = session.status;
  const finished = status === 'ANALYZED' || status === 'SHARED';
  if (!finished && session.expiresAt < new Date()) {
    if (status !== 'EXPIRED') {
      await db.kioskSession.update({ where: { id: session.id }, data: { status: 'EXPIRED' } }).catch(() => {});
    }
    status = 'EXPIRED';
  }

  return NextResponse.json({ ok: true, status, resultId: session.result?.id ?? null });
}
