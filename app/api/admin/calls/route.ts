import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Call log + click-to-dial. Records themselves are immutable (created only by
// the yay webhook); staff may add a free-text note and place outbound calls.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('calls.view');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');

  switch (b.op) {
    case 'list': {
      const where = b.filter === 'inbound' ? { direction: 'INBOUND' as const }
        : b.filter === 'outbound' ? { direction: 'OUTBOUND' as const }
        : b.filter === 'missed' ? { status: { in: ['missed', 'no-answer', 'busy', 'failed'] } }
        : {};
      const rows = await db.callRecord.findMany({
        where, orderBy: { startedAt: 'desc' }, take: 100,
        include: { matchedClient: { select: { id: true, firstName: true, lastName: true } }, matchedSupplier: { select: { id: true, name: true } } },
      });
      return NextResponse.json({ ok: true, calls: rows.map((c) => ({
        id: c.id, direction: c.direction, fromNumber: c.fromNumber, toNumber: c.toNumber,
        status: c.status, startedAt: c.startedAt.toISOString(), durationSec: c.durationSec,
        recordingUrl: c.recordingUrl, transcriptStatus: c.transcriptStatus, hasTranscript: !!c.transcript,
        matchType: c.matchType, matchedLabel: c.matchedLabel,
        client: c.matchedClient ? { id: c.matchedClient.id, name: [c.matchedClient.firstName, c.matchedClient.lastName].filter(Boolean).join(' ') } : null,
        supplier: c.matchedSupplier ? { id: c.matchedSupplier.id, name: c.matchedSupplier.name } : null,
        agentEmail: c.agentEmail, notes: c.notes,
      })) });
    }
    case 'get': {
      if (!b.id) return NextResponse.json({ ok: false }, { status: 400 });
      const c = await db.callRecord.findUnique({
        where: { id: String(b.id) },
        include: { matchedClient: { select: { id: true, firstName: true, lastName: true } }, matchedSupplier: { select: { id: true, name: true } } },
      });
      if (!c) return NextResponse.json({ ok: false }, { status: 404 });
      return NextResponse.json({ ok: true, call: {
        ...c, startedAt: c.startedAt.toISOString(), answeredAt: c.answeredAt?.toISOString() ?? null,
        endedAt: c.endedAt?.toISOString() ?? null, createdAt: c.createdAt.toISOString(), raw: undefined,
        client: c.matchedClient ? { id: c.matchedClient.id, name: [c.matchedClient.firstName, c.matchedClient.lastName].filter(Boolean).join(' ') } : null,
        supplier: c.matchedSupplier ? { id: c.matchedSupplier.id, name: c.matchedSupplier.name } : null,
      } });
    }
    case 'note': {
      const manage = await requirePermission('calls.manage');
      if (!manage) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
      if (!b.id) return NextResponse.json({ ok: false }, { status: 400 });
      await db.callRecord.update({ where: { id: String(b.id) }, data: { notes: String(b.notes || '').slice(0, 2000) || null } });
      return NextResponse.json({ ok: true });
    }
    case 'dial': {
      const manage = await requirePermission('calls.manage');
      if (!manage) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
      const to = String(b.to || '').trim();
      if (!to) return NextResponse.json({ ok: false, error: 'No number to dial.' }, { status: 400 });
      const { clickToCall } = await import('@/lib/yay');
      // Agent = the staff member's yay extension (set on their profile) or the
      // extension passed from the client; falls back to their email handle.
      const agent = String(b.agent || session.email);
      const res = await clickToCall({ agent, to });
      return NextResponse.json(res, { status: res.ok ? 200 : 400 });
    }
  }
  return NextResponse.json({ ok: false, error: 'Unknown op' }, { status: 400 });
}
