import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

const VALID = new Set(['GREEN', 'YELLOW', 'RED']);

// BLD-1532: set or clear a client's traffic-light status (GREEN/YELLOW/RED).
// Not clinical data — only clients.edit is required (mirrors the patch-test
// route's shape, minus the clients.clinical.view gate the medical-flag route
// has, per the ticket).
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });

  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!sessionCan(session, 'clients.edit')) {
    return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
  }

  const { clientId, status, reason } = (await req.json().catch(() => ({}))) as {
    clientId?: string;
    status?: string | null;
    reason?: string;
  };
  if (!clientId) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });

  const value = status && VALID.has(status) ? (status as 'GREEN' | 'YELLOW' | 'RED') : null;
  if (status && !value) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
  const note = (reason || '').trim().slice(0, 2000);

  const { db } = await import('@/lib/db');
  const { logAudit } = await import('@/lib/audit');

  await db.client.update({
    where: { id: clientId },
    data: {
      clientStatus: value,
      clientStatusSetBy: value ? session!.email : null,
      clientStatusAt: value ? new Date() : null,
      clientStatusReason: value ? note || null : null,
    },
  });
  await logAudit({
    action: 'CLIENT_STATUS_CHANGED',
    actor: session!.email,
    actorRole: session!.role,
    clientId,
    summary: value ? `Client status set to ${value}` : 'Client status cleared',
  });
  return NextResponse.json({ ok: true });
}
